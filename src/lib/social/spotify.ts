import type { SpotifyItem, SpotifyKind } from "@/lib/social/types";

/** Todo lo que la app sabe de Spotify, y el único lugar que lo sabe.
 *
 *  **Corre en los dos lados.** No hay clave ni API: el reproductor es el
 *  `<iframe>` público de `open.spotify.com/embed`, y el título sale del oEmbed,
 *  que tampoco pide credenciales. Por eso esto no está detrás de una ruta como
 *  Giphy: el compositor parsea el link en el navegador para no esperar a nadie,
 *  y `addComment` / `publishPost` vuelven a pasar lo que llega por `saneaSpotify`.
 *
 *  Lo único que necesita el servidor es `previsualizarSpotify`
 *  (`lib/social/spotify-actions.ts`): resolver los links cortos de la app del
 *  celular y pedir el título, que desde el navegador chocaría con CORS.
 */

const KINDS: readonly SpotifyKind[] = ["track", "album", "playlist"];

/** Un id de Spotify: 22 caracteres base62. Es todo lo que se valida del lado
 *  del id, y alcanza: va pegado a un path fijo de `open.spotify.com`. */
const ID = /^[0-9A-Za-z]{22}$/;

/** Las formas de link que copia la gente:
 *
 *  - `https://open.spotify.com/track/{id}?si=…` — "Copiar enlace" en la web y
 *    en el escritorio;
 *  - `https://open.spotify.com/intl-es/track/{id}` — el mismo, con el idioma;
 *  - `https://open.spotify.com/embed/track/{id}` — el `src` de un embed;
 *  - `spotify:track:{id}` — "Copiar URI" del escritorio.
 *
 *  Se busca **dentro** del texto y no se exige que sea el texto entero: compartir
 *  desde el celular a veces pega "Escuchá esto en Spotify: https://…". */
const LINK =
  /(?:open|play)\.spotify\.com\/(?:intl-[a-z]{2}(?:-[a-z]{2})?\/)?(?:embed\/)?(track|album|playlist)\/([0-9A-Za-z]{22})/i;
const URI = /spotify:(track|album|playlist):([0-9A-Za-z]{22})/i;

/** Los links cortos que genera la app del celular (`spotify.link/AbC123`). No
 *  dicen qué son hasta seguirlos, así que los resuelve el servidor. */
const LINK_CORTO = /https?:\/\/(?:spotify\.link|spotify\.app\.link)\/[\w-]+/i;

/** `{ kind, id }` de un link de Spotify, o `null` si no lo es. */
export function parseSpotify(input: string): Pick<SpotifyItem, "kind" | "id"> | null {
  const m = LINK.exec(input) ?? URI.exec(input);
  if (!m) return null;
  return { kind: m[1].toLowerCase() as SpotifyKind, id: m[2] };
}

/** El link corto que hay en el texto, si hay uno. */
export const linkCortoSpotify = (input: string) => LINK_CORTO.exec(input)?.[0] ?? null;

/** El link canónico, el que se abre en Spotify y el que pide el oEmbed. */
export const spotifyUrl = (s: Pick<SpotifyItem, "kind" | "id">) =>
  `https://open.spotify.com/${s.kind}/${s.id}`;

/** El `src` del reproductor. Se arma acá y en ningún otro lado: es lo que
 *  garantiza que el `<iframe>` apunte siempre a `open.spotify.com/embed`. */
export const spotifyEmbedUrl = (s: Pick<SpotifyItem, "kind" | "id">) =>
  `https://open.spotify.com/embed/${s.kind}/${s.id}?utm_source=generator`;

/** Valida y recorta lo que llega del cliente, o `null` si no sirve.
 *
 *  Lo llaman `publishPost` y `addComment` antes de escribir, igual que
 *  `saneaGif`: lo que llega por una Server Action es JSON que alguien puede
 *  escribir a mano. Acá hay menos para cuidar que en un GIF —no hay ninguna
 *  URL, el `src` se arma de `kind` + `id`— pero sin esto un `kind` inventado
 *  armaría un embed que no existe y un `title` sin tope sería un campo de
 *  depósito en Firestore. */
export function saneaSpotify(s: unknown): SpotifyItem | null {
  if (!s || typeof s !== "object") return null;

  const { kind, id, title } = s as Record<string, unknown>;
  if (typeof kind !== "string" || !KINDS.includes(kind as SpotifyKind)) return null;
  if (typeof id !== "string" || !ID.test(id)) return null;

  return {
    kind: kind as SpotifyKind,
    id,
    title: typeof title === "string" ? title.trim().slice(0, 200) : "",
  };
}
