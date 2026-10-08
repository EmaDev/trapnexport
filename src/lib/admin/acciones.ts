"use server";

import { FieldValue } from "firebase-admin/firestore";
import { revalidatePath } from "next/cache";

import { requireAdmin } from "@/lib/admin/auth";
import { adminDb } from "@/lib/firebase/admin";
import { COL } from "@/lib/firebase/collections";
import type { UserDoc } from "@/lib/firebase/schema";
import { saneaFicha, type FichaInput } from "@/lib/social/ficha";

/** Escrituras del panel sobre cuentas reales.
 *
 *  Van por el Admin SDK, que se saltea `firestore.rules`, y eso es
 *  precisamente el punto: ninguna regla podría autorizar esto. "Confirmar que
 *  esta persona es Naza Sochan" no es un permiso que se pueda derivar del
 *  token de quien escribe — es un juicio de alguien que conoce al plantel.
 *
 *  Cada acción empieza por `requireAdmin()`: es una Server Action, así que se
 *  puede invocar por POST desde cualquier lado, y sin ese chequeo el botón de
 *  la pantalla sería una decoración sobre un endpoint abierto.
 */

const revalidar = () => {
  revalidatePath("/admin/usuarios");
  revalidatePath("/admin");
};

export type ResultadoRevision = { ok: true } | { ok: false; error: string };

/** Confirma que quien se registró es el jugador que dice ser.
 *
 *  Deja la cuenta activa y verificada. El reclamo no se borra: queda con
 *  `approved` y quién lo aprobó, que es lo único que después permite responder
 *  "¿y esto quién lo autorizó?".
 */
export async function aprobarSolicitud(uid: string): Promise<ResultadoRevision> {
  const admin = await requireAdmin();
  const ref = adminDb().collection(COL.user).doc(uid);

  try {
    await adminDb().runTransaction(async (tx) => {
      const snap = await tx.get(ref);
      const u = snap.data() as UserDoc | undefined;

      // Releer dentro de la transacción y no confiar en lo que mostraba la
      // pantalla: entre que se pintó la lista y se tocó el botón, otro admin
      // pudo haber resuelto la misma solicitud.
      if (!u) throw new Error("Esa cuenta ya no existe.");
      if (u.claim?.status !== "pending") throw new Error("Esa solicitud ya fue resuelta.");

      tx.update(ref, {
        status: "active",
        verified: true,
        "claim.status": "approved",
        "claim.reviewedAt": FieldValue.serverTimestamp(),
        "claim.reviewedBy": admin.uid,
        updatedAt: FieldValue.serverTimestamp(),
      });
    });
  } catch (err) {
    return { ok: false, error: (err as Error).message };
  }

  revalidar();
  return { ok: true };
}

/** Rechaza el reclamo: la persona no es ese jugador.
 *
 *  **Borra el perfil**, y no es exceso de celo: rechazar tiene que dejar el
 *  jugador reclamable de nuevo *y* liberar el handle. El handle es el del
 *  jugador —`@nazamaciel`—, así que si la cuenta sobreviviera como hincha se
 *  quedaría con el nombre de usuario del jugador real, y el jugador real no
 *  podría registrarse nunca. No hay forma de liberarlo sin borrar la reserva, y
 *  no hay reserva sin cuenta.
 *
 *  **La credencial de acceso NO se toca.** Esa cuenta de Google o ese email con
 *  contraseña son de la persona; lo que se rechazó es la afirmación de ser un
 *  jugador, no su derecho a tener cuenta. La próxima vez que entre cae en
 *  `/completar-perfil` y puede registrarse como hincha con otro handle.
 */
export async function rechazarSolicitud(uid: string): Promise<ResultadoRevision> {
  await requireAdmin();
  const db = adminDb();
  const ref = db.collection(COL.user).doc(uid);

  try {
    await db.runTransaction(async (tx) => {
      const snap = await tx.get(ref);
      const u = snap.data() as UserDoc | undefined;

      if (!u) throw new Error("Esa cuenta ya no existe.");
      if (u.claim?.status !== "pending") throw new Error("Esa solicitud ya fue resuelta.");

      // Las tres escrituras van juntas: un jugador liberado con el handle
      // todavía tomado, o al revés, es un estado que nadie puede reparar desde
      // la pantalla.
      tx.delete(db.collection(COL.handle).doc(u.handle));
      tx.delete(ref);
      if (u.playerId) {
        tx.update(db.collection(COL.jugador).doc(u.playerId), { claimedBy: null });
      }
    });

    // Borrar un documento no borra sus subcolecciones: sin esto, `private/` y
    // `gallery/` quedarían huérfanas colgando de un id que ya no existe.
    await db.recursiveDelete(ref);
  } catch (err) {
    return { ok: false, error: (err as Error).message };
  }

  revalidar();
  return { ok: true };
}

/** Carga la ficha deportiva de una cuenta desde el panel.
 *
 *  Es la misma ficha que la persona edita en `/perfil` y el mismo documento:
 *  no hay una copia del club. Existe porque la ficha es opcional y buena parte
 *  del plantel no la completa —o la completa a medias—, y lo que se muestra en
 *  `/historia` sale de ahí: sin esta acción, la única forma de que la
 *  trayectoria de alguien tenga sus skills sería pedirle que entre y las
 *  cargue.
 *
 *  **Pisa lo que haya**, incluso lo que cargó la persona, y no hay forma de que
 *  no lo haga: la ficha se guarda entera, así que "completá lo que falta" y
 *  "reemplazá todo" son la misma escritura. Por eso el formulario del panel
 *  abre con los valores actuales y no vacío — lo que se guarda es lo que se ve.
 *
 *  Comparte `saneaFicha` con `updateFicha`: los dos caminos escriben la misma
 *  clave, y un rango validado de un solo lado es un rango que no existe.
 */
export async function guardarFichaDeCuenta(
  uid: string,
  input: FichaInput,
): Promise<ResultadoRevision> {
  await requireAdmin();
  const ref = adminDb().collection(COL.user).doc(uid);

  const snap = await ref.get();
  const u = snap.data() as UserDoc | undefined;
  if (!u) return { ok: false, error: "Esa cuenta ya no existe." };

  await ref.update({
    ficha: saneaFicha(input),
    updatedAt: FieldValue.serverTimestamp(),
  });

  // La ficha se ve en cuatro lugares y ninguno es `/admin/usuarios`, así que
  // este no usa `revalidar()`: la trayectoria pública, el perfil de la persona,
  // su propia pantalla de perfil y la solapa desde la que se acaba de editar.
  revalidatePath("/historia");
  revalidatePath("/perfil");
  revalidatePath(`/u/${u.handle}`);
  revalidatePath("/admin/historia");

  return { ok: true };
}

/** Suspende o reactiva una cuenta. No borra nada: deja de verse en el feed. */
export async function setCuentaSuspendida(
  uid: string,
  suspender: boolean,
): Promise<ResultadoRevision> {
  await requireAdmin();
  const ref = adminDb().collection(COL.user).doc(uid);

  try {
    await adminDb().runTransaction(async (tx) => {
      const snap = await tx.get(ref);
      const u = snap.data() as UserDoc | undefined;
      if (!u) throw new Error("Esa cuenta ya no existe.");

      // Reactivar no siempre es volver a `active`: si la cuenta tenía un
      // reclamo sin resolver, vuelve a `pending`. Sin esto, suspender y
      // reactivar aprobaría el reclamo de rebote, sin que nadie lo revisara.
      const status = suspender
        ? "suspended"
        : u.claim?.status === "pending"
          ? "pending"
          : "active";

      tx.update(ref, { status, updatedAt: FieldValue.serverTimestamp() });
    });
  } catch (err) {
    return { ok: false, error: (err as Error).message };
  }

  revalidar();
  return { ok: true };
}

/* ── tipo de cuenta ──────────────────────────────────────────────────────── */

/** A qué se la quiere convertir: hincha, o jugador del plantel. */
export type DestinoCuenta =
  | { rol: "fan" }
  | { rol: "player"; playerId: string };

/** Cambia de qué lado del club está una cuenta: hincha ⇄ plantel.
 *
 *  Existe por el caso que el alta no cubre: alguien del plantel que se
 *  registró por la vía rápida —"soy hincha"— y quedó sin vínculo con su ficha.
 *  Desde el alta no hay vuelta atrás: el paso "soy del equipo" sólo existe al
 *  registrarse, y sin esto la única salida era borrar la cuenta y pedirle que
 *  se registre de nuevo, perdiendo sus publicaciones y su historial.
 *
 *  **No reemplaza a `aprobarSolicitud`.** Ahí hay alguien afirmando ser un
 *  jugador y el admin confirma; acá el admin es el que lo afirma, sin reclamo
 *  previo. Por eso escribe el `claim` como `approved` con su propio uid: el
 *  vínculo queda con la misma huella de quién lo autorizó, que es lo único que
 *  después permite responder "¿y esto quién lo decidió?".
 *
 *  Las dos direcciones tocan `trapnexport-jugador`, y por eso van en una
 *  transacción: el `claimedBy` del jugador es lo que impide que dos cuentas
 *  reclamen al mismo, y una cuenta vinculada a un jugador que quedó libre —o al
 *  revés— no se puede reparar desde la pantalla.
 *
 *  Lo que **no** cambia es el handle. Es la URL del perfil y lo que se escribe
 *  para mencionar a alguien: reescribirlo acá dejaría los enlaces y las
 *  menciones existentes apuntando a un perfil que no está, y el handle libre no
 *  se puede garantizar sin la reserva de `trapnexport-handle`. Quien pase del
 *  plantel a hincha se queda con el handle del jugador, que es exactamente el
 *  motivo por el que `rechazarSolicitud` borra el perfil en vez de degradarlo;
 *  acá se acepta a propósito —la cuenta ya tiene contenido propio— y la
 *  pantalla lo avisa antes de confirmar.
 */
export async function cambiarTipoDeCuenta(
  uid: string,
  destino: DestinoCuenta,
): Promise<ResultadoRevision> {
  const admin = await requireAdmin();
  const db = adminDb();
  const userRef = db.collection(COL.user).doc(uid);

  let handle = "";

  try {
    await db.runTransaction(async (tx) => {
      // Todas las lecturas antes de cualquier escritura: requisito de las
      // transacciones de Firestore.
      const snap = await tx.get(userRef);
      const u = snap.data() as UserDoc | undefined;
      if (!u) throw new Error("Esa cuenta ya no existe.");
      handle = u.handle;

      // Un admin no se degrada desde una tabla de moderación, y la cuenta del
      // club no es de nadie. El rol `admin` de Firestore acompaña al custom
      // claim de Auth, que es la autoridad real: cambiarlo de un lado solo
      // deja los dos contradiciéndose.
      if (u.role === "admin" || u.role === "club") {
        throw new Error("El tipo de esta cuenta no se cambia desde acá.");
      }

      const jugadorAnterior = u.playerId
        ? db.collection(COL.jugador).doc(u.playerId)
        : null;

      if (destino.rol === "player") {
        if (u.role === "player" && u.playerId === destino.playerId) {
          throw new Error("Esa cuenta ya está vinculada a ese jugador.");
        }

        const jugadorRef = db.collection(COL.jugador).doc(destino.playerId);
        const jugadorSnap = await tx.get(jugadorRef);
        if (!jugadorSnap.exists) throw new Error("Ese jugador no está en el plantel.");

        // El mismo chequeo que hace `firestore.rules` en el alta. Releerlo acá
        // y no confiar en la lista que se pintó: el jugador pudo haber sido
        // reclamado entre que se abrió el diálogo y se tocó guardar.
        const claimedBy = jugadorSnap.data()?.claimedBy as string | null | undefined;
        if (claimedBy && claimedBy !== uid) {
          throw new Error("Ese jugador ya lo reclamó otra cuenta.");
        }

        tx.update(userRef, {
          role: "player",
          playerId: destino.playerId,
          // Lo decide el admin: no hay nada más que confirmar, así que la
          // cuenta queda verificada y con el tilde en el perfil.
          verified: true,
          // Una cuenta suspendida sigue suspendida: cambiarle el tipo es
          // corregir un dato, no levantar una sanción.
          status: u.status === "suspended" ? "suspended" : "active",
          claim: {
            status: "approved",
            // Si ya había pedido el vínculo, la fecha del pedido es la suya y
            // no la de hoy. Si no hubo reclamo, el pedido es este cambio.
            requestedAt: u.claim?.requestedAt ?? FieldValue.serverTimestamp(),
            reviewedAt: FieldValue.serverTimestamp(),
            reviewedBy: admin.uid,
            ...(u.claim?.note ? { note: u.claim.note } : {}),
          },
          updatedAt: FieldValue.serverTimestamp(),
        });

        tx.update(jugadorRef, { claimedBy: uid });

        // Reasignar a otro jugador libera al anterior: dejarlo tomado por una
        // cuenta que ya no es esa persona bloquea al jugador real para siempre.
        if (jugadorAnterior && u.playerId !== destino.playerId) {
          tx.update(jugadorAnterior, { claimedBy: null });
        }
        return;
      }

      if (u.role === "fan") throw new Error("Esa cuenta ya es de hincha.");

      tx.update(userRef, {
        role: "fan",
        // El tilde era por ser del plantel: sin vínculo no hay nada verificado.
        verified: false,
        status: u.status === "suspended" ? "suspended" : "active",
        // `delete()` y no `null`: un hincha no tiene `playerId`, y un campo en
        // `null` haría que cualquier `if (u.playerId)` siga siendo distinto de
        // "no existe" en las queries por ese campo.
        playerId: FieldValue.delete(),
        claim: FieldValue.delete(),
        updatedAt: FieldValue.serverTimestamp(),
      });

      // La ficha deportiva **queda**. No se muestra en ningún lado sin
      // `playerId` —`/historia` cruza por ese campo— y borrarla haría que
      // deshacer el cambio pierda lo que la persona cargó a mano.

      if (jugadorAnterior) tx.update(jugadorAnterior, { claimedBy: null });
    });
  } catch (err) {
    return { ok: false, error: (err as Error).message };
  }

  revalidar();
  // El vínculo con el plantel se ve afuera del panel: la trayectoria pública
  // cruza cuentas verificadas con fichas por `playerId`, y el perfil muestra el
  // tilde y la ficha.
  revalidatePath("/historia");
  revalidatePath("/admin/historia");
  revalidatePath("/perfil");
  if (handle) revalidatePath(`/u/${handle}`);

  return { ok: true };
}
