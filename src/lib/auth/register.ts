"use client";

import {
  createUserWithEmailAndPassword,
  updateProfile,
  type User as FirebaseUser,
} from "firebase/auth";
import { doc, getDoc, runTransaction, serverTimestamp } from "firebase/firestore";

import { authErrorMessage } from "@/lib/auth/errors";
import { auth, db } from "@/lib/firebase/client";
import { COL, PRIVATE_DOC, SUB } from "@/lib/firebase/collections";
import { avatarUrl } from "@/lib/media";
import type { RegisterResult } from "@/lib/social/types";

/** El alta de una cuenta, de punta a punta.
 *
 *  Corre en el navegador, no en una server action, y no es por comodidad: la
 *  transacción que reserva el handle tiene que ir firmada con el token del
 *  usuario para que `firestore.rules` pueda validarla. Una server action
 *  recibiría el `uid` como un campo más del formulario y no tendría forma de
 *  saber si es cierto.
 *
 *  Hay **dos caminos** hasta el mismo documento, y por eso la escritura está
 *  separada de la credencial:
 *
 *    - email y contraseña → `registerFan` / `claimPlayer`. Crean la credencial
 *      y el perfil en un solo envío, porque el formulario ya pidió todo.
 *    - Google → `completeProfile`. La credencial ya existe (la dio Google) y
 *      lo que falta es el handle, que Google no tiene: el alta se parte en dos
 *      pantallas y esto escribe la segunda.
 */

export const HANDLE_RE = /^[a-z0-9._]{3,20}$/;

export const normalizeHandle = (handle: string) => handle.trim().toLowerCase();

/** Error de negocio del alta — el mensaje ya está escrito para la pantalla.
 *
 *  Se distingue de los de Firebase porque esos pasan por `authErrorMessage`,
 *  que traduce códigos y esconde el resto. Los de acá no hay que traducirlos:
 *  "ese usuario ya está en uso" es lo que hay que mostrar tal cual. */
class RegistroError extends Error {}

/** ¿Está libre este nombre de usuario?
 *
 *  Es para avisar mientras se completa el formulario, **no** para decidir. La
 *  unicidad la resuelve la transacción del alta: entre este chequeo y el envío
 *  puede registrarse otra persona con el mismo handle, y eso lo agarra la
 *  reserva, no esta lectura. */
export async function isHandleTaken(handle: string): Promise<boolean> {
  const clean = normalizeHandle(handle);
  if (!HANDLE_RE.test(clean)) return false;
  return (await getDoc(doc(db, COL.handle, clean))).exists();
}

/** Un handle propuesto a partir de lo que dio Google.
 *
 *  Es una sugerencia editable, no una decisión: sale de la parte local del
 *  email, sin los puntos de Gmail —que ahí no significan nada— y recortado al
 *  largo que aceptan las reglas. Si no queda nada usable devuelve `""` y la
 *  persona lo escribe. */
export function suggestHandle(email: string | null, displayName?: string | null): string {
  const base = (email?.split("@")[0] ?? displayName ?? "")
    .toLowerCase()
    .normalize("NFD")
    // U+0300–U+036F: los acentos que `NFD` separa de su letra.
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]/g, "")
    .slice(0, 20);

  return base.length >= 3 ? base : "";
}

interface PerfilInput {
  name: string;
  handle: string;
  /** foto de la cuenta; si no viene se genera una con las iniciales */
  avatar?: string;
  /** slug del plantel, si esta cuenta reclama a alguien */
  playerId?: string;
  /** lo que la persona le escribe al admin para que la reconozca */
  note?: string;
}

function validar(input: PerfilInput): string | null {
  if (input.name.trim().length < 2) return "Ingresá tu nombre.";
  if (!HANDLE_RE.test(normalizeHandle(input.handle))) {
    return "El usuario va de 3 a 20 caracteres: minúsculas, números, punto o guion bajo.";
  }
  return null;
}

/** Escribe el perfil de una credencial que **ya existe**.
 *
 *  Las cuatro escrituras van en una sola transacción porque dependen entre sí:
 *  el documento de usuario no vale sin la reserva del handle (las reglas piden
 *  las dos con `getAfter`), y un reclamo no vale sin marcar al jugador. Que
 *  cualquiera de ellas quede sola es un estado que no se puede reparar solo.
 *
 *  Tira `RegistroError` con el texto ya listo para mostrar.
 */
async function escribirPerfil(user: FirebaseUser, input: PerfilInput): Promise<void> {
  const name = input.name.trim();
  const handle = normalizeHandle(input.handle);
  const uid = user.uid;
  const esJugador = Boolean(input.playerId);

  await runTransaction(db, async (tx) => {
    // Todas las lecturas antes de cualquier escritura: es requisito de las
    // transacciones de Firestore, no un orden estético.
    const handleRef = doc(db, COL.handle, handle);
    if ((await tx.get(handleRef)).exists()) {
      throw new RegistroError("Ese nombre de usuario ya está en uso.");
    }

    const jugadorRef = input.playerId ? doc(db, COL.jugador, input.playerId) : null;
    if (jugadorRef) {
      const snap = await tx.get(jugadorRef);
      if (!snap.exists()) throw new RegistroError("Ese jugador no está en el plantel.");
      if (snap.data().claimedBy) {
        throw new RegistroError("Esa cuenta ya fue reclamada por alguien.");
      }
    }

    /*  El avatar generado es un data-URI de ~600 bytes y la foto de Google es
     *  una URL: los dos entran sin problema en el documento. Las fotos que
     *  suba la persona NO van acá — van a Storage, y en este campo queda la
     *  URL. */
    tx.set(doc(db, COL.user, uid), {
      uid,
      handle,
      name,
      avatar: input.avatar || avatarUrl(name, handle),
      role: esJugador ? "player" : "fan",
      // Una cuenta de hincha entra directo; una que dice ser del plantel
      // espera a que el admin confirme que es quien dice ser.
      status: esJugador ? "pending" : "active",
      verified: false,
      stats: { posts: 0, comments: 0, gallery: 0 },
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      ...(input.playerId
        ? {
            playerId: input.playerId,
            claim: {
              status: "pending",
              requestedAt: serverTimestamp(),
              ...(input.note?.trim() ? { note: input.note.trim() } : {}),
            },
          }
        : {}),
    });

    // La reserva del handle. Va en la misma transacción que el documento de
    // usuario porque es lo único que hace único al handle: las reglas exigen
    // las dos escrituras juntas, y dos altas simultáneas con el mismo nombre
    // chocan acá en vez de convivir.
    tx.set(handleRef, { uid, createdAt: serverTimestamp() });

    tx.set(doc(db, COL.user, uid, SUB.private, PRIVATE_DOC), {
      email: user.email ?? "",
      emailVerified: user.emailVerified,
      providers: user.providerData.map((p) => p.providerId),
      pushSubscriptions: [],
      notifications: { likes: true, comments: true, news: true },
      updatedAt: serverTimestamp(),
    });

    // Marca el jugador como tomado. `claimedBy == null` en las reglas es lo
    // que impide que dos personas reclamen al mismo.
    if (jugadorRef) tx.update(jugadorRef, { claimedBy: uid });
  });

  // Cosmético y no crítico: es lo que ve el panel de Firebase Auth en la lista
  // de usuarios. Si falla, la cuenta ya está bien creada.
  await updateProfile(user, { displayName: name }).catch(() => {});
}

const aResultado = (err: unknown): RegisterResult => ({
  ok: false,
  error: err instanceof RegistroError ? err.message : authErrorMessage(err),
});

/* ── alta con email y contraseña ─────────────────────────────────────────── */

interface AltaBase extends PerfilInput {
  email: string;
  password: string;
}

async function crearCuenta(input: AltaBase): Promise<RegisterResult> {
  const invalido = validar(input);
  if (invalido) return { ok: false, error: invalido };
  if (input.password.length < 6) {
    return { ok: false, error: "La contraseña necesita al menos 6 caracteres." };
  }

  let cred;
  try {
    cred = await createUserWithEmailAndPassword(auth, input.email.trim(), input.password);
  } catch (err) {
    return { ok: false, error: authErrorMessage(err) };
  }

  try {
    await escribirPerfil(cred.user, input);
  } catch (err) {
    // El perfil no se creó: la credencial sin perfil no sirve para nada y
    // dejaría el email ocupado para siempre. Con Google esto NO se hace —ahí
    // la cuenta es de la persona, no la creamos nosotros— y por eso el borrado
    // vive acá y no dentro de `escribirPerfil`.
    await cred.user.delete().catch(() => {});
    return aResultado(err);
  }

  return { ok: true };
}

/** Alta de una cuenta que no es del plantel: nombre y handle libres, sin
 *  reclamo ni revisión. Queda activa de entrada. */
export const registerFan = (input: AltaBase) => crearCuenta(input);

/** Alta de alguien que dice ser un jugador del plantel.
 *
 *  El nombre y el handle salen del documento del jugador, no de un formulario:
 *  quien reclama la cuenta de Naza Sochan no elige llamarse otra cosa. La
 *  cuenta queda en `pending` hasta que el admin confirme la identidad. */
export const claimPlayer = (input: AltaBase & { playerId: string }) => crearCuenta(input);

/* ── completar el alta de una sesión de Google ───────────────────────────── */

/** Escribe el perfil de quien ya entró con Google.
 *
 *  Google da email, nombre y foto, pero no un handle, y el handle es
 *  obligatorio: es la URL del perfil y lo que se escribe para mencionar a
 *  alguien. Por eso entrar con Google por primera vez no termina en el feed
 *  sino en `/completar-perfil`.
 *
 *  A diferencia del alta con contraseña, si esto falla **no se borra la
 *  credencial**: esa cuenta de Google es de la persona y existía antes de esta
 *  app. Queda una sesión sin perfil —`account: null` en `AuthContext`— y la
 *  pantalla de completar el perfil la vuelve a pedir.
 */
export async function completeProfile(input: PerfilInput): Promise<RegisterResult> {
  const user = auth.currentUser;
  if (!user) return { ok: false, error: "Se cerró la sesión. Volvé a entrar." };

  const invalido = validar(input);
  if (invalido) return { ok: false, error: invalido };

  try {
    await escribirPerfil(user, input);
    return { ok: true };
  } catch (err) {
    return aResultado(err);
  }
}
