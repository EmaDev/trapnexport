// Crea la cuenta oficial del club, que es el remitente de las difusiones.
//
//   npm run seed:club
//
// Es un `UserDoc` como cualquier otro salvo por dos cosas: su id es `club` y no
// un uid de Firebase Auth, y lo escribe el Admin SDK. Las dos juntas son lo que
// hace que nadie pueda suplantarlo — `firestore.rules` sólo deja crear
// `trapnexport-user/{uid}` a quien tenga ese uid en su token, y no existe
// ninguna credencial con la que iniciar sesión como `club`.
//
// El handle se reserva igual que cualquier otro, en `trapnexport-handle`: si no,
// alguien podría registrarse como @trapnexport y hacerse pasar por el club en el
// feed, aunque no pudiera mandar difusiones.
//
// Es idempotente: volver a correrlo actualiza nombre y avatar sin tocar nada
// más.

import { cert, getApps, initializeApp } from "firebase-admin/app";
import { FieldValue, getFirestore } from "firebase-admin/firestore";

import { CLUB_UID, COL } from "../src/lib/firebase/collections.ts";

const { FIREBASE_ADMIN_PROJECT_ID, FIREBASE_ADMIN_CLIENT_EMAIL, FIREBASE_ADMIN_PRIVATE_KEY } =
  process.env;

if (!FIREBASE_ADMIN_PROJECT_ID || !FIREBASE_ADMIN_CLIENT_EMAIL || !FIREBASE_ADMIN_PRIVATE_KEY) {
  console.error(
    "\nFaltan las credenciales del Admin SDK en .env.local:\n\n" +
      "  FIREBASE_ADMIN_PROJECT_ID\n" +
      "  FIREBASE_ADMIN_CLIENT_EMAIL\n" +
      "  FIREBASE_ADMIN_PRIVATE_KEY\n",
  );
  process.exit(1);
}

// Las dos mitades del `.env` apuntan al mismo Firebase y nada las obliga a
// coincidir: con el project id mal copiado, el seed escribe en OTRA base sin
// fallar y la cuenta del club simplemente nunca aparece.
const publico = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
if (publico && publico !== FIREBASE_ADMIN_PROJECT_ID) {
  console.error(
    `\nEl proyecto del Admin SDK no es el que usa la app:\n\n` +
      `  FIREBASE_ADMIN_PROJECT_ID       = ${FIREBASE_ADMIN_PROJECT_ID}\n` +
      `  NEXT_PUBLIC_FIREBASE_PROJECT_ID = ${publico}\n`,
  );
  process.exit(1);
}

/** La private key como PEM, venga como venga del `.env`. Ver `seed-jugadores`. */
function parsePrivateKey(raw) {
  let key = raw.trim();
  if ((key.startsWith('"') && key.endsWith('"')) || (key.startsWith("'") && key.endsWith("'"))) {
    key = key.slice(1, -1);
  }
  key = key.replace(/\\n/g, "\n");

  if (!key.includes("-----BEGIN") || !key.includes("PRIVATE KEY-----")) {
    console.error("\nFIREBASE_ADMIN_PRIVATE_KEY no parece una clave privada.\n");
    process.exit(1);
  }
  return key;
}

if (!getApps().length) {
  initializeApp({
    credential: cert({
      projectId: FIREBASE_ADMIN_PROJECT_ID,
      clientEmail: FIREBASE_ADMIN_CLIENT_EMAIL,
      privateKey: parsePrivateKey(FIREBASE_ADMIN_PRIVATE_KEY),
    }),
  });
}

const HANDLE = "trapnexport";
const NOMBRE = "Trap N Export";

const db = getFirestore();
const ref = db.collection(COL.user).doc(CLUB_UID);
const existe = (await ref.get()).exists;

const batch = db.batch();

batch.set(
  ref,
  {
    uid: CLUB_UID,
    handle: HANDLE,
    name: NOMBRE,
    // El escudo, que es el único asset de marca real de la app. Es una ruta
    // pública y no una URL de Storage: no se sube ni se cambia desde ningún
    // lado, así que no tiene `avatarPath`.
    avatar: "/escudo.svg",
    bio: "Cuenta oficial del club.",
    // `club` y no `fan`: el rol es lo que deja distinguirlo al listar cuentas.
    // No es un permiso — el panel se sigue gateando por el claim `admin`.
    role: "club",
    status: "active",
    verified: true,
    updatedAt: FieldValue.serverTimestamp(),
    ...(existe ? {} : { stats: { posts: 0, comments: 0, gallery: 0 }, createdAt: FieldValue.serverTimestamp() }),
  },
  { merge: true },
);

batch.set(
  db.collection(COL.handle).doc(HANDLE),
  { uid: CLUB_UID, createdAt: FieldValue.serverTimestamp() },
  { merge: true },
);

await batch.commit();

console.log(
  existe
    ? `\nCuenta del club actualizada (${COL.user}/${CLUB_UID}, @${HANDLE}).\n`
    : `\nCuenta del club creada (${COL.user}/${CLUB_UID}, @${HANDLE}).\n` +
        `Ya se le puede mandar difusiones desde /admin/mensajes.\n`,
);
