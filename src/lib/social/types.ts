/** Modelo de dominio de la red social.
 *
 *  Es el contrato entre el módulo público (`/`) y el módulo de administración
 *  (`/admin`): los dos leen y escriben estas mismas entidades. Los tipos de la
 *  UI (`PostAuthor`, `PostComment`, `AppNotification`) se derivan de acá en los
 *  mappers de `queries.ts` — ninguna pantalla arma props a mano.
 */

export type UserId = string;

export type ClaimStatus = "pending" | "approved" | "rejected";

/** Resultado de las escrituras de registro (`registerFan`, `claimPlayer` en
 *  `lib/auth/register.ts`). Vive acá y no ahí porque un archivo `"use server"`
 *  sólo puede exportar funciones async. */
export type RegisterResult = { ok: true } | { ok: false; error: string };

/*  Acá vivían `User` y `TeamClaim`, la cuenta del store en memoria.
 *
 *  Se fueron con `db.users`: la cuenta ahora es `UserDoc` en
 *  `lib/firebase/schema.ts` —un documento de Firestore cuyo id es el uid de
 *  Firebase Auth— y el reclamo del plantel es `UserClaimDoc`. Para leerlas
 *  desde el módulo social está `lib/social/directorio.ts`, que las devuelve
 *  como `Cuenta`.
 *
 *  Tener las dos formas conviviendo era una trampa: dos tipos llamados casi
 *  igual, con el mismo campo `id` significando cosas distintas —el slug del
 *  jugador en uno, el uid en el otro— y nada que impidiera pasar uno donde iba
 *  el otro. */

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
/** Una habilidad puntuada, tal como la carga el propio jugador en `/perfil`.
 *
 *  Misma forma y misma escala que `PlayerSkill` de `lib/historia/types.ts`
 *  —`label` + `value` de 0 a 100— y es a propósito: las dos alimentan la misma
 *  barra en `PlayerSpotlight` y el mismo promedio en `construirCarta`, así que
 *  tienen que ser intercambiables sin traducir nada.
 *
 *  Está declarada acá y no importada de la historia para no cruzar los dos
 *  módulos: `lib/historia/types.ts` ya importa `PlayerFicha` de este archivo, y
 *  la vuelta importaría un ciclo entre dos archivos de tipos por una interfaz
 *  de dos campos. TypeScript es estructural: donde se espera un `PlayerSkill`
 *  esto entra igual.
 */
export interface FichaSkill {
  label: string;
  /** 0 a 100 — es la escala de la barra, no una nota sobre 10 */
  value: number;
}

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
  /** lo que se cree bueno haciendo, puntuado por él mismo.
   *
   *  Ausente —y no `[]`— cuando nunca cargó ninguna: la diferencia importa
   *  porque es lo que decide si `/historia` muestra estas skills o cae a las
   *  que tenga la ficha institucional del club. */
  skills?: FichaSkill[];
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

/*  Acá vivían `Post` y `CommentRow`, las filas del store en memoria.
 *
 *  Se fueron con `db.posts` y `db.comments`: ahora son `PostDoc` y `CommentDoc`
 *  en `lib/firebase/schema.ts`. `PostMediaItem` se queda porque es lo que el
 *  compositor le pasa a `publishPost` —el resultado de subir al bucket, antes de
 *  que exista ningún documento— y no tiene por qué saber de Firestore.
 *
 *  Dos diferencias con lo que había, y las dos tienen su porqué escrito en el
 *  schema: `savedBy` ya no está en la publicación sino en
 *  `trapnexport-user/{uid}/saved`, y `hidden` dejó de ser opcional. */

/*  Y acá vivían `Message` y `Conversation`, con `participantIds` como una tupla
 *  de exactamente dos y los mensajes en un array embebido.
 *
 *  El chat entero se fue a `lib/chat/`: `ConversacionDoc` y `MensajeDoc` en el
 *  schema. Las dos formas cambiaron por lo mismo —ahora hay grupos—: los
 *  participantes son `string[]` y los mensajes una subcolección, porque una
 *  conversación activa supera el tope de 1 MB del documento. */

/** Los tipos de aviso de campanita.
 *
 *  Los tres primeros los dispara otro usuario sobre algo tuyo (`actorId`
 *  siempre presente). Los cuatro nuevos son de plataforma:
 *
 *  - `post`       — otra cuenta publicó en el feed
 *  - `message`    — te llegó un mensaje privado
 *  - `cronograma` — cambió el cronograma del evento (sin actor: lo edita el panel)
 *  - `noticia`    — se publicó una noticia (sin actor)
 *  - `encuesta`   — se abrió una votación nueva (sin actor)
 */
export type NotificationKind =
  | "like"
  | "comment"
  | "mention"
  | "post"
  | "message"
  | "cronograma"
  | "noticia"
  | "encuesta";

/*  La notificación guardada vive en Firestore (`trapnexport-notification`); su
 *  forma es `NotificacionDoc` en `lib/firebase/schema.ts`. Acá queda sólo el
 *  `NotificationKind`, que lo comparten el escritor (`social/notify.ts`) y el
 *  mapper de lectura (`social/queries.ts`). */
