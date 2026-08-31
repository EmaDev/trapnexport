import { getAuth } from "firebase-admin/auth";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { adminApp } from "@/lib/firebase/admin";

/** La autenticación del módulo privado.
 *
 *  Son **dos** condiciones, y las dos hacen falta: haber iniciado sesión, y
 *  tener el custom claim `admin` en el token. La primera la da Firebase Auth a
 *  cualquiera que se registre en la app; la segunda se otorga a mano con
 *  `npm run admin:grant -- alguien@mail.com`, que corre con el Admin SDK.
 *
 *  El claim vive en el token de Firebase y **no** en un campo de Firestore. El
 *  documento de usuario es de lectura pública y su propio dueño puede
 *  escribirlo: un `role: "admin"` ahí adentro sería un permiso que el usuario
 *  se puede dar solo. El claim sólo lo puede poner el Admin SDK.
 *
 *  No hay flag para apagar esto. Existía uno (`ADMIN_AUTH_ENABLED`) mientras
 *  no había con qué autenticar; ahora sería una variable de entorno capaz de
 *  desactivar la autenticación del panel de moderación, y eso tarde o temprano
 *  sale mal configurado a producción.
 */

/** La cookie de sesión. Se llama `__session` y no es capricho: Firebase Hosting
 *  descarta cualquier otra cookie en las respuestas cacheables. */
export const ADMIN_SESSION_COOKIE = "__session";

/** Cuánto dura la sesión del panel. Cinco días es el máximo que acepta
 *  `createSessionCookie`; para moderación esporádica, tener que volver a entrar
 *  cada semana es aceptable y acota la ventana de una cookie robada. */
export const ADMIN_SESSION_MAX_AGE = 5 * 24 * 60 * 60; // segundos

export interface AdminSession {
  uid: string;
  email: string;
  name: string;
}

/** La identidad del admin, o `null`. No redirige.
 *
 *  La usa el layout, que también envuelve a `/admin/login`: si redirigiera
 *  desde ahí, el login se redirigiría a sí mismo para siempre.
 *
 *  `verifySessionCookie(..., true)` comprueba además que la sesión no haya sido
 *  revocada, lo que cuesta una llamada a Firebase por request. Es el precio de
 *  poder echar a alguien de verdad: sin ese `true`, revocarle el acceso a una
 *  cuenta no tiene efecto hasta que la cookie expire, cinco días después.
 */
export async function getAdminSession(): Promise<AdminSession | null> {
  const session = (await cookies()).get(ADMIN_SESSION_COOKIE)?.value;
  if (!session) return null;

  try {
    const decoded = await getAuth(adminApp()).verifySessionCookie(session, true);

    // La cookie es válida pero eso sólo prueba quién es, no que pueda entrar.
    if (decoded.admin !== true) return null;

    return {
      uid: decoded.uid,
      email: decoded.email ?? "",
      name: decoded.name ?? decoded.email ?? "Administración",
    };
  } catch {
    // Cookie vencida, revocada o falsificada. Las tres son lo mismo desde acá:
    // no hay sesión. El detalle no se registra ni se muestra — sólo le sirve a
    // quien esté probando cookies.
    return null;
  }
}

/** Igual que `getAdminSession`, pero corta la request si no hay sesión.
 *
 *  Va en la primera línea de cada página del panel —menos `/admin/login`— y al
 *  principio de cada Server Action del panel. Lo segundo no es redundante: una
 *  Server Action es un endpoint POST que se puede invocar sin pasar por
 *  ninguna pantalla, así que el guard de la página no la protege.
 */
export async function requireAdmin(): Promise<AdminSession> {
  const session = await getAdminSession();
  if (!session) redirect("/admin/login");
  return session;
}
