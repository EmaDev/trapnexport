import { borrarImagen, subirImagen, type ImagenSubida } from "@/lib/storage/imagen";

/** Subida de las imágenes de la historia del club desde `/admin/historia`.
 *
 *  Mismo motor que las fotos del feed (`lib/storage/imagen.ts`), otra política:
 *
 *  - **Carpeta propia.** `trapnexport-historia/` y no `trapnexport-post/`: son
 *    contenido institucional que vive para siempre, no publicaciones que se
 *    borran con su post. Mezclarlas haría imposible limpiar un bucket sin
 *    revisar archivo por archivo.
 *  - **Lado largo mayor.** 1600 px en vez de 1280: la portada de una temporada
 *    y la foto de una etapa se muestran a pantalla completa en el museo y en
 *    el modo presentación —que sale por un proyector—, no en una tarjeta de
 *    feed.
 *  - **Sin segmento de usuario.** El panel escribe como el club, no como una
 *    persona: no hay dueño por archivo que valga la pena registrar en la ruta.
 *
 *  ⚠️ La carpeta necesita su regla en `storage.rules`. El panel se autentica
 *  con la cookie de sesión del servidor, no con Firebase Auth en el navegador,
 *  así que la subida llega al bucket sin token — igual que la del compositor.
 *  La regla acota tipo y tamaño; ver el comentario largo en `storage.rules`.
 */

const CARPETA = "trapnexport-historia";

const MAX_EDGE = 1600;

export type ImagenHistoria = ImagenSubida;

/** Comprime `file` y lo sube a `trapnexport-historia/`. Devuelve la URL pública
 *  y la ruta en el bucket. Lanza si no es una imagen o si la subida falla. */
export function subirImagenHistoria(file: File): Promise<ImagenHistoria> {
  return subirImagen(file, { carpeta: CARPETA, maxEdge: MAX_EDGE });
}

/** Borra un archivo subido. Best-effort, igual que en el feed. */
export function borrarImagenHistoria(path: string): Promise<void> {
  return borrarImagen(path);
}
