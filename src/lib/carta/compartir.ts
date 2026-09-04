/** Lo propio de compartir la carta de jugador, que es sólo el texto.
 *
 *  Todo lo demás —el portapapeles, la hoja del sistema, la descarga— sale tal
 *  cual de `lib/invitacion/compartir.ts`: ahí ya está resuelto que Instagram no
 *  acepta links y necesita un archivo por `navigator.share`, que copiar un PNG
 *  hay que hacerlo en el tick del gesto, y qué queda donde no hay ninguna de
 *  las dos cosas. Es el mismo problema y no tiene una segunda respuesta.
 */

/** El texto que acompaña a la carta cuando se comparte. El link va al final y
 *  en su propia línea: WhatsApp arma el preview con la última URL del texto. */
export const textoCarta = (nombre: string, general: number, club: string, url: string) =>
  `Mi carta de ${club}: ${nombre}, ${general} de general.\n${url}`;
