import { getAuth, type DecodedIdToken } from "firebase-admin/auth";
import { cookies } from "next/headers";

import { adminApp } from "@/lib/firebase/admin";

/** La sesión del lado del servidor, que es una cookie.
 *
 *  El navegador tiene un `idToken` de Firebase que dura una hora y vive en
 *  JavaScript. El servidor necesita otra cosa: algo que llegue solo en cada
 *  request, que el script de la página no pueda leer, y que se pueda verificar
 *  sin hablar con el cliente. Eso es esta cookie.
 *
 *  Sin ella los Server Components no saben quién mira. Y eso no es un detalle
 *  de comodidad: `getFeed`, `getMyProfile`, `getNotifications` y
 *  `getUnreadChats` corren en el servidor **antes** de que exista un cliente al
 *  que pedirle un token, así que la alternativa —mandar el `idToken` como
 *  parámetro en cada llamada— obligaría a reescribir esas pantallas como
 *  cliente. Con la cookie, las firmas de `social/queries.ts` y
 *  `social/actions.ts` no cambian: sólo cambia de dónde sale el uid.
 *
 *  **Es una sola cookie para los dos módulos, y no por comodidad.** Firebase
 *  Hosting descarta cualquier cookie que no se llame `__session` en las
 *  respuestas cacheables, así que no existe la opción de tener una para el feed
 *  y otra para el panel. Lo que separa a un usuario de un admin no es la
 *  cookie: es el custom claim `admin` que viaja adentro del token, y que
 *  `lib/admin/auth.ts` chequea al leerla. Una cookie de usuario común entra al
 *  proxy de `/admin` y muere en `requireAdmin()`.
 */

/** Se llama `__session` y no es capricho: ver arriba. */
export const SESSION_COOKIE = "__session";

/** Cinco días es el máximo que acepta `createSessionCookie`.
 *
 *  Se toma el máximo a propósito: el feed es una PWA que se abre y se cierra
 *  todo el día, y una sesión corta significaría volver a pedir la contraseña en
 *  el medio. La ventana de una cookie robada la acota `verifySessionCookie(…,
 *  true)`, que consulta si la sesión fue revocada, no la duración. */
export const SESSION_MAX_AGE = 5 * 24 * 60 * 60; // segundos

/** `lax` y no `strict`, y es consecuencia directa de que la cookie sea una sola.
 *
 *  El panel podría permitirse `strict`: nadie llega a `/admin` desde un link
 *  externo. El feed no puede: `/post/:id` y `/u/:handle` están hechos para
 *  compartirse, y con `strict` esa primera navegación desde WhatsApp llega sin
 *  cookie — la persona abre su propia app y la ve deslogueada. Como la cookie
 *  es compartida, gana el caso que se rompe.
 *
 *  No se pierde gran cosa: `lax` tampoco viaja en un POST cross-site, que es lo
 *  que `strict` protegía de verdad acá.
 */
const SAME_SITE = "lax" as const;

const opcionesDeCookie = () => ({
  httpOnly: true,
  // El JavaScript de la página nunca la lee; en producción sólo viaja por
  // HTTPS. En dev queda sin `secure` porque si no el navegador la descarta en
  // `http://localhost` y no se puede probar el flujo.
  secure: process.env.NODE_ENV === "production",
  sameSite: SAME_SITE,
  path: "/",
  maxAge: SESSION_MAX_AGE,
});

/** Lo que se tira cuando el token es válido pero la cuenta no es admin.
 *
 *  Separado de un token inválido a propósito: son dos respuestas distintas
 *  —403 y 401— y quien llama no tiene por qué inferirlo de un mensaje. */
export class SinPermisoError extends Error {
  constructor() {
    super("Esa cuenta no tiene acceso al panel.");
    this.name = "SinPermisoError";
  }
}

/** Canjea un `idToken` del navegador por la cookie de sesión.
 *
 *  **Por defecto no mira el claim `admin`.** Este es el canje de la app:
 *  cualquier cuenta con sesión válida tiene derecho a una cookie, porque la
 *  necesita para votar, publicar y escribir. Quién puede entrar al panel se
 *  decide mirando el token: acá con `exigirAdmin`, y en cada request con
 *  `getAdminSession()`.
 *
 *  `exigirAdmin` corta **antes** de emitir. Que la cookie sea una sola hace que
 *  el orden importe: sin ese corte, alguien sin permiso que se equivoca de
 *  pantalla de login se llevaría igual una cookie válida. No entraría al panel
 *  —`requireAdmin()` la rechaza— pero el 403 dejaría de ser cierto.
 *
 *  Devuelve el token decodificado por si quien llama necesita algo más de él.
 */
export async function crearSesion(
  idToken: string,
  { exigirAdmin = false }: { exigirAdmin?: boolean } = {},
): Promise<DecodedIdToken> {
  const auth = getAuth(adminApp());

  // `true`: rechaza el token si la cuenta fue deshabilitada o su sesión revocada
  // desde que se emitió.
  const decoded = await auth.verifyIdToken(idToken, true);

  if (exigirAdmin && decoded.admin !== true) throw new SinPermisoError();

  const cookie = await auth.createSessionCookie(idToken, {
    expiresIn: SESSION_MAX_AGE * 1000,
  });

  (await cookies()).set(SESSION_COOKIE, cookie, opcionesDeCookie());
  return decoded;
}

/** Cierra la sesión del servidor.
 *
 *  Borra la cookie **y** revoca los refresh tokens de la cuenta. Lo segundo es
 *  lo que hace que salir signifique algo: sin eso, una copia de la cookie
 *  robada antes de salir seguiría sirviendo hasta que expire, y el
 *  `verifySessionCookie(…, true)` de la lectura no tendría nada que detectar.
 */
export async function cerrarSesion(): Promise<void> {
  const jar = await cookies();
  const cookie = jar.get(SESSION_COOKIE)?.value;

  if (cookie) {
    try {
      const auth = getAuth(adminApp());
      const decoded = await auth.verifySessionCookie(cookie);
      await auth.revokeRefreshTokens(decoded.sub);
    } catch {
      // La cookie ya no valía. Igual hay que borrarla del navegador.
    }
  }

  jar.delete(SESSION_COOKIE);
}

/** El token de la sesión actual, verificado, o `null`.
 *
 *  Es el único lugar donde se verifica la cookie: lo usan `getCurrentUid()` acá
 *  y `getAdminSession()` en `lib/admin/auth.ts`, que además le mira el claim.
 *
 *  `verifySessionCookie(…, true)` comprueba que la sesión no haya sido revocada,
 *  lo que cuesta una llamada a Firebase por request. Es el precio de poder echar
 *  a alguien de verdad: sin ese `true`, revocarle el acceso a una cuenta no
 *  tiene efecto hasta que la cookie expire, cinco días después.
 */
export async function verificarSesion(): Promise<DecodedIdToken | null> {
  const cookie = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!cookie) return null;

  try {
    return await getAuth(adminApp()).verifySessionCookie(cookie, true);
  } catch {
    // Vencida, revocada o falsificada. Las tres son lo mismo desde acá: no hay
    // sesión. El detalle no se registra ni se muestra — sólo le sirve a quien
    // esté probando cookies.
    return null;
  }
}

/** Quién está mirando, o `null` si no hay sesión.
 *
 *  Es la versión para pantallas: el feed, un perfil y una publicación se ven
 *  sin cuenta, y lo único que cambia sin sesión es que no aparecen los botones
 *  que escriben.
 */
export async function getCurrentUid(): Promise<string | null> {
  return (await verificarSesion())?.uid ?? null;
}

/** Lo que se tira cuando una escritura llega sin sesión.
 *
 *  Es una clase y no un `Error` pelado para que las Server Actions puedan
 *  distinguirla de una falla real de Firestore y devolver "iniciá sesión" en
 *  lugar de "algo salió mal". */
export class SinSesionError extends Error {
  constructor() {
    super("Necesitás iniciar sesión.");
    this.name = "SinSesionError";
  }
}

/** Quién está escribiendo. Corta si no hay sesión.
 *
 *  Va en la primera línea de cada Server Action que escribe, y no es redundante
 *  con esconder el botón en la UI: una Server Action es un endpoint POST que se
 *  puede invocar sin pasar por ninguna pantalla. Es el mismo par que
 *  `getAdminSession` / `requireAdmin` en el panel, por el mismo motivo.
 */
export async function requireUid(): Promise<string> {
  const uid = await getCurrentUid();
  if (!uid) throw new SinSesionError();
  return uid;
}
