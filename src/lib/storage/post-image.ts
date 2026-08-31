import { deleteObject, getDownloadURL, ref, uploadBytes } from "firebase/storage";

import { auth, storage } from "@/lib/firebase/client";

/** Subida de las imágenes de las publicaciones a Firebase Storage.
 *
 *  Corre en el navegador. El compositor pasa el `File`, este módulo lo
 *  **comprime fuerte** en un `<canvas>` y sube el resultado a
 *  `trapnexport-post/`; por la Server Action `publishPost` viaja sólo la
 *  `downloadURL` más la ruta del archivo (para poder borrarlo después). El
 *  original nunca sale del dispositivo.
 *
 *  Es el equivalente para posts de lo que `lib/media-upload.ts` hace para
 *  avatares y carrete mientras esos sigan sin Storage: ahí el destino es un
 *  data-URI dentro del body de la action; acá es el bucket.
 */

/** Carpeta del bucket. Misma convención de nombres que las colecciones de
 *  Firestore del proyecto (`trapnexport-user`, `trapnexport-jugador`). */
const CARPETA = "trapnexport-post";

/** Lado largo al que se baja la imagen antes de subirla. 1280 px llena una
 *  tarjeta de feed a pantalla completa en un teléfono retina y recorta a menos
 *  de la mitad el peso de una foto de 2500–4000 px. */
const MAX_EDGE = 1280;

/** Calidad de compresión. WebP a 0.7 deja una foto de celular en 80–160 KB
 *  —una fracción del original— sin artefactos visibles a tamaño de feed. El
 *  JPEG de respaldo (navegadores que no codifican WebP en canvas) va un punto
 *  más alto porque a igual número comprime peor. */
const WEBP_QUALITY = 0.7;
const JPEG_QUALITY = 0.72;

/** Tope del archivo de ENTRADA: un archivo enorme hay que decodificarlo entero
 *  en memoria antes de reescalarlo, y ahí es donde revienta una pestaña de
 *  celular, no en la subida. */
const MAX_INPUT_BYTES = 25 * 1024 * 1024;

export interface UploadedPostImage {
  /** `downloadURL` pública: es lo que se guarda en el post y renderiza el `<img>` */
  src: string;
  /** ruta dentro del bucket (`trapnexport-post/{uid}/…`), para borrar el archivo
   *  cuando se quita la foto o se elimina el post */
  path: string;
  /** peso final subido, en bytes */
  size: number;
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
 *  perdería el alfa y sin el relleno WebP/JPEG lo pintan de negro. Para fotos de
 *  feed no importa; un PNG con transparencia real no es lo que el compositor
 *  busca subir. */
async function comprimir(
  file: File,
): Promise<{ blob: Blob; ext: "webp" | "jpg"; contentType: string }> {
  const img = await loadImage(file);

  const lado = Math.max(img.naturalWidth, img.naturalHeight) || 1;
  const escala = Math.min(1, MAX_EDGE / lado);
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
    return { blob: webp, ext: "webp", contentType: "image/webp" };
  }
  const jpeg = await toBlob(canvas, "image/jpeg", JPEG_QUALITY);
  if (jpeg) return { blob: jpeg, ext: "jpg", contentType: "image/jpeg" };

  throw new Error("No se pudo comprimir la imagen.");
}

const nombreAzar = (ext: string) =>
  `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}.${ext}`;

/** Comprime `file` y lo sube a `trapnexport-post/`. Devuelve la URL pública y la
 *  ruta en el bucket. Lanza si no es una imagen, si se pasa del tope de entrada
 *  o si la subida falla. */
export async function uploadPostImage(file: File): Promise<UploadedPostImage> {
  if (!file.type.startsWith("image/")) {
    throw new Error("Ese archivo no es una imagen.");
  }
  if (file.size > MAX_INPUT_BYTES) {
    throw new Error("La imagen es demasiado pesada. Probá con una más liviana.");
  }

  const { blob, ext, contentType } = await comprimir(file);

  // El `uid` sólo ordena los archivos por dueño y acota el destino; no es un
  // control de acceso (de eso se ocupa `storage.rules`). Sin sesión de Firebase
  // —el feed corre sobre la cuenta semilla— van a `anon/`.
  const uid = auth.currentUser?.uid ?? "anon";
  const path = `${CARPETA}/${uid}/${nombreAzar(ext)}`;
  const objeto = ref(storage, path);

  await uploadBytes(objeto, blob, {
    contentType,
    // Los archivos son inmutables (nombre al azar por subida): que el navegador
    // y el CDN los cacheen para siempre.
    cacheControl: "public, max-age=31536000, immutable",
  });

  return { src: await getDownloadURL(objeto), path, size: blob.size };
}

/** Borra un archivo subido. Best-effort: si ya no está —o las reglas no dejan—
 *  no es un error que deba frenar nada, sólo queda un huérfano en el bucket. */
export async function deletePostImage(path: string): Promise<void> {
  try {
    await deleteObject(ref(storage, path));
  } catch {
    /* el archivo ya no existe o no se pudo borrar; se ignora a propósito */
  }
}
