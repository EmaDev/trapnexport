"use client";

import { Poll } from "lib-kit-components";
import type { ComponentProps } from "react";

import { VideoEncuesta } from "@/components/organisms/VideoEncuesta";

/** El `Poll` del kit con la media de la encuesta ya resuelta.
 *
 *  Es el único lugar que decide **cómo** se vota una encuesta con media, y lo
 *  comparten el feed y la vista previa del panel: una previa que eligiera la
 *  vista por su cuenta podría mostrar algo distinto de lo que ve el socio, que
 *  es justo lo que la previa está para evitar.
 *
 *  - con `video` → el clip va arriba, **una sola vez**, y debajo las opciones
 *    como lista. El video es el material sobre el que se vota (la compilación
 *    de los goles), no una de las alternativas.
 *  - con imágenes en las opciones → carrusel: cada tarjeta es una opción.
 *  - sin media → la lista de siempre.
 *
 *  Ver `lib/contenido/media.ts` por qué el video es de la encuesta y las
 *  imágenes de la opción.
 *
 *  El `layout` no se recibe por prop a propósito: sale de la media, y poder
 *  pasarlo dejaría pedir un carrusel a una encuesta de video.
 */
export type EncuestaPollProps = Omit<
  ComponentProps<typeof Poll>,
  "layout" | "mediaVariant" | "mediaPerView" | "mediaSelector"
> & {
  /** el único video de la encuesta, ya validado (`videoDeEncuesta`) */
  video?: string;
};

export function EncuestaPoll({ video, options = [], className = "", ...poll }: EncuestaPollProps) {
  const hayImagenes = options.some((o) => o.image);

  if (!video) {
    return (
      <Poll
        {...poll}
        options={options}
        className={className}
        layout={hayImagenes ? "media" : "list"}
        mediaSelector
      />
    );
  }

  return (
    <div className={`overflow-hidden rounded-2xl border border-border bg-surface ${className}`}>
      {/* Un archivo o un embed de YouTube: lo resuelve `VideoEncuesta`. */}
      <VideoEncuesta video={video} />

      {/* El `Poll` queda sin su propio marco: el borde y el redondeo los pone
          el contenedor, así el video y las opciones son una sola tarjeta. */}
      <Poll
        {...poll}
        options={options}
        layout="list"
        className="!rounded-none !border-0 !bg-transparent"
      />
    </div>
  );
}
