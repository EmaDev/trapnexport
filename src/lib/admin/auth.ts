import { cookies } from "next/headers";
import { redirect } from "next/navigation";

/** La costura de autenticación del módulo privado.
 *
 *  Hoy `/admin` es accesible sin credenciales, a pedido: la app todavía no
 *  tiene Firebase Auth conectado. Lo que sí está es **todo lo que rodea** a esa
 *  puerta, para que encenderla sea cambiar una variable y completar un `TODO`,
 *  no rearmar el módulo:
 *
 *    - `ADMIN_AUTH_ENABLED=true` activa el guard (middleware + este archivo).
 *    - El middleware corta antes de renderizar si no hay cookie de sesión.
 *    - `requireAdmin()` es el único punto por el que las páginas del panel
 *      obtienen la identidad: cuando entre Firebase, se verifica acá y ninguna
 *      pantalla se entera.
 *    - `/admin` va con `noindex` y `X-Robots-Tag` pase lo que pase.
 *
 *  Cómo se termina (checklist, en orden):
 *
 *    1. `ADMIN_SESSION_COOKIE` la escribe un endpoint que canjea el idToken de
 *       Firebase por una session cookie (`createSessionCookie`).
 *    2. Acá abajo, reemplazar el bloque TODO por `verifySessionCookie` con
 *       `firebase-admin` (ya está en package.json) y chequear el custom claim
 *       `admin === true`.
 *    3. Poner `ADMIN_AUTH_ENABLED=true` en el entorno.
 */

export const ADMIN_SESSION_COOKIE = "__session";

export const isAdminAuthEnabled = () => process.env.ADMIN_AUTH_ENABLED === "true";

export interface AdminSession {
  uid: string;
  email: string;
  name: string;
}

/** Sesión de referencia mientras no hay auth: deja el panel usable y hace
 *  evidente en pantalla que la identidad todavía no es real. */
const PLACEHOLDER: AdminSession = {
  uid: "admin-local",
  email: "admin@local (sin autenticar)",
  name: "Administración",
};

/** La identidad del admin, o `null` si no hay sesión. No redirige.
 *
 *  La usa el layout, que también envuelve a `/admin/login`: si redirigiera
 *  desde ahí, el login se redirigiría a sí mismo para siempre. */
export async function getAdminSession(): Promise<AdminSession | null> {
  if (!isAdminAuthEnabled()) return PLACEHOLDER;

  const session = (await cookies()).get(ADMIN_SESSION_COOKIE)?.value;
  if (!session) return null;

  // TODO(firebase): verificar de verdad. Con firebase-admin ya instalado:
  //
  //   const decoded = await getAuth(adminApp).verifySessionCookie(session, true);
  //   if (!decoded.admin) return null;
  //   return { uid: decoded.uid, email: decoded.email ?? "", name: decoded.name ?? "" };
  //
  // Hasta entonces, con el flag encendido sólo se exige que la cookie exista:
  // suficiente para probar el flujo, insuficiente para producción.
  return { ...PLACEHOLDER, email: "admin@local (cookie sin verificar)" };
}

/** Igual que `getAdminSession`, pero corta la request si no hay sesión.
 *
 *  Va en la primera línea de cada página del panel —menos `/admin/login`—: es
 *  el `assert` de permisos del lado del servidor, la segunda barrera después
 *  del middleware, y el único lugar del que sale la identidad del admin. */
export async function requireAdmin(): Promise<AdminSession> {
  const session = await getAdminSession();
  if (!session) redirect("/admin/login");
  return session;
}
