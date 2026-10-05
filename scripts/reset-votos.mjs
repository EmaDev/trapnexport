// Pone en cero los votos de todas las encuestas de `trapnexport-encuesta`.
//
//   npm run reset:votos -- --si
//
// **Borra datos y no se puede deshacer**, así que sin `--si` no hace nada: sólo
// informa qué encontraría. El flag es la confirmación.
//
// Resetea los **dos** lugares donde vive un voto, y hay que hacer los dos o la
// base queda incoherente:
//
//   1. `opciones[].votos` de cada encuesta — el contador que se proyecta en la
//      gala y el que suma `/admin/encuestas`.
//   2. La subcolección `trapnexport-encuesta/{id}/voto/{uid}` — un documento por
//      persona, que es lo que `votarEncuesta` usa de fuente de verdad para el
//      dedupe y lo que el feed lee para pintar "Votado".
//
// Dejar sólo (1) sería lo peor de los dos mundos: los contadores en cero pero
// cada uno viendo "Votado" y sin poder votar de nuevo, porque para el servidor
// su voto sigue estando.
//
// No toca las encuestas en sí: ni la pregunta, ni las opciones, ni el estado, ni
// el video. Sólo los votos.

import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

import { COL, SUB_VOTO } from "../src/lib/firebase/collections.ts";

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
    ].join("\n"),
  );
  process.exit(1);
}

/** La private key viaja en una variable de entorno con los saltos de línea
 *  escapados y, según cómo se haya pegado, entre comillas. Mismo criterio que
 *  `seed-contenido.mjs`. */
function parsePrivateKey(raw) {
  const key = raw.replace(/\\n/g, "\n");
  return key.startsWith('"') || key.startsWith("'") ? key.slice(1, -1) : key;
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

const confirmado = process.argv.includes("--si");
const db = getFirestore();
const snap = await db.collection(COL.encuesta).get();

/** Un lote de Firestore admite 500 escrituras. Hoy son diecisiete encuestas y
 *  un puñado de votos, pero el día de la gala vota el club entero y la
 *  subcolección de una sola categoría puede pasarse sola. */
const LOTE = 450;

const escrituras = [];
let contadoresPrevios = 0;
let docsVoto = 0;

for (const doc of snap.docs) {
  const opciones = doc.data().opciones ?? [];
  const votos = opciones.reduce((n, o) => n + (o.votos ?? 0), 0);
  contadoresPrevios += votos;

  // Sólo las que tienen algo en cero por poner: reescribir las diecisiete sin
  // necesidad gastaría escrituras y movería `opciones` sin motivo.
  if (votos > 0) {
    escrituras.push({
      ref: doc.ref,
      op: "update",
      data: { opciones: opciones.map((o) => ({ ...o, votos: 0 })) },
    });
  }

  const votosSnap = await doc.ref.collection(SUB_VOTO).get();
  docsVoto += votosSnap.size;
  for (const v of votosSnap.docs) escrituras.push({ ref: v.ref, op: "delete" });
}

console.log(
  `${COL.encuesta}: ${snap.size} encuestas · ${contadoresPrevios} votos en los ` +
    `contadores · ${docsVoto} documentos en ${SUB_VOTO}/`,
);

if (!escrituras.length) {
  console.log("No hay nada que resetear: los votos ya están en cero.");
  process.exit(0);
}

if (!confirmado) {
  console.log(
    [
      "",
      `Se pondrían en cero los contadores de ${escrituras.filter((e) => e.op === "update").length} ` +
        `encuesta(s) y se borrarían ${docsVoto} documento(s) de voto.`,
      "",
      "Esto no se puede deshacer. Para hacerlo:",
      "",
      "  npm run reset:votos -- --si",
      "",
    ].join("\n"),
  );
  process.exit(0);
}

for (let i = 0; i < escrituras.length; i += LOTE) {
  const batch = db.batch();
  for (const e of escrituras.slice(i, i + LOTE)) {
    if (e.op === "delete") batch.delete(e.ref);
    else batch.update(e.ref, e.data);
  }
  await batch.commit();
}

console.log(
  `Listo: ${contadoresPrevios} votos a cero y ${docsVoto} documento(s) de voto borrados.`,
);

// Las pantallas que muestran votos (`/`, `/admin/encuestas`, `/admin/presentacion`)
// son dinámicas, así que la próxima carga ya los lee en cero: no hay caché que
// invalidar desde acá.
process.exit(0);
