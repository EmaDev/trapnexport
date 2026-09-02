import { borrarImagen, subirImagen, type ImagenSubida } from "@/lib/storage/imagen";

/** Subida de las imágenes de las publicaciones a Firebase Storage.
 *
 *  Corre en el navegador. El compositor pasa el `File`, `lib/storage/imagen.ts`
 *  lo **comprime fuerte** en un `<canvas>` y sube el resultado a
 *  `trapnexport-post/{uid}/`; por la Server Action `publishPost` viaja sólo la
 *  `downloadURL` más la ruta del archivo (para poder borrarlo después). El
 *  original nunca sale del dispositivo.
 *
 *  Lo único propio del feed que queda acá es la política: en qué carpeta y con
 *  qué lado máximo. El motor lo comparte con el panel de la historia, que sube
 *  con otro tamaño porque sus fotos se miran a pantalla completa.
 */

/** Carpeta del bucket. Misma convención de nombres que las colecciones de
 *  Firestore del proyecto (`trapnexport-user`, `trapnexport-jugador`). */
const CARPETA = "trapnexport-post";

/** Lado largo al que se baja la imagen antes de subirla. 1280 px llena una
 *  tarjeta de feed a pantalla completa en un teléfono retina y recorta a menos
 *  de la mitad el peso de una foto de 2500–4000 px. */
const MAX_EDGE = 1280;

export type UploadedPostImage = ImagenSubida;

/** Comprime `file` y lo sube a `trapnexport-post/`. Devuelve la URL pública y la
 *  ruta en el bucket. Lanza si no es una imagen, si se pasa del tope de entrada
 *  o si la subida falla. */
export function uploadPostImage(file: File): Promise<UploadedPostImage> {
  return subirImagen(file, { carpeta: CARPETA, maxEdge: MAX_EDGE, porUsuario: true });
}

/** Borra un archivo subido. Best-effort: si ya no está —o las reglas no dejan—
 *  no es un error que deba frenar nada, sólo queda un huérfano en el bucket. */
export function deletePostImage(path: string): Promise<void> {
  return borrarImagen(path);
}
