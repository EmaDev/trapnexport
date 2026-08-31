import { adminDb } from "@/lib/firebase/admin";
import { COL } from "@/lib/firebase/collections";
import type { UserDoc } from "@/lib/firebase/schema";
import { shortDate } from "@/lib/time";

/** Lecturas del panel sobre las cuentas **reales**, las de Firestore.
 *
 *  Es la mitad "read" del par con `actions.ts`, igual que `social/queries.ts`
 *  lo es de `social/actions.ts`. La diferencia con aquel es la fuente: aquel
 *  lee el store en memoria, que hoy sólo tiene las cuentas semilla del feed;
 *  esto lee `trapnexport-user`, que son las personas que efectivamente se
 *  registraron. Mientras el feed no migre, las dos listas conviven y no son la
 *  misma cosa — una es contenido de muestra, la otra son cuentas.
 *
 *  Va con el Admin SDK y no con el del navegador porque el panel necesita ver
 *  lo que las reglas le esconden a cualquier cliente: cuentas suspendidas,
 *  reclamos pendientes y —cuando haga falta— el email de la subcolección
 *  privada.
 */

/** Una fila de la tabla de cuentas. */
export interface CuentaRow {
  uid: string;
  name: string;
  handle: string;
  avatar: string;
  posts: number;
  alta: string;
  estado: "activa" | "pendiente" | "suspendida";
  verificado: boolean;
  /** entró con Google, con contraseña, o las dos */
  rol: UserDoc["role"];
}

/** Una solicitud de "soy este jugador del plantel", esperando revisión. */
export interface SolicitudRow {
  uid: string;
  /** nombre del jugador reclamado */
  playerName: string;
  playerId: string;
  handle: string;
  avatar: string;
  note?: string;
  pedidoEl: string;
}

const ESTADO: Record<UserDoc["status"], CuentaRow["estado"]> = {
  active: "activa",
  pending: "pendiente",
  suspended: "suspendida",
};

/*  Firestore devuelve `Timestamp`; el resto del panel formatea desde
 *  milisegundos. `?? Date.now()` cubre la ventana en la que `serverTimestamp()`
 *  todavía no fue confirmado por el servidor. */
const fecha = (ts: { toMillis(): number } | null | undefined) =>
  shortDate(ts?.toMillis() ?? Date.now());

/** Todas las cuentas registradas, de la más nueva a la más vieja.
 *
 *  Ordena por alta y no por cantidad de publicaciones —como hacía la versión
 *  del store— porque hoy nadie tiene publicaciones en Firestore: ordenar por un
 *  campo que vale cero en todas las filas deja la tabla en un orden arbitrario
 *  que cambia entre renders. */
export async function getCuentas(): Promise<CuentaRow[]> {
  const snap = await adminDb().collection(COL.user).orderBy("createdAt", "desc").get();

  return snap.docs.map((d) => {
    const u = d.data() as UserDoc;
    return {
      uid: d.id,
      name: u.name,
      handle: u.handle,
      avatar: u.avatar,
      posts: u.stats?.posts ?? 0,
      alta: fecha(u.createdAt),
      estado: ESTADO[u.status] ?? "activa",
      verificado: Boolean(u.verified),
      rol: u.role,
    };
  });
}

/** Las solicitudes del plantel pendientes de confirmación.
 *
 *  Es la cola de trabajo del admin: cada fila es alguien que se registró
 *  diciendo "soy este jugador" y todavía no se verificó que lo sea. Hasta que
 *  se resuelva, esa cuenta está en `pending` y el jugador queda tomado, así que
 *  dejarlas juntando polvo bloquea al jugador real.
 */
export async function getSolicitudes(): Promise<SolicitudRow[]> {
  const snap = await adminDb()
    .collection(COL.user)
    .where("claim.status", "==", "pending")
    .get();

  return snap.docs
    .map((d) => {
      const u = d.data() as UserDoc;
      return {
        uid: d.id,
        // El nombre de la cuenta ES el del jugador: al reclamar no se elige
        // otro. Se muestra igual como "dice ser X" porque hasta que el admin
        // confirme, ese nombre es una afirmación de la persona, no un hecho.
        playerName: u.name,
        playerId: u.playerId ?? "",
        handle: u.handle,
        avatar: u.avatar,
        note: u.claim?.note,
        pedidoEl: fecha(u.claim?.requestedAt),
        orden: u.claim?.requestedAt?.toMillis() ?? 0,
      };
    })
    // Las más viejas primero: es una cola, y la que más esperó es la que más
    // tiempo lleva bloqueando a un jugador.
    .sort((a, b) => a.orden - b.orden)
    .map(({ orden: _orden, ...row }) => row);
}

export interface CuentasStats {
  total: number;
  suspendidas: number;
  /** vínculos con el plantel esperando autorización */
  pendientes: number;
}

/** Los números de cuentas para el tablero.
 *
 *  Van con `count()` y no trayendo los documentos: son tres números en una
 *  pantalla que no muestra ninguna cuenta, y `count()` se factura como una
 *  lectura en vez de una por usuario registrado.
 *
 *  `pendientes` es el que importa: es la única cifra del panel que significa
 *  "hay algo que hacer". Una solicitud sin resolver deja a una persona sin
 *  poder usar la cuenta y a un jugador bloqueado para el que sí sea.
 */
export async function getCuentasStats(): Promise<CuentasStats> {
  const col = adminDb().collection(COL.user);

  const [total, suspendidas, pendientes] = await Promise.all([
    col.count().get(),
    col.where("status", "==", "suspended").count().get(),
    col.where("claim.status", "==", "pending").count().get(),
  ]);

  return {
    total: total.data().count,
    suspendidas: suspendidas.data().count,
    pendientes: pendientes.data().count,
  };
}
