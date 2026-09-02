"use server";

import { FieldValue } from "firebase-admin/firestore";
import { revalidatePath } from "next/cache";

import { getCurrentUid } from "@/lib/auth/sesion";
import { adminDb } from "@/lib/firebase/admin";
import { COL, SUB_VOTO } from "@/lib/firebase/collections";
import type { EncuestaDoc, VotoDoc } from "@/lib/firebase/schema";

/** El voto de una encuesta desde el feed.
 *
 *  Va en su propio archivo y **no** en `contenido/actions.ts` porque ahí cada
 *  acción arranca con `requireAdmin()`: esto lo llama cualquiera que mire el
 *  feed, no el panel. Escribe igual con el Admin SDK —`firestore.rules` tiene la
 *  colección cerrada al cliente— pero sin exigir sesión de admin.
 *
 *  Lo que **sí** exige es sesión: una Server Action es un endpoint POST y sin
 *  este chequeo se la puede invocar sin pasar por el feed —ni por el snackbar de
 *  "iniciá sesión"— y el voto entra igual.
 *
 *  El uid sale de la cookie de sesión (`lib/auth/sesion.ts`) y no de un token
 *  que mande el cliente. Eso cambia dos cosas respecto de la versión anterior:
 *
 *  1. **Hay dedupe.** El voto de cada persona es un documento propio en
 *     `trapnexport-encuesta/{id}/voto/{uid}`, y ese documento —no lo que diga el
 *     cliente— es lo que dice qué había votado antes. Antes el voto anterior
 *     viajaba en un parámetro `previos` que el navegador recordaba sólo mientras
 *     durara la sesión: recargar y volver a votar sumaba de más, y un POST hecho
 *     a mano podía sumar todas las veces que quisiera.
 *  2. **Votar dos veces lo mismo no hace nada.** Es la consecuencia de que el
 *     estado anterior sea del servidor: la resta y la suma se cancelan solas.
 */

export type ResultadoVoto = { ok: true } | { ok: false; error: string };

export async function votarEncuesta(
  encuestaId: string,
  opciones: string[],
): Promise<ResultadoVoto> {
  const uid = await getCurrentUid();
  if (!uid) return { ok: false, error: "Necesitás iniciar sesión para votar." };

  const db = adminDb();
  const encuestaRef = db.collection(COL.encuesta).doc(encuestaId);
  const votoRef = encuestaRef.collection(SUB_VOTO).doc(uid);

  try {
    await db.runTransaction(async (tx) => {
      // Las dos lecturas antes de cualquier escritura: una transacción de
      // Firestore no admite leer después de escribir.
      const [encuestaSnap, votoSnap] = await Promise.all([tx.get(encuestaRef), tx.get(votoRef)]);

      const e = encuestaSnap.data() as EncuestaDoc | undefined;
      if (!e) throw new Error("Esa votación ya no existe.");
      if (e.estado !== "abierta") throw new Error("La votación no está abierta.");

      const validas = new Set(e.opciones.map((o) => o.id));
      let elegidas = opciones.filter((id) => validas.has(id));
      if (!elegidas.length) throw new Error("No elegiste ninguna opción válida.");
      // Una encuesta de opción única no puede recibir dos: el `Poll` ya lo
      // limita, pero la acción es un endpoint y hay que defenderlo igual.
      if (!e.multiple) elegidas = elegidas.slice(0, 1);

      /*  Lo que esta persona tenía votado, según el servidor. Se filtra por
       *  opciones válidas igual que lo nuevo: una opción borrada del panel entre
       *  un voto y el siguiente no tiene contador al que devolverle nada. */
      const antes = ((votoSnap.data() as VotoDoc | undefined)?.opciones ?? []).filter((id) =>
        validas.has(id),
      );

      const suma = elegidas.filter((id) => !antes.includes(id));
      const resta = antes.filter((id) => !elegidas.includes(id));

      // Cambiar el voto por el mismo voto: no hay nada que mover. Se sale sin
      // escribir para no gastar una escritura ni tocar `updatedAt`.
      if (!suma.length && !resta.length) return;

      const nuevas = e.opciones.map((o) => {
        let votos = o.votos ?? 0;
        if (suma.includes(o.id)) votos += 1;
        // Nunca por debajo de cero, por si el contador viene inconsistente de
        // una tanda vieja (los votos previos al dedupe no tienen documento).
        if (resta.includes(o.id)) votos = Math.max(0, votos - 1);
        return { ...o, votos };
      });

      tx.update(encuestaRef, { opciones: nuevas });
      tx.set(
        votoRef,
        {
          opciones: elegidas,
          // `createdAt` sólo en el alta: `merge` deja el que ya estaba, así se
          // puede saber quién votó temprano y quién cambió de opinión después.
          ...(votoSnap.exists ? {} : { createdAt: FieldValue.serverTimestamp() }),
          updatedAt: FieldValue.serverTimestamp(),
        },
        { merge: true },
      );
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
