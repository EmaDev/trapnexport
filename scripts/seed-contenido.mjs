// Carga las encuestas de los Trap Awards en `trapnexport-encuesta`.
//
//   npm run seed:contenido
//
// Las encuestas son la única parte del contenido del panel que tiene datos
// reales de arranque: son las diecisiete categorías de `src/lib/trap-awards.ts`.
// Noticias, invitaciones y el día del cronograma nacen vacíos y se cargan desde
// `/admin` (el cronograma cae a "hoy" hasta que se elija una fecha), así que
// este seed no los toca.
//
// Es **idempotente y conserva los votos**: una encuesta que ya existe no se
// pisa. Volver a correrlo después de que la gente votó no reinicia nada; sólo
// crea las categorías que falten (por ejemplo si se sumó un premio nuevo).
//
// El `createdAt` se escribe escalonado —un minuto por premio— y no con
// `serverTimestamp()`: `/admin/presentacion` ordena las categorías por
// `createdAt` y espera el orden de `PREMIOS`, que es el orden en que se anuncian
// en la gala. Diecisiete escrituras en el mismo lote quedarían con timestamps
// casi idénticos y el orden sería aleatorio.

import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getFirestore, Timestamp } from "firebase-admin/firestore";

import { COL } from "../src/lib/firebase/collections.ts";
import { esPremioDeVideo, opcionesDe, PREMIOS } from "../src/lib/trap-awards.ts";

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
      `Tienen que ser el mismo, o el seed carga las encuestas donde nadie las lee.\n`,
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
const col = db.collection(COL.encuesta);

// Qué encuestas ya están, para no pisarles los votos ni el estado. Una sola
// lectura de la colección en vez de diecisiete `get` sueltos.
const existentes = new Set((await col.get()).docs.map((d) => d.id));

const base = Date.now();
const batch = db.batch();
let nuevas = 0;

PREMIOS.forEach((premio, i) => {
  if (existentes.has(premio.id)) return;

  batch.set(col.doc(premio.id), {
    pregunta: premio.pregunta,
    ...(premio.descripcion ? { descripcion: premio.descripcion } : {}),
    opciones: opcionesDe(premio).map((texto, j) => ({
      id: `${premio.id}-${j + 1}`,
      texto,
      votos: 0,
    })),
    multiple: premio.multiple ?? false,
    // Los Trap Awards se revelan en la gala: la votación del feed nunca muestra
    // porcentajes.
    resultadosVisibles: false,
    // Los premios de video nacen en borrador: sus opciones son de relleno hasta
    // que se carguen los clips.
    estado: esPremioDeVideo(premio) ? "borrador" : "abierta",
    createdAt: Timestamp.fromMillis(base - i * 60_000),
  });
  nuevas++;
});

if (nuevas) await batch.commit();

console.log(
  `${COL.encuesta}: ${PREMIOS.length} categorías (${nuevas} nuevas, ` +
    `${PREMIOS.length - nuevas} ya existían y se conservaron con sus votos).`,
);

process.exit(0);
