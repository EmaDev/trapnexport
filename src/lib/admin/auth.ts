import { redirect } from "next/navigation";

import { verificarSesion } from "@/lib/auth/sesion";

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

/*  La cookie ya no se define acá. Vive en `lib/auth/sesion.ts` porque es **una
 *  sola para toda la app**: Firebase Hosting descarta cualquier cookie que no se
 *  llame `__session` en las respuestas cacheables, así que no existe la opción
 *  de tener una para el feed y otra para el panel.
 *
 *  Lo que este módulo aporta encima de esa sesión compartida es el claim. */

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
 *  La verificación de la cookie —incluido el chequeo de revocación, que cuesta
 *  una llamada a Firebase por request— la hace `verificarSesion()`, que es la
 *  misma que usa el módulo público. Acá encima va lo único que este módulo
 *  agrega: el claim.
 */
export async function getAdminSession(): Promise<AdminSession | null> {
  const decoded = await verificarSesion();
  if (!decoded) return null;

  // La cookie es válida, pero eso sólo prueba quién es, no que pueda entrar.
  // Es el mismo `__session` que lleva cualquier persona con sesión en el feed.
  if (decoded.admin !== true) return null;

  return {
    uid: decoded.uid,
    email: decoded.email ?? "",
    name: decoded.name ?? decoded.email ?? "Administración",
  };
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
