// Manda un aviso de campanita a toda la comunidad: "App versión 1 en test".
//
//   npm run seed:notificaciones
//
// Es el mismo fan-out que `lib/social/notify.ts` (`notifyAll`): un documento en
// `trapnexport-notification` por cada cuenta no suspendida de `trapnexport-user`.
//
// Es **idempotente**: guarda a quién ya le llegó este mismo aviso y sólo escribe
// para los que faltan. Correrlo de nuevo después de que se registró gente nueva
// completa esos y no duplica los que ya lo tenían.

import { cert, getApps, initializeApp } from "firebase-admin/app";
import { FieldValue, getFirestore } from "firebase-admin/firestore";

import { COL } from "../src/lib/firebase/collections.ts";

/* ── el aviso ────────────────────────────────────────────────────────────── */

const AVISO = {
  kind: "noticia",
  text: "App versión 1 en test",
  description:
    "Estás usando la primera versión de prueba. Si algo se ve raro o no anda, avisá.",
  href: "/",
};

/* ── credenciales del Admin SDK ──────────────────────────────────────────── */

const { FIREBASE_ADMIN_PROJECT_ID, FIREBASE_ADMIN_CLIENT_EMAIL, FIREBASE_ADMIN_PRIVATE_KEY } =
  process.env;

if (!FIREBASE_ADMIN_PROJECT_ID || !FIREBASE_ADMIN_CLIENT_EMAIL || !FIREBASE_ADMIN_PRIVATE_KEY) {
  console.error(
    [
      "",
      "Faltan las credenciales del Admin SDK en .env.local:",
      "",
      "  FIREBASE_ADMIN_PROJECT_ID",
      "  FIREBASE_ADMIN_CLIENT_EMAIL",
      "  FIREBASE_ADMIN_PRIVATE_KEY",
      "",
      "Consola de Firebase → Configuración del proyecto → Cuentas de servicio →",
      "Generar nueva clave privada. La private key va entre comillas dobles, con",
      "los \\n literales tal como vienen en el JSON.",
      "",
    ].join("\n"),
  );
  process.exit(1);
}

const publico = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
if (publico && publico !== FIREBASE_ADMIN_PROJECT_ID) {
  console.error(
    `\nEl proyecto del Admin SDK no es el que usa la app:\n\n` +
      `  FIREBASE_ADMIN_PROJECT_ID       = ${FIREBASE_ADMIN_PROJECT_ID}\n` +
      `  NEXT_PUBLIC_FIREBASE_PROJECT_ID = ${publico}\n\n` +
      `Tienen que ser el mismo, o el aviso se escribe donde nadie lo lee.\n`,
  );
  process.exit(1);
}

/** Devuelve la private key como PEM, venga como venga del `.env`. Ver el
 *  comentario largo en `seed-jugadores.mjs`: es el paso que más falla. */
function parsePrivateKey(raw) {
  let key = raw.trim();
  if (
    (key.startsWith('"') && key.endsWith('"')) ||
    (key.startsWith("'") && key.endsWith("'"))
  ) {
    key = key.slice(1, -1);
  }
  key = key.replace(/\\n/g, "\n");

  if (!key.includes("-----BEGIN") || !key.includes("PRIVATE KEY-----")) {
    console.error(
      "\nFIREBASE_ADMIN_PRIVATE_KEY no parece una clave privada.\n" +
        "Tiene que empezar con -----BEGIN PRIVATE KEY----- y terminar con\n" +
        "-----END PRIVATE KEY-----\\n, entre comillas dobles y en un solo renglón,\n" +
        "tal cual viene el campo `private_key` del JSON que descarga Firebase.\n",
    );
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

const db = getFirestore();

/* ── fan-out ─────────────────────────────────────────────────────────────── */

// Los destinatarios: las cuentas no suspendidas, igual que `notifyAll`.
const usuarios = await db
  .collection(COL.user)
  .where("status", "in", ["active", "pending"])
  .get();

if (usuarios.empty) {
  console.log(
    `${COL.user}: no hay cuentas activas todavía. Nadie a quien avisarle.`,
  );
  process.exit(0);
}

// A quién ya le llegó este mismo aviso: no se le manda de nuevo.
const yaAvisados = new Set(
  (await db.collection(COL.notificacion).where("text", "==", AVISO.text).get()).docs.map(
    (d) => d.data().userId,
  ),
);

const pendientes = usuarios.docs.map((d) => d.id).filter((id) => !yaAvisados.has(id));

if (!pendientes.length) {
  console.log(
    `${COL.notificacion}: los ${usuarios.size} usuarios ya tenían el aviso. Sin cambios.`,
  );
  process.exit(0);
}

// Batches de 450 (el límite de Firestore es 500).
for (let i = 0; i < pendientes.length; i += 450) {
  const batch = db.batch();
  for (const userId of pendientes.slice(i, i + 450)) {
    batch.set(db.collection(COL.notificacion).doc(), {
      userId,
      kind: AVISO.kind,
      text: AVISO.text,
      description: AVISO.description,
      href: AVISO.href,
      read: false,
      createdAt: FieldValue.serverTimestamp(),
    });
  }
  await batch.commit();
}

console.log(
  `${COL.notificacion}: "${AVISO.text}" enviado a ${pendientes.length} ` +
    `de ${usuarios.size} usuarios (${usuarios.size - pendientes.length} ya lo tenían).`,
);

process.exit(0);
