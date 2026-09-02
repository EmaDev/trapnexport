import type { Conversation } from "@/lib/social/types";

/** Lo único que todavía vive en memoria del módulo público: el chat.
 *
 *  Vive en `globalThis` a propósito: en `next dev` cada recompilación descarta
 *  los módulos, y sin esto una conversación desaparecía al guardar un archivo.
 *
 *  **Ya se fueron de acá** las cuentas (`trapnexport-user`, vía
 *  `lib/social/directorio.ts`), las publicaciones (`trapnexport-post`), los
 *  comentarios (`trapnexport-comment`), el carrete del perfil
 *  (`trapnexport-user/{uid}/gallery`) y las notificaciones
 *  (`trapnexport-notification`). Quién mira sale de la cookie de sesión.
 *
 *  Los ids de lo que queda —`fromId`, `participantIds`— son **uid de Firebase
 *  Auth**: el mismo id que devuelve la sesión y con el que se firma cada
 *  escritura. Cuando el chat pase a Firestore no hay que traducir nada.
 */
export interface Db {
  conversations: Conversation[];
}

const globalForDb = globalThis as unknown as { __socialDb?: Db };

export const db: Db = (globalForDb.__socialDb ??= { conversations: [] });

/** id corto y único dentro del proceso; el backend real lo reemplaza por el suyo. */
export const newId = (prefix: string) =>
  `${prefix}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;
