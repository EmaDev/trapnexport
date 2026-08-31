import { avatarUrl } from "@/lib/media";
import { JUGADORES } from "@/lib/trap-awards";
import type { CommentRow, Conversation, Post, User } from "@/lib/social/types";

/** Base de datos en memoria del módulo público — feed, comentarios, chat.
 *
 *  Vive en `globalThis` a propósito: en `next dev` cada recompilación descarta
 *  los módulos, y sin esto una publicación desaparecía al guardar un archivo.
 *  Todo lo demás (queries, actions, pantallas) habla con este objeto y no sabe
 *  de dónde salen los datos, así que migrar a Firestore es reescribir
 *  `queries.ts` y `actions.ts`, no las pantallas.
 *
 *  **No hay datos de relleno.** Las cuentas salen de `JUGADORES`
 *  (`lib/trap-awards.ts`), que es el plantel real —el `id` de cada cuenta es el
 *  id del jugador, el mismo que vota en los premios y tiene perfil en
 *  `/historia`—. Todo lo demás arranca vacío y se llena con lo que se hace en la
 *  app: publicaciones, comentarios y mensajes. Las notificaciones ya no viven
 *  acá: son documentos de Firestore (`trapnexport-notification`, ver
 *  `lib/social/notify.ts`).
 */
export interface Db {
  users: User[];
  posts: Post[];
  comments: CommentRow[];
  conversations: Conversation[];
  /** sesión simulada: a quién representa el módulo público mientras no hay auth */
  currentUserId: string;
}

const DAY = 24 * 60 * 60 * 1000;

/** La cuenta desde la que se ve la app mientras no haya login. */
const YO = "emanuel-cisterna";

function seed(): Db {
  const now = Date.now();

  /** Las cuentas del plantel, en el orden de la lista.
   *
   *  `joinedAt` se abre en abanico —una semana entre cuenta y cuenta— y no es
   *  el mismo instante para todas: `/admin/usuarios` ordena por antigüedad y
   *  con dieciocho fechas idénticas la tabla quedaría en un orden arbitrario
   *  que cambia entre renders. */
  const users: User[] = JUGADORES.map((j, i) => ({
    id: j.id,
    name: j.nombre,
    handle: j.handle,
    avatar: avatarUrl(j.nombre, j.handle),
    joinedAt: now - (400 - i * 7) * DAY,
  }));

  return {
    users,
    posts: [],
    comments: [],
    conversations: [],
    currentUserId: YO,
  };
}

const globalForDb = globalThis as unknown as { __socialDb?: Db };

export const db: Db = (globalForDb.__socialDb ??= seed());

/** id corto y único dentro del proceso; el backend real lo reemplaza por el suyo. */
export const newId = (prefix: string) =>
  `${prefix}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;
