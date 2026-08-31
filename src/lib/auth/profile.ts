"use client";

import { doc, onSnapshot, serverTimestamp, updateDoc } from "firebase/firestore";

import { auth, db } from "@/lib/firebase/client";
import { COL } from "@/lib/firebase/collections";
import type { FsTimestamp, UserDoc } from "@/lib/firebase/schema";
import type { ClaimStatus, PlayerFicha } from "@/lib/social/types";

/** La cuenta que inició sesión, ya traducida para la UI.
 *
 *  No es el `UserDoc`: las fechas vienen como `Timestamp` de Firestore y todas
 *  las pantallas de la app trabajan con milisegundos (`shortDate`, `timeAgo`).
 *  Traducirlo una vez acá evita que cada componente tenga que saber que del
 *  otro lado hay Firestore — que es la misma regla que ya siguen los VM de
 *  `lib/social/queries.ts`.
 */
export interface AccountVM {
  uid: string;
  handle: string;
  name: string;
  avatar: string;
  bio?: string;
  role: UserDoc["role"];
  status: UserDoc["status"];
  verified: boolean;
  /** slug en `trapnexport-jugador`; sólo en cuentas del plantel */
  playerId?: string;
  /** en qué quedó el reclamo, si esta cuenta reclamó a alguien del plantel */
  claimStatus?: ClaimStatus;
  ficha: PlayerFicha;
  stats: UserDoc["stats"];
  joinedAt: number;
}

/** `serverTimestamp()` viaja en dos pasos: el snapshot local llega con el campo
 *  en `null` y recién la confirmación del servidor trae el valor. Sin este
 *  fallback, el perfil parpadea con "se unió el 1/1/1970" durante el alta. */
const millis = (ts: FsTimestamp | null | undefined) => ts?.toMillis() ?? Date.now();

const toAccount = (data: UserDoc): AccountVM => ({
  uid: data.uid,
  handle: data.handle,
  name: data.name,
  avatar: data.avatar,
  bio: data.bio,
  role: data.role,
  status: data.status,
  verified: data.verified,
  playerId: data.playerId,
  claimStatus: data.claim?.status,
  ficha: data.ficha ?? {},
  stats: data.stats,
  joinedAt: millis(data.createdAt),
});

/** Escucha el documento de una cuenta y avisa cada vez que cambia.
 *
 *  Es `onSnapshot` y no un `getDoc` porque hay un cambio que la persona tiene
 *  que ver sin recargar: cuando el admin aprueba su reclamo, `status` pasa de
 *  `pending` a `active` y la app se le destraba sola.
 *
 *  `null` significa "hay sesión en Auth pero no hay perfil": pasa si el alta se
 *  cortó entre crear la credencial y escribir el documento. La UI tiene que
 *  tratarlo como una cuenta incompleta, no como si no hubiera nadie.
 *
 *  Devuelve la función para cortar la escucha.
 */
export function watchAccount(uid: string, onChange: (account: AccountVM | null) => void) {
  return onSnapshot(
    doc(db, COL.user, uid),
    (snap) => onChange(snap.exists() ? toAccount(snap.data() as UserDoc) : null),
    // Un error acá es casi siempre `permission-denied` por reglas mal
    // desplegadas. Que la app quede colgada en "cargando" para siempre esconde
    // exactamente el problema que hay que ver.
    (err) => {
      console.error("[auth] no se pudo leer el perfil", err);
      onChange(null);
    },
  );
}

/** Marca que la cuenta abrió la app. Alimenta el "activos" del panel.
 *
 *  Silencioso a propósito: es telemetría, y una falla acá no puede impedirle a
 *  nadie usar la app. `lastSeenAt` está en las claves que el dueño puede
 *  escribir (ver `editableByOwner` en `firestore.rules`).
 */
export function touchLastSeen(uid: string) {
  if (auth.currentUser?.uid !== uid) return;
  updateDoc(doc(db, COL.user, uid), { lastSeenAt: serverTimestamp() }).catch(() => {});
}
