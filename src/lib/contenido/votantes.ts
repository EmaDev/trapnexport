"use server";

import { requireAdmin } from "@/lib/admin/auth";
import { adminDb } from "@/lib/firebase/admin";
import { COL, SUB_VOTO } from "@/lib/firebase/collections";
import type { EncuestaDoc, UserDoc, VotoDoc } from "@/lib/firebase/schema";
import { dateTime } from "@/lib/time";

/** Quién votó qué en una encuesta. **Sólo en desarrollo.**
 *
 *  El voto es secreto para el resto de la app: el feed sólo le muestra a cada
 *  uno lo suyo y la gala sólo los totales. Esto existe para depurar con datos
 *  reales —ver que el dedupe y el cambio de voto dejan los contadores bien— y
 *  por eso el corte está acá, en el servidor, y no sólo en el botón: una Server
 *  Action es un endpoint POST y se puede llamar sin pasar por el panel.
 *
 *  Va en su propio archivo y no en `actions.ts` porque es una lectura, y en
 *  `queries.ts` no puede ir porque el modal la pide desde el cliente. La página
 *  repite el mismo chequeo de `NODE_ENV` para decidir si muestra el botón: un
 *  archivo `"use server"` sólo puede exportar funciones async.
 */

const VER_VOTANTES = process.env.NODE_ENV === "development";

export interface Votante {
  uid: string;
  name: string;
  handle?: string;
  /** los textos de las opciones elegidas, en el orden de la encuesta */
  opciones: string[];
  /** "16/10/26, 21:04" — la primera vez que votó */
  votoEl: string;
  /** con valor sólo si cambió el voto después del primero */
  cambioEl?: string;
}

export interface VotantesEncuesta {
  votantes: Votante[];
  /** cada opción con los nombres de quienes la eligieron */
  porOpcion: { id: string; texto: string; votos: number; nombres: string[] }[];
}

export async function getVotantes(encuestaId: string): Promise<VotantesEncuesta | null> {
  if (!VER_VOTANTES) return null;
  await requireAdmin();

  const db = adminDb();
  const encuestaRef = db.collection(COL.encuesta).doc(encuestaId);
  const [encuestaSnap, votosSnap] = await Promise.all([
    encuestaRef.get(),
    encuestaRef.collection(SUB_VOTO).get(),
  ]);

  const e = encuestaSnap.data() as EncuestaDoc | undefined;
  if (!e) return null;

  // Una sola lectura para todas las cuentas: `getAll` y no un `get()` por voto.
  const uids = votosSnap.docs.map((d) => d.id);
  const users = uids.length
    ? await db.getAll(...uids.map((uid) => db.collection(COL.user).doc(uid)))
    : [];
  const userPorUid = new Map(
    users.filter((u) => u.exists).map((u) => [u.id, u.data() as UserDoc]),
  );

  const opciones = e.opciones ?? [];
  // Del más temprano al más tarde. Las ids elegidas viajan aparte del texto
  // para armar `porOpcion` por id: dos opciones pueden llamarse igual.
  const filas = votosSnap.docs
    .map((doc) => {
      const v = doc.data() as VotoDoc;
      const u = userPorUid.get(doc.id);
      const creado = v.createdAt?.toMillis();
      const cambiado = v.updatedAt?.toMillis();
      const elegidas = opciones.filter((o) => v.opciones?.includes(o.id));
      const votante: Votante = {
        uid: doc.id,
        // Una cuenta borrada deja su voto: se muestra el uid para poder rastrearlo.
        name: u?.name || doc.id,
        handle: u?.handle,
        opciones: elegidas.map((o) => o.texto),
        votoEl: creado ? dateTime(creado) : "—",
        cambioEl: cambiado && creado && cambiado - creado > 1000 ? dateTime(cambiado) : undefined,
      };
      return { votante, ids: elegidas.map((o) => o.id), creado: creado ?? 0 };
    })
    .sort((a, b) => a.creado - b.creado);

  const porOpcion = opciones.map((o) => ({
    id: o.id,
    texto: o.texto,
    votos: o.votos ?? 0,
    nombres: filas.filter((f) => f.ids.includes(o.id)).map((f) => f.votante.name),
  }));

  return { votantes: filas.map((f) => f.votante), porOpcion };
}
