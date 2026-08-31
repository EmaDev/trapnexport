// Carga el plantel en `trapnexport-jugador`.
//
//   npm run seed:jugadores
//
// Es la única forma de escribir esa colección: `firestore.rules` no le permite
// crear jugadores a ningún cliente —si pudiera, cualquiera se inventaría un
// integrante del club—, así que el alta pasa sí o sí por el Admin SDK.
//
// La fuente es `src/lib/trap-awards.ts`, que hoy es el plantel real de la app.
// Se importa el `.ts` directamente: Node 24 le saca los tipos solo, y ese
// archivo no importa nada, así que entra sin build. Duplicar la lista acá sería
// garantizar que las dos se desincronicen.
//
// Es idempotente y **conserva los reclamos**: `claimedBy` sólo se inicializa en
// `null` cuando el documento no existía. Volver a correrlo después de que
// alguien reclamó su cuenta no lo desvincula.

import { cert, getApps, initializeApp } from "firebase-admin/app";
import { FieldValue, getFirestore } from "firebase-admin/firestore";

import { COL } from "../src/lib/firebase/collections.ts";
import { JUGADORES } from "../src/lib/trap-awards.ts";

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
      'los \\n literales tal como vienen en el JSON.',
      "",
    ].join("\n"),
  );
  process.exit(1);
}

// Las dos mitades del `.env` apuntan al mismo Firebase, y nada las obliga a
// coincidir: con el project id del admin mal copiado, el seed escribe en OTRA
// base sin fallar, y el plantel simplemente nunca aparece en la app.
const publico = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
if (publico && publico !== FIREBASE_ADMIN_PROJECT_ID) {
  console.error(
    `\nEl proyecto del Admin SDK no es el que usa la app:\n\n` +
      `  FIREBASE_ADMIN_PROJECT_ID      = ${FIREBASE_ADMIN_PROJECT_ID}\n` +
      `  NEXT_PUBLIC_FIREBASE_PROJECT_ID = ${publico}\n\n` +
      `Tienen que ser el mismo, o el seed carga el plantel donde nadie lo lee.\n`,
  );
  process.exit(1);
}

/** Devuelve la private key como PEM, venga como venga del `.env`.
 *
 *  Es el paso que más falla al configurar esto, y siempre con el mismo error
 *  ilegible del SDK ("Failed to parse private key"). Son tres formas de pegar
 *  la misma clave:
 *
 *    - copiada del JSON  → un renglón con `\n` **escapados**
 *    - pegada a mano     → varios renglones de verdad
 *    - con comillas      → según cómo las haya tomado el parser del `.env`
 *
 *  Las tres son razonables y las tres tienen que andar. Si igual no parece una
 *  PEM, corta acá con un mensaje que se entienda, y no adentro del SDK.
 */
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
const col = db.collection(COL.jugador);

// Qué documentos ya están, para no pisarles el `claimedBy`. Una sola lectura de
// la colección entera en vez de dieciocho `get` sueltos.
const existentes = new Set((await col.get()).docs.map((d) => d.id));

const batch = db.batch();

JUGADORES.forEach((j, i) => {
  const doc = {
    nombre: j.nombre,
    apodo: j.apodo,
    handle: j.handle,
    incorporacion: j.incorporacion ?? false,
    // El orden de la lista NO es alfabético y es dato: las opciones de cada
    // premio salen de acá, y ordenar por apellido le daría el primer lugar a la
    // misma persona en las catorce votaciones.
    orden: i,
    updatedAt: FieldValue.serverTimestamp(),
  };

  // `merge: true` y `claimedBy` sólo en el alta: así el seed puede volver a
  // correrse para corregir un apodo sin soltar las cuentas ya reclamadas.
  if (!existentes.has(j.id)) {
    doc.claimedBy = null;
    doc.createdAt = FieldValue.serverTimestamp();
  }

  batch.set(col.doc(j.id), doc, { merge: true });
});

await batch.commit();

const nuevos = JUGADORES.filter((j) => !existentes.has(j.id)).length;
console.log(
  `${COL.jugador}: ${JUGADORES.length} jugadores escritos ` +
    `(${nuevos} nuevos, ${JUGADORES.length - nuevos} actualizados).`,
);
process.exit(0);
