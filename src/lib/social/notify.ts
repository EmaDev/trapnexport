import { db, newId } from "@/lib/social/store";
import type { NotificationKind, UserId } from "@/lib/social/types";

/** Alta de notificaciones de campanita — servicio de dominio, no Server Action.
 *
 *  Lo llaman las Server Actions de `social/` (post nuevo, mensaje privado) y las
 *  de `contenido/` (cronograma, noticias) desde el servidor; ninguna pantalla lo
 *  toca. Es la única costura por la que `contenido/` escribe en el store social:
 *  la notificación es dato de la red —tiene dueño y estado de leída por
 *  persona—, no del contenido que administra el club.
 *
 *  Cuando entre Firestore, esto pasa a escribir en la colección `notifications`
 *  (un documento por destinatario) y las firmas no cambian.
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

/** Notifica a una sola cuenta (mensaje privado, en el futuro respuestas, etc.). */
export function notifyUser(userId: UserId, n: NuevaNotificacion): void {
  if (userId === n.actorId) return;
  db.notifications.unshift({ id: newId("n"), userId, at: Date.now(), ...n });
}

/** Fan-out: una notificación por cuenta activa, salvo el actor.
 *
 *  Se guarda una fila por destinatario y no un único doc "broadcast" a
 *  propósito: cada quien marca la suya como leída por su lado. Un doc compartido
 *  se apagaría para todos apenas el primero lo abriera. Con veinte cuentas
 *  semilla el costo es nulo, y es el mismo patrón que en Firestore.
 */
export function notifyAll(n: NuevaNotificacion): void {
  for (const u of db.users) {
    if (u.suspended || u.id === n.actorId) continue;
    db.notifications.unshift({ id: newId("n"), userId: u.id, at: Date.now(), ...n });
  }
}
