"use server";

import { revalidatePath } from "next/cache";

import { adminDb } from "@/lib/firebase/admin";
import { COL } from "@/lib/firebase/collections";
import type { EncuestaDoc } from "@/lib/firebase/schema";

/** El voto de una encuesta desde el feed.
 *
 *  Va en su propio archivo y **no** en `contenido/actions.ts` porque ahí cada
 *  acción arranca con `requireAdmin()`: esto lo llama cualquiera que mire el
 *  feed, no el panel. Escribe igual con el Admin SDK —`firestore.rules` tiene la
 *  colección cerrada al cliente— pero sin exigir sesión de admin.
 *
 *  No hay dedupe por persona: mientras el feed no tenga Firebase Auth, no hay un
 *  uid en el que anclarlo. El cliente recuerda su voto en la sesión y manda el
 *  anterior en `previos` para que cambiar el voto reste de la opción vieja; un
 *  recargar y volver a votar sí suma de más. Los resultados no se muestran hasta
 *  la gala, así que el ruido no se ve, pero es una limitación real.
 */

export type ResultadoVoto = { ok: true } | { ok: false; error: string };

export async function votarEncuesta(
  encuestaId: string,
  opciones: string[],
  previos: string[] = [],
): Promise<ResultadoVoto> {
  const ref = adminDb().collection(COL.encuesta).doc(encuestaId);

  try {
    await adminDb().runTransaction(async (tx) => {
      const snap = await tx.get(ref);
      const e = snap.data() as EncuestaDoc | undefined;

      if (!e) throw new Error("Esa votación ya no existe.");
      if (e.estado !== "abierta") throw new Error("La votación no está abierta.");

      const validas = new Set(e.opciones.map((o) => o.id));
      let suma = opciones.filter((id) => validas.has(id));
      if (!suma.length) throw new Error("No elegiste ninguna opción válida.");
      // Una encuesta de opción única no puede recibir dos: el `Poll` ya lo
      // limita, pero la acción es un endpoint y hay que defenderlo igual.
      if (!e.multiple) suma = suma.slice(0, 1);

      // Lo que había votado antes y ya no: se le resta uno (nunca por debajo de
      // cero, por si el contador viene inconsistente de una tanda vieja).
      const resta = previos.filter((id) => validas.has(id) && !suma.includes(id));

      const nuevas = e.opciones.map((o) => {
        let votos = o.votos ?? 0;
        if (suma.includes(o.id)) votos += 1;
        if (resta.includes(o.id)) votos = Math.max(0, votos - 1);
        return { ...o, votos };
      });

      tx.update(ref, { opciones: nuevas });
    });
  } catch (err) {
    return { ok: false, error: (err as Error).message };
  }

  // El voto alimenta los números de `/admin/encuestas` y la pantalla de la gala.
  revalidatePath("/admin/encuestas");
  revalidatePath("/admin/presentacion");
  revalidatePath("/admin");
  return { ok: true };
}
