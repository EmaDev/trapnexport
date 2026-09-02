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

  /* ── la historia del club (`lib/historia/`) ─────────────────────────────── */
  /** identidad, palmarés y balance: una sola fila. Ver `HistoriaClubDoc`. */
  historia: `${PREFIX}-historia`,
  /** las etapas de la línea de tiempo. Ver `EraDoc`. */
  era: `${PREFIX}-era`,
  /** las temporadas; el id del documento **es** el año. Ver `TemporadaDoc`. */
  temporada: `${PREFIX}-temporada`,
  /** las fichas de trayectoria. Colección aparte de `-jugador`: ver `PlayerDoc`. */
  historiaJugador: `${PREFIX}-historia-jugador`,
  /** frases célebres. Ver `FraseDoc`. */
  frase: `${PREFIX}-frase`,
  /** el museo: fotos del archivo. Ver `FotoDoc`. */
  foto: `${PREFIX}-foto`,
  /** los videos del archivo. Ver `ClipDoc`. */
  clip: `${PREFIX}-clip`,

  /* ── el feed (`lib/social/`) ────────────────────────────────────────────── */
  /** publicaciones del feed y del foro. Ver `PostDoc`. */
  post: `${PREFIX}-post`,
  /** comentarios y respuestas. Colección de primer nivel y no subcolección de
   *  la publicación: el feed necesita los comentarios de las 50 publicaciones
   *  que muestra, y eso es una query con `in` sobre `postId`; con subcolecciones
   *  serían 50 queries o un collection group con el mismo campo igual.
   *  Ver `CommentDoc`. */
  comment: `${PREFIX}-comment`,

  /* ── el chat (`lib/chat/`) ──────────────────────────────────────────────── */
  /** conversaciones: directas de a dos y grupos. Ver `ConversacionDoc`. */
  conversacion: `${PREFIX}-conversacion`,
  /** el registro de lo que se mandó por difusión desde el panel. No es el
   *  mecanismo de envío —eso son conversaciones y mensajes normales— sino la
   *  auditoría: qué se comunicó, a quiénes y quién lo mandó. Ver `DifusionDoc`. */
  difusion: `${PREFIX}-difusion`,

  /** avisos de campanita: un documento por destinatario. Los escribe el
   *  servidor (`lib/social/notify.ts`) y los lee `social/queries.ts`. Ver
   *  `NotificacionDoc`. */
  notificacion: `${PREFIX}-notification`,
} as const;

/** La subcolección de mensajes: `trapnexport-conversacion/{id}/mensaje/{id}`.
 *
 *  Subcolección y no un array dentro de la conversación: una conversación activa
 *  supera el tope de 1 MB del documento, y hasta que lo supera se relee entera
 *  cada vez que la bandeja lista las conversaciones. */
export const SUB_MENSAJE = "mensaje";

/** El uid de la cuenta oficial del club.
 *
 *  Es un id fijo y **no** un uid de Firebase Auth, a propósito: no existe
 *  ninguna credencial con la que iniciar sesión como el club, así que nadie
 *  puede suplantarlo ni siquiera con las reglas de su lado. El documento lo crea
 *  el seed con el Admin SDK, que se saltea `validNewUser`.
 *
 *  Es el remitente de las difusiones del panel. Que sea el club y no la cuenta
 *  personal de quien aprieta enviar tiene dos motivos: un aviso institucional no
 *  debería llegar como "Emanuel te escribió", y el día que administre otra
 *  persona el hilo quedaría partido entre dos remitentes.
 *
 *  Hay que excluirlo a mano de donde se listan cuentas —el buscador,
 *  `notifyAll`, `/admin/usuarios`—: es un remitente, no un usuario. */
export const CLUB_UID = "club";

/** El único documento dentro de `trapnexport-config`.
 *
 *  El cronograma es de un solo día y esa fecha vive una sola vez, acá, en vez
 *  de repetirse en cada evento —donde dos podrían quedar con días distintos—.
 *  Ruta completa: `trapnexport-config/cronograma`. Ver `CronogramaConfigDoc`.
 */
export const CONFIG_CRONOGRAMA = "cronograma";

/** El único documento dentro de `trapnexport-historia`.
 *
 *  Identidad del club, palmarés y balance de finales son una sola fila que se
 *  edita junta en la solapa "Club" del panel, así que van en un documento con
 *  nombre fijo y no en una colección de uno. Ruta completa:
 *  `trapnexport-historia/club`. Ver `HistoriaClubDoc`.
 */
export const HISTORIA_CLUB = "club";

/** La subcolección de votos de una encuesta: `trapnexport-encuesta/{id}/voto/{uid}`.
 *
 *  Un documento por persona, con el uid de Firebase Auth como id. Que el id sea
 *  el uid **es** el dedupe: Firestore no tiene índices únicos, así que la única
 *  forma de garantizar un voto por cuenta es que el segundo voto caiga sobre el
 *  mismo documento que el primero. Ver `VotoDoc` y `lib/contenido/voto.ts`.
 */
export const SUB_VOTO = "voto";

/** Subcolecciones de `trapnexport-user/{uid}`.
 *
 *  No llevan prefijo: ya están namespaceadas por el documento padre, y
 *  repetirlo daría rutas como `trapnexport-user/{uid}/trapnexport-gallery`.
 */
export const SUB = {
  private: "private",
  gallery: "gallery",
  /** publicaciones guardadas: un doc por publicación, con el id de la
   *  publicación de id. Va del lado del usuario y no como array `savedBy` en la
   *  publicación porque guardar es privado y no tiene contador visible: si
   *  viviera en el post, guardar reescribiría el documento que todo el feed
   *  está leyendo, y de paso le contaría a todos quién lo guardó.
   *  Ver `GuardadoDoc`. */
  saved: "saved",
} as const;

/** El único documento dentro de `private/`.
 *
 *  Es un doc con nombre fijo y no una colección de varios porque los datos
 *  privados de una cuenta son un solo registro: email, proveedores, push y
 *  preferencias. Ruta completa: `trapnexport-user/{uid}/private/account`.
 */
export const PRIVATE_DOC = "account";
