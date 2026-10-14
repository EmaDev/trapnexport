"use client";

import { motion } from "framer-motion";
import { useEffect, useState } from "react";
import { Spinner, useDebounce } from "lib-kit-components";

import { linkCortoSpotify, parseSpotify } from "@/lib/social/spotify";
import { previsualizarSpotify } from "@/lib/social/spotify-actions";
import type { SpotifyItem } from "@/lib/social/types";

/** El selector de canciones de Spotify, para el compositor de posts y el de
 *  comentarios.
 *
 *  **Se pega un link, no se busca.** Buscar en el catálogo de Spotify pide la
 *  Web API con credenciales de una app registrada; pegar un link no pide nada,
 *  y es lo que la gente ya hace: en Spotify, "Compartir › Copiar enlace".
 *
 *  Panel en el flujo y no un popover, por lo mismo que `GifPicker`: vive dentro
 *  del `article` `overflow-hidden` de `SocialPost`.
 *
 *  Apenas el texto parece un link de Spotify se pide `previsualizarSpotify`, que
 *  confirma que existe y trae el título; si sale bien, `onPick` y el panel se
 *  cierra solo. No hay botón de "Agregar": pegar ya es elegir.
 */

/** Lo mismo que el buscador de GIFs: pegar es instantáneo, pero tipear un link
 *  a mano no tiene que disparar una consulta por letra. */
const DEBOUNCE_MS = 350;

const pareceSpotify = (s: string) => !!parseSpotify(s) || !!linkCortoSpotify(s);

export function SpotifyPicker({
  onPick,
  onClose,
}: {
  onPick: (item: SpotifyItem) => void;
  onClose: () => void;
}) {
  const [q, setQ] = useState("");
  /** La última previsualización que falló, y de qué texto era. Las que salen
   *  bien no se guardan: llaman a `onPick` y el panel se desmonta. */
  const [fallo, setFallo] = useState<string | null>(null);

  const link = useDebounce(q.trim(), DEBOUNCE_MS);
  const valido = pareceSpotify(link);

  /*  Derivados, como en `GifPicker`: "buscando" es cierto exactamente cuando hay
   *  un link válido que todavía no volvió. Así el efecto no tiene ningún
   *  `setState` sincrónico en el cuerpo. */
  const buscando = valido && fallo !== link;
  const noEncontrado = valido && fallo === link;

  useEffect(() => {
    if (!pareceSpotify(link)) return;
    let vigente = true;

    void previsualizarSpotify(link)
      .then((item) => {
        if (!vigente) return;
        if (item) onPick(item);
        else setFallo(link);
      })
      .catch(() => {
        if (vigente) setFallo(link);
      });

    // Un link pegado encima de otro: el que vuelve tarde no pisa al nuevo.
    return () => {
      vigente = false;
    };
    // `onPick` fuera a propósito: es una flecha nueva en cada render del padre
    // y volvería a disparar la consulta sin que el link haya cambiado.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [link]);

  const pegar = async () => {
    try {
      setQ(await navigator.clipboard.readText());
    } catch {
      // Sin permiso para leer el portapapeles: queda el campo para pegar a mano.
    }
  };

  return (
    <motion.div
      initial={{ height: 0, opacity: 0 }}
      animate={{ height: "auto", opacity: 1 }}
      exit={{ height: 0, opacity: 0 }}
      transition={{ type: "spring", stiffness: 320, damping: 32 }}
      className="overflow-hidden"
    >
      <div className="mt-2 rounded-2xl border border-border bg-surface p-3">
        <div className="flex items-center gap-2">
          <input
            autoFocus
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Pegá el link de Spotify…"
            inputMode="url"
            // Enter acá no publica: el formulario es el post o el comentario, y
            // mandarlo a medio elegir sería publicar sin la canción.
            onKeyDown={(e) => {
              if (e.key === "Enter") e.preventDefault();
              if (e.key === "Escape") onClose();
            }}
            className="h-9 min-w-0 flex-1 rounded-xl border border-border bg-surface-alt/60 px-3 text-sm text-foreground outline-none transition-colors placeholder:text-muted focus:border-primary"
          />
          {typeof navigator !== "undefined" && !!navigator.clipboard?.readText && (
            <button
              type="button"
              onClick={() => void pegar()}
              className="h-9 shrink-0 rounded-xl border border-border px-3 text-xs font-bold text-foreground transition-colors hover:bg-surface-alt"
            >
              Pegar
            </button>
          )}
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar Spotify"
            className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-muted transition-colors hover:bg-surface-alt hover:text-foreground"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round">
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="mt-2 flex min-h-8 items-center gap-2 px-1 text-xs text-muted" aria-live="polite">
          {buscando && (
            <>
              <Spinner size="sm" />
              Buscando en Spotify…
            </>
          )}
          {noEncontrado && <span className="text-danger">No encontramos eso en Spotify. Revisá el link.</span>}
          {!valido && link && <span className="text-danger">Eso no parece un link de Spotify.</span>}
          {!link && <span>En Spotify: ··· › Compartir › Copiar enlace. Sirven temas, discos y playlists.</span>}
        </div>
      </div>
    </motion.div>
  );
}
