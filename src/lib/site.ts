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

/** Fecha de lanzamiento que cuenta el `CountdownHero` del feed.
 *
 *  Configurable por entorno para no tener que tocar código al mover la fecha.
 *  Si el valor no parsea, cae al default en vez de romper el render con un
 *  `Invalid Date` (que en el contador se ve como `NaN` en cada bloque).
 */
const LAUNCH_FALLBACK = "2026-10-01T21:00:00-03:00";

const parseLaunch = (raw: string | undefined): Date => {
  const parsed = new Date(raw ?? LAUNCH_FALLBACK);
  return Number.isNaN(parsed.getTime()) ? new Date(LAUNCH_FALLBACK) : parsed;
};

export const LAUNCH_DATE = parseLaunch(process.env.NEXT_PUBLIC_LAUNCH_DATE);
