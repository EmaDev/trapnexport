/** Helpers de identidad del contenido del club.
 *
 *  Lo que queda del store en memoria: la base ahora es Firestore
 *  (`trapnexport-noticia`, `-encuesta`, `-invitacion`, `-evento`, `-config`),
 *  la leen `queries.ts` y la escriben `actions.ts`, las dos con el Admin SDK.
 *  Acá viven sólo los generadores de id/código, que no dependen de dónde estén
 *  guardados los datos.
 */

/** id corto y único dentro del proceso. Lo usan las opciones de una encuesta,
 *  que son un array embebido y no documentos: no tienen id de Firestore y
 *  igual hay que poder reconocerlas entre ediciones. */
export const newId = (prefix: string) =>
  `${prefix}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;

/** Los diacríticos que `normalize("NFD")` deja sueltos, U+0300–U+036F.
 *
 *  Se arma con `String.fromCharCode` en vez de un literal `/[..]/`: el rango
 *  escrito con las marcas combinantes de verdad es invisible en el editor y
 *  cualquier reformateo o copy-paste se lo lleva sin que se note. */
const DIACRITICS = new RegExp(
  `[${String.fromCharCode(0x300)}-${String.fromCharCode(0x36f)}]`,
  "g",
);

/** "Cena de los 28 anos" -> "cena-de-los-28-anos". */
const slug = (s: string) =>
  s
    .normalize("NFD")
    .replace(DIACRITICS, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 24);

/** Slug para la URL pública de una invitación: `/invitacion/:code`.
 *
 *  Sale del título y del nombre del invitado, más cuatro caracteres al azar.
 *  El slug legible es para que el link se entienda cuando se manda por
 *  WhatsApp; el sufijo es para que no se pueda adivinar el de otra persona
 *  cambiando el nombre en la barra de direcciones. */
export function invitacionCode(invitado: string, titulo: string): string {
  const base = [slug(titulo), slug(invitado)].filter(Boolean).join("-") || "invitacion";
  return `${base}-${Math.random().toString(36).slice(2, 6)}`;
}
