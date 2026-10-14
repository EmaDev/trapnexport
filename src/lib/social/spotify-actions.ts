"use server";

import { getCurrentUid } from "@/lib/auth/sesion";
import { linkCortoSpotify, parseSpotify, spotifyUrl } from "@/lib/social/spotify";
import type { SpotifyItem } from "@/lib/social/types";

/** Spotify se cae como cualquier tercero; el selector tiene que decir "no se
 *  pudo", no quedarse girando. */
const TIMEOUT_MS = 6000;

/** Sigue un link corto de la app (`spotify.link/…`) hasta el link de verdad.
 *
 *  Primero mira a dónde terminó la redirección; si no llegó a `open.spotify.com`
 *  —el link corto a veces es una página intermedia que redirige por JavaScript—
 *  busca el link adentro del HTML. Si ninguna de las dos sirve, `null`. */
async function resolverLinkCorto(url: string) {
  try {
    const res = await fetch(url, {
      redirect: "follow",
      signal: AbortSignal.timeout(TIMEOUT_MS),
      next: { revalidate: 3600 },
    });
    return parseSpotify(res.url) ?? parseSpotify(await res.text());
  } catch {
    return null;
  }
}

/** Lo que el compositor muestra antes de publicar: el link que pegó la persona,
 *  convertido en un `SpotifyItem` con título. `null` si no es de Spotify o
 *  Spotify dice que no existe.
 *
 *  Corre en el servidor por dos cosas que el navegador no puede: seguir un link
 *  corto (la redirección es cross-origin) y leer el oEmbed (no manda CORS).
 *
 *  **Pide sesión**, igual que `/api/giphy`: sin eso es un proxy abierto hacia
 *  Spotify que cualquiera puede usar desde afuera de la app.
 */
export async function previsualizarSpotify(input: string): Promise<SpotifyItem | null> {
  const uid = await getCurrentUid();
  if (!uid) return null;

  const texto = input.slice(0, 1000);
  let ref = parseSpotify(texto);
  if (!ref) {
    const corto = linkCortoSpotify(texto);
    if (corto) ref = await resolverLinkCorto(corto);
  }
  if (!ref) return null;

  try {
    const res = await fetch(
      `https://open.spotify.com/oembed?url=${encodeURIComponent(spotifyUrl(ref))}`,
      { signal: AbortSignal.timeout(TIMEOUT_MS), next: { revalidate: 86_400 } },
    );
    // 404 / 400: el id tiene el formato pero no existe —un link roto o
    // inventado—. Eso sí es un "no": publicarlo sería un reproductor vacío.
    if (res.status === 404 || res.status === 400) return null;
    const json = res.ok ? ((await res.json()) as { title?: string }) : {};
    return { ...ref, title: (json.title ?? "").trim().slice(0, 200) };
  } catch {
    /*  Spotify caído o lento: el link tiene la forma correcta, así que se deja
     *  pasar sin título. El reproductor lo carga el navegador directo de
     *  Spotify; si ellos vuelven, el embed funciona igual. */
    return { ...ref, title: "" };
  }
}
