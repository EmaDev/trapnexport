"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useState } from "react";
import { Spinner, useDebounce } from "lib-kit-components";

import type { GifSugerido } from "@/lib/social/types";

/** El selector de GIFs del compositor de comentarios.
 *
 *  Panel **en el flujo**, abajo del textarea, y no un popover absoluto: la caja
 *  de comentarios vive en el slot `children` de `SocialPost`, y ese `article` es
 *  `overflow-hidden` —es el mismo motivo por el que el menú de "⋯" de
 *  `PostCard` tiene que montarse en el wrapper—. Un panel absoluto de 300px de
 *  alto quedaría recortado en la mitad de los posts del feed. En el flujo,
 *  además, empuja el contenido en vez de taparlo, que en un celular es lo que
 *  uno quiere mientras elige.
 *
 *  Habla con `/api/giphy`, nunca con `api.giphy.com`: la clave es del servidor
 *  (ver `lib/social/giphy.ts`).
 */

/** Lo que se espera a que deje de tipear antes de pedir. 350 ms es el punto
 *  donde buscar "festejo" es una llamada y no siete: por debajo se siente igual
 *  de inmediato y gasta cuota de la API en prefijos que nadie quería buscar. */
const DEBOUNCE_MS = 350;

export function GifPicker({
  onPick,
  onClose,
}: {
  onPick: (gif: GifSugerido) => void;
  onClose: () => void;
}) {
  const [q, setQ] = useState("");
  /** La última búsqueda que volvió: de qué término es, y qué trajo. */
  const [resultado, setResultado] = useState<{
    q: string;
    gifs: GifSugerido[];
    error: string | null;
  } | null>(null);

  const busqueda = useDebounce(q, DEBOUNCE_MS);

  /*  "Cargando" es derivado y no un `useState`: es cierto exactamente cuando lo
   *  que hay en pantalla no es de la búsqueda actual. Guardarlo aparte sería un
   *  segundo estado que hay que acordarse de apagar en los tres caminos —ok,
   *  error, abortado— y que se puede quedar en `true` para siempre si alguno se
   *  olvida. Además es lo que deja el efecto sin ningún `setState` sincrónico en
   *  el cuerpo, que es lo que React desaconseja por las renders en cascada. */
  const cargando = resultado?.q !== busqueda;
  const error = resultado?.error ?? null;
  const gifs = resultado?.gifs ?? [];

  useEffect(() => {
    /*  Aborta la búsqueda anterior. Sin esto, dos pedidos en vuelo pueden volver
     *  desordenados y la grilla termina mostrando los resultados de un prefijo
     *  —"go" cuando ya escribiste "gol"—: el último en llegar gana, y no es
     *  necesariamente el último que salió. */
    const ac = new AbortController();

    fetch(`/api/giphy?q=${encodeURIComponent(busqueda)}`, { signal: ac.signal })
      .then(async (res) => {
        const json = (await res.json()) as { gifs?: GifSugerido[]; error?: string };
        if (!res.ok) throw new Error(json.error ?? "No pudimos traer los GIFs.");
        setResultado({ q: busqueda, gifs: json.gifs ?? [], error: null });
      })
      .catch((e: unknown) => {
        // Abortar es lo normal al tipear, no un error que mostrar: el pedido que
        // lo reemplaza es el que va a escribir el resultado.
        if (e instanceof DOMException && e.name === "AbortError") return;
        setResultado({
          q: busqueda,
          gifs: [],
          error: e instanceof Error ? e.message : "No pudimos traer los GIFs.",
        });
      });

    return () => ac.abort();
  }, [busqueda]);

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
            placeholder="Buscar GIFs…"
            // Enter en un selector de GIFs no envía nada: el formulario es el
            // comentario, y mandarlo a medio elegir sería publicar sin el GIF.
            onKeyDown={(e) => {
              if (e.key === "Enter") e.preventDefault();
              if (e.key === "Escape") onClose();
            }}
            className="h-9 flex-1 min-w-0 rounded-xl border border-border bg-surface-alt/60 px-3 text-sm text-foreground placeholder:text-muted outline-none focus:border-primary transition-colors"
          />
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar GIFs"
            className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-muted transition-colors hover:bg-surface-alt hover:text-foreground"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round">
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/*  Alto fijo y no `auto`: la grilla cambia en cada tecla, y sin un alto
            estable el comentario entero salta mientras uno busca. */}
        <div className="mt-3 h-56 overflow-y-auto overscroll-contain">
          {cargando && (
            <div className="flex h-full items-center justify-center">
              <Spinner />
            </div>
          )}

          {!cargando && error && (
            <p className="flex h-full items-center justify-center px-4 text-center text-xs text-muted">
              {error}
            </p>
          )}

          {!cargando && !error && gifs.length === 0 && (
            <p className="flex h-full items-center justify-center px-4 text-center text-xs text-muted">
              {q.trim() ? `No encontramos GIFs de “${q.trim()}”.` : "No hay GIFs para mostrar."}
            </p>
          )}

          {!cargando && !error && gifs.length > 0 && (
            <div className="grid grid-cols-3 gap-1.5">
              <AnimatePresence initial={false}>
                {gifs.map((g) => (
                  <motion.button
                    key={g.id}
                    layout
                    type="button"
                    initial={{ opacity: 0, scale: 0.94 }}
                    animate={{ opacity: 1, scale: 1 }}
                    onClick={() => onPick(g)}
                    title={g.title || "GIF"}
                    className="relative aspect-square overflow-hidden rounded-lg bg-surface-alt ring-offset-2 ring-offset-surface transition-all hover:ring-2 hover:ring-primary active:scale-95"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element -- lo sirve el CDN de Giphy; `next/image` lo optimizaría a un fotograma */}
                    <img
                      src={g.preview}
                      alt={g.title || "GIF"}
                      loading="lazy"
                      className="h-full w-full object-cover"
                    />
                  </motion.button>
                ))}
              </AnimatePresence>
            </div>
          )}
        </div>

        {/*  La atribución no es decorativa: la sección 5.A de los términos de la
            API de Giphy pide mostrar "Powered By GIPHY" de forma visible donde
            se use la API. No se saca.

            Pendiente para la clave de producción: Giphy pide ahí el logo oficial
            —no este texto— y screenshots de dónde está puesto como parte de la
            solicitud. Con la clave de desarrollo esto alcanza. */}
        <p className="mt-2 text-center text-[10px] font-semibold uppercase tracking-wider text-muted">
          Powered by GIPHY
        </p>
      </div>
    </motion.div>
  );
}
