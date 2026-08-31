import type { PlantillaInvitacion } from "@/lib/contenido/types";
import { photoUrl } from "@/lib/media";
import { longDate } from "@/lib/time";

/** La tarjeta de invitación: lo que ve el invitado cuando abre su link.
 *
 *  Se renderiza en dos lugares y tiene que verse **igual** en los dos: en
 *  `/invitacion/:code` (la ruta pública, Server Component) y en la vista previa
 *  del panel, que es cliente y se actualiza mientras se escribe el formulario.
 *  Por eso no lleva `"use client"` ni estado: es una función de sus props.
 *
 *  Y por eso el club llega **por prop** en vez de importar `CLUB` de
 *  `lib/historia`: ese módulo son 1400 líneas de etapas, temporadas y
 *  jugadores, y un import desde la vista previa se las llevaría enteras al
 *  bundle del panel para usar el nombre y el escudo.
 *
 *  Tres plantillas. Cambian el diseño y nada más: los seis datos —a quién,
 *  qué, cuándo, dónde, el mensaje y quién invita— están en las tres. Una
 *  plantilla que esconda campos convierte elegir el estilo en elegir qué
 *  información recibe el invitado, que no es lo mismo.
 */

export interface InvitationCardProps {
  invitado: string;
  titulo: string;
  mensaje: string;
  /** "YYYY-MM-DD" */
  fecha: string;
  /** "HH:mm" */
  hora: string;
  lugar: string;
  plantilla: PlantillaInvitacion;
  club: { name: string; crest: string };
  className?: string;
}

/* ── piezas ──────────────────────────────────────────────────────────────── */

function Crest({ club, size = 56 }: { club: InvitationCardProps["club"]; size?: number }) {
  return (
    /* eslint-disable-next-line @next/next/no-img-element -- data-URI */
    <img
      src={club.crest}
      alt={`Escudo de ${club.name}`}
      width={size}
      height={size}
      className="shrink-0"
      style={{ width: size, height: size }}
    />
  );
}

/** Cuándo y dónde, que es el par que el invitado vuelve a mirar tres veces. */
function Cuando({
  fecha,
  hora,
  lugar,
  muted,
  rule,
}: {
  fecha: string;
  hora: string;
  lugar: string;
  /** clase del texto secundario, distinta en fondo oscuro y en fondo claro */
  muted: string;
  rule: string;
}) {
  return (
    <dl className={`flex flex-col gap-3 border-y py-4 text-sm ${rule}`}>
      <div>
        <dt className={`text-[10px] font-semibold uppercase tracking-widest ${muted}`}>
          Cuándo
        </dt>
        <dd className="mt-0.5 font-semibold first-letter:uppercase">
          {longDate(fecha)} · {hora} h
        </dd>
      </div>
      {lugar && (
        <div>
          <dt className={`text-[10px] font-semibold uppercase tracking-widest ${muted}`}>
            Dónde
          </dt>
          <dd className="mt-0.5 font-semibold">{lugar}</dd>
        </div>
      )}
    </dl>
  );
}

/* ── la tarjeta ──────────────────────────────────────────────────────────── */

export function InvitationCard({
  invitado,
  titulo,
  mensaje,
  fecha,
  hora,
  lugar,
  plantilla,
  club,
  className = "",
}: InvitationCardProps) {
  const box = `relative overflow-hidden rounded-3xl ${className}`;

  /* ── gala: fondo oscuro, todo centrado, tipografía con serifa ──────────── */
  if (plantilla === "gala") {
    return (
      <article
        className={`${box} bg-[linear-gradient(160deg,#0a0a0a_0%,var(--color-primary)_120%)] px-6 py-9 text-center text-white sm:px-10`}
      >
        <span
          aria-hidden
          className="pointer-events-none absolute inset-3 rounded-[1.25rem] border border-white/20"
        />

        <div className="relative flex flex-col items-center gap-6">
          <Crest club={club} size={60} />

          <p className="text-[10px] font-semibold uppercase tracking-[0.3em] text-white/60">
            {club.name} invita a
          </p>

          {/* El nombre del invitado es el punto de toda la tarjeta: es lo único
              que la hace suya y por eso es lo más grande de la composición. */}
          <h1 className="font-serif text-3xl leading-tight text-balance sm:text-4xl">
            {invitado}
          </h1>

          <p className="text-lg font-semibold text-balance">{titulo}</p>

          {mensaje && (
            <p className="max-w-sm text-sm leading-relaxed text-white/80 text-pretty">
              {mensaje}
            </p>
          )}

          <div className="w-full max-w-sm text-left">
            <Cuando
              fecha={fecha}
              hora={hora}
              lugar={lugar}
              muted="text-white/55"
              rule="border-white/20"
            />
          </div>

          <p className="text-[10px] uppercase tracking-[0.25em] text-white/45">
            Invitación personal · no transferible
          </p>
        </div>
      </article>
    );
  }

  /* ── cancha: la foto del estadio de fondo ──────────────────────────────── */
  if (plantilla === "cancha") {
    return (
      <article className={`${box} text-white`}>
        {/* eslint-disable-next-line @next/next/no-img-element -- data-URI */}
        <img
          src={photoUrl(`inv-${plantilla}`)}
          alt=""
          className="absolute inset-0 size-full object-cover"
        />
        {/* El velo no es decorativo: la foto varía de luminosidad por semilla y
            sin él el texto blanco no llega a 4.5:1 en las claras. */}
        <span
          aria-hidden
          className="absolute inset-0 bg-[linear-gradient(to_top,rgba(0,0,0,0.92),rgba(0,0,0,0.6))]"
        />

        <div className="relative flex flex-col gap-5 px-6 py-8 sm:px-8">
          <div className="flex items-center gap-3">
            <Crest club={club} size={44} />
            <span className="text-xs font-semibold uppercase tracking-widest text-white/70">
              {club.name}
            </span>
          </div>

          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.25em] text-white/60">
              Invitación para
            </p>
            <h1 className="mt-1 text-3xl font-bold leading-tight text-balance sm:text-4xl">
              {invitado}
            </h1>
          </div>

          <p className="text-lg font-semibold text-balance">{titulo}</p>

          {mensaje && (
            <p className="text-sm leading-relaxed text-white/85 text-pretty">{mensaje}</p>
          )}

          <Cuando
            fecha={fecha}
            hora={hora}
            lugar={lugar}
            muted="text-white/55"
            rule="border-white/25"
          />
        </div>
      </article>
    );
  }

  /* ── mínima: fondo de la app, borde y aire ─────────────────────────────── */
  return (
    <article
      className={`${box} border border-border bg-surface px-6 py-9 text-foreground sm:px-10`}
    >
      <div className="flex flex-col gap-6">
        <div className="flex items-center justify-between gap-3">
          <span className="text-xs font-semibold uppercase tracking-widest text-muted">
            {club.name}
          </span>
          <Crest club={club} size={40} />
        </div>

        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.25em] text-primary">
            Invitación para
          </p>
          <h1 className="mt-1 text-3xl font-bold leading-tight text-balance sm:text-4xl">
            {invitado}
          </h1>
        </div>

        <p className="text-lg font-semibold text-balance">{titulo}</p>

        {mensaje && (
          <p className="text-sm leading-relaxed text-muted text-pretty">{mensaje}</p>
        )}

        <Cuando
          fecha={fecha}
          hora={hora}
          lugar={lugar}
          muted="text-muted"
          rule="border-border"
        />
      </div>
    </article>
  );
}
