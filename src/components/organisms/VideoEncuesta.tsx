"use client";

import { embedYoutube, esShortYoutube, idYoutube } from "@/lib/contenido/media";

/** El video de una encuesta, sea un archivo o un link de YouTube.
 *
 *  Son dos reproductores distintos y no uno con otro `src`: un link de YouTube
 *  no es el archivo del video, así que `<video src="https://youtube.com/…">`
 *  no reproduce nada —falla en silencio, con el cuadro negro—. Lo que sirve es
 *  un `<iframe>` al embed, y de la URL original lo único que se usa es el id.
 *
 *  La diferencia también está en el alto. Un `<video>` trae sus medidas
 *  adentro y alcanza con acotarlo; un `<iframe>` no tiene medidas propias y hay
 *  que darle la proporción desde afuera, que es lo que decide `esShortYoutube`:
 *  los shorts se filman verticales y a 16/9 quedan con dos franjas negras.
 */
export function VideoEncuesta({
  video,
  className = "",
}: {
  video: string;
  className?: string;
}) {
  const youtube = idYoutube(video);

  if (youtube) {
    const vertical = esShortYoutube(video);
    return (
      <div
        className={`relative mx-auto w-full bg-black ${className}`}
        /* El tope va en el **ancho** y no en el alto: con `aspect-ratio`, un
           `max-height` deja el ancho en 100% y rompe la proporción. Acotando el
           ancho a lo que entra en 70svh, el alto lo deduce el ratio y un short
           vertical no ocupa pantalla y media. */
        style={
          vertical
            ? { aspectRatio: "9 / 16", maxWidth: "calc(70svh * 9 / 16)" }
            : { aspectRatio: "16 / 9" }
        }
      >
        <iframe
          src={embedYoutube(youtube)}
          title="Video de la encuesta"
          allow="accelerometer; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen"
          allowFullScreen
          referrerPolicy="strict-origin-when-cross-origin"
          className="absolute inset-0 h-full w-full"
        />
      </div>
    );
  }

  /* `controls` y no autoplay: es un clip que se mira entero antes de votar, y
     puede tener audio. `object-contain` sobre negro porque los videos vienen
     del teléfono y son verticales: recortarlos a 16/9 cortaría la jugada. */
  return (
    <video
      src={video}
      controls
      playsInline
      preload="metadata"
      className={`max-h-[60svh] w-full bg-black object-contain ${className}`}
    />
  );
}
