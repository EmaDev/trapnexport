"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useState } from "react";
import {
  ActivityTimeline,
  Carousel,
  ChipCarousel,
  ProgressBar,
  StatCard,
  Tabs,
  usePrefersReducedMotion,
  type Chip,
  type TimelineEvent,
} from "lib-kit-components";

import { StarIcon } from "@/components/atoms/icons";
import type { Player, PlayerStatus } from "@/lib/historia";
import { ClipRail } from "./ClipCard";
import { QuoteBlock } from "./QuoteBlock";

/** Elegí un jugador y mirá su trayectoria completa: números, skills, carrera
 *  año por año, fotos, clips y su frase.
 *
 *  Es una pantalla dentro de una pantalla, y por eso el selector va arriba y
 *  fijo: con seis jugadores y ocho bloques cada uno, una grilla de fichas
 *  abiertas sería un scroll de cincuenta pantallas.
 *
 *  Lo que sí sale de la librería: `ChipCarousel` (el selector, con avatar),
 *  `Tabs` (plantel / leyendas), `ActivityTimeline` (la carrera — acá sí es
 *  exactamente lo que hace: una entidad, eventos en orden, estado por evento),
 *  `Carousel` (las fotos, con miniaturas y zoom) y `StatCard`. Los clips y la
 *  frase son de `ClipCard` y `QuoteBlock`, que la librería no tiene.
 */

const FILTERS = [
  { id: "plantel", label: "Plantel" },
  { id: "leyenda", label: "Leyendas" },
  { id: "todos", label: "Todos" },
] as const;

type FilterId = (typeof FILTERS)[number]["id"];

const STATUS: Record<PlayerStatus, { label: string; tone: string }> = {
  plantel: { label: "En el plantel", tone: "bg-success/10 text-success border-success/30" },
  leyenda: { label: "Leyenda", tone: "bg-accent/10 text-accent border-accent/30" },
};

function Label({ children }: { children: React.ReactNode }) {
  return (
    <h4 className="text-xs font-semibold uppercase tracking-wider text-muted">{children}</h4>
  );
}

export function PlayerSpotlight({
  players,
  initialId,
  onPick,
}: {
  players: Player[];
  /** jugador con el que abrir, si viene de un deep link `?jugador=` */
  initialId?: string;
  /** se llama al cambiar de jugador; `/historia` lo usa para sincronizar la URL */
  onPick?: (id: string) => void;
}) {
  const reduced = usePrefersReducedMotion();
  const [filter, setFilter] = useState<FilterId>("todos");
  const [picked, setPicked] = useState(() =>
    players.some((p) => p.id === initialId) ? initialId! : (players[0]?.id ?? ""),
  );

  const pick = (id: string) => {
    setPicked(id);
    onPick?.(id);
  };

  const list =
    filter === "todos" ? players : players.filter((p) => p.status === filter);

  // El jugador sale de derivar, no de un `useEffect` que corrija el estado:
  // si el filtro deja afuera al elegido, cae al primero de la lista nueva y no
  // hay un frame intermedio con el panel vacío.
  const player = list.find((p) => p.id === picked) ?? list[0];

  const chips: Chip[] = list.map((p) => ({
    id: p.id,
    label: p.name,
    image: p.avatar,
    sub: `#${p.number} · ${p.position}`,
  }));

  if (!player) return null;

  const career: TimelineEvent[] = player.career.map((c) => ({
    id: c.id,
    title: c.title,
    description: c.description,
    time: c.season,
    status: c.status,
  }));

  return (
    <div className="flex flex-col gap-4">
      <Tabs
        items={FILTERS.map((f) => ({ ...f }))}
        value={filter}
        onChange={(v) => setFilter(v as FilterId)}
        variant="segmented"
        size="sm"
        fitted
      />

      <ChipCarousel
        chips={chips}
        value={player.id}
        onChange={(v) => pick(v as string)}
        clearable={false}
        variant="soft"
        size="lg"
        className="-mx-4 px-4"
      />

      {/* `mode="wait"` y no el crossfade por default: los dos paneles miden
          distinto (cada jugador tiene otra cantidad de hitos y de clips) y
          superpuestos dan un salto de alto a mitad de la transición. */}
      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={player.id}
          initial={reduced ? false : { opacity: 0, x: 16 }}
          animate={{ opacity: 1, x: 0 }}
          exit={reduced ? undefined : { opacity: 0, x: -16 }}
          transition={{ duration: reduced ? 0 : 0.22, ease: "easeOut" }}
          className="flex flex-col gap-5"
        >
          {/* ── ficha ─────────────────────────────────────────────────────── */}
          <div className="flex gap-4">
            <div className="relative w-28 shrink-0 overflow-hidden rounded-2xl border border-border sm:w-36">
              {/* eslint-disable-next-line @next/next/no-img-element -- data-URI */}
              <img
                src={player.photo}
                alt={player.name}
                className="block aspect-3/4 w-full object-cover"
              />
              <span className="absolute left-0 top-0 rounded-br-xl bg-primary px-2 py-1 text-sm font-bold text-white tabular-nums">
                {player.number}
              </span>
            </div>

            <div className="flex min-w-0 flex-col gap-1.5">
              <span
                className={`w-fit rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${
                  STATUS[player.status].tone
                }`}
              >
                {STATUS[player.status].label}
              </span>

              <h3 className="text-xl font-bold leading-tight">{player.name}</h3>
              <p className="text-sm text-muted">
                «{player.nickname}» · {player.position}
              </p>

              <dl className="mt-1 grid grid-cols-2 gap-x-3 gap-y-1 text-xs">
                {[
                  ["En el club", player.years],
                  ["Pie", player.foot],
                  ["Altura", player.height],
                  ["Nació en", player.birthplace],
                ].map(([k, v]) => (
                  <div key={k} className="min-w-0">
                    <dt className="text-muted">{k}</dt>
                    <dd className="truncate font-medium">{v}</dd>
                  </div>
                ))}
              </dl>
            </div>
          </div>

          <p className="text-sm leading-relaxed">{player.bio}</p>

          {/* ── números ───────────────────────────────────────────────────── */}
          <section className="flex flex-col gap-2">
            <Label>En números</Label>
            <div className="grid grid-cols-2 gap-2">
              {player.stats.map((s) => (
                <StatCard
                  key={s.label}
                  label={s.label}
                  value={s.value}
                  tone="primary"
                  variant="outline"
                />
              ))}
            </div>
          </section>

          {/* ── skills ────────────────────────────────────────────────────── */}
          {/* Vacío para las fichas en memoria: convertir a alguien que ya no
              está en barras de "Regate 93" no es el tono que corresponde. */}
          {player.skills.length > 0 && (
            <section className="flex flex-col gap-2">
              <Label>Skills</Label>
              <ul className="flex flex-col gap-2.5">
                {player.skills.map((s) => (
                  <li key={s.label}>
                    {/* El número va afuera de `ProgressBar` a propósito: su
                        `showValue` escribe un porcentaje, y "Liderazgo 94%" no
                        es lo que dice el dato — es un puntaje sobre 100. */}
                    <div className="mb-1 flex items-baseline justify-between gap-2">
                      <span className="text-[13px] font-medium">{s.label}</span>
                      <span className="text-[13px] font-bold tabular-nums text-primary">
                        {s.value}
                      </span>
                    </div>
                    <ProgressBar
                      value={s.value}
                      max={100}
                      size="sm"
                      tone={s.value >= 90 ? "accent" : "primary"}
                    />
                  </li>
                ))}
              </ul>
            </section>
          )}

          {/* ── carrera ───────────────────────────────────────────────────── */}
          <section className="flex flex-col gap-2">
            <Label>Trayectoria en el club</Label>
            <ActivityTimeline events={career} />
          </section>

          {/* ── fotos ─────────────────────────────────────────────────────── */}
          {player.gallery.length > 0 && (
            <section className="flex flex-col gap-2">
              <Label>Fotos</Label>
              <Carousel
                images={player.gallery.map((g) => ({
                  src: g.src,
                  alt: g.alt,
                  caption: `${g.year} · ${g.caption}`,
                }))}
                aspect={16 / 9}
                thumbs
                zoomable
              />
            </section>
          )}

          {/* ── clips ─────────────────────────────────────────────────────── */}
          {player.clips.length > 0 && (
            <section className="flex flex-col gap-2">
              <Label>Clips</Label>
              <ClipRail clips={player.clips} />
            </section>
          )}

          {/* ── su frase ──────────────────────────────────────────────────── */}
          {player.quote && (
            <section className="flex flex-col gap-2">
              <Label>
                <span className="inline-flex items-center gap-1.5">
                  <StarIcon width={12} height={12} className="text-accent" />
                  Su frase
                </span>
              </Label>
              <QuoteBlock
                text={player.quote.text}
                author={player.quote.author}
                role={player.quote.role}
                year={player.quote.year}
                avatar={player.quote.avatar}
                variant="featured"
              />
            </section>
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
