import type { CommentRow, Conversation, GalleryItem, Post } from "@/lib/social/types";

/** Lo que todavía vive en memoria del módulo público: feed, comentarios y chat.
 *
 *  Vive en `globalThis` a propósito: en `next dev` cada recompilación descarta
 *  los módulos, y sin esto una publicación desaparecía al guardar un archivo.
 *  Todo lo demás (queries, actions, pantallas) habla con este objeto y no sabe
 *  de dónde salen los datos, así que migrar a Firestore es reescribir
 *  `queries.ts` y `actions.ts`, no las pantallas.
 *
 *  **Las cuentas ya no están acá.** Salen de `trapnexport-user` a través de
 *  `lib/social/directorio.ts`, y quién mira sale de la cookie de sesión
 *  (`lib/auth/sesion.ts`). Lo que había antes era el plantel de `JUGADORES`
 *  convertido en usuarios, indexado por el slug del jugador, más un
 *  `currentUserId` fijo en una cuenta: el feed se veía igual iniciara sesión
 *  quien iniciara.
 *
 *  Por eso todos los ids de este archivo —`authorId`, `likedBy`, `savedBy`,
 *  `fromId`, `participantIds`, las claves de `gallery`— son **uid de Firebase
 *  Auth**. Es el mismo id que devuelve la sesión y el mismo con el que se firma
 *  cada escritura. Cuando estas tres colecciones pasen a Firestore no hay que
 *  traducir nada.
 *
 *  No hay datos de relleno: todo arranca vacío y se llena con lo que se hace en
 *  la app. Las notificaciones ya no viven acá: son documentos de Firestore
 *  (`trapnexport-notification`, ver `lib/social/notify.ts`).
 */
export interface Db {
  posts: Post[];
  comments: CommentRow[];
  conversations: Conversation[];
  /** carrete personal por uid. Mapa y no campo del usuario porque el usuario ya
   *  no es un objeto de este store: es un documento de Firestore que no puede
   *  llevar data-URIs adentro. Se va en la Fase 4, a `user/{uid}/gallery`. */
  gallery: Record<string, GalleryItem[]>;
}

const globalForDb = globalThis as unknown as { __socialDb?: Db };

export const db: Db = (globalForDb.__socialDb ??= {
  posts: [],
  comments: [],
  conversations: [],
  gallery: {},
});

/** id corto y único dentro del proceso; el backend real lo reemplaza por el suyo. */
export const newId = (prefix: string) =>
  `${prefix}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;
