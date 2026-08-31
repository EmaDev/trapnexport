"use client";

import { useState } from "react";
import { BottomSheet, VideoPlayer, usePrefersReducedMotion } from "lib-kit-components";

import { PlayIcon } from "@/components/atoms/icons";
import type { Clip } from "@/lib/historia";

/** Un clip del archivo del club: portada en 16:9 y, al tocarla, el video en un
 *  `BottomSheet`.
 *
 *  ⚠️ La librería trae `VideoPlayer` (que se usa acá abajo) pero no una card de
 *  video: `MediaCard` es de imagen y `Carousel` —lo dice su propia doc— no
 *  reproduce video. Este archivo es la card que falta, no un reemplazo del
 *  reproductor.
 *
 *  Dos estados de media, y dependen del dato, no de una prop:
 *
 *  - `clip.src` cargado → el sheet monta `VideoPlayer` con el `.mp4` real.
 *  - sin `src` → el sheet muestra `clip.motion`, el SVG animado que genera
 *    `clipUrl(..., true)` en `lib/media.ts`, con un pie que aclara que el
 *    archivo todavía no está digitalizado. Mentir sobre eso sería peor que la
 *    portada estática.
 *
 *  En desktop el hover cambia la portada por la versión animada. En touch no
 *  hay hover y no se emula: el `motion` se ve al abrir el sheet.
 */

export function ClipCard({ clip }: { clip: Clip }) {
  const [open, setOpen] = useState(false);
  const [hover, setHover] = useState(false);
  const reduced = usePrefersReducedMotion();

  // `clipUrl` genera los dos SVG de entrada, así que el cambio es sólo de
  // `src`: no hay carga de red ni salto de layout al pasar el mouse.
  const preview = hover && !reduced ? clip.motion : clip.poster;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        onPointerEnter={() => setHover(true)}
        onPointerLeave={() => setHover(false)}
        className="group relative block w-full overflow-hidden rounded-2xl border border-border text-left"
        aria-label={`Ver el clip: ${clip.title} (${clip.year})`}
      >
        <span className="relative block aspect-video">
          {/* eslint-disable-next-line @next/next/no-img-element -- data-URI */}
          <img src={preview} alt="" className="absolute inset-0 size-full object-cover" />

          {/* El degradé de abajo no es decorativo: sostiene el 4.5:1 del título
              blanco sobre una portada cuya luminosidad varía por semilla. */}
          <span className="absolute inset-0 bg-[linear-gradient(to_top,rgba(0,0,0,0.78),rgba(0,0,0,0.1)_58%,transparent)]" />

          <span className="absolute left-3 top-3 rounded-full bg-black/55 px-2 py-0.5 text-[11px] font-semibold text-white">
            {clip.year}
          </span>
          <span className="absolute right-3 top-3 rounded-full bg-black/55 px-2 py-0.5 text-[11px] font-semibold tabular-nums text-white">
            {clip.duration}
          </span>

          <span className="absolute left-1/2 top-1/2 grid size-14 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full bg-white/15 text-white ring-2 ring-white/70 transition-transform duration-200 group-hover:scale-110">
            <PlayIcon width={18} height={18} className="translate-x-px" />
          </span>

          <span className="absolute inset-x-3 bottom-3 block">
            <span className="block truncate text-sm font-semibold text-white">{clip.title}</span>
            <span className="block truncate text-[11px] text-white/75">{clip.description}</span>
          </span>
        </span>
      </button>

      <BottomSheet
        open={open}
        onClose={() => setOpen(false)}
        title={clip.title}
        description={`${clip.year} · ${clip.duration}`}
        showClose
      >
        {clip.src ? (
          <VideoPlayer
            src={clip.src}
            poster={clip.poster}
            title={clip.title}
            subtitle={`${clip.year} · Archivo del club`}
            resumeKey={`clip-${clip.id}`}
          />
        ) : (
          <div className="overflow-hidden rounded-xl border border-border">
            {/* eslint-disable-next-line @next/next/no-img-element -- data-URI */}
            <img src={clip.motion} alt={clip.title} className="block w-full" />
          </div>
        )}

        <p className="mt-3 text-sm">{clip.description}</p>

        {!clip.src && (
          <p className="mt-2 text-xs text-muted">
            Reconstrucción de la jugada: el video original todavía no está
            digitalizado.
          </p>
        )}
      </BottomSheet>
    </>
  );
}

/** Fila de clips con scroll horizontal y snap.
 *
 *  El `-mx-4 px-4` es a propósito: la fila sangra hasta el borde de la pantalla
 *  aunque viva dentro del contenedor con `px-4`, así se ve que hay más a la
 *  derecha sin necesidad de flechas.
 */
export function ClipRail({ clips, className = "" }: { clips: Clip[]; className?: string }) {
  return (
    <ul
      className={[
        "-mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto scrollbar-none px-4 pb-1",
        className,
      ].join(" ")}
    >
      {clips.map((c) => (
        <li key={c.id} className="w-[78%] shrink-0 snap-start sm:w-[48%]">
          <ClipCard clip={c} />
        </li>
      ))}
    </ul>
  );
}
