"use server";

import { FieldValue } from "firebase-admin/firestore";

import { adminDb } from "@/lib/firebase/admin";
import { COL } from "@/lib/firebase/collections";
import type { JugadorDoc, PlayerDoc } from "@/lib/firebase/schema";
import { avatarUrl } from "@/lib/media";

/** El plantel, para el paso "Soy del equipo" del registro. */
export interface ClaimablePlayerVM {
  /** slug: el id del documento en `trapnexport-historia-jugador` */
  id: string;
  name: string;
  nickname: string;
  /** el handle que va a llevar la cuenta al reclamarla */
  handle: string;
  /** la foto de la ficha, o el avatar generado si no cargó ninguna */
  avatar: string;
  /** ya hay una cuenta vinculada — no se puede volver a elegir */
  claimed: boolean;
}

/** Quién es del plantel sale de **la historia del club**, no de una lista aparte.
 *
 *  Antes salía de `trapnexport-jugador`, que es lo que siembra
 *  `scripts/seed-jugadores.mjs` desde `lib/trap-awards.ts`. El problema no era
 *  técnico sino de dónde vive el dato: el plantel se edita en
 *  `/admin/historia` → "Jugadores", y esa pantalla escribe
 *  `trapnexport-historia-jugador`. Las dos listas quedaron distintas y nadie se
 *  enteró hasta que faltó alguien al registrarse — Edu Carballo estaba cargado
 *  en el panel y la lista del alta no lo tenía, porque la lista del alta era un
 *  archivo del repo que había que volver a sembrar a mano.
 *
 *  Ahora la ficha de la historia es la fuente y `trapnexport-jugador` queda
 *  como lo único que de verdad le pertenece: **el registro de reclamos**
 *  (`claimedBy`) y el handle sugerido. Agregar un jugador en el panel alcanza
 *  para que aparezca en el alta.
 *
 *  ## Por qué es una server action
 *
 *  `trapnexport-historia-jugador` está cerrada a cualquier cliente en
 *  `firestore.rules` —toda la historia se lee con el Admin SDK desde el
 *  servidor— y no hay motivo para abrirla sólo para esto. El alta no necesita
 *  sesión para llamarla: lo que devuelve es el plantel, que ya es público en
 *  `/historia`.
 */
export async function getClaimablePlayers(): Promise<ClaimablePlayerVM[]> {
  const db = adminDb();

  const [fichas, reclamos] = await Promise.all([
    db.collection(COL.historiaJugador).orderBy("orden", "asc").get(),
    db.collection(COL.jugador).get(),
  ]);

  type Reclamo = JugadorDoc & { claimedBy?: string | null };
  const reclamoDe = new Map(reclamos.docs.map((d) => [d.id, d.data() as Reclamo]));

  // Los handles ya repartidos, para no derivar uno que choque con otro jugador.
  const tomados = new Set(
    reclamos.docs.map((d) => (d.data() as Reclamo).handle).filter(Boolean),
  );

  const roster: ClaimablePlayerVM[] = [];
  const nuevos: { id: string; ficha: PlayerDoc; handle: string; orden: number }[] = [];

  let orden = 0;
  for (const d of fichas.docs) {
    const id = d.id;
    const ficha = d.data() as PlayerDoc;

    /*  Las leyendas quedan afuera. La colección de la historia tiene las
     *  fichas de todos los que pasaron por el club, y `status: "leyenda"`
     *  marca a los que no son del plantel de hoy. Una de esas fichas es de
     *  alguien que falleció: ofrecer su nombre en "elegí quién sos del
     *  plantel" para que alguien reclame su cuenta no es algo que esta
     *  pantalla deba poder hacer. Por eso se esconden en vez de aparecer en
     *  gris como los ya registrados — ahí el gris explica algo útil, acá sería
     *  un lugar donde no corresponde que estén. */
    if (ficha.status === "leyenda") continue;

    const reclamo = reclamoDe.get(id);

    /*  Sin fila en `trapnexport-jugador` el reclamo no puede andar: la
     *  transacción de `claimPlayer` hace `update` sobre ese documento y las
     *  reglas piden `resource.data.claimedBy == null`, así que un `update` a un
     *  documento que no existe falla. Es el caso de cualquiera cargado en el
     *  panel después del último seed. Se crea acá, con `claimedBy: null`, que
     *  es exactamente lo que habría escrito el seed. */
    const handle = reclamo?.handle || handleLibre(ficha, tomados);
    if (!reclamo) {
      tomados.add(handle);
      nuevos.push({ id, ficha, handle, orden });
    }

    roster.push({
      id,
      name: ficha.name,
      nickname: ficha.nickname,
      handle,
      avatar: ficha.avatar || ficha.photo || avatarUrl(ficha.name, id),
      claimed: Boolean(reclamo?.claimedBy),
    });
    orden += 1;
  }

  if (nuevos.length) await abrirReclamos(nuevos);

  return roster;
}

/** Crea las filas de reclamo que faltan. Idempotente y normalmente vacío.
 *
 *  Es la única escritura de una lectura, y por eso va con `create` y no con
 *  `set`: si entre la lectura de arriba y esto alguien reclamó al jugador —dos
 *  personas registrándose a la vez—, el `create` falla y se descarta en vez de
 *  pisarle el `claimedBy` que acaba de quedar escrito.
 */
async function abrirReclamos(
  nuevos: { id: string; ficha: PlayerDoc; handle: string; orden: number }[],
): Promise<void> {
  const col = adminDb().collection(COL.jugador);

  await Promise.all(
    nuevos.map(({ id, ficha, handle, orden }) =>
      col
        .doc(id)
        .create({
          nombre: ficha.name,
          apodo: ficha.nickname,
          handle,
          incorporacion: false,
          orden,
          claimedBy: null,
          createdAt: FieldValue.serverTimestamp(),
          updatedAt: FieldValue.serverTimestamp(),
        })
        .catch(() => {}),
    ),
  );
}

const sinTildes = (s: string) =>
  s
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");

/** Un handle sugerido para quien todavía no tiene fila de reclamo.
 *
 *  Sigue la forma de los que ya están sembrados —apodo + apellido, sin tildes
 *  ni espacios: "Adri" + "Ledesma" → `adriledesma`—, que es como se nombran
 *  entre ellos. Tiene que pasar `HANDLE_RE` (`[a-z0-9._]{3,20}`) porque es el
 *  handle con el que se va a crear la cuenta y acá no hay formulario donde
 *  corregirlo: si saliera inválido, el alta del jugador sería un callejón sin
 *  salida.
 */
function handleLibre(ficha: PlayerDoc, tomados: Set<string>): string {
  const apellido = sinTildes(ficha.name.trim().split(/\s+/).pop() ?? "");
  const apodo = sinTildes(ficha.nickname ?? "");
  const base = (apodo + apellido || sinTildes(ficha.name) || "jugador").slice(0, 20);

  if (!tomados.has(base) && base.length >= 3) return base;

  // Un sufijo antes que un handle repetido: dos filas con el mismo handle son
  // dos altas que chocan en la reserva, y la segunda no tendría cómo seguir.
  for (let i = 2; i < 100; i += 1) {
    const cand = `${base.slice(0, 20 - String(i).length)}${i}`;
    if (!tomados.has(cand) && cand.length >= 3) return cand;
  }
  return base;
}
