import type { ClaimStatus, NotificationKind, PlayerFicha } from "@/lib/social/types";

/** La forma **exacta** de lo que hay guardado en Firestore.
 *
 *  Es el contrato de la base, no el de la UI. Las pantallas siguen consumiendo
 *  los VM de `lib/social/queries.ts` (`ProfileVM`, `AuthorVM`, `SessionVM`); en
 *  el medio hay un mapper que traduce estos documentos a esos VM. Esa
 *  separación es lo que permite cambiar la base sin tocar una sola pantalla, y
 *  es la misma regla que ya sigue el store en memoria.
 *
 *  Los nombres de los campos van en inglés para que el mapper contra el `User`
 *  de `lib/social/types.ts` sea casi identidad. La única excepción es
 *  `JugadorDoc`, que refleja el `Jugador` de `lib/trap-awards.ts` —que ya está
 *  en español— por exactamente la misma razón.
 */

/* ── tiempo ──────────────────────────────────────────────────────────────── */

/** Un `Timestamp` de Firestore, definido por lo poco que usamos de él.
 *
 *  No se importa de `firebase/firestore` ni de `firebase-admin`: los dos SDK
 *  exportan un `Timestamp` distinto —el cliente escribe, el servidor lee en las
 *  server actions— y tipar el schema contra uno haría que el otro no compile.
 *  Los mappers sólo llaman `toMillis()`, así que esto alcanza.
 */
export interface FsTimestamp {
  toMillis(): number;
  toDate(): Date;
}

/** Al **escribir**, los campos de fecha van como `serverTimestamp()`, que
 *  devuelve un `FieldValue` y no un `Timestamp`. Es a propósito: el reloj del
 *  navegador lo pone el usuario, y una cuenta con `createdAt` en 2019 rompe
 *  cualquier orden por antigüedad. Los tipos de abajo describen la lectura. */

/* ── trapnexport-user/{uid} ──────────────────────────────────────────────── */

/** Qué es esta cuenta para la app.
 *
 *  - `fan`    — se registró por su cuenta, sin vínculo con el plantel.
 *  - `player` — reclamó un jugador del plantel. Es el único rol que tiene
 *               `ficha`. El rol se asigna **al reclamar**, no al aprobarse:
 *               quien gatea el acceso es `status`, que arranca en `pending`.
 *               Tener el rol esperando aprobación en dos campos distintos
 *               permitiría que se contradigan.
 *  - `admin`  — entra a `/admin`. El rol acá es para la UI; **la autoridad es
 *               el custom claim `admin` de Firebase Auth**, que es lo que
 *               verifica `lib/admin/auth.ts`. Un campo de Firestore que otorga
 *               permisos es un campo que hay que defender en las rules.
 */
/** `club` es la cuenta oficial (`CLUB_UID`), el remitente de las difusiones del
 *  panel. No es un permiso —quién entra a `/admin` lo decide el claim `admin`—
 *  sino lo que permite distinguirla al listar cuentas: es un remitente, no un
 *  usuario, y no tiene que aparecer en el buscador ni recibir sus propios
 *  avisos. `firestore.rules` sigue aceptando sólo `fan` y `player` en un alta
 *  desde el cliente; ésta la crea el seed con el Admin SDK. */
export type UserRole = "fan" | "player" | "admin" | "club";

/** El estado de la cuenta, en un solo campo.
 *
 *  Reemplaza al par `suspended?: boolean` + `claim.status` del store en
 *  memoria: son tres estados excluyentes, y tenerlos en dos campos permite
 *  escribir el cuarto, que no existe (suspendida y pendiente a la vez).
 *
 *  - `active`    — ve y publica. Es el estado de todo `fan` al registrarse.
 *  - `pending`   — reclamó un jugador y el admin todavía no confirmó.
 *  - `suspended` — moderada: no aparece en el feed público.
 */
export type UserStatus = "active" | "pending" | "suspended";

/** Alguien se registró diciendo "soy este jugador del plantel".
 *
 *  Vive dentro del `UserDoc` y no en una colección aparte: el reclamo y la
 *  cuenta nacen en la misma escritura y se resuelven juntos. Que un jugador ya
 *  esté tomado se consulta por `playerId` (indexado), no leyendo reclamos.
 */
export interface UserClaimDoc {
  /** lo que la persona escribió para que el admin la reconozca */
  note?: string;
  status: ClaimStatus;
  requestedAt: FsTimestamp;
  reviewedAt?: FsTimestamp;
  /** uid del admin que resolvió — quién aprobó tiene que quedar registrado */
  reviewedBy?: string;
}

/** Contadores desnormalizados, mantenidos con `increment()`.
 *
 *  Firestore no tiene un `COUNT(*)` barato: `/perfil` y `/admin/usuarios`
 *  muestran "N publicaciones" por cada cuenta de la lista, y resolverlo con una
 *  query por fila es una lectura facturada por usuario en pantalla.
 */
export interface UserStats {
  posts: number;
  comments: number;
  gallery: number;
}

/** Una cuenta. Documento en `trapnexport-user/{uid}`.
 *
 *  **El id del documento es el uid de Firebase Auth.** Por eso una rule de
 *  escritura es `request.auth.uid == userId` sin lecturas extra, y leer la
 *  cuenta propia es un `get` directo en vez de una query por campo.
 *
 *  Es de **lectura pública**: el feed necesita el autor de cada publicación.
 *  Nada sensible entra acá — el email y el push viven en `UserPrivateDoc`.
 */
export interface UserDoc {
  /** igual al id del documento. Redundante a propósito: sin esto, el resultado
   *  de una query no sabe quién es sin arrastrar el `DocumentSnapshot`. */
  uid: string;

  /* ── identidad ─────────────────────────────────────────────────────────── */
  /** único en toda la app, en minúsculas: `/^[a-z0-9._]{3,20}$/`.
   *  La unicidad NO la garantiza este campo sino `trapnexport-handle`. */
  handle: string;
  name: string;
  /** URL pública de Firebase Storage. Hoy `lib/media-upload.ts` produce
   *  data-URIs: eso no entra acá. Un documento de Firestore tiene un tope de
   *  1 MB, y a este lo lee el feed una vez por cada publicación. */
  avatar: string;
  /** ruta del archivo en el bucket (`users/{uid}/avatar-xxx.webp`). Sin esto,
   *  al cambiar la foto la anterior queda huérfana en Storage para siempre. */
  avatarPath?: string;
  bio?: string;

  /* ── cuenta y permisos ─────────────────────────────────────────────────── */
  role: UserRole;
  status: UserStatus;
  /** el tilde del perfil. Lo pone el admin al aprobar un reclamo. */
  verified: boolean;

  /* ── vínculo con el plantel ────────────────────────────────────────────── */
  /** id del documento en `trapnexport-jugador` (`"naza-sochan"`). Presente
   *  desde que se solicita el reclamo, esté aprobado o no. */
  playerId?: string;
  claim?: UserClaimDoc;

  /* ── ficha deportiva ───────────────────────────────────────────────────── */
  /** sólo en cuentas `player`. Objeto anidado y no campos sueltos: se edita y
   *  se valida como una unidad, igual que hoy en `updateFicha`. */
  ficha?: PlayerFicha;

  /* ── contadores y metadata ─────────────────────────────────────────────── */
  stats: UserStats;
  createdAt: FsTimestamp;
  updatedAt: FsTimestamp;
  /** última vez que la cuenta abrió la app. Alimenta "activos" en `/admin`. */
  lastSeenAt?: FsTimestamp;
}

/* ── trapnexport-user/{uid}/private/account ──────────────────────────────── */

/** Una suscripción de push del navegador, tal como la devuelve
 *  `PushManager.subscribe()` — es lo que `web-push` necesita para enviar.
 *
 *  Es una lista y no un objeto: la misma persona puede tener la PWA instalada
 *  en el teléfono y abierta en la compu, y cada instalación tiene su endpoint.
 */
export interface PushSubscriptionDoc {
  endpoint: string;
  keys: { p256dh: string; auth: string };
  /** el user agent, para que el usuario pueda distinguir sus dispositivos */
  ua?: string;
  createdAt: FsTimestamp;
}

/** Lo que no puede leer nadie más que su dueño.
 *
 *  Documento único en `trapnexport-user/{uid}/private/account`. Está separado
 *  del `UserDoc` por una razón concreta: el `UserDoc` es de lectura pública
 *  porque el feed lee el autor de cada post, y con el email adentro cualquiera
 *  con la app abierta podría listar los mails del plantel.
 *
 *  El panel de admin los lee igual: usa `firebase-admin`, que se saltea las
 *  security rules.
 */
export interface UserPrivateDoc {
  /** copia del email de Firebase Auth. Auth es la fuente de verdad; esto está
   *  para poder buscar y listar desde el panel sin pegarle a la Admin API. */
  email: string;
  emailVerified: boolean;
  /** `["password"]`, `["google.com"]`, … */
  providers: string[];
  pushSubscriptions: PushSubscriptionDoc[];
  notifications: {
    likes: boolean;
    comments: boolean;
    /** noticias y avisos del club */
    news: boolean;
  };
  updatedAt: FsTimestamp;
}

/* ── trapnexport-user/{uid}/gallery/{id} ─────────────────────────────────── */

/** Una foto o un video del carrete personal.
 *
 *  Es subcolección y no el array `gallery: GalleryItem[]` del store en memoria:
 *  un array embebido se reescribe entero en cada alta, se lee entero en cada
 *  lectura del perfil —y del feed, que lee el mismo documento— y choca contra
 *  el tope de 1 MB del documento apenas se suben dos fotos.
 */
export interface GalleryDoc {
  kind: "image" | "video";
  /** URL pública de Storage */
  src: string;
  /** ruta en el bucket, para poder borrar el archivo junto con el documento.
   *  Cadena vacía en un item que no vino de una subida. */
  path: string;
  alt: string;
  createdAt: FsTimestamp;
}

/* ── trapnexport-handle/{handle} ─────────────────────────────────────────── */

/** La reserva de un nombre de usuario. El id del documento **es** el handle.
 *
 *  Firestore no tiene índices únicos: chequear `where("handle", "==", x)` antes
 *  de escribir no sirve, porque dos altas simultáneas pasan las dos. La
 *  unicidad sale de que el id de un documento sí es único: el alta crea este
 *  doc y el `UserDoc` en la **misma transacción**, y si el handle ya existe la
 *  transacción entera falla.
 *
 *  Cambiar de handle es borrar este doc y crear el nuevo, también atómico.
 */
export interface HandleDoc {
  uid: string;
  createdAt: FsTimestamp;
}

/* ── contenido del panel ─────────────────────────────────────────────────── */

/** El contenido que administra `/admin` (noticias, encuestas, invitaciones,
 *  cronograma). Reflejan los tipos de dominio de `lib/contenido/types.ts` —que
 *  ya están en español— con dos diferencias:
 *
 *  - `createdAt` / `updatedAt` son `FsTimestamp` acá y `number` (millis) en el
 *    dominio: se escriben con `serverTimestamp()` y el mapper de `queries.ts`
 *    los baja a milisegundos, igual que en `admin/cuentas.ts`.
 *  - las fechas de calendario (`fecha`, `hora`, `cierra`) siguen siendo
 *    strings `"YYYY-MM-DD"` / `"HH:mm"`. Un evento ocurre a las 21:00 **en la
 *    cancha**, no en un instante UTC; ver el encabezado de `contenido/types.ts`.
 *
 *  El id del documento es el id de dominio. Para las encuestas semilla ese id
 *  es el del premio (`"mejor-arquero"`), lo que hace que `/admin/presentacion`
 *  cruce encuesta ↔ premio con un `get` directo y sin tabla de equivalencias.
 */

/** `trapnexport-noticia/{id}`. Refleja `Noticia`. */
export interface NoticiaDoc {
  titulo: string;
  copete: string;
  cuerpo: string;
  /** URL de la portada. Ausente mientras no haya un uploader en el panel. */
  cover?: string;
  estado: "borrador" | "publicada";
  autor: string;
  /** una sola destacada por vez: marcar una apaga la anterior */
  destacada: boolean;
  createdAt: FsTimestamp;
  updatedAt: FsTimestamp;
}

/** Una opción dentro de `EncuestaDoc.opciones`. Array embebido y no
 *  subcolección: son pocas por encuesta, se leen y se reescriben siempre
 *  juntas, y el tope de 1 MB del documento sobra. */
export interface OpcionEncuestaDoc {
  id: string;
  texto: string;
  votos: number;
  /** URL de imagen o video: la opción se vota como media, no como texto */
  media?: string;
}

/** `trapnexport-encuesta/{id}`. Refleja `Encuesta`. */
export interface EncuestaDoc {
  pregunta: string;
  descripcion?: string;
  opciones: OpcionEncuestaDoc[];
  multiple: boolean;
  resultadosVisibles: boolean;
  estado: "borrador" | "abierta" | "cerrada";
  /** "YYYY-MM-DD"; ausente = sin fecha de cierre */
  cierra?: string;
  createdAt: FsTimestamp;
}

/* ── trapnexport-encuesta/{id}/voto/{uid} ────────────────────────────────── */

/** Lo que votó una persona en una encuesta.
 *
 *  **El id del documento es el uid**, y eso es todo el mecanismo de dedupe:
 *  Firestore no tiene índices únicos, así que la forma de garantizar un voto por
 *  cuenta es que el segundo voto caiga sobre el mismo documento que el primero.
 *  Es la misma idea que `trapnexport-handle` usa para los nombres de usuario.
 *
 *  Guarda el voto y no sólo "ya votó" porque el contador de `OpcionEncuestaDoc`
 *  hay que poder **corregirlo**: cambiar de opción tiene que restar de la
 *  anterior, y para eso el servidor necesita saber cuál era sin preguntarle al
 *  navegador, que puede mentir o simplemente haberlo olvidado al recargar.
 *
 *  Los votos anteriores al dedupe no tienen documento. Por eso el descuento
 *  nunca baja de cero: hay conteos viejos que no tienen a quién devolvérselos.
 */
export interface VotoDoc {
  /** ids de `OpcionEncuestaDoc`; uno solo salvo que la encuesta sea `multiple` */
  opciones: string[];
  /** la primera vez que votó; no se pisa al cambiar el voto */
  createdAt: FsTimestamp;
  updatedAt: FsTimestamp;
}

/** `trapnexport-invitacion/{id}`. Refleja `Invitacion`.
 *
 *  `code` es lo que va en la URL pública `/invitacion/:code`; se consulta por
 *  `where("code", "==", …)` (índice de campo único, automático) y es inmutable
 *  una vez emitido. */
export interface InvitacionDoc {
  code: string;
  invitado: string;
  titulo: string;
  mensaje: string;
  fecha: string;
  hora: string;
  lugar: string;
  plantilla: "gala" | "cancha" | "minima";
  efecto: "holo" | "aurora" | "flote";
  revelacion: "directa" | "lacre" | "cortina" | "raspar";
  estado: "activa" | "revocada";
  createdAt: FsTimestamp;
}

/** `trapnexport-evento/{id}`. Refleja `Evento`. Sin `fecha`: la comparten todos
 *  y vive en `CronogramaConfigDoc`. */
export interface EventoDoc {
  nombre: string;
  descripcion: string;
  /** "HH:mm" — hora de inicio dentro del día del cronograma */
  hora: string;
  /** minutos; puede cruzar la medianoche sin cambiar de día */
  duracion: number;
  lugar: string;
  tipo: "partido" | "entrenamiento" | "institucional" | "social";
  createdAt: FsTimestamp;
}

/** `trapnexport-config/cronograma`. El día en que ocurre **todo** el cronograma.
 *
 *  Un solo campo para toda la colección de eventos: moverlo es una escritura
 *  atómica y no un update de N filas donde la mitad podría quedarse atrás. */
export interface CronogramaConfigDoc {
  /** "YYYY-MM-DD" */
  fecha: string;
  updatedAt: FsTimestamp;
}

/* ── trapnexport-post/{id} ───────────────────────────────────────────────── */

/** Una imagen de una publicación. */
export interface PostMediaDoc {
  /** `downloadURL` de Firebase Storage (ver `lib/storage/post-image.ts`) */
  src: string;
  alt: string;
  /** ruta del archivo en el bucket, para borrarlo cuando se elimina el post.
   *  Ausente en publicaciones anteriores a la subida a Storage. */
  path?: string;
}

/** Una publicación del feed. `trapnexport-post/{id}`.
 *
 *  La escribe y la lee **el servidor** con el Admin SDK: el feed sale de Server
 *  Components y las escrituras son Server Actions que sacan el uid de la cookie
 *  de sesión. Por eso `firestore.rules` la deja abierta a lectura —el feed es
 *  público, se comparte por link— y cerrada a escritura desde el cliente.
 */
export interface PostDoc {
  /** uid de Firebase Auth de quien publicó */
  authorId: string;
  text: string;
  media: PostMediaDoc[];
  createdAt: FsTimestamp;
  /** uid de quienes reaccionaron; el contador sale del `length`.
   *
   *  Array embebido y no subcolección, al revés que `saved`: el like tiene
   *  contador visible y se muestran los primeros nombres, así que se lee en la
   *  misma lectura que la publicación. El techo es el tope de 1 MB del
   *  documento, que a ~30 bytes por uid son decenas de miles de likes. */
  likedBy: string[];
  shares: number;
  /** oculto por moderación: invisible en el feed, visible en `/admin`.
   *
   *  **Siempre presente, incluso en `false`.** No es cosmética: el feed
   *  consulta `where("hidden", "==", false)`, y una query de igualdad en
   *  Firestore **no devuelve** los documentos a los que les falta el campo. Un
   *  `hidden` opcional haría que las publicaciones nuevas no aparecieran. */
  hidden: boolean;
  /** comentarios vivos, desnormalizado.
   *
   *  Se guarda porque el feed muestra "Comentarios (N)" en cada publicación:
   *  contarlos de verdad sería una query por publicación en pantalla. Lo mueven
   *  `addComment` y `deleteComment` con `increment`, en el mismo lote que el
   *  alta o la baja del comentario. */
  commentCount: number;
}

/* ── trapnexport-comment/{id} ────────────────────────────────────────────── */

/** Un comentario o una respuesta. `trapnexport-comment/{id}`. */
export interface CommentDoc {
  /** id del documento en `trapnexport-post` */
  postId: string;
  /** uid de Firebase Auth de quien comentó */
  authorId: string;
  text: string;
  createdAt: FsTimestamp;
  likedBy: string[];
  /** `null` = comentario raíz; un id = respuesta a ese comentario */
  parentId: string | null;
  pinned?: boolean;
}

/* ── trapnexport-user/{uid}/saved/{postId} ───────────────────────────────── */

/** Una publicación guardada. **El id del documento es el id de la publicación**,
 *  así que guardar dos veces es escribir el mismo documento y no hay duplicados.
 *
 *  El documento no necesita más que la fecha: existir ya significa "guardada".
 */
export interface GuardadoDoc {
  createdAt: FsTimestamp;
}

/* ── trapnexport-conversacion/{id} ───────────────────────────────────────── */

export type ConversacionTipo = "directa" | "grupo";

/** El último mensaje, copiado dentro de la conversación.
 *
 *  Desnormalizado a propósito: la bandeja muestra la última línea de cada
 *  conversación, y sin esto listarla sería una query a la subcolección de
 *  mensajes por cada conversación. Lo escribe `enviarMensaje` en el mismo lote
 *  que el mensaje. */
export interface UltimoMensajeDoc {
  texto: string;
  autorId: string;
  at: FsTimestamp;
}

/** Una conversación: directa de a dos, o grupo. `trapnexport-conversacion/{id}`.
 *
 *  **El id de una directa es determinístico**: los dos uid ordenados y unidos
 *  por `__` (ver `idDirecta` en `lib/chat/queries.ts`). Firestore no tiene
 *  índices únicos, así que con id al azar dos personas escribiéndose por primera
 *  vez al mismo tiempo crearían dos conversaciones para el mismo par y los
 *  mensajes se partirían entre las dos. Es la misma solución que usa
 *  `trapnexport-handle` para los nombres de usuario.
 *
 *  Los grupos sí llevan id al azar: el mismo conjunto de personas puede tener
 *  dos grupos distintos, y eso es legítimo.
 */
export interface ConversacionDoc {
  tipo: ConversacionTipo;
  /** uid de los participantes. La bandeja se consulta con
   *  `where("participantIds", "array-contains", uid)`. */
  participantIds: string[];

  /* ── sólo en grupos ────────────────────────────────────────────────────── */
  nombre?: string;
  avatar?: string;
  avatarPath?: string;
  /** uid de quien lo creó */
  creadoPor?: string;

  /* ── denormalizado para la bandeja ─────────────────────────────────────── */
  ultimoMensaje?: UltimoMensajeDoc;

  /** hasta cuándo leyó cada participante, por uid.
   *
   *  Mapa dentro del documento y no subcolección: el "no leído" sale de comparar
   *  contra `ultimoMensaje.at`, sin leer un solo mensaje. Con el plantel entero
   *  son decenas de entradas, muy lejos del tope de 1 MB.
   *
   *  La contra es que cualquier participante puede escribir el mapa completo,
   *  así que `firestore.rules` exige que un update sólo toque **su propia
   *  clave**. */
  lastReadAt: Record<string, FsTimestamp>;

  createdAt: FsTimestamp;
  /** se mueve con cada mensaje: es el orden de la bandeja */
  updatedAt: FsTimestamp;
}

/* ── trapnexport-conversacion/{id}/mensaje/{id} ──────────────────────────── */

/** `"sistema"` es "Fulano agregó a Mengano": lo escribe el servidor, no tiene
 *  autor que mostrar y se dibuja centrado en vez de en una burbuja. Sin un tipo,
 *  esos avisos habría que fabricarlos en la UI a partir de nada. */
export type MensajeTipo = "texto" | "sistema";

export interface MensajeDoc {
  /** uid de quien escribió. En los de sistema es el uid de quien hizo la acción. */
  autorId: string;
  texto: string;
  tipo: MensajeTipo;
  at: FsTimestamp;
}

/* ── trapnexport-difusion/{id} ───────────────────────────────────────────── */

export type DifusionAlcance = "todos" | "plantel" | "seleccion";

/** El registro de una difusión del panel.
 *
 *  **No es el mecanismo de envío.** Una difusión se manda como conversaciones
 *  directas normales entre el club y cada destinatario — por eso cada uno puede
 *  contestar en privado sin ver a los demás. Este documento es la auditoría: sin
 *  él no hay forma de saber qué se comunicó ni a quiénes.
 */
export interface DifusionDoc {
  texto: string;
  alcance: DifusionAlcance;
  /** los uid a los que efectivamente se les escribió, ya resueltos */
  destinatarios: string[];
  /** uid del admin que apretó enviar. El remitente que ve la gente es el club
   *  (`CLUB_UID`); esto es para saber quién fue. */
  enviadoPor: string;
  createdAt: FsTimestamp;
}

/* ── trapnexport-notification/{id} ──────────────────────────────────────────── */

/** Un aviso de campanita. **Un documento por destinatario**, no un doc
 *  "broadcast" compartido: cada quien marca el suyo como leído por su lado, y
 *  un doc único se apagaría para todos apenas el primero lo abriera.
 *
 *  Lo escribe el servidor (`lib/social/notify.ts`): las Server Actions de
 *  `social/` (like, comentario, mensaje, post nuevo) y las de `contenido/`
 *  (cronograma, noticia publicada, votación abierta). La lista y el contador
 *  salen de `social/queries.ts`.
 */
export interface NotificacionDoc {
  /** a quién le pertenece. Hoy es el id de la cuenta semilla del feed; con
   *  Firebase Auth en el módulo público pasa a ser el uid, sin cambiar la forma. */
  userId: string;
  kind: NotificationKind;
  /** quién generó el hecho. Ausente en los avisos de plataforma (`cronograma`,
   *  `noticia`, `encuesta`), que no los produce una persona sino el panel. */
  actorId?: string;
  /** el título que se ve en la lista */
  text: string;
  /** la bajada; si falta, `getNotifications` pone una genérica según el `kind` */
  description?: string;
  href?: string;
  read: boolean;
  createdAt: FsTimestamp;
}

/* ── trapnexport-jugador/{slug} ──────────────────────────────────────────── */

/** Un integrante del plantel. El id del documento es el slug (`"naza-sochan"`),
 *  el mismo que hoy usa `JUGADORES` en `lib/trap-awards.ts` y el `?jugador=` de
 *  `/historia`.
 *
 *  Colección aparte de `trapnexport-user` porque son dos cosas distintas: el
 *  plantel es dato del club y existe aunque nadie se registre nunca; una cuenta
 *  es alguien que se registró. El puente entre las dos es `UserDoc.playerId`.
 *
 *  Los campos van en español porque replican el `Jugador` que ya existe.
 */
export interface JugadorDoc {
  nombre: string;
  /** cómo se lo nombra en la cancha */
  apodo: string;
  /** el handle sugerido al reclamar la cuenta; no reserva nada por sí solo */
  handle: string;
  /** llegó al plantel en esta edición */
  incorporacion?: boolean;
  /** posición en la lista. El orden no es alfabético y **importa**: las
   *  opciones de cada premio salen de acá, y ordenar por apellido le daría el
   *  primer lugar a la misma persona en las catorce votaciones. */
  orden: number;
}

/* ── la historia del club ────────────────────────────────────────────────── */

/** Los documentos de `lib/historia/`, uno por sección de `/historia`.
 *
 *  Todos se editan desde `/admin/historia` y los lee `historia/queries.ts` con
 *  el Admin SDK. Dos decisiones que se repiten en los siete:
 *
 *  1. **Los campos van en inglés**, al revés que el resto del panel. No es
 *     inconsistencia por descuido: replican uno a uno las entidades de
 *     `lib/historia/types.ts` (`Era`, `Season`, `Player`…), que son las que
 *     consumen las pantallas públicas y los componentes de la librería. Un
 *     mapper que tradujera `title` ↔ `titulo` en catorce campos sería una
 *     tabla de equivalencias que hay que mantener a mano para no ganar nada.
 *
 *  2. **Las listas van embebidas**, no en subcolecciones: los hitos de una
 *     etapa, las skills de un jugador o las fotos de una temporada se leen y
 *     se reescriben siempre con su padre, son pocas, y el tope de 1 MB por
 *     documento sobra. Una subcolección obligaría a un `get` extra por fila
 *     para dibujar una pantalla que ya se pide entera.
 */

/** `trapnexport-historia/club`. Identidad, palmarés y balance en una fila.
 *  Refleja `ClubIdentity` + `Trophy[]` + `Balance`. */
export interface HistoriaClubDoc {
  name: string;
  nickname: string;
  founded: number;
  stadium: string;
  colors: string;
  motto: string;
  /** cuántos pasaron por el plantel; el hero lo cuenta con `CountUp` */
  members: number;
  /** ruta o URL del escudo */
  crest: string;
  intro: string;
  trophies: { id: string; name: string; times: number; years: string; photo: string }[];
  balance: { finales: number; ganadas: number; perdidas: number; estrellas: number };
  updatedAt: FsTimestamp;
}

/** `trapnexport-era/{id}`. Refleja `Era`.
 *
 *  `orden` existe porque la línea de tiempo se lee **hacia adelante** y
 *  `period` es texto libre ("2023", "2020 — 2022"): ordenar por ese string
 *  pondría "2020 — 2022" después de "2023". El panel lo asigna al crear y lo
 *  cambia al subir/bajar una etapa. */
export interface EraDoc {
  period: string;
  title: string;
  tagline: string;
  description: string;
  photo: string;
  /** la etapa que todavía se está jugando marca el timeline como "en curso" */
  current?: boolean;
  stats: { label: string; value: string }[];
  milestones: {
    id: string;
    date: string;
    title: string;
    description: string;
    kind: string;
  }[];
  orden: number;
}

/** Una foto embebida en una temporada o en una ficha de jugador. Igual a
 *  `Photo` salvo que acá `src` es siempre un valor guardado: o la URL de
 *  Storage que subió el panel, o el data-URI generado de `lib/media.ts`. */
export interface FotoEmbebidaDoc {
  id: string;
  src: string;
  alt: string;
  caption: string;
  year: number;
}

/** Un clip embebido. Igual a `Clip`. */
export interface ClipEmbebidoDoc {
  id: string;
  title: string;
  description: string;
  year: number;
  duration: string;
  poster: string;
  motion: string;
  src?: string;
}

/** Una frase embebida (el cierre de una temporada o de una ficha). Igual a
 *  `Quote`. */
export interface FraseEmbebidaDoc {
  id: string;
  text: string;
  author: string;
  role: string;
  year: number;
  avatar: string;
}

/** `trapnexport-temporada/{año}`. Refleja `Season`.
 *
 *  El id del documento **es** el año (`"2025"`), no un id al azar: es lo que
 *  va en la URL pública `/historia/:año`, y con un id autogenerado esa ruta
 *  necesitaría un `where("year", "==", …)` para resolver cada visita. */
export interface TemporadaDoc {
  year: number;
  title: string;
  tagline: string;
  cover: string;
  competition: string;
  position: string;
  captain: string;
  topScorer: string;
  stats: { label: string; value: string }[];
  highlights: {
    id: string;
    month: string;
    title: string;
    description: string;
    kind: string;
  }[];
  /** ids de `trapnexport-historia-jugador`, con el motivo */
  hallOfFame: { playerId: string; reason: string }[];
  gallery: FotoEmbebidaDoc[];
  clips: ClipEmbebidoDoc[];
  quote?: FraseEmbebidaDoc;
}

/** `trapnexport-historia-jugador/{slug}`. Refleja `Player`.
 *
 *  Colección aparte de `trapnexport-jugador` porque son dos cosas distintas:
 *  aquélla es el plantel de la edición en curso —nombre, apodo, orden en las
 *  votaciones— y ésta es la ficha de trayectoria que se muestra en
 *  `/historia`, con carrera, fotos y clips. Comparten el slug a propósito, así
 *  que un jugador está en las dos con el mismo id y no hace falta traducir. */
export interface PlayerDoc {
  name: string;
  nickname: string;
  number: number;
  position: string;
  /** "2020 — 2023" o "2019 — hoy" */
  years: string;
  status: string;
  foot: string;
  height: string;
  birthplace: string;
  photo: string;
  avatar: string;
  bio: string;
  stats: { label: string; value: string }[];
  /** 0 a 100 — es la escala de `ProgressBar`, no una nota sobre 10 */
  skills: { label: string; value: number }[];
  career: {
    id: string;
    season: string;
    title: string;
    description: string;
    status: string;
  }[];
  gallery: FotoEmbebidaDoc[];
  clips: ClipEmbebidoDoc[];
  quote?: FraseEmbebidaDoc;
  /** posición en la grilla de jugadores; mismo motivo que `EraDoc.orden` */
  orden: number;
}

/** Las tres colecciones sueltas del archivo: frases, fotos del museo y clips.
 *
 *  Son la misma forma que sus versiones embebidas menos el `id` —el id del
 *  documento ya **es** el id, y guardarlo dos veces es un campo que se puede
 *  desincronizar— más el `orden` con el que se muestran. */

/** `trapnexport-frase/{id}`. Refleja `Quote`. */
export interface FraseDoc extends Omit<FraseEmbebidaDoc, "id"> {
  orden: number;
}

/** `trapnexport-foto/{id}`. Refleja `Photo` — el museo de `/historia`. */
export interface FotoDoc extends Omit<FotoEmbebidaDoc, "id"> {
  orden: number;
}

/** `trapnexport-clip/{id}`. Refleja `Clip` — la sección de video. */
export interface ClipDoc extends Omit<ClipEmbebidoDoc, "id"> {
  orden: number;
}
