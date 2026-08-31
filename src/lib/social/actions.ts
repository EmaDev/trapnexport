"use server";

import { revalidatePath } from "next/cache";

import { avatarUrl } from "@/lib/media";
import { db, newId } from "@/lib/social/store";
import type {
  GalleryItem,
  PiernaHabil,
  PlayerFicha,
  PostMediaItem,
  Posicion,
  RegisterResult,
} from "@/lib/social/types";

/** Escrituras del dominio, como Server Actions.
 *
 *  Es la mitad "write" del par con `queries.ts`. Las pantallas cliente reciben
 *  estas funciones como props y las llaman igual que a un fetch: no conocen el
 *  store. Cuando entre Firestore + Firebase Auth, cada cuerpo pasa a escribir
 *  en la colección y a validar el usuario del token; las firmas no cambian.
 *
 *  Todas revalidan las rutas afectadas, incluidas las del admin: el panel no
 *  tiene datos propios, mira exactamente lo mismo que el feed.
 */

const me = () => db.currentUserId;

const toggleIn = (list: string[], id: string, on: boolean) => {
  const i = list.indexOf(id);
  if (on && i === -1) list.push(id);
  if (!on && i !== -1) list.splice(i, 1);
};

const revalidatePublic = (postId?: string) => {
  revalidatePath("/");
  // El foro lee el mismo `getFeed()` que el feed: sin esto, un post publicado
  // desde el FAB no aparece hasta recargar.
  revalidatePath("/foro");
  if (postId) revalidatePath(`/post/${postId}`);
  revalidatePath("/perfil");
};

/* ── publicaciones ───────────────────────────────────────────────────────── */

/** Publica en el feed. `media` son imagenes ya reescaladas por
 *  `lib/media-upload.ts` — el compositor no manda el archivo original.
 *
 *  Un post puede ser solo texto o solo imagenes: lo unico que se rechaza es
 *  que no venga ninguna de las dos. */
export async function publishPost(
  text: string,
  media: PostMediaItem[] = [],
): Promise<void> {
  const clean = text.trim();
  // `slice(0, 4)`: `SocialPost` muestra cuatro y colapsa el resto en un "+N",
  // asi que mas de cuatro es peso que nadie ve.
  const fotos = media.filter((m) => m.src).slice(0, 4);
  if (!clean && fotos.length === 0) return;

  db.posts.unshift({
    id: newId("p"),
    authorId: me(),
    text: clean,
    media: fotos,
    createdAt: Date.now(),
    likedBy: [],
    savedBy: [],
    shares: 0,
  });

  revalidatePublic();
  revalidatePath("/admin");
  revalidatePath("/admin/publicaciones");
}

export async function toggleLike(postId: string, liked: boolean): Promise<void> {
  const post = db.posts.find((p) => p.id === postId);
  if (!post) return;

  toggleIn(post.likedBy, me(), liked);
  revalidatePublic(postId);
}

export async function toggleSave(postId: string, saved: boolean): Promise<void> {
  const post = db.posts.find((p) => p.id === postId);
  if (!post) return;

  toggleIn(post.savedBy, me(), saved);
  revalidatePublic(postId);
}

export async function registerShare(postId: string): Promise<void> {
  const post = db.posts.find((p) => p.id === postId);
  if (!post) return;

  post.shares += 1;
  revalidatePublic(postId);
}

/* ── perfil propio ──────────────────────────────────────────────────── */

/** Cambia la foto de perfil.
 *
 *  `src` es un data-URI (subida propia, ya reescalada) o uno de los avatares
 *  generados por `avatarUrl`. Los dos son strings y el store no distingue: el
 *  dia que haya Storage, aca llega la URL del bucket y este cuerpo no cambia.
 *
 *  Revalida `/u/[handle]` ademas del feed: el avatar viejo quedaria cacheado en
 *  el perfil publico de la misma persona.
 */
export async function updateAvatar(src: string): Promise<void> {
  const user = db.users.find((u) => u.id === me());
  if (!user || !src) return;

  user.avatar = src;

  revalidatePublic();
  revalidatePath(`/u/${user.handle}`);
  revalidatePath("/admin/usuarios");
}

/** Reemplaza la ficha deportiva entera.
 *
 *  Entera y no campo por campo: el panel es un formulario con Guardar, no
 *  autoguardado por input. Un campo vacio se borra (queda `undefined`), que es
 *  justo lo que espera quien limpia el input y guarda.
 *
 *  Los rangos se validan aca y no solo en el `<input type=number>`: el input
 *  frena a un dedo distraido, esto frena a cualquiera que llame la action.
 */
export async function updateFicha(input: {
  edad?: number | null;
  peso?: number | null;
  altura?: number | null;
  dorsal?: number | null;
  piernaHabil?: string | null;
  posicion?: string | null;
  ciudad?: string | null;
  bio?: string | null;
}): Promise<void> {
  const user = db.users.find((u) => u.id === me());
  if (!user) return;

  /** Numero dentro de rango, o `undefined` (que borra el campo). Rechaza NaN,
   *  negativos y decimales donde no corresponde. */
  const num = (v: number | null | undefined, min: number, max: number, dec = 0) => {
    if (v === null || v === undefined || Number.isNaN(v)) return undefined;
    if (v < min || v > max) return undefined;
    return dec === 0 ? Math.round(v) : Math.round(v * 10 ** dec) / 10 ** dec;
  };

  const enumOf = <T extends string>(v: string | null | undefined, valid: readonly T[]) =>
    v && (valid as readonly string[]).includes(v) ? (v as T) : undefined;

  const POSICIONES = [
    "arquero",
    "defensor",
    "mediocampista",
    "delantero",
    "polifuncional",
  ] as const satisfies readonly Posicion[];
  const PIERNAS = ["derecha", "izquierda", "ambidiestro"] as const satisfies readonly PiernaHabil[];

  const ficha: PlayerFicha = {
    edad: num(input.edad, 10, 80),
    peso: num(input.peso, 30, 200, 1),
    altura: num(input.altura, 120, 230),
    dorsal: num(input.dorsal, 1, 99),
    piernaHabil: enumOf(input.piernaHabil, PIERNAS),
    posicion: enumOf(input.posicion, POSICIONES),
    ciudad: input.ciudad?.trim().slice(0, 40) || undefined,
  };

  user.ficha = ficha;
  // La bio no es parte de la ficha (es dato de la red social, no del jugador)
  // pero se edita en el mismo panel: es un solo Guardar para el usuario.
  if (input.bio !== undefined) user.bio = input.bio?.trim().slice(0, 160) || undefined;

  revalidatePublic();
  revalidatePath(`/u/${user.handle}`);
}

/** Suma una foto o un video al carrete personal.
 *
 *  No publica nada en el feed: el carrete es material propio del perfil. Para
 *  que salga al feed hay que pasarlo por el compositor (`publishPost`).
 */
export async function addGalleryItem(input: {
  kind: GalleryItem["kind"];
  src: string;
  alt?: string;
}): Promise<void> {
  const user = db.users.find((u) => u.id === me());
  if (!user || !input.src) return;
  if (input.kind !== "image" && input.kind !== "video") return;

  user.gallery ??= [];
  user.gallery.push({
    id: newId("g"),
    kind: input.kind,
    src: input.src,
    alt: input.alt?.trim().slice(0, 80) || (input.kind === "video" ? "Video" : "Foto"),
    addedAt: Date.now(),
  });

  revalidatePath("/perfil");
  revalidatePath(`/u/${user.handle}`);
}

export async function removeGalleryItem(id: string): Promise<void> {
  const user = db.users.find((u) => u.id === me());
  if (!user?.gallery) return;

  user.gallery = user.gallery.filter((g) => g.id !== id);

  revalidatePath("/perfil");
  revalidatePath(`/u/${user.handle}`);
}

/* ── comentarios ─────────────────────────────────────────────────────────── */

export async function addComment(
  postId: string,
  text: string,
  parentId?: string | null,
): Promise<void> {
  const clean = text.trim();
  if (!clean) return;

  db.comments.push({
    id: newId("c"),
    postId,
    authorId: me(),
    text: clean,
    createdAt: Date.now(),
    likedBy: [],
    parentId: parentId ?? null,
  });

  revalidatePublic(postId);
  revalidatePath("/admin");
}

export async function toggleCommentLike(commentId: string, liked: boolean): Promise<void> {
  const comment = db.comments.find((c) => c.id === commentId);
  if (!comment) return;

  toggleIn(comment.likedBy, me(), liked);
  revalidatePublic(comment.postId);
}

export async function deleteComment(commentId: string): Promise<void> {
  const i = db.comments.findIndex((c) => c.id === commentId);
  if (i === -1) return;

  const [removed] = db.comments.splice(i, 1);
  // las respuestas de un comentario borrado quedarían huérfanas
  db.comments = db.comments.filter((c) => c.parentId !== commentId);

  revalidatePublic(removed.postId);
  revalidatePath("/admin");
}

/* ── chat ────────────────────────────────────────────────────────────────── */

export async function sendMessage(conversationId: string, text: string): Promise<void> {
  const clean = text.trim();
  const conv = db.conversations.find((c) => c.id === conversationId);
  if (!conv || !clean) return;

  conv.messages.push({ id: newId("m"), fromId: me(), text: clean, at: Date.now() });

  revalidatePath("/chat");
  revalidatePath(`/chat/${conversationId}`);
}

/* ── notificaciones ──────────────────────────────────────────────────────── */

export async function markNotificationRead(id: string): Promise<void> {
  const n = db.notifications.find((x) => x.id === id);
  if (n) n.read = true;
  revalidatePath("/notificaciones");
}

export async function markAllNotificationsRead(): Promise<void> {
  db.notifications.filter((n) => n.userId === me()).forEach((n) => (n.read = true));
  revalidatePath("/notificaciones");
}

export async function dismissNotification(id: string): Promise<void> {
  db.notifications = db.notifications.filter((n) => n.id !== id);
  revalidatePath("/notificaciones");
}

/* ── cuentas (registro) ──────────────────────────────────────────────────── */

/** Alta de una cuenta que NO es del plantel: nombre y handle libres, sin
 *  reclamo ni revisión de admin. El uid ya existe —el formulario llama a
 *  Firebase Auth antes que a esto— y acá sólo se crea el perfil social. */
export async function registerFan(input: {
  authUid: string;
  name: string;
  handle: string;
}): Promise<RegisterResult> {
  const name = input.name.trim();
  const handle = input.handle.trim().toLowerCase();

  if (name.length < 2) return { ok: false, error: "Ingresá tu nombre." };
  if (!/^[a-z0-9._]{3,20}$/.test(handle)) {
    return {
      ok: false,
      error: "El usuario va de 3 a 20 caracteres: minúsculas, números, punto o guion bajo.",
    };
  }
  if (db.users.some((u) => u.handle.toLowerCase() === handle)) {
    return { ok: false, error: "Ese nombre de usuario ya está en uso." };
  }

  db.users.push({
    id: newId("u"),
    name,
    handle,
    avatar: avatarUrl(name, handle),
    authUid: input.authUid,
    joinedAt: Date.now(),
  });

  revalidatePath("/admin/usuarios");
  revalidatePath("/admin");
  return { ok: true };
}

/** Alguien dice ser un jugador del plantel: la cuenta ya existe (viene de
 *  `JUGADORES`, sembrada en `store.ts`), así que esto no crea una fila nueva
 *  — vincula el uid recién creado en Firebase Auth a la cuenta del jugador
 *  elegido y deja el reclamo en `pending` hasta que el admin lo confirme. */
export async function claimPlayerAccount(input: {
  playerId: string;
  authUid: string;
  note?: string;
}): Promise<RegisterResult> {
  const player = db.users.find((u) => u.id === input.playerId);
  if (!player) return { ok: false, error: "Ese jugador no existe." };
  if (player.authUid) return { ok: false, error: "Esa cuenta ya fue reclamada por alguien." };

  player.authUid = input.authUid;
  player.claim = {
    note: input.note?.trim() || undefined,
    status: "pending",
    requestedAt: Date.now(),
  };

  revalidatePath("/admin/usuarios");
  revalidatePath("/admin");
  return { ok: true };
}

/* ── moderación (sólo /admin) ────────────────────────────────────────────── */

export async function setPostHidden(postId: string, hidden: boolean): Promise<void> {
  const post = db.posts.find((p) => p.id === postId);
  if (!post) return;

  post.hidden = hidden;
  revalidatePublic(postId);
  revalidatePath("/admin");
  revalidatePath("/admin/publicaciones");
}

export async function deletePost(postId: string): Promise<void> {
  db.posts = db.posts.filter((p) => p.id !== postId);
  db.comments = db.comments.filter((c) => c.postId !== postId);

  revalidatePublic();
  revalidatePath("/admin");
  revalidatePath("/admin/publicaciones");
}

export async function setUserSuspended(userId: string, suspended: boolean): Promise<void> {
  const user = db.users.find((u) => u.id === userId);
  if (!user || user.id === me()) return;

  user.suspended = suspended;
  revalidatePublic();
  revalidatePath("/admin");
  revalidatePath("/admin/usuarios");
}

/** El admin confirma (o no) que quien se registró diciendo "soy Fulano" es
 *  realmente Fulano. Aprobar marca la cuenta como verificada; rechazar libera
 *  el `authUid` para que la cuenta vuelva a estar disponible — la persona
 *  puede reintentar, o el jugador real puede reclamarla después. */
export async function reviewClaim(
  userId: string,
  decision: "approved" | "rejected",
): Promise<void> {
  const user = db.users.find((u) => u.id === userId);
  if (!user?.claim || user.claim.status !== "pending") return;

  user.claim.status = decision;
  user.claim.reviewedAt = Date.now();

  if (decision === "approved") {
    user.verified = true;
  } else {
    user.authUid = undefined;
  }

  revalidatePublic();
  revalidatePath("/admin");
  revalidatePath("/admin/usuarios");
}
