import { cert, getApps, initializeApp, type App } from "firebase-admin/app";
import { getFirestore, type Firestore } from "firebase-admin/firestore";

/** Firebase del lado del **servidor**, con credenciales de servicio.
 *
 *  Nunca importar esto desde un componente cliente: la clave privada que lee de
 *  abajo no puede salir del servidor. Todo lo que lo usa vive en archivos con
 *  `"use server"` o en Server Components.
 *
 *  Es la contracara de `client.ts`, y la diferencia importa: el SDK del
 *  navegador escribe **como el usuario** y las reglas lo validan; este escribe
 *  **como el proyecto** y se saltea las reglas por completo. Por eso acá van
 *  sólo las operaciones que ninguna regla podría autorizar —aprobar un reclamo
 *  de identidad, suspender una cuenta, leer emails— y no las que el usuario
 *  puede hacer por sí mismo.
 *
 *  La inicialización es perezosa a propósito. Importar este módulo desde una
 *  ruta que después no lo usa no puede tirar el build por una variable de
 *  entorno faltante: se rompe cuando se lo usa de verdad, con un mensaje que
 *  dice qué falta.
 */

let cached: { app: App; db: Firestore } | undefined;

function init() {
  const projectId = process.env.FIREBASE_ADMIN_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_ADMIN_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_ADMIN_PRIVATE_KEY;

  if (!projectId || !clientEmail || !privateKey) {
    throw new Error(
      "Faltan FIREBASE_ADMIN_PROJECT_ID / FIREBASE_ADMIN_CLIENT_EMAIL / " +
        "FIREBASE_ADMIN_PRIVATE_KEY en el entorno. Consola de Firebase → " +
        "Configuración del proyecto → Cuentas de servicio.",
    );
  }

  const app =
    getApps()[0] ??
    initializeApp({
      credential: cert({
        projectId,
        clientEmail,
        // El `.env` guarda los saltos escapados; `cert()` espera la PEM real.
        privateKey: privateKey.replace(/\\n/g, "\n"),
      }),
    });

  cached = { app, db: getFirestore(app) };
  return cached;
}

export const adminApp = () => (cached ?? init()).app;
export const adminDb = () => (cached ?? init()).db;
