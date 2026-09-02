import type { Conversation, GalleryItem } from "@/lib/social/types";

/** Lo que todavía vive en memoria del módulo público: el chat y el carrete.
 *
 *  Vive en `globalThis` a propósito: en `next dev` cada recompilación descarta
 *  los módulos, y sin esto una publicación desaparecía al guardar un archivo.
 *  Todo lo demás (queries, actions, pantallas) habla con este objeto y no sabe
 *  de dónde salen los datos, así que migrar a Firestore es reescribir
 *  `queries.ts` y `actions.ts`, no las pantallas.
 *
 *  **Ya se fueron de acá** las cuentas (`trapnexport-user`, vía
 *  `lib/social/directorio.ts`), las publicaciones (`trapnexport-post`), los
 *  comentarios (`trapnexport-comment`) y las notificaciones
 *  (`trapnexport-notification`). Quién mira sale de la cookie de sesión.
 *
 *  Todos los ids de lo que queda —`fromId`, `participantIds`, las claves de
 *  `gallery`— son **uid de Firebase Auth**: el mismo id que devuelve la sesión y
 *  con el que se firma cada escritura. Cuando el chat y el carrete pasen a
 *  Firestore no hay que traducir nada.
 *
 *  No hay datos de relleno: todo arranca vacío y se llena con lo que se hace en
 *  la app.
 */
export interface Db {
  conversations: Conversation[];
  /** carrete personal por uid. Mapa y no campo del usuario porque el usuario ya
   *  no es un objeto de este store: es un documento de Firestore que no puede
   *  llevar data-URIs adentro. Se va en la Fase 4, a `user/{uid}/gallery`. */
  gallery: Record<string, GalleryItem[]>;
}

const globalForDb = globalThis as unknown as { __socialDb?: Db };

export const db: Db = (globalForDb.__socialDb ??= {
  conversations: [],
  gallery: {},
});

/** id corto y único dentro del proceso; el backend real lo reemplaza por el suyo. */
export const newId = (prefix: string) =>
  `${prefix}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;
