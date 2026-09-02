import { cert, getApps, initializeApp, type App } from "firebase-admin/app";
import { getFirestore, type Firestore } from "firebase-admin/firestore";
import { getStorage } from "firebase-admin/storage";

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

let cached: { app: App; db: Firestore; bucket?: string } | undefined;

function init() {
  const projectId = process.env.FIREBASE_ADMIN_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_ADMIN_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_ADMIN_PRIVATE_KEY;
  /*  El mismo bucket que usa el navegador: no hay dos. Va por separado y no en
   *  `initializeApp` porque es la única pieza que puede faltar sin romper nada
   *  —Firestore anda igual— y porque las credenciales de admin y el bucket
   *  vienen de variables distintas. */
  const bucket = process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET;

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

  cached = { app, db: getFirestore(app), bucket };
  return cached;
}

export const adminApp = () => (cached ?? init()).app;
export const adminDb = () => (cached ?? init()).db;

/** Borra un archivo del bucket desde el servidor. Best-effort.
 *
 *  Existe para un caso que el navegador no puede cubrir: cuando el panel borra
 *  una publicación ajena, hay que borrar también sus imágenes, y el que aprieta
 *  el botón no es el dueño de los archivos. `lib/storage/imagen.ts` hace lo
 *  mismo del lado del cliente para las subidas propias.
 *
 *  No tira nunca. Un archivo que ya no está, un `path` de una tanda vieja que
 *  nunca existió o un bucket sin configurar no pueden frenar el borrado del
 *  documento: el resultado sería una publicación que no se puede eliminar
 *  porque su foto ya no está, que es exactamente al revés de lo que se quiere.
 *  El costo de fallar es un huérfano en el bucket.
 */
export async function borrarDelBucket(path: string): Promise<void> {
  try {
    const { app, bucket } = cached ?? init();
    if (!bucket || !path) return;
    await getStorage(app).bucket(bucket).file(path).delete();
  } catch {
    /* ya no existe, o no se pudo: se ignora a propósito */
  }
}
