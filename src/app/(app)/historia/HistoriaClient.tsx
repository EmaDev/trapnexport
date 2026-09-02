"use client";

import { motion, useSpring, useTransform } from "framer-motion";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  AppHeader,
  BottomSheet,
  Carousel,
  ChipCarousel,
  MediaCard,
  SafeAreaSpacer,
  usePrefersReducedMotion,
  type Chip,
} from "lib-kit-components";

import {
  BallIcon,
  BellIcon,
  ChatIcon,
  PresentIcon,
  QuoteIcon,
  ShirtIcon,
  StarIcon,
  TrophyIcon,
} from "@/components/atoms/icons";
import { ClipRail } from "@/components/organisms/ClipCard";
import { EraTimeline } from "@/components/organisms/EraTimeline";
import { PlayerSpotlight } from "@/components/organisms/PlayerSpotlight";
import { QuoteBlock } from "@/components/organisms/QuoteBlock";
import { TrayectoriaPresentador } from "@/components/organisms/TrayectoriaPresentador";
import type { Historia } from "@/lib/historia";
import { armarTrayectoria, type Orientacion } from "@/lib/presentacion/trayectoria";
import { useNotifications } from "../notifications-context";

/** La historia del club, en una sola pantalla larga.
 *
 *  Seis secciones, en el orden en que se cuenta una historia y no en el orden
 *  en que están los datos:
 *
 *    hero          quién es el club: escudo, números, palmarés
 *    trayectoria   la línea de tiempo, 1998 → hoy  (`EraTimeline`)
 *    temporadas    las últimas cinco, cada una con su página  (`/historia/:año`)
 *    museo         fotos del archivo  (`Carousel` con miniaturas y zoom)
 *    video         clips  (`ClipRail`)
 *    frases        las citas  (`QuoteBlock`)
 *    jugadores     elegir uno y ver todo  (`PlayerSpotlight`)
 *
 *  Es scroll y no `Tabs` a propósito: una trayectoria se lee de corrido, y con
 *  pestañas cada etapa queda escondida detrás de un tab que hay que adivinar.
 *  Lo que sí hay es una fila de chips arriba que salta a cada sección, porque
 *  scrollear siete pantallas para volver a los jugadores no es leer, es buscar.
 *
 *  El label del `BottomNav` sigue diciendo "Historia" y no "Historia del club":
 *  la nav tiene cuatro ítems y en 360px un label de tres palabras se corta.
 */

/* ── piezas locales ──────────────────────────────────────────────────────── */

/** Título de sección: ícono, nombre y bajada.
 *
 *  El `id` y el `scroll-mt-24` son lo que hace funcionar la fila de chips: el
 *  margen de scroll compensa el `AppHeader` sticky, que si no tapa el título
 *  justo cuando el salto termina. */
function SectionHeading({
  id,
  icon,
  title,
  hint,
}: {
  id: string;
  icon: React.ReactNode;
  title: string;
  hint: string;
}) {
  return (
    <header id={id} className="scroll-mt-24">
      <h2 className="flex items-center gap-2 text-base font-bold">
        <span className="text-primary">{icon}</span>
        {title}
      </h2>
      <p className="mt-0.5 text-sm text-muted">{hint}</p>
    </header>
  );
}

/** Contador que arranca en cero y sube al montar.
 *
 *  ⚠️ No es `AnimatedCounter` de la librería, y no por gusto: ese componente
 *  inicializa su spring **en** `value` (`useSpring(value, …)`), así que anima
 *  cuando el número cambia y dibuja quieto un número fijo — lo dice su propia
 *  doc: "si el número es estático, no lo uses". Los tres números del hero son
 *  fijos, y lo que se quiere es la subida al entrar.
 *
 *  Son las mismas tres líneas de `AnimatedCounter` con el spring arrancando en
 *  0. Va con `MotionValue` y no con `useState` a propósito: el valor vive
 *  afuera de React, así la subida no dispara un render por frame.
 */
function CountUp({ value, format }: { value: number; format?: (n: number) => string }) {
  const reduced = usePrefersReducedMotion();
  const spring = useSpring(0, { duration: 1100, bounce: 0.15 });
  const text = useTransform(spring, (n) => (format ? format(n) : String(Math.round(n))));

  useEffect(() => {
    spring.set(value);
  }, [value, spring]);

  if (reduced) {
    return <span className="tabular-nums">{format ? format(value) : value}</span>;
  }
  return <motion.span className="tabular-nums">{text}</motion.span>;
}

const es = (n: number) => Math.round(n).toLocaleString("es-AR");

/* ── la pantalla ─────────────────────────────────────────────────────────── */

const SECTIONS: Chip[] = [
  { id: "trayectoria", label: "Trayectoria" },
  { id: "temporadas", label: "Temporadas" },
  { id: "museo", label: "Museo" },
  { id: "video", label: "Video" },
  { id: "frases", label: "Frases" },
  { id: "jugadores", label: "Jugadores" },
];

export function HistoriaClient({ historia }: { historia: Historia }) {
  const { club, balance, trophies, eras, seasons, players, quotes, gallery, clips } =
    historia;
  const router = useRouter();
  const reduced = usePrefersReducedMotion();
  const { unread, open, unreadChats } = useNotifications();

  // El chip de sección es un salto, no un filtro: se marca el último elegido
  // y no se sigue el scroll (ver el mismo criterio en `EraTimeline`).
  const [jumped, setJumped] = useState("");
  const root = useRef<HTMLDivElement>(null);

  // Modo presentación. `elegirOrientacion` abre la hoja donde se elige cómo se
  // acomoda; `presentando` guarda la elegida y monta el presentador.
  //
  // Son dos estados y no uno con `null` porque el presentador tiene que
  // montarse **dentro del toque** que elige la orientación: es el único momento
  // en que el navegador concede pantalla completa y el bloqueo de rotación.
  const [elegirOrientacion, setElegirOrientacion] = useState(false);
  const [presentando, setPresentando] = useState<Orientacion | null>(null);

  // El guion es una función de las etapas, así que se recalcula sólo si cambian
  // — no en cada render de una pantalla que tiene siete secciones animadas.
  const trayectoria = useMemo(
    () => armarTrayectoria(eras, club, balance),
    [eras, club, balance],
  );

  const presentar = (orientacion: Orientacion) => {
    setElegirOrientacion(false);
    setPresentando(orientacion);
  };

  // Deep link a un jugador: `/historia?jugador=vega` abre la pantalla en su
  // ficha y baja hasta la sección. Es lo que hace compartible la trayectoria
  // de una persona sin tener que darle una ruta propia a cada una.
  const initialPlayer = useSearchParams().get("jugador") ?? undefined;

  const titles = trophies.reduce((n, t) => n + t.times, 0);
  const seasonsPlayed = seasons[0] ? seasons[0].year - club.founded : 0;

  const jump = (id: string) => {
    setJumped(id);
    root.current
      ?.querySelector(`#${id}`)
      ?.scrollIntoView({ behavior: reduced ? "auto" : "smooth", block: "start" });
  };

  // Sólo al montar, y sólo si vino el parámetro: entrar por el link tiene que
  // dejarte mirando la ficha, no arriba de todo con el jugador cambiado.
  useEffect(() => {
    if (!initialPlayer) return;
    document
      .getElementById("jugadores")
      ?.scrollIntoView({ behavior: "auto", block: "start" });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- una sola vez, al montar
  }, []);

  // La URL se sincroniza con `history.replaceState` y no con `router.replace`:
  // el destino es el mismo árbol de React, así que un replace de Next sería
  // volver a renderizar la pantalla entera para cambiar un query param.
  const syncPlayer = (id: string) => {
    const url = new URL(window.location.href);
    url.searchParams.set("jugador", id);
    window.history.replaceState(null, "", url);
  };

  return (
    <>
      <AppHeader
        title="Historia"
        subtitle={`${club.name} · desde ${club.founded}`}
        largeTitle
        variant="blur"
        sticky
        actions={[
          {
            id: "notif",
            label: "Notificaciones",
            icon: <BellIcon />,
            badge: unread || false,
            onClick: open,
          },
          {
            // Los mensajes directos se levantan desde el header en las cuatro
            // pantallas raíz, no sólo en el feed: desde que dejaron de ser un
            // tab, el sobre es la única puerta y tiene que estar donde el
            // usuario esté parado.
            id: "chat",
            label: "Mensajes",
            icon: <ChatIcon />,
            badge: unreadChats || false,
            onClick: () => router.push("/chat"),
          },
        ]}
      />

      <div
        ref={root}
        className="mx-auto flex w-full max-w-xl flex-col gap-8 px-4 py-4"
      >
        {/* ── hero ──────────────────────────────────────────────────────── */}
        <section className="flex flex-col gap-4">
          <div className="relative overflow-hidden rounded-3xl bg-[linear-gradient(135deg,var(--color-primary),var(--color-accent))] p-5 text-white">
            {/* Dos círculos de luz, del mismo blanco translúcido que usa la
                media generada: sin esto el degradé es una banda plana. */}
            <span
              aria-hidden
              className="pointer-events-none absolute -right-16 -top-20 size-52 rounded-full bg-white/10"
            />
            <span
              aria-hidden
              className="pointer-events-none absolute -bottom-24 -left-10 size-44 rounded-full bg-white/5"
            />

            <div className="relative flex items-center gap-4">
              {/* eslint-disable-next-line @next/next/no-img-element -- data-URI */}
              <img
                src={club.crest}
                alt={`Escudo de ${club.name}`}
                className="size-20 shrink-0 drop-shadow-lg sm:size-24"
              />
              <div className="min-w-0">
                <p className="text-[11px] font-semibold uppercase tracking-widest text-white/70">
                  {club.nickname} · {club.stadium}
                </p>
                <h1 className="mt-0.5 text-balance text-xl font-bold leading-tight sm:text-2xl">
                  {club.name}
                </h1>
                <p className="mt-1 text-sm italic text-white/85">«{club.motto}»</p>
              </div>
            </div>

            <dl className="relative mt-5 grid grid-cols-3 gap-2 border-t border-white/20 pt-4 text-center">
              {[
                { label: "Títulos", value: titles, format: undefined },
                { label: "Temporadas", value: seasonsPlayed, format: undefined },
                { label: "Jugadores", value: club.members, format: es },
              ].map((s) => (
                <div key={s.label}>
                  <dd className="text-2xl font-bold leading-none">
                    <CountUp value={s.value} format={s.format} />
                  </dd>
                  <dt className="mt-1 text-[10px] font-semibold uppercase tracking-wide text-white/70">
                    {s.label}
                  </dt>
                </div>
              ))}
            </dl>
          </div>

          <p className="text-sm leading-relaxed text-muted">{club.intro}</p>

          {/* Palmarés. Va en el hero y no en una sección propia porque son
              cuatro líneas: una sección con título para cuatro líneas es más
              chrome que contenido. */}
          <ul className="flex flex-col divide-y divide-border overflow-hidden rounded-2xl border border-border">
            {trophies.map((t) => (
              <li key={t.id} className="flex items-center gap-3 px-4 py-3">
                <TrophyIcon width={18} height={18} className="shrink-0 text-accent" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold">{t.name}</p>
                  <p className="truncate text-xs text-muted">{t.years}</p>
                </div>
                <span className="shrink-0 rounded-full bg-accent/10 px-2 py-0.5 text-xs font-bold tabular-nums text-accent">
                  ×{t.times}
                </span>
              </li>
            ))}
          </ul>
        </section>

        <ChipCarousel
          chips={SECTIONS}
          value={jumped}
          onChange={(v) => jump(v as string)}
          clearable={false}
          variant="solid"
          size="sm"
          className="-mx-4 px-4"
        />

        {/* ── trayectoria ───────────────────────────────────────────────── */}
        <section className="flex flex-col gap-4">
          <SectionHeading
            id="trayectoria"
            icon={<BallIcon width={18} height={18} />}
            title="La trayectoria"
            hint={`${eras.length} etapas, de ${club.founded} a hoy. Tocá una para abrirla.`}
          />

          {/* El modo presentación no es otra vista de lo mismo: la lista de
              abajo es para leer y buscar, y esto es para mostrarle la historia
              a alguien, a pantalla completa y sin el resto de la app alrededor. */}
          <button
            type="button"
            onClick={() => setElegirOrientacion(true)}
            className="flex items-center gap-3 rounded-2xl border border-primary/30 bg-[linear-gradient(135deg,var(--color-primary),var(--color-accent))] px-4 py-3 text-left text-white"
          >
            <PresentIcon width={22} height={22} className="shrink-0" />
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-semibold">Modo presentación</span>
              <span className="block text-xs text-white/75">
                {trayectoria.length} cards a pantalla completa, avanzando por la
                línea de tiempo.
              </span>
            </span>
          </button>

          <EraTimeline eras={eras} />
        </section>

        {/* ── temporadas ────────────────────────────────────────────────── */}
        <section className="flex flex-col gap-4">
          <SectionHeading
            id="temporadas"
            icon={<StarIcon width={18} height={18} />}
            title="Temporada por temporada"
            hint="Las últimas cinco, con su tabla, sus hitos y su plantel."
          />
          {/* Fila con snap en vez de grilla: cinco temporadas en grilla son
              tres pantallas de scroll en el medio de la pantalla más larga de
              la app. Sangra con `-mx-4 px-4` para que se vea que hay más. */}
          <ul className="-mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto scrollbar-none px-4 pb-1">
            {seasons.map((s) => (
              <li key={s.year} className="w-[82%] shrink-0 snap-start sm:w-[60%]">
                <MediaCard
                  src={s.cover}
                  alt={`Temporada ${s.year}`}
                  label={String(s.year)}
                  aspect={16 / 9}
                  badge={s.position}
                  title={s.title}
                  description={s.tagline}
                  meta={`Capitán: ${s.captain} · Goleador: ${s.topScorer}`}
                  variant="outline"
                  onClick={() => router.push(`/historia/${s.year}`)}
                />
              </li>
            ))}
          </ul>
        </section>

        {/* ── museo ─────────────────────────────────────────────────────── */}
        <section className="flex flex-col gap-4">
          <SectionHeading
            id="museo"
            icon={<TrophyIcon width={18} height={18} />}
            title="El museo"
            hint={`${gallery.length} fotos del archivo. Tocá una para verla en grande.`}
          />
          <Carousel
            images={gallery.map((g) => ({
              src: g.src,
              alt: g.alt,
              caption: `${g.year} · ${g.caption}`,
            }))}
            aspect={16 / 9}
            thumbs
            zoomable
            // Sin autoplay con `prefers-reduced-motion`: un carrusel que avanza
            // solo es exactamente el movimiento que esa preferencia pide evitar.
            autoplay={reduced ? undefined : 4200}
          />
        </section>

        {/* ── video ─────────────────────────────────────────────────────── */}
        <section className="flex flex-col gap-4">
          <SectionHeading
            id="video"
            icon={<BallIcon width={18} height={18} />}
            title="Archivo en video"
            hint="Los clips que se guardaron. En desktop, pasá el mouse para verlos moverse."
          />
          <ClipRail clips={clips} />
        </section>

        {/* ── frases ────────────────────────────────────────────────────── */}
        <section className="flex flex-col gap-4">
          <SectionHeading
            id="frases"
            icon={<QuoteIcon width={18} height={18} />}
            title="Frases célebres"
            hint="Lo que se dijo, y quién lo dijo."
          />
          <ul className="-mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto scrollbar-none px-4 pb-1">
            {quotes.map((q) => (
              <li key={q.id} className="flex w-[86%] shrink-0 snap-start sm:w-[64%]">
                <QuoteBlock
                  text={q.text}
                  author={q.author}
                  role={q.role}
                  year={q.year}
                  avatar={q.avatar}
                  variant="featured"
                />
              </li>
            ))}
          </ul>
        </section>

        {/* ── jugadores ─────────────────────────────────────────────────── */}
        <section className="flex flex-col gap-4">
          <SectionHeading
            id="jugadores"
            icon={<ShirtIcon width={18} height={18} />}
            title="Los que la jugaron"
            hint={`${players.length} trayectorias. Elegí una y está entera: números, skills, carrera, fotos y clips.`}
          />
          <PlayerSpotlight
            players={players}
            initialId={initialPlayer}
            onPick={syncPlayer}
          />
        </section>

        <p className="border-t border-border pt-6 text-center text-sm italic text-muted">
          «{club.motto}» · {club.founded}—{seasons[0]?.year ?? club.founded}
        </p>

        <SafeAreaSpacer edge="bottom" min={8} />
      </div>

      {/* ── elegir cómo se presenta ─────────────────────────────────────── */}
      <BottomSheet
        open={elegirOrientacion}
        onClose={() => setElegirOrientacion(false)}
        title="Modo presentación"
        description="Elegí cómo se acomoda en la pantalla. Se puede cambiar mientras presentás."
        showClose
      >
        <div className="grid grid-cols-2 gap-3">
          <OpcionOrientacion
            orientacion="horizontal"
            titulo="Horizontal"
            detalle="El teléfono acostado. La línea de tiempo corre abajo."
            onClick={presentar}
          />
          <OpcionOrientacion
            orientacion="vertical"
            titulo="Vertical"
            detalle="El teléfono parado. La línea de tiempo baja por el costado."
            onClick={presentar}
          />
        </div>
      </BottomSheet>

      {/* Se monta encima y no reemplazando la pantalla: `/historia` es larga, y
          desmontarla para presentar devolvería al usuario arriba de todo al
          terminar, perdiendo el lugar donde estaba leyendo. */}
      {presentando && (
        <TrayectoriaPresentador
          vinetas={trayectoria}
          orientacionInicial={presentando}
          onSalir={() => setPresentando(null)}
        />
      )}
    </>
  );
}

/** Una de las dos formas de presentar, con su miniatura.
 *
 *  El dibujo no es decorativo: la diferencia entre las dos opciones es dónde
 *  queda la línea de tiempo, y eso se explica peor con una palabra que con un
 *  rectángulo que la muestra. */
function OpcionOrientacion({
  orientacion,
  titulo,
  detalle,
  onClick,
}: {
  orientacion: Orientacion;
  titulo: string;
  detalle: string;
  onClick: (o: Orientacion) => void;
}) {
  const horizontal = orientacion === "horizontal";

  return (
    <button
      type="button"
      onClick={() => onClick(orientacion)}
      className="flex flex-col items-center gap-2 rounded-2xl border border-border p-3 text-center transition-colors hover:border-primary"
    >
      <span
        aria-hidden
        className={`flex items-stretch overflow-hidden rounded-lg border border-border bg-surface-alt ${
          horizontal ? "h-14 w-24 flex-col" : "h-20 w-14 flex-row"
        }`}
      >
        <span className="flex-1" />
        {/* el riel, en el borde que le toca */}
        <span
          className={`flex shrink-0 items-center justify-center bg-primary/20 ${
            horizontal ? "h-3 w-full" : "h-full w-3"
          }`}
        >
          <span className={`rounded-full bg-primary ${horizontal ? "h-1 w-10" : "h-10 w-1"}`} />
        </span>
      </span>

      <span className="text-sm font-semibold">{titulo}</span>
      <span className="text-xs leading-snug text-muted">{detalle}</span>
    </button>
  );
}
