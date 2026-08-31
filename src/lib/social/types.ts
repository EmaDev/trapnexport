/** Modelo de dominio de la red social.
 *
 *  Es el contrato entre el módulo público (`/`) y el módulo de administración
 *  (`/admin`): los dos leen y escriben estas mismas entidades. Los tipos de la
 *  UI (`PostAuthor`, `PostComment`, `AppNotification`) se derivan de acá en los
 *  mappers de `queries.ts` — ninguna pantalla arma props a mano.
 */

export type UserId = string;

export type ClaimStatus = "pending" | "approved" | "rejected";

/** Alguien se registró diciendo "soy este jugador del plantel" y falta que el
 *  admin confirme que es quien dice ser. Vive en el `User` del jugador
 *  reclamado, no en una tabla aparte: la cuenta y el reclamo son la misma
 *  fila hasta que se apruebe o se rechace. */
export interface TeamClaim {
  /** lo que la persona escribió para que el admin la reconozca */
  note?: string;
  status: ClaimStatus;
  requestedAt: number;
  reviewedAt?: number;
}

/** Resultado de las escrituras de registro (`registerFan`, `claimPlayerAccount`
 *  en `actions.ts`). Vive acá y no en `actions.ts` porque un archivo
 *  `"use server"` sólo puede exportar funciones async. */
export type RegisterResult = { ok: true } | { ok: false; error: string };

export interface User {
  id: UserId;
  name: string;
  handle: string;
  avatar: string;
  bio?: string;
  verified?: boolean;
  /** el admin puede suspender una cuenta: deja de aparecer en el feed público */
  suspended?: boolean;
  joinedAt: number;
  /** uid de Firebase Auth vinculado a esta cuenta, una vez que alguien se
   *  registra con este `id`. Sin esto, la cuenta existe (viene de `JUGADORES`)
   *  pero nadie la reclamó todavía. */
  authUid?: string;
  /** presente sólo en cuentas del plantel reclamadas por alguien */
  claim?: TeamClaim;
  /** datos deportivos, editables desde `/perfil` */
  ficha?: PlayerFicha;
  /** carrete propio: fotos y videos subidos sin publicar en el feed */
  gallery?: GalleryItem[];
}

/* ── ficha del jugador ───────────────────────────────────────────────────── */

/** Las cinco posiciones que se usan en la cancha del club. El `value` es lo que
 *  se guarda; el label sale de `POSICION_LABEL` para que la UI no invente
 *  textos y el panel de admin lea lo mismo que el perfil. */
export type Posicion = "arquero" | "defensor" | "mediocampista" | "delantero" | "polifuncional";

export const POSICION_LABEL: Record<Posicion, string> = {
  arquero: "Arquero",
  defensor: "Defensor",
  mediocampista: "Mediocampista",
  delantero: "Delantero",
  polifuncional: "Polifuncional",
};

export type PiernaHabil = "derecha" | "izquierda" | "ambidiestro";

export const PIERNA_LABEL: Record<PiernaHabil, string> = {
  derecha: "Derecha",
  izquierda: "Izquierda",
  ambidiestro: "Ambidiestro",
};

/** Los datos deportivos de una cuenta: lo que edita el panel del perfil.
 *
 *  Todo opcional a propósito — una cuenta recién creada no tiene ficha, y una
 *  cuenta de hincha nunca va a tener dorsal. La UI muestra sólo lo cargado.
 *
 *  Es un objeto aparte y no campos sueltos en `User` porque se escribe y se
 *  valida como una unidad (`updateFicha` en `actions.ts` la reemplaza entera),
 *  y porque separa el dato deportivo del dato de cuenta: nombre, handle y
 *  avatar son de la red social; esto es del jugador.
 */
export interface PlayerFicha {
  /** años; el editor la acota a 10–80 antes de guardar */
  edad?: number;
  /** kilos, un decimal */
  peso?: number;
  /** centímetros */
  altura?: number;
  piernaHabil?: PiernaHabil;
  posicion?: Posicion;
  /** número de camiseta, 1–99; único no está garantizado todavía */
  dorsal?: number;
  /** de dónde es; texto libre y corto, va debajo del nombre */
  ciudad?: string;
}

/** Una foto o un video del carrete personal de la cuenta.
 *
 *  Vive en el `User` y no en `Post`: son dos cosas distintas: esto es material
 *  propio que se muestra en el perfil, un post es algo publicado en el feed.
 *  Se puede subir acá sin publicar nada.
 *
 *  `src` es hoy un data-URI (ver `lib/media-upload.ts`, que además reescala las
 *  imágenes antes de subirlas). Cuando entre Firebase Storage, `src` pasa a ser
 *  la URL del bucket y no cambia nada más.
 */
export interface GalleryItem {
  id: string;
  kind: "image" | "video";
  src: string;
  alt: string;
  addedAt: number;
}

export interface PostMediaItem {
  /** `downloadURL` de Firebase Storage (ver `lib/storage/post-image.ts`) */
  src: string;
  alt: string;
  /** ruta del archivo en el bucket (`trapnexport-post/…`), para borrarlo cuando
   *  se elimina el post. Ausente en data semilla y en posts viejos sin subida. */
  path?: string;
}

export interface Post {
  id: string;
  authorId: UserId;
  text: string;
  media: PostMediaItem[];
  createdAt: number;
  /** ids de quienes reaccionaron; el contador sale del length */
  likedBy: UserId[];
  savedBy: UserId[];
  shares: number;
  /** oculto por moderación: invisible en el feed, visible en /admin */
  hidden?: boolean;
}

export interface CommentRow {
  id: string;
  postId: string;
  authorId: UserId;
  text: string;
  createdAt: number;
  likedBy: UserId[];
  /** null = comentario raíz; un id = respuesta */
  parentId?: string | null;
  pinned?: boolean;
}

export interface Message {
  id: string;
  fromId: UserId;
  text: string;
  at: number;
}

export interface Conversation {
  id: string;
  /** siempre dos: la librería no trae mensajería de grupo */
  participantIds: [UserId, UserId];
  messages: Message[];
}

/** Los tipos de aviso de campanita.
 *
 *  Los tres primeros los dispara otro usuario sobre algo tuyo (`actorId`
 *  siempre presente). Los cuatro nuevos son de plataforma:
 *
 *  - `post`       — otra cuenta publicó en el feed
 *  - `message`    — te llegó un mensaje privado
 *  - `cronograma` — cambió el cronograma del evento (sin actor: lo edita el panel)
 *  - `noticia`    — se publicó una noticia (sin actor)
 */
export type NotificationKind =
  | "like"
  | "comment"
  | "mention"
  | "post"
  | "message"
  | "cronograma"
  | "noticia";

export interface NotificationRow {
  id: string;
  /** dueño de la notificación */
  userId: UserId;
  kind: NotificationKind;
  /** quién la generó; ausente en los avisos de plataforma (`cronograma`,
   *  `noticia`), que no los produce una persona sino el panel */
  actorId?: UserId;
  text: string;
  /** bajada propia de esta notificación; si falta, `getNotifications` pone una
   *  genérica según el `kind` */
  description?: string;
  href?: string;
  at: number;
  read?: boolean;
}
