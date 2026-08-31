"use client";

import { collection, getDocs, orderBy, query } from "firebase/firestore";

import { db } from "@/lib/firebase/client";
import { COL } from "@/lib/firebase/collections";
import type { JugadorDoc } from "@/lib/firebase/schema";

/** El plantel, para el paso "Soy del equipo" del registro. */
export interface ClaimablePlayerVM {
  /** slug: el id del documento en `trapnexport-jugador` */
  id: string;
  name: string;
  nickname: string;
  /** el handle que va a llevar la cuenta al reclamarla */
  handle: string;
  /** ya hay una cuenta vinculada — no se puede volver a elegir */
  claimed: boolean;
}

/** Lee `trapnexport-jugador` ordenado por `orden`.
 *
 *  Se lee desde el navegador y no desde el servidor porque el servidor no
 *  tiene con qué: no hay credenciales de Admin SDK en el flujo público, y la
 *  colección es de lectura abierta justamente para esto.
 *
 *  Devuelve el plantel **completo**, no sólo los libres: mostrar "ya
 *  registrado" en gris explica por qué falta un nombre; hacerlo desaparecer
 *  deja a la persona buscándose en una lista donde no está.
 *
 *  Una lista vacía casi siempre significa que falta correr el seed
 *  (`npm run seed:jugadores`), no que no haya plantel.
 */
export async function getClaimablePlayers(): Promise<ClaimablePlayerVM[]> {
  const snap = await getDocs(query(collection(db, COL.jugador), orderBy("orden")));

  return snap.docs.map((d) => {
    const j = d.data() as JugadorDoc & { claimedBy?: string | null };
    return {
      id: d.id,
      name: j.nombre,
      nickname: j.apodo,
      handle: j.handle,
      claimed: Boolean(j.claimedBy),
    };
  });
}
