import { spotifyEmbedUrl } from "@/lib/social/spotify";
import type { SpotifyItem } from "@/lib/social/types";

/** El reproductor de Spotify de un post o un comentario.
 *
 *  Es el `<iframe>` oficial de `open.spotify.com/embed`, sin nada propio
 *  adentro: el play, la tapa, el preview de 30 segundos —o el tema entero si la
 *  persona tiene la sesión de Spotify abierta— los resuelve Spotify. Lo único
 *  que decidimos acá es el alto, y sólo hay dos que el embed acepta sin
 *  deformarse:
 *
 *    compact → 80px,  una fila: título, artista y play. Los comentarios.
 *    normal  → 152px, con la tapa grande. Los posts.
 *
 *  El hueco tiene alto fijo y fondo propio para que la lista no salte mientras
 *  carga, mismo criterio que las medidas guardadas de `CommentGif`.
 *
 *  `loading="lazy"`: un feed con diez canciones no son diez reproductores
 *  bajando a la vez, sólo los que están por entrar en pantalla.
 */
export function SpotifyEmbed({
  item,
  compact = false,
  className = "",
}: {
  item: SpotifyItem;
  compact?: boolean;
  className?: string;
}) {
  const alto = compact ? 80 : 152;
  return (
    <div
      className={`overflow-hidden rounded-xl bg-surface-alt ${className}`}
      style={{ height: alto }}
    >
      <iframe
        src={spotifyEmbedUrl(item)}
        title={item.title ? `${item.title} en Spotify` : "Reproductor de Spotify"}
        width="100%"
        height={alto}
        loading="lazy"
        // Los permisos que pide el código de inserción oficial de Spotify.
        allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
        className="block border-0"
      />
    </div>
  );
}
