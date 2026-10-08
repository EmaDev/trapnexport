import type { CommentGif, GifSugerido } from "@/lib/social/types";

/** El cliente de la API de Giphy, y el único lugar que sabe de ella.
 *
 *  **Corre sólo en el servidor.** La clave es `GIPHY_API_KEY` —sin
 *  `NEXT_PUBLIC_`, a propósito—: una clave de Giphy en el bundle es una clave
 *  pública, y la cuota es por clave. El navegador no habla con `api.giphy.com`,
 *  habla con `/api/giphy` (ver `app/api/giphy/route.ts`), que es esto detrás de
 *  una ruta con sesión.
 *
 *  Dos mitades, y las dos tienen que estar:
 *
 *  - `buscarGifs` / `gifsEnTendencia` — la búsqueda del selector.
 *  - `saneaGif` — el corte de lo que llega del cliente al guardar. Un
 *    comentario con GIF viaja como `{ id, url, width, height, title }` por una
 *    Server Action, y una Server Action es un POST: nadie garantiza que ese
 *    objeto salió del selector. Sin este filtro, `url` sería un `<img src>`
 *    libre —un pixel de tracking, o una imagen cualquiera— publicado en el feed
 *    con el nombre de quien comentó.
 */

const API = "https://api.giphy.com/v1/gifs";

/** Clasificación máxima que devuelve la API.
 *
 *  `pg-13` y no `g`: esto es un club de amigos y la escala de Giphy es
 *  conservadora —con `g` desaparecen la mitad de los GIFs de festejo—. Lo que
 *  queda afuera es `r`, que es lo que no queremos en el feed. */
const RATING = "pg-13";

/** Cuántos GIFs trae una búsqueda. Son dos pantallas de la grilla de a tres:
 *  suficiente para encontrar uno sin bajar un catálogo. */
const LIMIT = 24;

/** Giphy se cae como cualquier servicio de terceros, y cuando se cae el
 *  selector tiene que decir "no se pudo", no quedarse girando. */
const TIMEOUT_MS = 8000;

/** Los dominios desde los que Giphy sirve los GIFs: `media0.giphy.com` a
 *  `media4.giphy.com`, `media.giphy.com` e `i.giphy.com`. Se valida el sufijo y
 *  no la lista exacta porque los números de los `media*` cambian, pero el
 *  dominio padre no. */
const HOST_GIPHY = /(^|\.)giphy\.com$/;

/* ── la forma en que contesta la API ─────────────────────────────────────── */

/*  Las medidas llegan como strings ("200"), no como números: por eso el
 *  `Number()` en `aSugerido` y no un cast. */
interface GiphyRendition {
  url?: string;
  width?: string;
  height?: string;
}

interface GiphyGif {
  id?: string;
  title?: string;
  images?: Record<string, GiphyRendition | undefined>;
}

/** La clave, o `null` si no está configurada.
 *
 *  Se lee en cada llamada y no en una constante de módulo: una constante se
 *  evalúa al importar, y en el build de Next eso es antes de que exista el
 *  entorno del servidor. */
export const giphyHabilitado = () => !!process.env.GIPHY_API_KEY;

/** Una rendición concreta, con fallbacks.
 *
 *  Giphy no garantiza todas las rendiciones en todos los GIFs. Si no hay
 *  ninguna de las pedidas el GIF se descarta: mostrar una tarjeta vacía en la
 *  grilla es peor que mostrar 23 en vez de 24. */
const rendicion = (g: GiphyGif, ...nombres: string[]): GiphyRendition | null => {
  for (const n of nombres) {
    const r = g.images?.[n];
    if (r?.url) return r;
  }
  return null;
};

const aSugerido = (g: GiphyGif): GifSugerido | null => {
  if (!g.id) return null;

  const grande = rendicion(g, "fixed_width", "fixed_height", "downsized");
  if (!grande?.url) return null;

  const chica = rendicion(g, "fixed_width_small", "fixed_height_small", "preview_gif");

  const width = Number(grande.width) || 200;
  const height = Number(grande.height) || 200;

  return {
    id: g.id,
    url: grande.url,
    width,
    height,
    title: (g.title ?? "").trim(),
    preview: chica?.url ?? grande.url,
  };
};

/** Una llamada a la API. Devuelve `[]` ante cualquier problema —sin clave, con
 *  la API caída, con un cuerpo que no parsea— y `null` nunca: el selector
 *  distingue "no hay resultados" de "no se pudo" por el status de la ruta, no
 *  por esto. Tirar acá obligaría a cada llamador a envolver en try/catch la
 *  búsqueda de un GIF, que es lo menos importante de la pantalla. */
async function pedir(path: string, params: Record<string, string>): Promise<GifSugerido[]> {
  const key = process.env.GIPHY_API_KEY;
  if (!key) return [];

  const qs = new URLSearchParams({ api_key: key, rating: RATING, lang: "es", ...params });

  try {
    const res = await fetch(`${API}/${path}?${qs}`, {
      signal: AbortSignal.timeout(TIMEOUT_MS),
      /*  El catálogo de Giphy no cambia en diez minutos y la cuota de la clave
       *  sí se gasta: dos personas buscando "gol" el mismo rato son una sola
       *  llamada. Es la caché de Next del lado del servidor, no del navegador
       *  —la respuesta de `/api/giphy` sale privada, ver la ruta—. */
      next: { revalidate: 600 },
    });
    if (!res.ok) return [];

    const json = (await res.json()) as { data?: GiphyGif[] };
    return (json.data ?? []).map(aSugerido).filter((g): g is GifSugerido => !!g);
  } catch {
    // timeout, DNS, cuerpo que no es JSON: para el selector son lo mismo.
    return [];
  }
}

/** Lo que se ofrece con el buscador vacío: los GIFs del momento. */
export const gifsEnTendencia = (limit = LIMIT) =>
  pedir("trending", { limit: String(limit) });

/** Busca por texto. Con `q` vacío cae a tendencias, para que el selector no
 *  tenga que decidirlo en dos lugares. */
export const buscarGifs = (q: string, limit = LIMIT) => {
  const clean = q.trim();
  if (!clean) return gifsEnTendencia(limit);
  // 100 caracteres: la API corta más allá y nadie busca un GIF con un párrafo.
  return pedir("search", { q: clean.slice(0, 100), limit: String(limit) });
};

/* ── el corte del lado de la escritura ──────────────────────────────────── */

/** Valida y recorta el GIF que llega del cliente, o `null` si no sirve.
 *
 *  Lo llama `addComment` (`lib/social/actions.ts`) antes de escribir. Un `null`
 *  no es un error: el comentario se guarda sin GIF, y si tampoco traía texto no
 *  se guarda nada. Que un GIF inválido degrade a comentario de texto y no a una
 *  excepción es el mismo criterio que el resto de `actions.ts` —salir en
 *  silencio ante lo que nadie pidió desde la app—.
 *
 *  Qué se controla, y por qué cada cosa:
 *
 *  - **el host tiene que ser de Giphy.** Es lo único que realmente importa:
 *    sin esto el campo es un `<img src>` arbitrario en el feed.
 *  - **el esquema tiene que ser `https:`.** Un `http:` lo bloquea el navegador
 *    por mixed content y el comentario queda con la imagen rota; un `data:` o
 *    un `javascript:` no llegarían al `<img>` igual, pero tampoco tienen por
 *    qué llegar a Firestore.
 *  - **las medidas tienen que ser números positivos.** Van directo al
 *    `aspect-ratio` del hueco: un `0` o un `NaN` lo colapsan.
 *  - **el título se recorta.** Es el `alt`; 200 caracteres es más que cualquier
 *    título de Giphy real y evita que alguien use el campo de depósito.
 */
export function saneaGif(gif: unknown): CommentGif | null {
  if (!gif || typeof gif !== "object") return null;

  const { id, url, width, height, title } = gif as Record<string, unknown>;
  if (typeof id !== "string" || !id.trim()) return null;
  if (typeof url !== "string") return null;

  let u: URL;
  try {
    u = new URL(url);
  } catch {
    return null;
  }
  if (u.protocol !== "https:") return null;
  if (!HOST_GIPHY.test(u.hostname)) return null;

  const w = Number(width);
  const h = Number(height);
  if (!Number.isFinite(w) || !Number.isFinite(h) || w <= 0 || h <= 0) return null;

  return {
    id: id.trim().slice(0, 64),
    url: u.toString(),
    width: Math.round(w),
    height: Math.round(h),
    title: typeof title === "string" ? title.trim().slice(0, 200) : "",
  };
}
