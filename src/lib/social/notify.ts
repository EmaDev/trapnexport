import { FieldValue } from "firebase-admin/firestore";

import { adminDb } from "@/lib/firebase/admin";
import { COL } from "@/lib/firebase/collections";
import type { NotificationKind, UserId } from "@/lib/social/types";

/** Alta de notificaciones de campanita — servicio de dominio, no Server Action.
 *
 *  Lo llaman las Server Actions de `social/` (post nuevo, like, comentario,
 *  mensaje privado) y las de `contenido/` (cronograma, noticia publicada,
 *  votación abierta) desde el servidor; ninguna pantalla lo toca.
 *
 *  Escribe en `trapnexport-notification`, **un documento por destinatario**:
 *  cada quien marca el suyo como leído por su lado. Va con el Admin SDK, que se
 *  saltea `firestore.rules` — la colección está cerrada al cliente y la lectura
 *  también pasa por el servidor (`social/queries.ts`).
 *
 *  Las dos funciones son `async` y hay que **esperarlas**: una Server Action
 *  puede terminar y cortar el trabajo pendiente antes de que la escritura salga.
 */

interface NuevaNotificacion {
  kind: NotificationKind;
  /** el título que se ve en la lista */
  text: string;
  /** la bajada; si se omite, `getNotifications` pone una según el `kind` */
  description?: string;
  href?: string;
  /** autor del hecho: nunca se le notifica a sí mismo */
  actorId?: UserId;
}

/** El documento a guardar, sin los campos opcionales vacíos: Firestore rechaza
 *  `undefined`. */
const doc = (userId: string, n: NuevaNotificacion) => {
  const base: Record<string, unknown> = {
    userId,
    kind: n.kind,
    text: n.text,
    read: false,
    createdAt: FieldValue.serverTimestamp(),
  };
  if (n.actorId) base.actorId = n.actorId;
  if (n.description) base.description = n.description;
  if (n.href) base.href = n.href;
  return base;
};

/** Notifica a una sola cuenta (like, comentario, mensaje privado). */
export async function notifyUser(userId: UserId, n: NuevaNotificacion): Promise<void> {
  if (userId === n.actorId) return;
  await adminDb().collection(COL.notificacion).add(doc(userId, n));
}

/** Fan-out: una notificación por cuenta **no suspendida**, salvo el actor.
 *
 *  Los destinatarios son las cuentas reales de `trapnexport-user`, no una lista
 *  semilla: si nadie se registró todavía, un aviso del panel no le llega a
 *  nadie, que es lo correcto.
 *
 *  Un batch de Firestore admite 500 escrituras; se parte en tandas de 450 por
 *  las dudas de que el plantel crezca.
 */
export async function notifyAll(n: NuevaNotificacion): Promise<void> {
  const db = adminDb();
  const destinatarios = await db
    .collection(COL.user)
    .where("status", "in", ["active", "pending"])
    .get();

  const ids = destinatarios.docs.map((d) => d.id).filter((id) => id !== n.actorId);
  if (!ids.length) return;

  for (let i = 0; i < ids.length; i += 450) {
    const batch = db.batch();
    for (const id of ids.slice(i, i + 450)) {
      batch.set(db.collection(COL.notificacion).doc(), doc(id, n));
    }
    await batch.commit();
  }
}
