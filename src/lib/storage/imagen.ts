import { deleteObject, getDownloadURL, ref, uploadBytes } from "firebase/storage";

import { auth, storage } from "@/lib/firebase/client";

/** Subida de imágenes a Firebase Storage, comprimidas en el navegador.
 *
 *  Es el motor común de las dos superficies que suben fotos de verdad:
 *  `post-image.ts` (el compositor del feed) y el panel de la historia del club
 *  (`/admin/historia`, vía `ImageField`). Las dos hacen lo mismo —reescalar en
 *  un `<canvas>`, subir el blob, guardar la `downloadURL`— y lo único que
 *  cambia entre ellas es la carpeta del bucket y qué tan agresiva es la
 *  compresión: una foto de feed se mira a 400 px de ancho en un teléfono, y la
 *  portada de una temporada ocupa la pantalla entera.
 *
 *  El original nunca sale del dispositivo: por la Server Action viaja sólo la
 *  URL pública más la ruta del archivo, para poder borrarlo después.
 *
 *  Es distinto de `lib/media-upload.ts`, que sigue existiendo para avatares y
 *  carrete: aquéllos mandan un data-URI dentro del body de la action porque su
 *  destino es un documento de Firestore, no el bucket.
 */

/** Tope del archivo de ENTRADA: un archivo enorme hay que decodificarlo entero
 *  en memoria antes de reescalarlo, y ahí es donde revienta una pestaña de
 *  celular, no en la subida. */
const MAX_INPUT_BYTES = 25 * 1024 * 1024;

/** Calidad de compresión. WebP a 0.7 deja una foto de celular en 80–160 KB sin
 *  artefactos visibles. El JPEG de respaldo (navegadores que no codifican WebP
 *  en canvas) va un punto más alto porque a igual número comprime peor. */
const WEBP_QUALITY = 0.7;
const JPEG_QUALITY = 0.72;

export interface ImagenSubida {
  /** `downloadURL` pública: es lo que se guarda y lo que renderiza el `<img>` */
  src: string;
  /** ruta dentro del bucket, para borrar el archivo cuando se lo reemplaza */
  path: string;
  /** peso final subido, en bytes */
  size: number;
}

/** Lo que devuelve `subirImagen`: lo de arriba más las medidas del archivo ya
 *  reescalado.
 *
 *  Va en un tipo aparte y no como campos opcionales de `ImagenSubida` porque
 *  `subirArchivo` no puede darlas —sube sin decodificar, que es todo el punto de
 *  esa función— y un `width?: number` obligaría a cada consumidor a contemplar
 *  un caso que en su camino no existe. Quien las necesita de verdad es el chat:
 *  ver `MensajeImagenDoc`. */
export interface ImagenComprimidaSubida extends ImagenSubida {
  width: number;
  height: number;
}

const loadImage = (file: File): Promise<HTMLImageElement> =>
  new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("No se pudo abrir la imagen."));
    };
    img.src = url;
  });

const toBlob = (canvas: HTMLCanvasElement, type: string, quality: number): Promise<Blob | null> =>
  new Promise((resolve) => canvas.toBlob(resolve, type, quality));

/** Reescala en `<canvas>` y devuelve el blob comprimido, WebP si el navegador
 *  lo codifica y JPEG si no.
 *
 *  El canvas se rellena de blanco antes de dibujar: un PNG con transparencia
 *  perdería el alfa y sin el relleno WebP/JPEG lo pintan de negro. Para fotos
 *  no importa; un PNG con transparencia real —un escudo, por ejemplo— conviene
 *  referenciarlo por URL en vez de subirlo por acá. */
export async function comprimirImagen(
  file: File,
  maxEdge: number,
): Promise<{
  blob: Blob;
  ext: "webp" | "jpg";
  contentType: string;
  /** medidas del resultado, no del original */
  width: number;
  height: number;
}> {
  const img = await loadImage(file);

  const lado = Math.max(img.naturalWidth, img.naturalHeight) || 1;
  const escala = Math.min(1, maxEdge / lado);
  const w = Math.max(1, Math.round(img.naturalWidth * escala));
  const h = Math.max(1, Math.round(img.naturalHeight * escala));

  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("El navegador no dejó procesar la imagen.");
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, w, h);
  ctx.drawImage(img, 0, 0, w, h);

  const webp = await toBlob(canvas, "image/webp", WEBP_QUALITY);
  // `toBlob` con un tipo no soportado cae silenciosamente a PNG: si el blob no
  // salió como WebP, no sirve y se va al JPEG.
  if (webp && webp.type === "image/webp") {
    return { blob: webp, ext: "webp", contentType: "image/webp", width: w, height: h };
  }
  const jpeg = await toBlob(canvas, "image/jpeg", JPEG_QUALITY);
  if (jpeg) return { blob: jpeg, ext: "jpg", contentType: "image/jpeg", width: w, height: h };

  throw new Error("No se pudo comprimir la imagen.");
}

const nombreAzar = (ext: string) =>
  `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}.${ext}`;

/** Comprime `file` y lo sube a `carpeta/`. Devuelve la URL pública y la ruta en
 *  el bucket. Lanza si no es una imagen, si se pasa del tope de entrada o si la
 *  subida falla.
 *
 *  `porUsuario` mete un segmento con el uid entre la carpeta y el archivo. Sólo
 *  ordena los archivos por dueño y acota el destino; no es un control de acceso
 *  (de eso se ocupa `storage.rules`). */
export async function subirImagen(
  file: File,
  { carpeta, maxEdge, porUsuario = false }: {
    carpeta: string;
    maxEdge: number;
    porUsuario?: boolean;
  },
): Promise<ImagenComprimidaSubida> {
  if (!file.type.startsWith("image/")) {
    throw new Error("Ese archivo no es una imagen.");
  }
  if (file.size > MAX_INPUT_BYTES) {
    throw new Error("La imagen es demasiado pesada. Probá con una más liviana.");
  }

  const { blob, ext, contentType, width, height } = await comprimirImagen(file, maxEdge);

  const uid = auth.currentUser?.uid ?? "anon";
  const path = [carpeta, porUsuario ? uid : null, nombreAzar(ext)]
    .filter(Boolean)
    .join("/");
  const objeto = ref(storage, path);

  await uploadBytes(objeto, blob, {
    contentType,
    // Los archivos son inmutables (nombre al azar por subida): que el navegador
    // y el CDN los cacheen para siempre.
    cacheControl: "public, max-age=31536000, immutable",
  });

  return { src: await getDownloadURL(objeto), path, size: blob.size, width, height };
}

/** Sube un archivo **tal cual**, sin comprimirlo ni mirarle el tipo.
 *
 *  Existe para el video del carrete. Un video no se puede recomprimir en el
 *  navegador sin traer un transcoder entero, así que lo único que se puede hacer
 *  es acotarlo por tamaño —y eso lo decide quien llama, que sabe de qué se
 *  trata—. Para imágenes está `subirImagen`, que sí comprime: usar ésta con una
 *  foto de celular sube ocho megas al bucket.
 */
export async function subirArchivo(
  file: File,
  { carpeta, porUsuario = false }: { carpeta: string; porUsuario?: boolean },
): Promise<ImagenSubida> {
  const uid = auth.currentUser?.uid ?? "anon";
  const ext = file.name.split(".").pop()?.toLowerCase().slice(0, 5) || "bin";
  const path = [carpeta, porUsuario ? uid : null, nombreAzar(ext)].filter(Boolean).join("/");
  const objeto = ref(storage, path);

  await uploadBytes(objeto, file, {
    contentType: file.type || "application/octet-stream",
    cacheControl: "public, max-age=31536000, immutable",
  });

  return { src: await getDownloadURL(objeto), path, size: file.size };
}

/** Borra un archivo subido. Best-effort: si ya no está —o las reglas no dejan—
 *  no es un error que deba frenar nada, sólo queda un huérfano en el bucket. */
export async function borrarImagen(path: string): Promise<void> {
  try {
    await deleteObject(ref(storage, path));
  } catch {
    /* el archivo ya no existe o no se pudo borrar; se ignora a propósito */
  }
}
