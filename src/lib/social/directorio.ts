import { cache } from "react";

import { adminDb } from "@/lib/firebase/admin";
import { COL } from "@/lib/firebase/collections";
import type { UserDoc, UserStats } from "@/lib/firebase/schema";
import type { PlayerFicha } from "@/lib/social/types";

/** Las cuentas reales, leídas de `trapnexport-user`, para el módulo social.
 *
 *  Reemplaza al array `db.users` del store en memoria, que era el plantel de
 *  `JUGADORES` con el slug del jugador de id (`"naza-sochan"`). Acá el id es el
 *  **uid de Firebase Auth**, que es el mismo que devuelve la cookie de sesión y
 *  el mismo con el que se firman las publicaciones, los likes y los mensajes.
 *
 *  El plantel no se pierde: sigue en `trapnexport-jugador`, y el puente es
 *  `playerId`. Son dos cosas distintas a propósito —la cuenta es de la persona,
 *  la ficha del plantel es del club— y hay cuentas sin jugador (un hincha) y
 *  jugadores sin cuenta (alguien que todavía no se registró).
 *
 *  ## Por qué se trae la colección entera
 *
 *  El feed pide el autor de cada publicación, el nombre de los tres primeros que
 *  dieron like y el de quien comentó: pedirlos de a uno son decenas de lecturas
 *  por render, casi todas repetidas. Una sola lectura de la colección completa
 *  es más barata y mucho más simple mientras las cuentas se cuenten en decenas,
 *  que es el tamaño de un club.
 *
 *  **Dónde deja de servir:** el día que haya cientos de cuentas —si la app se
 *  abre a los hinchas— esto pasa a ser un `getAll()` de los uid que aparecen en
 *  la pantalla. La firma no cambia, sólo el cuerpo; por eso las funciones de
 *  `queries.ts` piden el directorio y no leen Firestore por su cuenta.
 *
 *  `cache()` es de React y memoiza **por request**: una pantalla que llama a
 *  `getFeed()`, `getSession()` y `getNotifications()` lee las cuentas una sola
 *  vez y no tres. No es un caché entre visitas: cada request nuevo relee.
 */

/** Una cuenta, ya traducida a lo que usa el módulo social.
 *
 *  No es el `UserDoc`: las fechas vienen como `Timestamp` de Firestore y todas
 *  las pantallas trabajan con milisegundos. Es la misma regla que sigue
 *  `AccountVM` en `lib/auth/profile.ts` para el lado del cliente. */
export interface Cuenta {
  /** el uid de Firebase Auth; es el id del documento */
  id: string;
  name: string;
  handle: string;
  avatar: string;
  bio?: string;
  verified: boolean;
  /** `status === "suspended"`: no aparece en el feed ni en el buscador */
  suspended: boolean;
  /** slug en `trapnexport-jugador`; sólo en cuentas del plantel */
  playerId?: string;
  ficha: PlayerFicha;
  stats: UserStats;
  joinedAt: number;
}

export interface Directorio {
  byId: (uid: string) => Cuenta | undefined;
  byHandle: (handle: string) => Cuenta | undefined;
  /** todas, incluidas las suspendidas: el panel las necesita contar */
  todas: () => Cuenta[];
}

const aCuenta = (uid: string, d: UserDoc): Cuenta => ({
  id: uid,
  name: d.name,
  handle: d.handle,
  avatar: d.avatar,
  bio: d.bio,
  verified: !!d.verified,
  suspended: d.status === "suspended",
  playerId: d.playerId,
  ficha: d.ficha ?? {},
  stats: d.stats ?? { posts: 0, comments: 0, gallery: 0 },
  // `serverTimestamp()` llega en `null` en el snapshot local hasta que el
  // servidor confirma: sin el fallback, una cuenta recién creada se muestra
  // como "se unió el 1/1/1970".
  joinedAt: d.createdAt?.toMillis() ?? Date.now(),
});

export const getDirectorio = cache(async (): Promise<Directorio> => {
  const snap = await adminDb().collection(COL.user).get();

  const porId = new Map<string, Cuenta>();
  const porHandle = new Map<string, Cuenta>();

  for (const doc of snap.docs) {
    const cuenta = aCuenta(doc.id, doc.data() as UserDoc);
    porId.set(cuenta.id, cuenta);
    porHandle.set(cuenta.handle, cuenta);
  }

  return {
    byId: (uid) => porId.get(uid),
    byHandle: (handle) => porHandle.get(handle),
    todas: () => [...porId.values()],
  };
});
