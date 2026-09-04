import {
  borrarImagen,
  subirImagen,
  type ImagenComprimidaSubida,
} from "@/lib/storage/imagen";

/** Subida de las fotos del chat a Firebase Storage.
 *
 *  Corre en el navegador, igual que las del feed: el compositor pasa el `File`,
 *  `lib/storage/imagen.ts` lo comprime en un `<canvas>` y sube el resultado a
 *  `trapnexport-chat/{uid}/`; por la Server Action `sendImage` viaja sólo la
 *  `downloadURL`, la ruta y las medidas. El original nunca sale del dispositivo.
 *
 *  Carpeta propia y no `trapnexport-post/`, aunque el motor sea el mismo: el
 *  path es lo que `storage.rules` usa para acotar quién escribe dónde, y
 *  mezclarlas dejaría a las fotos de un chat privado bajo la misma regla que las
 *  de un feed público. Separadas, el día que haya que retenerlas distinto —o
 *  borrar las de una conversación— hay un prefijo al que apuntar.
 *
 *  ## Lo que hay que saber antes de usar esto
 *
 *  **La foto es privada por el link, no por permisos.** Como todo el bucket de
 *  este proyecto, la lectura es pública: quien tenga la `downloadURL` ve la
 *  imagen sin estar en la conversación. El token que Firebase mete en la URL la
 *  hace imposible de adivinar, pero reenviarla la comparte. Esto es lo mismo que
 *  ya pasa con los avatares y las fotos del feed, sólo que acá el contenido es
 *  privado y conviene decirlo. Cerrarlo de verdad significa servir las imágenes
 *  desde el servidor con URLs firmadas, y eso es otra decisión, no un ajuste.
 */

/** Carpeta del bucket. Misma convención que las colecciones de Firestore. */
const CARPETA = "trapnexport-chat";

/** Lado largo al que se baja la foto. Más chico que el del feed (1280): una
 *  burbuja de chat se mira a ~240 px y a pantalla completa en el visor, no a
 *  ancho de tarjeta, y esto es lo que se manda de a una y por dato móvil. */
const MAX_EDGE = 1080;

export type UploadedChatImage = ImagenComprimidaSubida;

/** Comprime `file` y lo sube a `trapnexport-chat/{uid}/`. Devuelve la URL
 *  pública, la ruta en el bucket y las medidas del archivo ya reescalado.
 *  Lanza si no es una imagen, si se pasa del tope de entrada o si falla. */
export function uploadChatImage(file: File): Promise<UploadedChatImage> {
  return subirImagen(file, { carpeta: CARPETA, maxEdge: MAX_EDGE, porUsuario: true });
}

/** Borra una foto subida. Lo llama el compositor cuando se saca una que todavía
 *  no se mandó: sin esto, elegir y descartar deja el archivo en el bucket sin
 *  que ningún mensaje lo referencie. Best-effort, como el del feed. */
export function deleteChatImage(path: string): Promise<void> {
  return borrarImagen(path);
}
