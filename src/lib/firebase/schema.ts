import type { ClaimStatus, PlayerFicha } from "@/lib/social/types";

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
export type UserRole = "fan" | "player" | "admin";

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
  id: string;
  kind: "image" | "video";
  /** URL pública de Storage */
  src: string;
  /** ruta en el bucket, para poder borrar el archivo junto con el documento */
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
