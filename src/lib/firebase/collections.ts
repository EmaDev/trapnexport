/** Los nombres de las colecciones de Firestore, en un único lugar.
 *
 *  Todas llevan el prefijo `trapnexport-`. El proyecto de Firebase se comparte
 *  con otras apps, y el prefijo es lo que evita que dos de ellas terminen
 *  escribiendo la misma colección `users`.
 *
 *  Nadie escribe el string a mano. Un typo en `collection(db, "trapnexport-usr")`
 *  no tira ningún error: crea una colección nueva y vacía, y el bug aparece
 *  recién cuando alguien no puede iniciar sesión.
 */

const PREFIX = "trapnexport";

export const COL = {
  /** cuentas reales; el id del documento es el uid de Firebase Auth */
  user: `${PREFIX}-user`,
  /** el plantel del club — dato institucional, existe sin que nadie se registre */
  jugador: `${PREFIX}-jugador`,
  /** reserva de handles: un doc por handle tomado. Ver `HandleDoc`. */
  handle: `${PREFIX}-handle`,

  /* ── contenido que administra el panel (`lib/contenido/`) ───────────────── */
  /** noticias del club. Ver `NoticiaDoc`. */
  noticia: `${PREFIX}-noticia`,
  /** encuestas / votaciones. El id de las semilla es el del premio. Ver `EncuestaDoc`. */
  encuesta: `${PREFIX}-encuesta`,
  /** invitaciones con link propio. Ver `InvitacionDoc`. */
  invitacion: `${PREFIX}-invitacion`,
  /** eventos del cronograma. No guardan fecha: la comparten. Ver `EventoDoc`. */
  evento: `${PREFIX}-evento`,
  /** ajustes de una sola fila del panel (hoy: el día del cronograma). */
  config: `${PREFIX}-config`,

  /** avisos de campanita: un documento por destinatario. Los escribe el
   *  servidor (`lib/social/notify.ts`) y los lee `social/queries.ts`. Ver
   *  `NotificacionDoc`. */
  notificacion: `${PREFIX}-notification`,
} as const;

/** El único documento dentro de `trapnexport-config`.
 *
 *  El cronograma es de un solo día y esa fecha vive una sola vez, acá, en vez
 *  de repetirse en cada evento —donde dos podrían quedar con días distintos—.
 *  Ruta completa: `trapnexport-config/cronograma`. Ver `CronogramaConfigDoc`.
 */
export const CONFIG_CRONOGRAMA = "cronograma";

/** Subcolecciones de `trapnexport-user/{uid}`.
 *
 *  No llevan prefijo: ya están namespaceadas por el documento padre, y
 *  repetirlo daría rutas como `trapnexport-user/{uid}/trapnexport-gallery`.
 */
export const SUB = {
  private: "private",
  gallery: "gallery",
} as const;

/** El único documento dentro de `private/`.
 *
 *  Es un doc con nombre fijo y no una colección de varios porque los datos
 *  privados de una cuenta son un solo registro: email, proveedores, push y
 *  preferencias. Ruta completa: `trapnexport-user/{uid}/private/account`.
 */
export const PRIVATE_DOC = "account";
