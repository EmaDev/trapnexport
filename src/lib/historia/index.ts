/** La puerta **cliente** de la historia del club.
 *
 *  Reexporta los tipos y los valores de arranque, y nada más. En particular no
 *  reexporta `queries.ts` ni `actions.ts`, y eso es a propósito: los dos
 *  importan el Admin SDK, y `@/lib/historia` termina en el bundle del
 *  navegador —`lib/presentacion/trayectoria.ts` lo importa y lo usa un
 *  componente cliente—. Un barrel que arrastre `firebase-admin` al cliente no
 *  falla en el editor: falla en el build.
 *
 *  Quien corre en el servidor y necesita los datos **reales** (los que se
 *  editan en `/admin/historia`) importa de `@/lib/historia/queries`.
 */

export * from "./types";
export { BALANCE, CLUB, SEED } from "./seed";
