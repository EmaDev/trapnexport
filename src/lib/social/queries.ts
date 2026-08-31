import { adminDb } from "@/lib/firebase/admin";
import { COL } from "@/lib/firebase/collections";
import type { NotificacionDoc } from "@/lib/firebase/schema";
import { db } from "@/lib/social/store";
import type { GalleryItem, NotificationKind, PlayerFicha, User } from "@/lib/social/types";
import { relativeTime, shortDate } from "@/lib/time";

/** Lecturas del dominio, ya mapeadas a lo que esperan los componentes.
 *
 *  Las pantallas nunca tocan `db` ni arman props a mano: piden acá y reciben
 *  un view-model. Cuando `store.ts` pase a Firestore, sólo cambia el cuerpo de
 *  estas funciones — las firmas y los tipos de salida se mantienen.
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
  id: string;
  name: string;
  handle: string;
  avatar: string;
}

export interface ProfileVM {
  id: string;
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

/* ── helpers internos ────────────────────────────────────────────────────── */

const userById = (id: string): User | undefined => db.users.find((u) => u.id === id);

const authorOf = (id: string): AuthorVM => {
  const u = userById(id);
  return {
    name: u?.name ?? "Cuenta eliminada",
    handle: u?.handle ?? "desconocido",
    avatar: u?.avatar ?? "",
    verified: u?.verified,
  };
};

const commentsOf = (postId: string, viewerId: string): CommentVM[] =>
  db.comments
    .filter((c) => c.postId === postId)
    .sort((a, b) => a.createdAt - b.createdAt)
    .map((c) => {
      const author = userById(c.authorId);
      return {
        id: c.id,
        author: author?.name ?? "Cuenta eliminada",
        avatar: author?.avatar,
        text: c.text,
        at: c.createdAt,
        likes: c.likedBy.length,
        liked: c.likedBy.includes(viewerId),
        parentId: c.parentId ?? null,
        pinned: c.pinned,
        authorBadge: author?.verified ? "Verificado" : undefined,
      };
    });

const toPostVM = (postId: string, viewerId: string): PostVM | null => {
  const p = db.posts.find((x) => x.id === postId);
  if (!p) return null;

  const comments = commentsOf(p.id, viewerId);
  return {
    id: p.id,
    author: authorOf(p.authorId),
    time: relativeTime(p.createdAt),
    createdAt: p.createdAt,
    text: p.text,
    media: p.media,
    counts: { likes: p.likedBy.length, comments: comments.length, shares: p.shares },
    liked: p.likedBy.includes(viewerId),
    saved: p.savedBy.includes(viewerId),
    likedBy: p.likedBy.map((id) => userById(id)?.name.split(" ")[0] ?? "Alguien").slice(0, 3),
    comments,
  };
};

/* ── sesión ──────────────────────────────────────────────────────────────── */

/** Quién está mirando la app pública.
 *
 *  Hoy devuelve el usuario semilla. Cuando entre Firebase Auth, esto lee el
 *  token de sesión y resuelve el usuario real; ninguna pantalla cambia. */
export async function getSession(): Promise<SessionVM> {
  const me = userById(db.currentUserId)!;
  return { id: me.id, name: me.name, handle: me.handle, avatar: me.avatar };
}

/* ── feed y posts ────────────────────────────────────────────────────────── */

export async function getFeed(): Promise<PostVM[]> {
  const viewerId = db.currentUserId;
  const suspended = new Set(db.users.filter((u) => u.suspended).map((u) => u.id));

  return db.posts
    .filter((p) => !p.hidden && !suspended.has(p.authorId))
    .sort((a, b) => b.createdAt - a.createdAt)
    .map((p) => toPostVM(p.id, viewerId)!)
    .filter(Boolean);
}

export async function getPost(id: string): Promise<PostVM | null> {
  const p = db.posts.find((x) => x.id === id);
  if (!p || p.hidden) return null;
  return toPostVM(id, db.currentUserId);
}

export async function getPostsByHandle(handle: string): Promise<PostVM[]> {
  const user = db.users.find((u) => u.handle === handle);
  if (!user) return [];

  return db.posts
    .filter((p) => p.authorId === user.id && !p.hidden)
    .sort((a, b) => b.createdAt - a.createdAt)
    .map((p) => toPostVM(p.id, db.currentUserId)!);
}

/* ── perfiles ────────────────────────────────────────────────────────────── */

export async function getProfile(handle: string): Promise<ProfileVM | null> {
  const u = db.users.find((x) => x.handle === handle);
  if (!u || u.suspended) return null;

  return {
    id: u.id,
    name: u.name,
    handle: u.handle,
    avatar: u.avatar,
    bio: u.bio,
    verified: u.verified,
    joined: shortDate(u.joinedAt),
    isMe: u.id === db.currentUserId,
    stats: {
      posts: db.posts.filter((p) => p.authorId === u.id && !p.hidden).length,
    },
    ficha: u.ficha ?? {},
    gallery: [...(u.gallery ?? [])].sort((a, b) => b.addedAt - a.addedAt),
  };
}

export async function getMyProfile(): Promise<ProfileVM> {
  const me = userById(db.currentUserId)!;
  return (await getProfile(me.handle))!;
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
  const viewerId = db.currentUserId;
  const suspended = new Set(db.users.filter((u) => u.suspended).map((u) => u.id));

  return {
    accounts: db.users
      .filter((u) => !u.suspended && u.id !== viewerId)
      .map((u) => ({
        id: u.id,
        name: u.name,
        handle: u.handle,
        avatar: u.avatar,
        verified: u.verified,
        bio: u.bio,
      })),

    posts: db.posts
      .filter((p) => !p.hidden && !suspended.has(p.authorId))
      .sort((a, b) => b.createdAt - a.createdAt)
      .map((p) => ({
        id: p.id,
        text: p.text,
        author: authorOf(p.authorId).name,
        time: relativeTime(p.createdAt),
      })),
  };
}

/* ── chat ────────────────────────────────────────────────────────────────── */

export async function getConversations(): Promise<ConversationVM[]> {
  const viewerId = db.currentUserId;

  return db.conversations
    .map((c) => {
      const peerId = c.participantIds.find((id) => id !== viewerId)!;
      const last = c.messages[c.messages.length - 1];
      return {
        id: c.id,
        peer: authorOf(peerId),
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
  const c = db.conversations.find((x) => x.id === id);
  if (!c) return null;

  const viewerId = db.currentUserId;
  const peerId = c.participantIds.find((p) => p !== viewerId)!;

  return {
    id: c.id,
    peer: authorOf(peerId),
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
  const viewerId = db.currentUserId;

  const snap = await adminDb()
    .collection(COL.notificacion)
    .where("userId", "==", viewerId)
    .orderBy("createdAt", "desc")
    // El historial no es infinito: la pantalla y el drawer muestran los más
    // nuevos, y nadie baja cien avisos.
    .limit(100)
    .get();

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
      avatar: n.actorId ? userById(n.actorId)?.avatar : undefined,
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
  const day = 86_400_000;
  const today = new Date().setHours(23, 59, 59, 999);

  const postsPorDia = Array.from({ length: 7 }, (_, i) => {
    const to = today - (6 - i) * day;
    const from = to - day;
    return db.posts.filter((p) => p.createdAt > from && p.createdAt <= to).length;
  });

  return {
    usuarios: db.users.length,
    suspendidos: db.users.filter((u) => u.suspended).length,
    posts: db.posts.length,
    ocultos: db.posts.filter((p) => p.hidden).length,
    comentarios: db.comments.length,
    postsPorDia,
  };
}

export async function getAdminPosts(): Promise<AdminPostRow[]> {
  return db.posts
    .map((p) => {
      const author = userById(p.authorId);
      return {
        id: p.id,
        autor: author?.name ?? "Cuenta eliminada",
        handle: author?.handle ?? "",
        texto: p.text,
        fecha: shortDate(p.createdAt),
        createdAt: p.createdAt,
        likes: p.likedBy.length,
        comentarios: db.comments.filter((c) => c.postId === p.id).length,
        estado: (p.hidden ? "oculto" : "publicado") as AdminPostRow["estado"],
      };
    })
    .sort((a, b) => b.createdAt - a.createdAt);
}
