"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  AppHeader,
  Card,
  Carousel,
  SafeAreaSpacer,
  StatCard,
  usePrefersReducedMotion,
} from "lib-kit-components";

import { ShirtIcon, TrophyIcon } from "@/components/atoms/icons";
import { ClipRail } from "@/components/organisms/ClipCard";
import { KindChip } from "@/components/organisms/EraTimeline";
import { QuoteBlock } from "@/components/organisms/QuoteBlock";
import type { Player, Season } from "@/lib/historia";

/** Una temporada en detalle: la tabla, los hitos, las fotos, los clips y los
 *  jugadores que la marcaron.
 *
 *  Pantalla empujada desde `/historia`, con `AppHeader` y botón de volver — no
 *  `AppHeaderCardSlot`, que es de pantalla raíz y no es sticky. El `BottomNav`
 *  sigue visible: sólo la conversación de chat lo esconde, y el tab activo lo
 *  resuelve el shell por prefijo de sección (`/historia/2024` → Historia).
 *
 *  El salón de la temporada no linkea a `/u/:handle`: los jugadores del club
 *  son contenido editorial y no cuentas de la red social, así que el link
 *  correcto es a su ficha, `?jugador=` de `/historia`.
 */
export function YearClient({
  season,
  hallOfFame,
  prev,
  next,
}: {
  season: Season;
  /** el salón ya resuelto: la página cambia `playerId` por el jugador entero */
  hallOfFame: { player: Player; reason: string }[];
  prev: number | null;
  next: number | null;
}) {
  const router = useRouter();
  const reduced = usePrefersReducedMotion();

  return (
    <>
      <AppHeader
        title={String(season.year)}
        subtitle={season.title}
        onBack={() => router.push("/historia")}
        backLabel="Volver a la historia del club"
        variant="blur"
        sticky
      />

      <div className="mx-auto flex w-full max-w-xl flex-col gap-6 px-4 py-4">
        {/* ── portada ───────────────────────────────────────────────────── */}
        <div className="relative overflow-hidden rounded-2xl border border-border">
          {/* eslint-disable-next-line @next/next/no-img-element -- data-URI */}
          <img
            src={season.cover}
            alt={`Temporada ${season.year}`}
            className="block aspect-video w-full object-cover"
          />
          <div className="absolute inset-0 bg-[linear-gradient(to_top,rgba(0,0,0,0.8),transparent_60%)]" />
          <div className="absolute inset-x-4 bottom-3">
            <p className="text-[11px] font-semibold uppercase tracking-widest text-white/75">
              {season.competition}
            </p>
            <p className="mt-0.5 text-lg font-bold text-white">{season.position}</p>
          </div>
        </div>

        <p className="text-base">{season.tagline}</p>

        <section className="grid grid-cols-3 gap-3">
          {season.stats.map((s) => (
            <StatCard key={s.label} label={s.label} value={s.value} tone="primary" />
          ))}
        </section>

        {/* Capitán y goleador van en una card y no en `stats`: son nombres, no
            números, y `StatCard` los corta con `tabular-nums` a tres letras. */}
        <Card variant="outline" padding="md">
          <dl className="grid grid-cols-2 gap-3 text-sm">
            <div className="min-w-0">
              <dt className="text-xs uppercase tracking-wide text-muted">Capitán</dt>
              <dd className="mt-0.5 truncate font-semibold">{season.captain}</dd>
            </div>
            <div className="min-w-0">
              <dt className="text-xs uppercase tracking-wide text-muted">Goleador</dt>
              <dd className="mt-0.5 truncate font-semibold">{season.topScorer}</dd>
            </div>
          </dl>
        </Card>

        {/* ── hitos ─────────────────────────────────────────────────────── */}
        <section className="flex flex-col gap-3">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">
            Lo que pasó
          </h2>

          <ol className="flex flex-col gap-3">
            {season.highlights.map((h) => (
              <li key={h.id}>
                <Card variant="outline" padding="md">
                  <div className="flex flex-wrap items-center gap-2">
                    <KindChip kind={h.kind} />
                    <p className="text-xs font-medium uppercase tracking-wide text-primary">
                      {h.month}
                    </p>
                  </div>
                  <h3 className="mt-1.5 font-semibold">{h.title}</h3>
                  <p className="mt-1 text-sm text-muted">{h.description}</p>
                </Card>
              </li>
            ))}
          </ol>
        </section>

        {/* ── fotos ─────────────────────────────────────────────────────── */}
        {season.gallery.length > 0 && (
          <section className="flex flex-col gap-3">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">
              Fotos de la temporada
            </h2>
            <Carousel
              images={season.gallery.map((g) => ({
                src: g.src,
                alt: g.alt,
                caption: g.caption,
              }))}
              aspect={16 / 9}
              thumbs
              zoomable
              autoplay={reduced ? undefined : 4600}
            />
          </section>
        )}

        {/* ── clips ─────────────────────────────────────────────────────── */}
        {season.clips.length > 0 && (
          <section className="flex flex-col gap-3">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">
              Clips
            </h2>
            <ClipRail clips={season.clips} />
          </section>
        )}

        {/* ── la frase ──────────────────────────────────────────────────── */}
        {season.quote && (
          <QuoteBlock
            text={season.quote.text}
            author={season.quote.author}
            role={season.quote.role}
            year={season.quote.year}
            avatar={season.quote.avatar}
            variant="featured"
          />
        )}

        {/* ── salón de la temporada ─────────────────────────────────────── */}
        {hallOfFame.length > 0 && (
        <section className="flex flex-col gap-3">
          <h2 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-muted">
            <TrophyIcon width="1.1em" height="1.1em" className="text-accent" />
            Los del año {season.year}
          </h2>

          <ul className="flex flex-col gap-3">
            {hallOfFame.map(({ player, reason }) => (
              <li key={player.id}>
                <Card variant="outline" padding="md">
                  <div className="flex items-start gap-3">
                    {/* eslint-disable-next-line @next/next/no-img-element -- data-URI */}
                    <img src={player.avatar} alt="" className="size-11 shrink-0 rounded-full" />
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold">
                        {player.name}{" "}
                        <span className="text-sm font-normal text-muted">
                          #{player.number}
                        </span>
                      </p>
                      <p className="text-sm text-muted">{player.position}</p>
                      <p className="mt-1 text-sm">{reason}</p>
                      <Link
                        href={`/historia?jugador=${player.id}`}
                        className="mt-2 inline-flex items-center gap-1.5 text-sm font-medium text-primary"
                      >
                        <ShirtIcon width={14} height={14} />
                        Ver su trayectoria
                      </Link>
                    </div>
                  </div>
                </Card>
              </li>
            ))}
          </ul>
        </section>
        )}

        {/* Navegación entre temporadas: sin esto, recorrer la historia obliga a
            volver a la pantalla principal en cada salto. */}
        <nav className="flex items-center justify-between gap-3 border-t border-border pt-4">
          {prev ? (
            <Link href={`/historia/${prev}`} className="text-sm font-medium text-primary">
              ← {prev}
            </Link>
          ) : (
            <span />
          )}
          {next ? (
            <Link href={`/historia/${next}`} className="text-sm font-medium text-primary">
              {next} →
            </Link>
          ) : (
            <span />
          )}
        </nav>

        <SafeAreaSpacer edge="bottom" min={8} />
      </div>
    </>
  );
}
