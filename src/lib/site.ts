/** Nombre y URL absoluta de la app.
 *
 *  La URL tiene que ser absoluta y **la misma** que usa `ShareButton` y que el
 *  `canonical` de cada ruta: si difieren, WhatsApp resuelve el preview contra
 *  una URL y el usuario abre otra. */
export const APP_NAME = "Trap N Export";
export const APP_TAGLINE = "Lo que pasa entre los tuyos";

export const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") ?? "http://localhost:3000";

export const absoluteUrl = (path: string) =>
  `${SITE_URL}${path.startsWith("/") ? path : `/${path}`}`;

/* La fecha que cuenta el `CountdownHero` de la home **no** vive más acá.
 *
 *  Era `LAUNCH_DATE`, de `NEXT_PUBLIC_LAUNCH_DATE` con un default hardcodeado,
 *  y por eso el contador no mostraba un dato real: la variable no estaba puesta
 *  en ningún entorno, así que todo el mundo veía el default —ya vencido— y
 *  moverlo pedía un deploy. Ahora sale de `trapnexport-config/portada` y se
 *  edita en `/admin/portada`; por defecto cuenta al día del cronograma. Ver
 *  `getPortada()` en `lib/contenido/queries.ts`. */
