/** Subida de archivos desde el navegador, mientras no hay storage.
 *
 *  Todo termina en un data-URI que viaja por una Server Action hasta el store
 *  en memoria. Eso impone dos límites que no existirían con un bucket, y este
 *  módulo existe para respetarlos sin que cada pantalla los repita:
 *
 *  1. Una Server Action tiene tope de body (`serverActions.bodySizeLimit` en
 *     `next.config.ts`). Una foto de celular son 4–8 MB y no pasa.
 *  2. Base64 infla el archivo un 33% más.
 *
 *  Por eso las imágenes se reescalan en un `<canvas>` antes de salir —lado
 *  largo a 1600px y JPEG de calidad 0.82, que deja una foto de celular en
 *  200–400 KB— y los videos sólo se validan por tamaño: no hay forma de
 *  recomprimir video en el navegador sin traer un transcoder.
 *
 *  Cuando entre Firebase Storage, `readImage`/`readVideo` pasan a hacer
 *  `uploadBytes` y a devolver la `downloadURL`. Las firmas no cambian: los
 *  componentes ya reciben un string y no saben si es data-URI o URL.
 */

/** Lado largo al que se reescalan las fotos antes de subirlas. */
const MAX_EDGE = 1600;

/** Tope de video, ANTES de base64. Con el 33% de base64 encima queda cerca de
 *  los 10 MB de `bodySizeLimit`; subirlo acá sin subirlo allá da un 413. */
export const MAX_VIDEO_BYTES = 7 * 1024 * 1024;

/** Tope de imagen de ENTRADA. El reescalado la deja muy por debajo, pero un
 *  archivo enorme igual hay que leerlo y decodificarlo en memoria primero. */
export const MAX_IMAGE_BYTES = 20 * 1024 * 1024;

export type UploadResult =
  | { ok: true; src: string }
  | { ok: false; error: string };

const fmtMB = (bytes: number) => `${Math.round(bytes / (1024 * 1024))} MB`;

const readAsDataUrl = (file: File): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () =>
      typeof reader.result === "string"
        ? resolve(reader.result)
        : reject(new Error("No se pudo leer el archivo."));
    reader.onerror = () => reject(reader.error ?? new Error("No se pudo leer el archivo."));
    reader.readAsDataURL(file);
  });

/** Lee una imagen y la devuelve reescalada como JPEG.
 *
 *  Los PNG con transparencia pierden el alfa —el canvas se rellena de blanco a
 *  propósito, si no el JPEG lo pinta de negro—. Es el precio de que una foto
 *  entre en el body de la action; para avatares y carrete no importa.
 */
export async function readImage(file: File): Promise<UploadResult> {
  if (!file.type.startsWith("image/")) {
    return { ok: false, error: "Ese archivo no es una imagen." };
  }
  if (file.size > MAX_IMAGE_BYTES) {
    return { ok: false, error: `La imagen supera los ${fmtMB(MAX_IMAGE_BYTES)}.` };
  }

  const dataUrl = await readAsDataUrl(file);

  const img = await new Promise<HTMLImageElement | null>((resolve) => {
    const el = new Image();
    el.onload = () => resolve(el);
    el.onerror = () => resolve(null);
    el.src = dataUrl;
  });
  // Un archivo con extensión de imagen que el navegador no decodifica: se sube
  // tal cual y que falle al mostrarlo, no acá.
  if (!img) return { ok: true, src: dataUrl };

  const scale = Math.min(1, MAX_EDGE / Math.max(img.naturalWidth, img.naturalHeight));
  const w = Math.round(img.naturalWidth * scale);
  const h = Math.round(img.naturalHeight * scale);

  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) return { ok: true, src: dataUrl };

  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, w, h);
  ctx.drawImage(img, 0, 0, w, h);

  return { ok: true, src: canvas.toDataURL("image/jpeg", 0.82) };
}

/** Lee un video sin tocarlo: sólo valida el tipo y el tamaño. */
export async function readVideo(file: File): Promise<UploadResult> {
  if (!file.type.startsWith("video/")) {
    return { ok: false, error: "Ese archivo no es un video." };
  }
  if (file.size > MAX_VIDEO_BYTES) {
    return {
      ok: false,
      error: `El video supera los ${fmtMB(MAX_VIDEO_BYTES)}. Recortalo y volvé a intentar.`,
    };
  }
  return { ok: true, src: await readAsDataUrl(file) };
}

/** Despacha por tipo de archivo. Es lo que usan los inputs que aceptan las dos
 *  cosas (`accept="image/*,video/*"`). */
export async function readMedia(
  file: File,
): Promise<UploadResult & { kind?: "image" | "video" }> {
  if (file.type.startsWith("video/")) {
    return { ...(await readVideo(file)), kind: "video" };
  }
  if (file.type.startsWith("image/")) {
    return { ...(await readImage(file)), kind: "image" };
  }
  return { ok: false, error: "Sólo se pueden subir imágenes y videos." };
}
