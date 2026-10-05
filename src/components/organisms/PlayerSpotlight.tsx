"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useState } from "react";
import {
  ActivityTimeline,
  Carousel,
  ChipCarousel,
  StatCard,
  TabsGlow,
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
import type { Player } from "@/lib/historia";
import { PIERNA_LABEL, POSICION_LABEL } from "@/lib/social/types";
import { ClipRail } from "./ClipCard";
import { QuoteBlock } from "./QuoteBlock";

/** Elegí un jugador y mirá su ficha: datos, números, fotos, clips y su frase.
 *
 *  Las leyendas muestran además su historia entera —la bio y la trayectoria año
 *  por año en el club—, y los del plantel no. No es una ficha a medias: al que
 *  juega hoy se lo mira por lo que está haciendo esta temporada, y de la leyenda
 *  lo único que queda **es** el relato de lo que hizo.
 *
 *  Es una pantalla dentro de una pantalla, y por eso el selector va arriba y
 *  fijo: con seis jugadores y ocho bloques cada uno, una grilla de fichas
 *  abiertas sería un scroll de cincuenta pantallas.
 *
 *  ## De dónde salen los datos
 *
 *  De dos lados, y eso es lo que hay que tener presente al tocar este archivo:
 *  la ficha de trayectoria la carga el club en `/admin/historia`, y la ficha
 *  personal —posición, dorsal, medidas y ciudad— la carga la propia
 *  persona en `/perfil`, o el panel por ella (`/admin/historia` → Fichas)
 *  cuando no la completó. `queries.getPlayers()` cruza las dos por `playerId` y
 *  deja la segunda en `player.ficha`.
 *
 *  La foto sigue la misma regla y conviene saberlo antes de buscar el bug: si
 *  esa persona se cambió la foto de perfil, la ficha muestra **esa** —la de la
 *  cuenta— y no la que cargó el club. Lo resuelve `queries`, así que acá llega
 *  en `player.photo` y `player.avatar` como si fuera una sola fuente.
 *
 *  Gana la personal, campo por campo. El motivo no es técnico: la ficha del
 *  club se escribe una vez y no se vuelve a mirar, y quien cambió de puesto o
 *  se mudó lo sabe antes que nadie. Un jugador sin cuenta no pierde nada — todo
 *  cae a lo que tenga cargado el club, que es como se veía esta pantalla antes.
 *
 *  Lo que sí sale de la librería: `ChipCarousel` (el selector, con avatar),
 *  `TabsGlow` (plantel / leyendas), `ActivityTimeline` (la carrera de la leyenda —
 *  acá sí es exactamente lo que hace: una entidad, eventos en orden, estado por
 *  evento), `Carousel` (las fotos, con miniaturas y zoom) y `StatCard`. Los
 *  clips y la frase son de `ClipCard` y `QuoteBlock`, que la librería no tiene.
 */

const FILTERS = [
  { id: "plantel", label: "Plantel" },
  { id: "leyenda", label: "Leyendas" },
  { id: "todos", label: "Todos" },
] as const;

type FilterId = (typeof FILTERS)[number]["id"];

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

  // La historia larga es sólo de las leyendas; ver el encabezado del archivo.
  const esLeyenda = player.status === "leyenda";

  const career: TimelineEvent[] = esLeyenda
    ? player.career.map((c) => ({
        id: c.id,
        title: c.title,
        description: c.description,
        time: c.season,
        status: c.status,
      }))
    : [];

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

  return (
    <div className="flex flex-col gap-4">
      <TabsGlow
        items={FILTERS.map((f) => ({ ...f }))}
        value={filter}
        onChange={(v) => setFilter(v as FilterId)}
        size="sm"
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

            {/* La cabecera dice tres cosas y nada más: nombre, posición y
                dorsal. El estado, el apodo y el handle salieron a propósito —
                abajo viene la ficha entera, y repetir el perfil acá convertía
                la presentación del jugador en una lista de etiquetas. */}
            <div className="flex min-w-0 flex-col gap-1.5">
              <h3 className="text-xl font-bold leading-tight">{player.name}</h3>
              <p className="text-sm text-muted">
                {puestoDe(player)}
                {dorsalDe(player) ? ` · #${dorsalDe(player)}` : ""}
              </p>
            </div>
          </div>

          {esLeyenda && player.bio && (
            <p className="text-sm leading-relaxed">{player.bio}</p>
          )}

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

          {/* ── carrera ───────────────────────────────────────────────────── */}
          {/* El guard por largo no sobra: una leyenda recién cargada puede no
              tener ningún paso todavía, y un título solo arriba de la nada se
              lee como un bloque roto. */}
          {career.length > 0 && (
            <section className="flex flex-col gap-2">
              <Label>Trayectoria en el club</Label>
              <ActivityTimeline events={career} />
            </section>
          )}

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
