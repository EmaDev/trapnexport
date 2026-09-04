"use client";

import { AnimatePresence, motion } from "framer-motion";
import Link from "next/link";
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

import {
  BallIcon,
  BootIcon,
  CakeIcon,
  CalendarIcon,
  PinIcon,
  RulerIcon,
  ScaleIcon,
  ShirtIcon,
  StarIcon,
} from "@/components/atoms/icons";
import type { Player, PlayerStatus } from "@/lib/historia";
import { PIERNA_LABEL, POSICION_LABEL } from "@/lib/social/types";
import { ClipRail } from "./ClipCard";
import { QuoteBlock } from "./QuoteBlock";

/** Elegí un jugador y mirá su trayectoria completa: números, skills, carrera
 *  año por año, fotos, clips y su frase.
 *
 *  Es una pantalla dentro de una pantalla, y por eso el selector va arriba y
 *  fijo: con seis jugadores y ocho bloques cada uno, una grilla de fichas
 *  abiertas sería un scroll de cincuenta pantallas.
 *
 *  ## De dónde salen los datos
 *
 *  De dos lados, y eso es lo que hay que tener presente al tocar este archivo:
 *  la ficha de trayectoria la carga el club en `/admin/historia`, y la ficha
 *  personal —posición, dorsal, medidas, ciudad y skills— la carga la propia
 *  persona en `/perfil`, o el panel por ella (`/admin/historia` → Fichas)
 *  cuando no la completó. `queries.getPlayers()` cruza las dos por `playerId` y
 *  deja la segunda en `player.ficha`.
 *
 *  Gana la personal, campo por campo. El motivo no es técnico: la ficha del
 *  club se escribe una vez y no se vuelve a mirar, y quien cambió de puesto o
 *  se mudó lo sabe antes que nadie. Un jugador sin cuenta no pierde nada — todo
 *  cae a lo que tenga cargado el club, que es como se veía esta pantalla antes.
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

/*  Dorsal y puesto se resuelven en dos funciones y no en el JSX porque hacen
 *  falta en tres lugares que tienen que decir lo mismo: el chip del selector,
 *  el número sobre la foto y la ficha de abajo. Con el ternario escrito tres
 *  veces, la próxima vez se corrige en dos. */
const dorsalDe = (p: Player) => p.ficha?.dorsal ?? p.number;

const puestoDe = (p: Player) =>
  p.ficha?.posicion ? POSICION_LABEL[p.ficha.posicion] : p.position;

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
    sub: `#${dorsalDe(p)} · ${puestoDe(p)}`,
  }));

  if (!player) return null;

  /* ── lo que cargó la persona vs. lo que tiene el club ───────────────────
   *
   *  `player.ficha` es lo que esa misma persona editó en `/perfil` —o lo que
   *  el panel cargó por ella desde la solapa "Fichas"—, y gana campo por
   *  campo: el club anota la ficha una vez y no la vuelve a mirar; el jugador
   *  cambia de puesto, se muda y cumple años. Lo que no cargó cae a la ficha
   *  institucional, así que un jugador sin cuenta se sigue viendo igual que
   *  antes.
   *
   *  El objeto vacío evita repetir `player.ficha?.` ocho veces: acá `{}`
   *  significa lo mismo que "no hay cuenta" —ningún campo cargado—, y la
   *  distinción entre las dos cosas sólo le importa al panel. */
  const f = player.ficha ?? {};

  const datos = [
    { icon: <CalendarIcon />, label: "En el club", value: player.years },
    {
      icon: <ShirtIcon />,
      label: "Dorsal",
      value: dorsalDe(player) ? `#${dorsalDe(player)}` : "",
    },
    { icon: <BallIcon />, label: "Posición", value: puestoDe(player) },
    {
      icon: <BootIcon />,
      label: "Pie",
      value: f.piernaHabil ? PIERNA_LABEL[f.piernaHabil] : player.foot,
    },
    {
      icon: <RulerIcon />,
      label: "Altura",
      value: f.altura ? `${f.altura} cm` : player.height,
    },
    { icon: <ScaleIcon />, label: "Peso", value: f.peso ? `${f.peso} kg` : "" },
    { icon: <CakeIcon />, label: "Edad", value: f.edad ? `${f.edad} años` : "" },
    // Dos rótulos y no uno: la ciudad de la ficha es de dónde es hoy y el dato
    // del club es dónde nació. Se parecen lo suficiente para ocupar el mismo
    // lugar y no lo suficiente para llamarse igual.
    f.ciudad
      ? { icon: <PinIcon />, label: "De", value: f.ciudad }
      : { icon: <PinIcon />, label: "Nació en", value: player.birthplace },
  ].filter((d) => d.value);

  /*  Las skills son lo único que no se mezcla: son una lista, no un campo, y
   *  entreverar tres del club con dos del jugador daría una ficha que no es la
   *  de nadie. Manda la lista de la persona cuando cargó alguna. */
  const skills = f.skills?.length ? f.skills : player.skills;
  const skillsPropias = Boolean(f.skills?.length);

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
                {dorsalDe(player)}
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
                «{player.nickname}» · {puestoDe(player)}
              </p>

              {/* El handle es el único lugar de la ficha que sale del módulo
                  social: si esta persona tiene cuenta, desde su trayectoria se
                  puede llegar a su perfil. */}
              {player.handle && (
                <Link
                  href={`/u/${player.handle}`}
                  className="w-fit text-sm font-medium text-primary hover:underline"
                >
                  @{player.handle}
                </Link>
              )}
            </div>
          </div>

          <p className="text-sm leading-relaxed">{player.bio}</p>

          {/* ── datos ─────────────────────────────────────────────────────── */}
          {/* La misma grilla de tarjetas con ícono que ve la persona en su
              perfil, y no por casualidad: lo que edita allá es esto. */}
          {datos.length > 0 && (
            <section className="flex flex-col gap-2">
              <Label>Ficha</Label>
              <dl className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                {datos.map((d) => (
                  <div
                    key={d.label}
                    className="flex items-center gap-2.5 rounded-xl bg-surface-alt px-3 py-2.5"
                  >
                    <span className="shrink-0 text-primary [&>svg]:size-5">{d.icon}</span>
                    <div className="min-w-0">
                      <dt className="text-[11px] uppercase tracking-wide text-muted">{d.label}</dt>
                      <dd className="truncate text-sm font-semibold">{d.value}</dd>
                    </div>
                  </div>
                ))}
              </dl>
            </section>
          )}

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
          {skills.length > 0 && (
            <section className="flex flex-col gap-2">
              <div className="flex items-baseline justify-between gap-2">
                <Label>Skills</Label>
                {/* Quién las puso es parte del dato: "Liderazgo 94" puesto por
                    el club y puesto por uno mismo no se leen igual. */}
                {skillsPropias && (
                  <span className="text-[11px] text-muted">Cargadas en su perfil</span>
                )}
              </div>
              <ul className="flex flex-col gap-2.5">
                {skills.map((s) => (
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
