/** Copiar la carta al portapapeles.
 *
 *  Lo demás —Instagram y WhatsApp— sale tal cual de
 *  `lib/invitacion/compartir.ts`: ahí ya está resuelto que Instagram no acepta
 *  links y necesita un archivo por `navigator.share`, que WhatsApp sí acepta
 *  un link por `wa.me`, y qué hacer donde no hay Web Share con archivos. Es el
 *  mismo problema y no tiene una segunda respuesta; lo único que ese módulo no
 *  tenía es esto, porque una invitación se manda, no se copia.
 */

/** Qué pasó al tocar "Copiar imagen".
 *
 *  `sin-soporte` es un caso aparte de `error` y no un detalle: Firefox y Safari
 *  hasta hace poco no implementan `ClipboardItem` con PNG, y ahí no falló
 *  nada — el navegador no sabe hacerlo. La pantalla ofrece descargar en vez de
 *  mostrar un cartel rojo por algo que la persona no puede arreglar. */
export type ResultadoCopia = "copiado" | "sin-soporte" | "error";

export async function copiarImagen(png: Blob | null): Promise<ResultadoCopia> {
  if (!png) return "error";
  if (typeof ClipboardItem === "undefined" || !navigator.clipboard?.write) {
    return "sin-soporte";
  }

  try {
    // El blob va envuelto en una promesa resuelta y no pelado: Safari exige
    // que `ClipboardItem` se construya en el mismo tick del gesto del usuario
    // y descarta la escritura si antes hubo un `await`. Con la promesa adentro,
    // el navegador espera el contenido él mismo y el gesto sigue siendo válido.
    await navigator.clipboard.write([new ClipboardItem({ "image/png": Promise.resolve(png) })]);
    return "copiado";
  } catch {
    // Chrome tira `NotAllowedError` si el documento perdió el foco entre el
    // click y la escritura — es el caso de quien toca el botón y se va a otra
    // ventana. No hay nada que distinguir: los dos terminan en "no se pudo".
    return "error";
  }
}

/** Descarga el PNG. Es la salida cuando el navegador no sabe copiar imágenes:
 *  la carta termina igual en el teléfono, con un paso más. */
export function descargarImagen(png: Blob, nombre: string) {
  const href = URL.createObjectURL(png);
  const a = document.createElement("a");
  a.href = href;
  a.download = nombre;
  a.click();
  // Sin el revoke, el PNG —cerca de 1 MB— queda vivo hasta que se cierra la
  // pestaña. El timeout es porque revocar en el mismo tick cancela la descarga
  // en Safari, que lee la URL después del click.
  setTimeout(() => URL.revokeObjectURL(href), 10_000);
}

/** El texto que acompaña a la carta cuando se comparte. El link va al final y
 *  en su propia línea: WhatsApp arma el preview con la última URL del texto. */
export const textoCarta = (nombre: string, general: number, club: string, url: string) =>
  `Mi carta de ${club}: ${nombre}, ${general} de general.\n${url}`;
