"use server";

import { FieldValue } from "firebase-admin/firestore";
import { revalidatePath } from "next/cache";

import { getCurrentUid } from "@/lib/auth/sesion";
import { adminDb } from "@/lib/firebase/admin";
import { COL } from "@/lib/firebase/collections";
import { getDirectorio } from "@/lib/social/directorio";
import { notifyAll, notifyUser } from "@/lib/social/notify";
import { db, newId } from "@/lib/social/store";
import type {
  GalleryItem,
  PiernaHabil,
  PlayerFicha,
  PostMediaItem,
  Posicion,
} from "@/lib/social/types";

/** Escrituras del dominio, como Server Actions.
 *
 *  Es la mitad "write" del par con `queries.ts`. Las pantallas cliente reciben
 *  estas funciones como props y las llaman igual que a un fetch: no conocen el
 *  store.
 *
 *  **Quién escribe sale de la cookie de sesión**, no de un parámetro. Antes era
 *  `db.currentUserId`, una constante: cualquiera que llamara una de estas
 *  acciones escribía como la misma cuenta. Ahora cada una arranca pidiendo el
 *  uid, y sin sesión no hace nada — que no es redundante con esconder el botón
 *  en la UI: una Server Action es un endpoint POST que se puede invocar sin
 *  pasar por ninguna pantalla.
 *
 *  Se sale en silencio en vez de tirar un error, igual que cuando el post no
 *  existe: las pantallas ya gatean por sesión, así que llegar acá sin ella es
 *  una llamada que nadie hizo desde la app y no hay a quién avisarle.
 *
 *  Todas revalidan las rutas afectadas, incluidas las del admin: el panel no
 *  tiene datos propios, mira exactamente lo mismo que el feed.
 */

/** Nombre para el texto de una notificación; "Alguien" si la cuenta ya no está. */
const nombreDe = async (uid: string) => (await getDirectorio()).byId(uid)?.name ?? "Alguien";

/** El handle de una cuenta, para revalidar su perfil público. */
const handleDe = async (uid: string) => (await getDirectorio()).byId(uid)?.handle;

const toggleIn = (list: string[], id: string, on: boolean) => {
  const i = list.indexOf(id);
  if (on && i === -1) list.push(id);
  if (!on && i !== -1) list.splice(i, 1);
};

/** Primer renglón de un texto para la bajada de una notificación: una línea,
 *  sin cortar a mitad de palabra y con puntos suspensivos si sobra. */
const recorte = (s: string, max = 90) => {
  const linea = s.trim().split("\n")[0];
  if (linea.length <= max) return linea;
  return linea.slice(0, linea.lastIndexOf(" ", max) > 0 ? linea.lastIndexOf(" ", max) : max) + "…";
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

/** Publica en el feed. `media` son las imagenes YA comprimidas y subidas a
 *  Firebase Storage por el compositor (`lib/storage/post-image.ts`): cada item
 *  trae la `downloadURL` en `src` y su ruta en el bucket en `path`. Por aci no
 *  viaja ningun archivo.
 *
 *  Un post puede ser solo texto o solo imagenes: lo unico que se rechaza es
 *  que no venga ninguna de las dos. */
export async function publishPost(
  text: string,
  media: PostMediaItem[] = [],
): Promise<void> {
  const uid = await getCurrentUid();
  if (!uid) return;

  const clean = text.trim();
  // `slice(0, 4)`: `SocialPost` muestra cuatro y colapsa el resto en un "+N",
  // asi que mas de cuatro es peso que nadie ve.
  const fotos = media.filter((m) => m.src).slice(0, 4);
  if (!clean && fotos.length === 0) return;

  const id = newId("p");
  db.posts.unshift({
    id,
    authorId: uid,
    text: clean,
    media: fotos,
    createdAt: Date.now(),
    likedBy: [],
    savedBy: [],
    shares: 0,
  });

  // Aviso de campanita al resto de la comunidad: alguien publicó en el feed.
  // `notifyAll` ya excluye al autor.
  await notifyAll({
    kind: "post",
    actorId: uid,
    text: `${await nombreDe(uid)} publicó en el feed`,
    description: clean ? recorte(clean) : "Compartió fotos",
    href: `/post/${id}`,
  });

  revalidatePublic();
  revalidatePath("/notificaciones");
  revalidatePath("/admin");
  revalidatePath("/admin/publicaciones");
}

export async function toggleLike(postId: string, liked: boolean): Promise<void> {
  const uid = await getCurrentUid();
  if (!uid) return;

  const post = db.posts.find((p) => p.id === postId);
  if (!post) return;

  const yaEstaba = post.likedBy.includes(uid);
  toggleIn(post.likedBy, uid, liked);

  // Un aviso al autor por cada like NUEVO —quitar y volver a poner el like
  // vuelve a avisar, sacarlo no—. `notifyUser` ya descarta el like a uno mismo.
  if (liked && !yaEstaba) {
    await notifyUser(post.authorId, {
      kind: "like",
      actorId: uid,
      text: `A ${await nombreDe(uid)} le gustó tu publicación`,
      description: recorte(post.text) || "Tu publicación",
      href: `/post/${postId}`,
    });
    revalidatePath("/notificaciones");
  }

  revalidatePublic(postId);
}

export async function toggleSave(postId: string, saved: boolean): Promise<void> {
  const uid = await getCurrentUid();
  if (!uid) return;

  const post = db.posts.find((p) => p.id === postId);
  if (!post) return;

  toggleIn(post.savedBy, uid, saved);
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
 *  generados por `avatarUrl`. El dia que haya Storage (Fase 4) aca llega la URL
 *  del bucket y este cuerpo no cambia — salvo por `avatarPath`, que hace falta
 *  para poder borrar el archivo anterior.
 *
 *  Escribe en `trapnexport-user/{uid}` con el Admin SDK. Las reglas dejarian que
 *  lo hiciera el navegador (`avatar` esta en `editableByOwner`), pero el uid de
 *  la cookie es una fuente mas confiable que un campo del formulario, y asi la
 *  pantalla no tiene que saber de Firestore.
 *
 *  Revalida `/u/[handle]` ademas del feed: el avatar viejo quedaria cacheado en
 *  el perfil publico de la misma persona.
 */
export async function updateAvatar(src: string): Promise<void> {
  const uid = await getCurrentUid();
  if (!uid || !src) return;

  await adminDb()
    .collection(COL.user)
    .doc(uid)
    .update({ avatar: src, updatedAt: FieldValue.serverTimestamp() })
    .catch(() => {});

  const handle = await handleDe(uid);

  revalidatePublic();
  if (handle) revalidatePath(`/u/${handle}`);
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
  const uid = await getCurrentUid();
  if (!uid) return;

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

  /*  Firestore rechaza `undefined`, y acá `undefined` significa "borrá este
   *  campo" —es lo que espera quien limpia el input y guarda—. `deleteField()`
   *  es cómo se dice eso. Ojo: `ficha` se reemplaza entera, así que un campo
   *  que no viene se va solo; el `deleteField` es para `bio`, que es de nivel
   *  superior y no se reescribe entera. */
  const limpia = Object.fromEntries(
    Object.entries(ficha).filter(([, v]) => v !== undefined),
  ) as PlayerFicha;

  const cambios: Record<string, unknown> = {
    ficha: limpia,
    updatedAt: FieldValue.serverTimestamp(),
  };

  // La bio no es parte de la ficha (es dato de la red social, no del jugador)
  // pero se edita en el mismo panel: es un solo Guardar para el usuario.
  if (input.bio !== undefined) {
    const bio = input.bio?.trim().slice(0, 160);
    cambios.bio = bio || FieldValue.delete();
  }

  await adminDb().collection(COL.user).doc(uid).update(cambios).catch(() => {});

  const handle = await handleDe(uid);

  revalidatePublic();
  if (handle) revalidatePath(`/u/${handle}`);
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
  const uid = await getCurrentUid();
  if (!uid || !input.src) return;
  if (input.kind !== "image" && input.kind !== "video") return;

  (db.gallery[uid] ??= []).push({
    id: newId("g"),
    kind: input.kind,
    src: input.src,
    alt: input.alt?.trim().slice(0, 80) || (input.kind === "video" ? "Video" : "Foto"),
    addedAt: Date.now(),
  });

  const handle = await handleDe(uid);

  revalidatePath("/perfil");
  if (handle) revalidatePath(`/u/${handle}`);
}

export async function removeGalleryItem(id: string): Promise<void> {
  const uid = await getCurrentUid();
  if (!uid) return;

  const carrete = db.gallery[uid];
  if (!carrete) return;

  db.gallery[uid] = carrete.filter((g) => g.id !== id);

  const handle = await handleDe(uid);

  revalidatePath("/perfil");
  if (handle) revalidatePath(`/u/${handle}`);
}

/* ── comentarios ─────────────────────────────────────────────────────────── */

export async function addComment(
  postId: string,
  text: string,
  parentId?: string | null,
): Promise<void> {
  const uid = await getCurrentUid();
  if (!uid) return;

  const clean = text.trim();
  if (!clean) return;

  db.comments.push({
    id: newId("c"),
    postId,
    authorId: uid,
    text: clean,
    createdAt: Date.now(),
    likedBy: [],
    parentId: parentId ?? null,
  });

  // Aviso al autor del post por cada comentario (una respuesta también lo es).
  // `notifyUser` descarta comentar el propio post.
  const post = db.posts.find((p) => p.id === postId);
  if (post) {
    await notifyUser(post.authorId, {
      kind: "comment",
      actorId: uid,
      text: `${await nombreDe(uid)} comentó tu publicación`,
      description: recorte(clean),
      href: `/post/${postId}`,
    });
    revalidatePath("/notificaciones");
  }

  revalidatePublic(postId);
  revalidatePath("/admin");
}

export async function toggleCommentLike(commentId: string, liked: boolean): Promise<void> {
  const uid = await getCurrentUid();
  if (!uid) return;

  const comment = db.comments.find((c) => c.id === commentId);
  if (!comment) return;

  toggleIn(comment.likedBy, uid, liked);
  revalidatePublic(comment.postId);
}

/** Borra un comentario propio.
 *
 *  El corte por autor es nuevo, y hace falta desde que la identidad es real:
 *  mientras todos escribían como la misma cuenta semilla, "es mío" era cierto
 *  para cualquier comentario y la comprobación no hubiera hecho nada. Ahora sin
 *  esto cualquiera borra el comentario de cualquiera con un POST.
 *
 *  La moderación del panel no pasa por acá: `/admin/publicaciones` borra
 *  publicaciones enteras con `deletePost`, detrás de `requireAdmin()`.
 */
export async function deleteComment(commentId: string): Promise<void> {
  const uid = await getCurrentUid();
  if (!uid) return;

  const i = db.comments.findIndex((c) => c.id === commentId);
  if (i === -1) return;
  if (db.comments[i].authorId !== uid) return;

  const [removed] = db.comments.splice(i, 1);
  // las respuestas de un comentario borrado quedarían huérfanas
  db.comments = db.comments.filter((c) => c.parentId !== commentId);

  revalidatePublic(removed.postId);
  revalidatePath("/admin");
}

/* ── chat ────────────────────────────────────────────────────────────────── */

export async function sendMessage(conversationId: string, text: string): Promise<void> {
  const uid = await getCurrentUid();
  if (!uid) return;

  const clean = text.trim();
  const conv = db.conversations.find((c) => c.id === conversationId);
  if (!conv || !clean) return;
  // Escribir en una conversación ajena: mismo corte que en `getConversation`.
  if (!conv.participantIds.includes(uid)) return;

  conv.messages.push({ id: newId("m"), fromId: uid, text: clean, at: Date.now() });

  // Campanita para el destinatario. Las conversaciones son siempre de a dos
  // (ver `Conversation`), así que el otro participante es el que no soy yo.
  const peerId = conv.participantIds.find((p) => p !== uid);
  if (peerId) {
    await notifyUser(peerId, {
      kind: "message",
      actorId: uid,
      text: `${await nombreDe(uid)} te envió un mensaje`,
      description: recorte(clean),
      href: `/chat/${conversationId}`,
    });
  }

  revalidatePath("/chat");
  revalidatePath(`/chat/${conversationId}`);
  revalidatePath("/notificaciones");
}

/* ── notificaciones ──────────────────────────────────────────────────────── */

/*  Las tres operan sobre `trapnexport-notification` con el Admin SDK. El
 *  `.catch()` traga el caso de una fila que otra pestaña ya borró: marcar como
 *  leída algo que no está no es un error que el usuario tenga que ver. */

export async function markNotificationRead(id: string): Promise<void> {
  await adminDb()
    .collection(COL.notificacion)
    .doc(id)
    .update({ read: true })
    .catch(() => {});
  revalidatePath("/notificaciones");
}

export async function markAllNotificationsRead(): Promise<void> {
  const uid = await getCurrentUid();
  if (!uid) return;

  const db2 = adminDb();
  const snap = await db2
    .collection(COL.notificacion)
    .where("userId", "==", uid)
    .where("read", "==", false)
    .get();

  if (snap.size) {
    const batch = db2.batch();
    snap.docs.forEach((d) => batch.update(d.ref, { read: true }));
    await batch.commit();
  }
  revalidatePath("/notificaciones");
}

export async function dismissNotification(id: string): Promise<void> {
  await adminDb()
    .collection(COL.notificacion)
    .doc(id)
    .delete()
    .catch(() => {});
  revalidatePath("/notificaciones");
}

/* ── cuentas (registro) ──────────────────────────────────────────────────── */

/*  El alta ya NO pasa por acá. Vive en `lib/auth/register.ts` y escribe en
 *  Firestore desde el navegador: la transacción que reserva el handle tiene que
 *  ir firmada con el token del usuario para que `firestore.rules` la pueda
 *  validar, y una server action recibiría el uid como un campo más del
 *  formulario. Lo que queda en este store son las cuentas semilla del feed.
 */

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

/*  Suspender cuentas y revisar reclamos ya no vive acá: esas operaciones son
 *  sobre cuentas reales de Firestore y las hace `lib/admin/acciones.ts` con el
 *  Admin SDK. Este store sólo tiene el contenido semilla del feed. */
