"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useRef, useState } from "react";
import { ChipCarousel, usePrefersReducedMotion, type Chip } from "lib-kit-components";

import {
  ArrowDownIcon,
  ArrowUpIcon,
  BallIcon,
  HeartIcon,
  ShieldIcon,
  ShirtIcon,
  StarIcon,
  TicketIcon,
} from "@/components/atoms/icons";
import type { Era, MilestoneKind } from "@/lib/historia";

/** La línea de tiempo del club: cinco etapas, de 1998 a hoy, cada una con sus
 *  hitos adentro.
 *
 *  ⚠️ No sale de `lib-kit-components`, y no por falta de timelines: la librería
 *  tiene cuatro y ninguno sirve para esto.
 *
 *  - `ActivityTimeline` es plano: `title`/`description`/`time` y nada más. Sin
 *    lugar para la foto, las estadísticas ni el rango de años de la etapa.
 *  - `BranchingTimeline` anida dos niveles, que es la forma correcta, pero es
 *    de sólo lectura y sin colapsar: veinte hitos abiertos de una sola vez.
 *  - `Roadmap` agrupa por período —lo más cerca— pero mira al futuro: sus
 *    estados son "Lanzado / En curso / Planeado", no "título / descenso".
 *  - `HowItWorksTimeline` es explicativo y estático, de landing.
 *
 *  Lo que agrega este archivo sobre cualquiera de esos: la etapa es un bloque
 *  colapsable con su propia media y sus números, los hitos tienen tipo (y el
 *  tipo tiene color), y la fila de arriba salta a la etapa que se elija.
 *
 *  Por qué colapsable y no todo abierto: cinco etapas × cuatro hitos, con foto
 *  y párrafo cada una, son unas quince pantallas de scroll antes de llegar a
 *  las temporadas. Arranca abierta la etapa en curso, que es la que la mayoría
 *  viene a ver, y el resto se abre a demanda.
 */

/* ── tipos de hito ───────────────────────────────────────────────────────── */

/** Cada tipo tiene su color y su ícono. `derrota` y `homenaje` son los dos en
 *  tono serio: una historia de club sin la parte difícil no es una historia. */
const KINDS: Record<
  MilestoneKind,
  { label: string; tone: string; icon: React.ReactNode }
> = {
  titulo: {
    label: "Título",
    tone: "border-accent/30 bg-accent/10 text-accent",
    icon: <StarIcon width={11} height={11} />,
  },
  ascenso: {
    label: "Ascenso",
    tone: "border-success/30 bg-success/10 text-success",
    icon: <ArrowUpIcon width={11} height={11} strokeWidth={2.4} />,
  },
  debut: {
    label: "Debut",
    tone: "border-primary/30 bg-primary/10 text-primary",
    icon: <ShirtIcon width={11} height={11} strokeWidth={2.2} />,
  },
  obra: {
    label: "Institucional",
    tone: "border-border bg-surface-alt text-muted",
    icon: <ShieldIcon width={11} height={11} strokeWidth={2.2} />,
  },
  partido: {
    label: "Partido",
    tone: "border-border bg-surface-alt text-foreground",
    icon: <BallIcon width={11} height={11} strokeWidth={2.2} />,
  },
  derrota: {
    label: "Derrota",
    tone: "border-danger/30 bg-danger/10 text-danger",
    icon: <ArrowDownIcon width={11} height={11} strokeWidth={2.4} />,
  },
  homenaje: {
    label: "Homenaje",
    tone: "border-border bg-surface-alt text-muted",
    icon: <HeartIcon width={11} height={11} strokeWidth={2.2} />,
  },
  evento: {
    label: "Evento",
    tone: "border-primary/30 bg-primary/10 text-primary",
    icon: <TicketIcon width={11} height={11} strokeWidth={2.2} />,
  },
};

/** La etiqueta de tipo de hito. Exportada porque la usa también el detalle de
 *  temporada (`/historia/:año`): el mismo dato tiene que verse igual en las dos
 *  pantallas o el color deja de significar algo. */
export function KindChip({ kind }: { kind: MilestoneKind }) {
  const k = KINDS[kind];
  return (
    <span
      className={`inline-flex shrink-0 items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${k.tone}`}
    >
      {k.icon}
      {k.label}
    </span>
  );
}

/* ── el timeline ─────────────────────────────────────────────────────────── */

export function EraTimeline({ eras }: { eras: Era[] }) {
  const reduced = usePrefersReducedMotion();

  // Arranca abierta la etapa en curso; si ninguna lo está, la última.
  const [open, setOpen] = useState<Set<string>>(() => {
    const start = eras.find((e) => e.current) ?? eras[eras.length - 1];
    return new Set(start ? [start.id] : []);
  });

  // Un ref por etapa para que la fila de chips pueda saltar. El `scroll-mt-24`
  // del `<li>` compensa el `AppHeader` sticky, que si no tapa el título.
  const nodes = useRef<Record<string, HTMLLIElement | null>>({});

  // Qué chip queda marcado. Es el último salto, no "la etapa visible": seguir
  // el scroll pediría un IntersectionObserver por etapa para un feedback que
  // en una fila de cinco chips no cambia ninguna decisión.
  const [jumped, setJumped] = useState("");

  const allOpen = open.size === eras.length;

  const toggle = (id: string) =>
    setOpen((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const jump = (id: string) => {
    setJumped(id);
    setOpen((prev) => new Set(prev).add(id));
    nodes.current[id]?.scrollIntoView({
      behavior: reduced ? "auto" : "smooth",
      block: "start",
    });
  };

  const chips: Chip[] = eras.map((e) => ({
    id: e.id,
    label: e.period,
    sub: e.title,
  }));

  return (
    <div className="flex flex-col gap-4">
      {/* Selector de etapa. `clearable={false}`: acá el chip no es un filtro
          que se pueda apagar, es un salto — un estado vacío no significa nada. */}
      <ChipCarousel
        chips={chips}
        value={jumped}
        onChange={(v) => jump(v as string)}
        clearable={false}
        variant="outline"
        size="lg"
        className="-mx-4 px-4"
      />

      <div className="flex justify-end">
        <button
          type="button"
          onClick={() => setOpen(allOpen ? new Set() : new Set(eras.map((e) => e.id)))}
          className="text-xs font-semibold text-primary"
        >
          {allOpen ? "Contraer todo" : "Expandir todo"}
        </button>
      </div>

      <ol className="flex flex-col">
        {eras.map((era, i) => {
          const isOpen = open.has(era.id);
          const last = i === eras.length - 1;

          return (
            <li
              key={era.id}
              ref={(el) => {
                nodes.current[era.id] = el;
              }}
              className="relative scroll-mt-24 pb-7 pl-9 last:pb-0"
            >
              {/* La línea: del nodo hasta el final del bloque. La última etapa
                  no la dibuja, así el timeline cierra sin cola suelta. */}
              {!last && (
                <span
                  aria-hidden
                  className="absolute bottom-0 left-[11px] top-7 w-px bg-border"
                />
              )}

              <span
                aria-hidden
                className={`absolute left-0 top-1.5 grid size-6 place-items-center rounded-full border-2 bg-surface ${
                  era.current ? "border-primary" : "border-border"
                }`}
              >
                <span
                  className={`size-2 rounded-full ${
                    era.current ? "animate-pulse bg-primary" : "bg-muted"
                  }`}
                />
              </span>

              <button
                type="button"
                onClick={() => toggle(era.id)}
                aria-expanded={isOpen}
                className="block w-full text-left"
              >
                <span className="flex flex-wrap items-center gap-2">
                  <span className="text-xs font-bold uppercase tracking-wider text-primary">
                    {era.period}
                  </span>
                  {era.current && (
                    <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-primary">
                      En curso
                    </span>
                  )}
                </span>

                <span className="mt-0.5 flex items-start justify-between gap-3">
                  <span className="text-lg font-bold leading-tight">{era.title}</span>
                  {/* El chevron es el único indicador de que el bloque abre;
                      rota en vez de cambiar de glifo para no reflowear la fila. */}
                  <span
                    aria-hidden
                    className={`mt-1 shrink-0 text-muted transition-transform duration-200 ${
                      isOpen ? "rotate-180" : ""
                    }`}
                  >
                    <svg
                      viewBox="0 0 24 24"
                      width="18"
                      height="18"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth={2}
                      strokeLinecap="round"
                    >
                      <path d="m6 9.5 6 6 6-6" />
                    </svg>
                  </span>
                </span>

                <span className="mt-1 block text-sm text-muted">{era.tagline}</span>
              </button>

              <AnimatePresence initial={false}>
                {isOpen && (
                  <motion.div
                    key="body"
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: reduced ? 0 : 0.28, ease: "easeOut" }}
                    className="overflow-hidden"
                  >
                    <div className="flex flex-col gap-4 pt-4">
                      <div className="relative overflow-hidden rounded-2xl border border-border">
                        {/* eslint-disable-next-line @next/next/no-img-element -- data-URI */}
                        <img
                          src={era.photo}
                          alt={`${era.title} · ${era.period}`}
                          className="block aspect-video w-full object-cover"
                        />
                        <div className="absolute inset-x-0 bottom-0 grid grid-cols-3 gap-px bg-black/45 backdrop-blur-sm">
                          {era.stats.map((s) => (
                            <div key={s.label} className="px-2 py-2 text-center">
                              <p className="text-sm font-bold text-white tabular-nums">
                                {s.value}
                              </p>
                              <p className="truncate text-[10px] uppercase tracking-wide text-white/70">
                                {s.label}
                              </p>
                            </div>
                          ))}
                        </div>
                      </div>

                      <p className="text-sm leading-relaxed">{era.description}</p>

                      <ol className="flex flex-col gap-4 border-l border-dashed border-border pl-4">
                        {era.milestones.map((m) => (
                          <li key={m.id} className="relative">
                            <span
                              aria-hidden
                              className="absolute -left-[21px] top-1.5 size-2 rounded-full bg-border ring-4 ring-surface"
                            />
                            <div className="flex flex-wrap items-center gap-2">
                              <KindChip kind={m.kind} />
                              <span className="text-[11px] font-medium text-muted">
                                {m.date}
                              </span>
                            </div>
                            <h4 className="mt-1.5 text-sm font-semibold">{m.title}</h4>
                            <p className="mt-0.5 text-sm text-muted">{m.description}</p>
                          </li>
                        ))}
                      </ol>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
