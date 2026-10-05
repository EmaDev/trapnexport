import { subirImagen, type ImagenSubida } from "@/lib/storage/imagen";

/** Subida de las imágenes del carrusel de la home, desde `/admin/portada`.
 *
 *  Mismo motor que el resto (`lib/storage/imagen.ts`) y la misma política que
 *  las de la historia, con dos diferencias:
 *
 *  - **Carpeta propia.** `trapnexport-portada/` y no `trapnexport-historia/`:
 *    los slides se reemplazan seguido —la portada cambia con la semana— y el
 *    archivo de una etapa del club vive para siempre. Mezclarlos haría imposible
 *    limpiar los slides viejos sin revisar archivo por archivo cuál era de qué.
 *  - **Lado largo de 1920.** El carrusel ocupa el ancho completo de la columna
 *    en 16:9 y es lo primero que se ve al abrir la app; 1600 ya se nota blando
 *    en una pantalla densa.
 *
 *  ⚠️ La carpeta necesita su regla en `storage.rules` (ya está) y las reglas hay
 *  que **desplegarlas**: `firebase deploy --only storage`. Sin eso, la subida
 *  llega al bucket y la rechaza sin más contexto que un `unauthorized`.
 */

const CARPETA = "trapnexport-portada";

const MAX_EDGE = 1920;

export type ImagenPortada = ImagenSubida;

/** Comprime `file` y lo sube a `trapnexport-portada/`. Devuelve la URL pública
 *  y la ruta en el bucket. Lanza si no es una imagen o si la subida falla. */
export function subirImagenPortada(file: File): Promise<ImagenPortada> {
  return subirImagen(file, { carpeta: CARPETA, maxEdge: MAX_EDGE });
}
