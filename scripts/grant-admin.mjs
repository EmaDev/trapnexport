// Da (o saca) acceso al panel de administración.
//
//   npm run admin:grant -- alguien@mail.com
//   npm run admin:grant -- alguien@mail.com --revocar
//
// Escribe el custom claim `admin` en el token de Firebase Auth. Es la única
// forma de entrar a /admin: `requireAdmin()` lo exige, y el claim sólo lo puede
// poner el Admin SDK — nadie se lo puede dar a sí mismo desde la app.
//
// Después de correr esto, la persona tiene que **volver a iniciar sesión** en
// /admin/login: los claims viajan dentro del token, y el que ya tiene en el
// navegador se emitió antes de este cambio.

import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";

const args = process.argv.slice(2);
const revocar = args.includes("--revocar");
const email = args.find((a) => !a.startsWith("--"));

if (!email) {
  console.error(
    "\nFalta el email.\n\n" +
      "  npm run admin:grant -- alguien@mail.com\n" +
      "  npm run admin:grant -- alguien@mail.com --revocar\n",
  );
  process.exit(1);
}

const { FIREBASE_ADMIN_PROJECT_ID, FIREBASE_ADMIN_CLIENT_EMAIL, FIREBASE_ADMIN_PRIVATE_KEY } =
  process.env;

if (!FIREBASE_ADMIN_PROJECT_ID || !FIREBASE_ADMIN_CLIENT_EMAIL || !FIREBASE_ADMIN_PRIVATE_KEY) {
  console.error("\nFaltan las credenciales del Admin SDK en .env.local.\n");
  process.exit(1);
}

if (!getApps().length) {
  initializeApp({
    credential: cert({
      projectId: FIREBASE_ADMIN_PROJECT_ID,
      clientEmail: FIREBASE_ADMIN_CLIENT_EMAIL,
      privateKey: FIREBASE_ADMIN_PRIVATE_KEY.trim().replace(/^"|"$/g, "").replace(/\\n/g, "\n"),
    }),
  });
}

const auth = getAuth();

let user;
try {
  user = await auth.getUserByEmail(email);
} catch {
  console.error(
    `\nNo hay ninguna cuenta con el email ${email}.\n` +
      "La persona tiene que registrarse en la app primero: este script da permisos\n" +
      "sobre una cuenta que ya existe, no la crea.\n",
  );
  process.exit(1);
}

// Se reemplazan todos los claims, así que hay que conservar los que ya tenía:
// `setCustomUserClaims` pisa el objeto entero, no hace merge.
const claims = { ...(user.customClaims ?? {}) };
if (revocar) delete claims.admin;
else claims.admin = true;

await auth.setCustomUserClaims(user.uid, claims);

// Sin esto, el token que la persona ya tiene en el navegador sigue valiendo
// hasta una hora — con los permisos viejos. Al revocar es lo que hace que
// sacarle el acceso tenga efecto ahora y no dentro de un rato.
await auth.revokeRefreshTokens(user.uid);

console.log(
  revocar
    ? `\nListo: ${email} ya no tiene acceso al panel.\n`
    : `\nListo: ${email} tiene acceso al panel.\n` +
        "Tiene que volver a iniciar sesión en /admin/login para que el permiso\n" +
        "entre en su token.\n",
);
process.exit(0);
