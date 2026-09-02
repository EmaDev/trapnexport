import { Timestamp } from "firebase-admin/firestore";
import { cache } from "react";

import { getCurrentUid } from "@/lib/auth/sesion";
import { adminDb } from "@/lib/firebase/admin";
import { COL, SUB } from "@/lib/firebase/collections";
import type {
  CommentDoc,
  FsTimestamp,
  GalleryDoc,
  NotificacionDoc,
  PostDoc,
} from "@/lib/firebase/schema";
import { getDirectorio, type Directorio } from "@/lib/social/directorio";
import { db } from "@/lib/social/store";
import type { GalleryItem, NotificationKind, PlayerFicha } from "@/lib/social/types";
import { relativeTime, shortDate } from "@/lib/time";

/** Lecturas del dominio, ya mapeadas a lo que esperan los componentes.
 *
 *  Las pantallas nunca arman props a mano: piden acá y reciben un view-model.
 *
 *  Ya salen de Firestore las cuentas (`lib/social/directorio.ts`), las
 *  publicaciones (`trapnexport-post`), los comentarios (`trapnexport-comment`) y
 *  las notificaciones. Quién mira sale de la cookie de sesión. Lo único que
 *  queda en el store en memoria es el chat y el carrete del perfil.
 *
 *  Todo lo de este archivo corre en el servidor (Server Components y Server
 *  Actions). Es la mitad "read" del par read/write con `actions.ts`.
 */

/* ── view-models ─────────────────────────────────────────────────────────── */

export interface AuthorVM {
  name: string;
  handle: string;
  avatar: string;
  verified?: boolean;
}

/** Espeja el `Comment` de `CommentBox`: `at` es timestamp, no string formateado. */
export interface CommentVM {
  id: string;
  author: string;
  avatar?: string;
  text: string;
  at: number;
  likes: number;
  liked: boolean;
  parentId?: string | null;
  pinned?: boolean;
  authorBadge?: string;
}

export interface PostVM {
  id: string;
  author: AuthorVM;
  /** `SocialPost.time` es un string YA formateado — no un timestamp */
  time: string;
  createdAt: number;
  text: string;
  media: { src: string; alt: string }[];
  counts: { likes: number; comments: number; shares: number };
  liked: boolean;
  saved: boolean;
  likedBy: string[];
  comments: CommentVM[];
}

export interface SessionVM {
  /** uid de Firebase Auth */
  id: string;
  name: string;
  handle: string;
  avatar: string;
}

export interface ProfileVM {
  /** uid de Firebase Auth */
  id: string;
  /** slug en `trapnexport-jugador`, si esta cuenta es del plantel. Es el puente
   *  hacia la historia del club y hacia `JUGADORES`, que se indexan por jugador
   *  y no por cuenta. */
  playerId?: string;
  name: string;
  handle: string;
  avatar: string;
  bio?: string;
  verified?: boolean;
  joined: string;
  isMe: boolean;
  stats: { posts: number };
  /** datos deportivos; `{}` si la cuenta todavia no cargo nada */
  ficha: PlayerFicha;
  /** carrete propio, del mas nuevo al mas viejo */
  gallery: GalleryItem[];
}

export interface ConversationVM {
  id: string;
  peer: AuthorVM;
  lastMessage: string;
  lastAt: number;
  time: string;
  unread: number;
  mine: boolean;
}

export interface MessageVM {
  id: string;
  role: "user" | "bot";
  text: string;
  at: number;
}

export interface NotificationVM {
  id: string;
  title: string;
  description?: string;
  date: number;
  read: boolean;
  avatar?: string;
  href?: string;
  /** con qué ícono la dibuja la librería cuando no hay `avatar` de actor
   *  (los avisos de plataforma no lo tienen) */
  tone?: "info" | "success" | "warning" | "danger" | "neutral";
}

/* ── lectura de publicaciones ────────────────────────────────────────────── */

/** Cuántas publicaciones trae el feed de una vez.
 *
 *  Hay un tope y no "todas" porque una consulta sin `limit` crece para siempre y
 *  el día que moleste ya es tarde. Cincuenta es más de lo que nadie baja de una
 *  sentada; cuando haga falta más, esto pasa a paginar con `startAfter` y la
 *  pantalla suma un "ver más". */
const FEED_LIMIT = 50;

/** Cuántos ids admite un `where(..., "in", [...])` de Firestore. */
const IN_MAX = 30;

type PostConId = PostDoc & { id: string };
type ComentarioConId = CommentDoc & { id: string };

/** `serverTimestamp()` llega en `null` hasta que el servidor confirma: sin el
 *  fallback, una publicación recién creada aparece fechada en 1970. */
const aMillis = (t: FsTimestamp | undefined | null) => t?.toMillis() ?? Date.now();

const aPosts = (snap: FirebaseFirestore.QuerySnapshot): PostConId[] =>
  snap.docs.map((d) => ({ id: d.id, ...(d.data() as PostDoc) }));

/** Los comentarios de varias publicaciones, agrupados por publicación.
 *
 *  Una sola query para todo el feed en vez de una por publicación. `in` admite
 *  treinta valores, así que con el `FEED_LIMIT` de cincuenta son dos consultas.
 *
 *  **Dónde deja de servir:** trae *todos* los comentarios de las publicaciones
 *  en pantalla, aunque el feed muestre dos por publicación (`pageSize` de
 *  `CommentBox`). Con un club es un puñado de documentos; si un posteo se llena
 *  de comentarios, acá va un `limit` por publicación y la pantalla de detalle
 *  pasa a pedir el resto aparte.
 */
async function comentariosDe(postIds: string[]): Promise<Map<string, ComentarioConId[]>> {
  const porPost = new Map<string, ComentarioConId[]>();
  if (!postIds.length) return porPost;

  const tandas: string[][] = [];
  for (let i = 0; i < postIds.length; i += IN_MAX) tandas.push(postIds.slice(i, i + IN_MAX));

  const snaps = await Promise.all(
    tandas.map((ids) =>
      adminDb()
        .collection(COL.comment)
        .where("postId", "in", ids)
        .orderBy("createdAt", "asc")
        .get(),
    ),
  );

  for (const snap of snaps) {
    for (const d of snap.docs) {
      const c = { id: d.id, ...(d.data() as CommentDoc) };
      const lista = porPost.get(c.postId);
      if (lista) lista.push(c);
      else porPost.set(c.postId, [c]);
    }
  }

  return porPost;
}

/** Los ids de las publicaciones que esta persona guardó.
 *
 *  Se trae la subcolección entera —es privada y chica, son las que uno guardó a
 *  mano— en vez de preguntar por cada publicación de la pantalla, que serían
 *  cincuenta lecturas puntuales. `cache()` la memoiza por request. */
const guardadosDe = cache(async (uid: string): Promise<Set<string>> => {
  const snap = await adminDb().collection(COL.user).doc(uid).collection(SUB.saved).get();
  return new Set(snap.docs.map((d) => d.id));
});

/* ── helpers internos ────────────────────────────────────────────────────── */

/** El autor de algo, para la UI.
 *
 *  Nunca falla: una cuenta borrada deja publicaciones y comentarios que igual
 *  hay que dibujar. */
const authorOf = (uid: string, dir: Directorio): AuthorVM => {
  const u = dir.byId(uid);
  return {
    name: u?.name ?? "Cuenta eliminada",
    handle: u?.handle ?? "desconocido",
    avatar: u?.avatar ?? "",
    verified: u?.verified,
  };
};

const toCommentVM = (
  c: ComentarioConId,
  viewerId: string | null,
  dir: Directorio,
): CommentVM => {
  const author = dir.byId(c.authorId);
  return {
    id: c.id,
    author: author?.name ?? "Cuenta eliminada",
    avatar: author?.avatar,
    text: c.text,
    at: aMillis(c.createdAt),
    likes: c.likedBy?.length ?? 0,
    // Sin sesión nada figura como propio: un visitante no likeó nada.
    liked: viewerId ? !!c.likedBy?.includes(viewerId) : false,
    parentId: c.parentId ?? null,
    pinned: c.pinned,
    authorBadge: author?.verified ? "Verificado" : undefined,
  };
};

const toPostVM = (
  p: PostConId,
  comentarios: ComentarioConId[],
  viewerId: string | null,
  dir: Directorio,
  guardados: Set<string>,
): PostVM => {
  const comments = comentarios.map((c) => toCommentVM(c, viewerId, dir));
  const likedBy = p.likedBy ?? [];

  return {
    id: p.id,
    author: authorOf(p.authorId, dir),
    time: relativeTime(aMillis(p.createdAt)),
    createdAt: aMillis(p.createdAt),
    text: p.text,
    media: p.media ?? [],
    counts: {
      likes: likedBy.length,
      // El desnormalizado y no `comments.length`: el feed no baja todos los
      // comentarios de una publicación con muchos, pero el número tiene que
      // seguir siendo el real.
      comments: p.commentCount ?? comments.length,
      shares: p.shares ?? 0,
    },
    liked: viewerId ? likedBy.includes(viewerId) : false,
    saved: guardados.has(p.id),
    likedBy: likedBy.map((id) => dir.byId(id)?.name.split(" ")[0] ?? "Alguien").slice(0, 3),
    comments,
  };
};

/** Arma los view-models de una tanda de publicaciones: comentarios, guardados y
 *  autores en las mínimas consultas posibles. */
async function armarPosts(posts: PostConId[]): Promise<PostVM[]> {
  const [viewerId, dir] = await Promise.all([getCurrentUid(), getDirectorio()]);
  const [comentarios, guardados] = await Promise.all([
    comentariosDe(posts.map((p) => p.id)),
    viewerId ? guardadosDe(viewerId) : Promise.resolve(new Set<string>()),
  ]);

  // Las publicaciones de cuentas suspendidas no se muestran. El filtro es acá y
  // no en la query porque la suspensión vive en la cuenta, no en el post:
  // consultarla en Firestore obligaría a duplicar el estado en cada documento y
  // a reescribirlos todos al suspender a alguien.
  const ocultas = new Set(dir.todas().filter((u) => u.suspended).map((u) => u.id));

  return posts
    .filter((p) => !ocultas.has(p.authorId))
    .map((p) => toPostVM(p, comentarios.get(p.id) ?? [], viewerId, dir, guardados));
}

/* ── sesión ──────────────────────────────────────────────────────────────── */

/** Quién está mirando la app pública, o `null` si nadie inició sesión.
 *
 *  Devuelve `null` y no una cuenta semilla: el feed, un perfil y una publicación
 *  se ven sin cuenta —están hechos para compartirse por link— y lo único que
 *  cambia sin sesión es que no aparecen los controles que escriben.
 *
 *  También devuelve `null` con sesión abierta pero sin perfil todavía: es una
 *  cuenta a medio crear, la que está por pasar por `/completar-perfil`.
 */
export async function getSession(): Promise<SessionVM | null> {
  const uid = await getCurrentUid();
  if (!uid) return null;

  const me = (await getDirectorio()).byId(uid);
  if (!me) return null;

  return { id: me.id, name: me.name, handle: me.handle, avatar: me.avatar };
}

/* ── feed y posts ────────────────────────────────────────────────────────── */

export async function getFeed(): Promise<PostVM[]> {
  const snap = await adminDb()
    .collection(COL.post)
    .where("hidden", "==", false)
    .orderBy("createdAt", "desc")
    .limit(FEED_LIMIT)
    .get();

  return armarPosts(aPosts(snap));
}

export async function getPost(id: string): Promise<PostVM | null> {
  const doc = await adminDb().collection(COL.post).doc(id).get();
  if (!doc.exists) return null;

  const p = { id: doc.id, ...(doc.data() as PostDoc) };
  if (p.hidden) return null;

  const [vm] = await armarPosts([p]);
  // `armarPosts` filtra cuentas suspendidas: si el autor lo está, no hay post.
  return vm ?? null;
}

export async function getPostsByHandle(handle: string): Promise<PostVM[]> {
  const dir = await getDirectorio();
  const user = dir.byHandle(handle);
  if (!user) return [];

  const snap = await adminDb()
    .collection(COL.post)
    .where("authorId", "==", user.id)
    .where("hidden", "==", false)
    .orderBy("createdAt", "desc")
    .limit(FEED_LIMIT)
    .get();

  return armarPosts(aPosts(snap));
}

/* ── perfiles ────────────────────────────────────────────────────────────── */

/** El carrete de una cuenta, de lo más nuevo a lo más viejo.
 *
 *  Subcolección y no un array dentro del `UserDoc`: un array embebido se relee
 *  entero en cada lectura del perfil **y del feed**, que lee el mismo documento
 *  para sacar el autor de cada publicación, y choca contra el tope de 1 MB del
 *  documento. */
async function galeriaDe(uid: string): Promise<GalleryItem[]> {
  const snap = await adminDb()
    .collection(COL.user)
    .doc(uid)
    .collection(SUB.gallery)
    .orderBy("createdAt", "desc")
    .get();

  return snap.docs.map((d) => {
    const g = d.data() as GalleryDoc;
    return {
      id: d.id,
      kind: g.kind,
      src: g.src,
      alt: g.alt,
      addedAt: aMillis(g.createdAt),
    };
  });
}

export async function getProfile(handle: string): Promise<ProfileVM | null> {
  const [viewerId, dir] = await Promise.all([getCurrentUid(), getDirectorio()]);
  const u = dir.byHandle(handle);
  if (!u || u.suspended) return null;

  // Contar publicaciones, no traerlas: la pantalla ya las pide por su cuenta con
  // `getPostsByHandle` y acá sólo se necesita el número.
  const [cuenta, gallery] = await Promise.all([
    adminDb()
      .collection(COL.post)
      .where("authorId", "==", u.id)
      .where("hidden", "==", false)
      .count()
      .get(),
    galeriaDe(u.id),
  ]);

  return {
    id: u.id,
    playerId: u.playerId,
    name: u.name,
    handle: u.handle,
    avatar: u.avatar,
    bio: u.bio,
    verified: u.verified,
    joined: shortDate(u.joinedAt),
    isMe: u.id === viewerId,
    stats: { posts: cuenta.data().count },
    ficha: u.ficha,
    gallery,
  };
}

/** El perfil propio, o `null` si no hay sesión.
 *
 *  `null` es un caso real y no un error: `/perfil` es una pantalla del shell y
 *  se puede llegar por la barra de abajo sin haber entrado nunca. Quien la
 *  recibe decide si manda a `/login` o muestra el cartel de "entrá o
 *  registrate". */
export async function getMyProfile(): Promise<ProfileVM | null> {
  const session = await getSession();
  if (!session) return null;
  return getProfile(session.handle);
}

export interface SearchIndex {
  accounts: (AuthorVM & { id: string; bio?: string })[];
  posts: { id: string; text: string; author: string; time: string }[];
}

/** Todo lo buscable, en una sola pasada.
 *
 *  Devuelve el catálogo completo porque `SearchFilters` filtra del lado del
 *  cliente. Cuando el volumen lo pida, esto pasa a recibir el query y a
 *  filtrar en el servidor, y la pantalla cambia el filtrado local por un fetch
 *  con debounce.
 *
 *  Las cuentas suspendidas no entran: si el feed no las muestra, el buscador
 *  tampoco puede ser la puerta de atrás. */
export async function getSearchIndex(): Promise<SearchIndex> {
  const [viewerId, dir, snap] = await Promise.all([
    getCurrentUid(),
    getDirectorio(),
    adminDb()
      .collection(COL.post)
      .where("hidden", "==", false)
      .orderBy("createdAt", "desc")
      .limit(FEED_LIMIT)
      .get(),
  ]);

  const ocultas = new Set(dir.todas().filter((u) => u.suspended).map((u) => u.id));

  return {
    accounts: dir
      .todas()
      // Uno mismo no se busca. Sin sesión no se excluye a nadie.
      .filter((u) => !u.suspended && u.id !== viewerId)
      .map((u) => ({
        id: u.id,
        name: u.name,
        handle: u.handle,
        avatar: u.avatar,
        verified: u.verified,
        bio: u.bio,
      })),

    posts: aPosts(snap)
      .filter((p) => !ocultas.has(p.authorId))
      .map((p) => ({
        id: p.id,
        text: p.text,
        author: authorOf(p.authorId, dir).name,
        time: relativeTime(aMillis(p.createdAt)),
      })),
  };
}

/* ── chat ────────────────────────────────────────────────────────────────── */

export async function getConversations(): Promise<ConversationVM[]> {
  const [viewerId, dir] = await Promise.all([getCurrentUid(), getDirectorio()]);
  // Sin sesión no hay bandeja: las conversaciones son de a dos y hay que ser uno.
  if (!viewerId) return [];

  return db.conversations
    .filter((c) => c.participantIds.includes(viewerId))
    .map((c) => {
      const peerId = c.participantIds.find((id) => id !== viewerId)!;
      const last = c.messages[c.messages.length - 1];
      return {
        id: c.id,
        peer: authorOf(peerId, dir),
        lastMessage: last?.text ?? "",
        lastAt: last?.at ?? 0,
        time: last ? relativeTime(last.at) : "",
        // sin backend de lecturas: "no leído" = el último mensaje es del otro
        unread: last && last.fromId !== viewerId ? 1 : 0,
        mine: last?.fromId === viewerId,
      };
    })
    .sort((a, b) => b.lastAt - a.lastAt);
}

export async function getUnreadChats(): Promise<number> {
  return (await getConversations()).reduce((n, c) => n + c.unread, 0);
}

export async function getConversation(
  id: string,
): Promise<{ id: string; peer: AuthorVM; messages: MessageVM[] } | null> {
  const [viewerId, dir] = await Promise.all([getCurrentUid(), getDirectorio()]);
  if (!viewerId) return null;

  const c = db.conversations.find((x) => x.id === id);
  // Ser participante no es un detalle de presentación: sin este corte,
  // cualquiera con el id lee la conversación de otros dos.
  if (!c || !c.participantIds.includes(viewerId)) return null;

  const peerId = c.participantIds.find((p) => p !== viewerId)!;

  return {
    id: c.id,
    peer: authorOf(peerId, dir),
    // `Chatbot` modela la conversación como user/bot: "bot" es el otro participante
    messages: c.messages.map((m) => ({
      id: m.id,
      role: m.fromId === viewerId ? ("user" as const) : ("bot" as const),
      text: m.text,
      at: m.at,
    })),
  };
}

/* ── notificaciones ──────────────────────────────────────────────────────── */

/** Bajada genérica e ícono (vía `tone`) por tipo, para cuando la fila no trae
 *  los suyos. El `tone` es lo que hace que los avisos de plataforma —sin avatar
 *  de actor— muestren un ícono en lugar de un hueco. */
const NOTIF_META: Record<
  NotificationKind,
  { description: string; tone: NotificationVM["tone"] }
> = {
  like: { description: "Tocá para abrir la publicación", tone: "neutral" },
  comment: { description: "Tocá para abrir la publicación", tone: "neutral" },
  mention: { description: "Tocá para abrir la publicación", tone: "neutral" },
  post: { description: "Tocá para ver la publicación", tone: "info" },
  message: { description: "Tocá para abrir la conversación", tone: "info" },
  cronograma: { description: "Tocá para ver el cronograma", tone: "warning" },
  noticia: { description: "Tocá para leer la noticia", tone: "info" },
  encuesta: { description: "Tocá para votar", tone: "info" },
};

export async function getNotifications(): Promise<NotificationVM[]> {
  const viewerId = await getCurrentUid();
  // Los avisos son de alguien: sin sesión la campana está vacía, no llena de
  // los de otro.
  if (!viewerId) return [];

  const [snap, dir] = await Promise.all([
    adminDb()
      .collection(COL.notificacion)
      .where("userId", "==", viewerId)
      .orderBy("createdAt", "desc")
      // El historial no es infinito: la pantalla y el drawer muestran los más
      // nuevos, y nadie baja cien avisos.
      .limit(100)
      .get(),
    getDirectorio(),
  ]);

  return snap.docs.map((d) => {
    const n = d.data() as NotificacionDoc;
    const meta = NOTIF_META[n.kind] ?? NOTIF_META.post;
    return {
      id: d.id,
      title: n.text,
      description: n.description ?? meta.description,
      date: n.createdAt?.toMillis() ?? Date.now(),
      read: !!n.read,
      // Los avisos de plataforma no tienen actor: ahí manda el `tone`.
      avatar: n.actorId ? dir.byId(n.actorId)?.avatar : undefined,
      href: n.href,
      tone: meta.tone,
    };
  });
}

/* ── admin ───────────────────────────────────────────────────────────────── */

export interface AdminPostRow {
  id: string;
  autor: string;
  handle: string;
  texto: string;
  fecha: string;
  createdAt: number;
  likes: number;
  comentarios: number;
  estado: "publicado" | "oculto";
}

export interface AdminStats {
  usuarios: number;
  suspendidos: number;
  posts: number;
  ocultos: number;
  comentarios: number;
  /** publicaciones por día de los últimos 7 días, para el sparkline */
  postsPorDia: number[];
}

export async function getAdminStats(): Promise<AdminStats> {
  const db2 = adminDb();
  const day = 86_400_000;
  const today = new Date().setHours(23, 59, 59, 999);
  const desde = Timestamp.fromMillis(today - 7 * day);

  /*  Los tres primeros son agregaciones: devuelven un número sin traer los
   *  documentos. El panel mostraba estos contadores recorriendo el array
   *  entero, que en Firestore sería leer —y pagar— la colección completa cada
   *  vez que alguien abre `/admin`. */
  const [dir, total, ocultos, comentarios, ultimaSemana] = await Promise.all([
    getDirectorio(),
    db2.collection(COL.post).count().get(),
    db2.collection(COL.post).where("hidden", "==", true).count().get(),
    db2.collection(COL.comment).count().get(),
    // El sparkline sí necesita las fechas, pero sólo de la última semana.
    db2.collection(COL.post).where("createdAt", ">=", desde).get(),
  ]);

  const fechas = ultimaSemana.docs.map((d) => aMillis((d.data() as PostDoc).createdAt));
  const postsPorDia = Array.from({ length: 7 }, (_, i) => {
    const to = today - (6 - i) * day;
    const from = to - day;
    return fechas.filter((t) => t > from && t <= to).length;
  });

  const cuentas = dir.todas();

  return {
    usuarios: cuentas.length,
    suspendidos: cuentas.filter((u) => u.suspended).length,
    posts: total.data().count,
    ocultos: ocultos.data().count,
    comentarios: comentarios.data().count,
    postsPorDia,
  };
}

export async function getAdminPosts(): Promise<AdminPostRow[]> {
  // Sin filtrar por `hidden`: el panel es justamente donde se ven las ocultas.
  const [dir, snap] = await Promise.all([
    getDirectorio(),
    adminDb().collection(COL.post).orderBy("createdAt", "desc").limit(200).get(),
  ]);

  return aPosts(snap).map((p) => {
    const author = dir.byId(p.authorId);
    return {
      id: p.id,
      autor: author?.name ?? "Cuenta eliminada",
      handle: author?.handle ?? "",
      texto: p.text,
      fecha: shortDate(aMillis(p.createdAt)),
      createdAt: aMillis(p.createdAt),
      likes: p.likedBy?.length ?? 0,
      comentarios: p.commentCount ?? 0,
      estado: (p.hidden ? "oculto" : "publicado") as AdminPostRow["estado"],
    };
  });
}
