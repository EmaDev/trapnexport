import Link from "next/link";
import { Card, StatCard } from "lib-kit-components";

import {
  CalendarIcon,
  NewsIcon,
  PollIcon,
  ShieldIcon,
  TicketIcon,
  UsersIcon,
} from "@/components/atoms/icons";
import { requireAdmin } from "@/lib/admin/auth";
import { getCuentasStats } from "@/lib/admin/cuentas";
import { getContenidoStats, getProximosEventos } from "@/lib/contenido/queries";
import { TIPO_EVENTO } from "@/lib/contenido/types";
import { getHistoriaStats } from "@/lib/historia/queries";
import { getAdminStats } from "@/lib/social/queries";
import { PageHeading } from "./PageHeading";

export const metadata = { title: "Panel" };

/** Los accesos rápidos, que son las secciones de contenido.
 *
 *  El orden no es alfabético: es el de uso. Noticias y encuestas se cargan
 *  todas las semanas; invitaciones y cronograma, por evento; la historia del
 *  club, de vez en cuando y en tandas largas — por eso va última. */
const ACCESOS = [
  {
    href: "/admin/noticias",
    label: "Noticias",
    icon: <NewsIcon width={22} height={22} />,
    hint: "Cargar, editar y publicar noticias del club.",
  },
  {
    href: "/admin/encuestas",
    label: "Encuestas",
    icon: <PollIcon width={22} height={22} />,
    hint: "Preguntas con opciones, abiertas o cerradas.",
  },
  {
    href: "/admin/invitaciones",
    label: "Invitaciones",
    icon: <TicketIcon width={22} height={22} />,
    hint: "Generar un link con una tarjeta a nombre del invitado.",
  },
  {
    href: "/admin/cronograma",
    label: "Cronograma",
    icon: <CalendarIcon width={22} height={22} />,
    hint: "El programa del día del evento, hora por hora.",
  },
  {
    href: "/admin/historia",
    label: "Historia",
    icon: <ShieldIcon width={22} height={22} />,
    hint: "Las siete secciones de /historia: club, etapas, temporadas, jugadores y archivo.",
  },
] as const;

export default async function AdminHomePage() {
  await requireAdmin();

  const [stats, cuentas, contenido, proximos, historia] = await Promise.all([
    getAdminStats(),
    getCuentasStats(),
    getContenidoStats(),
    getProximosEventos(4),
    getHistoriaStats(),
  ]);

  /** El contador que va debajo del nombre de cada acceso rápido. Es lo que
   *  convierte una grilla de links en un panel: "3 noticias · 1 borrador" dice
   *  si hay algo pendiente sin entrar a la sección. */
  const contadores: Record<string, string> = {
    "/admin/noticias": `${contenido.noticias} en total · ${contenido.noticiasBorrador} en borrador`,
    "/admin/encuestas": `${contenido.encuestasAbiertas} abiertas · ${contenido.votos} votos`,
    "/admin/invitaciones": `${contenido.invitacionesActivas} activas de ${contenido.invitaciones}`,
    "/admin/cronograma": `${contenido.diaEvento} · ${contenido.eventosProximos} de ${contenido.eventos} por venir`,
    "/admin/historia": `${historia.etapas} etapas · ${historia.temporadas} temporadas · ${historia.jugadores} jugadores`,
  };

  return (
    <>
      <PageHeading
        title="Panel"
        description="Los usuarios registrados y el acceso a todo lo que se carga desde acá."
      />

      {/* ── usuarios registrados ─────────────────────────────────────────── */}
      <section className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
        {/* El número que preside el panel va en una card propia y no como una
            `StatCard` más de la fila: en una grilla de cuatro iguales,
            "usuarios registrados" es una de cuatro. Acá es el título.

            ⚠️ No usa `Card variant="gradient"`: ese variant de la librería es un
            tinte al 10% (`from-primary/[0.10] … to-transparent`) pensado para
            texto oscuro, y el blanco encima queda en ~1.3:1. El degradé va
            explícito sobre las CSS vars, igual que en el hero de `/historia`,
            para que también siga al tema en oscuro. */}
        <div className="rounded-2xl bg-[linear-gradient(135deg,var(--color-primary),var(--color-accent))] p-6">
          <div className="flex h-full flex-col justify-between gap-4 text-white">
            <div className="flex items-center gap-2 text-sm font-medium text-white/80">
              <UsersIcon width={18} height={18} />
              Usuarios registrados
            </div>
            <div>
              <p className="text-5xl font-bold leading-none tabular-nums">
                {cuentas.total.toLocaleString("es-AR")}
              </p>
              <p className="mt-2 text-sm text-white/80">
                {cuentas.suspendidas > 0
                  ? `${cuentas.suspendidas} suspendidas`
                  : "Ninguna suspendida"}
              </p>
              {/* El único número del panel que significa "hay algo que hacer".
                  Una solicitud sin resolver deja a una persona sin poder usar
                  su cuenta y a un jugador bloqueado para quien sí sea, así que
                  no puede quedar escondida adentro de otra pantalla. */}
              {cuentas.pendientes > 0 && (
                <p className="mt-3 inline-flex items-center gap-2 rounded-full bg-white/20 px-3 py-1 text-sm font-semibold">
                  {cuentas.pendientes}{" "}
                  {cuentas.pendientes === 1
                    ? "vínculo por autorizar"
                    : "vínculos por autorizar"}
                </p>
              )}
            </div>
            <Link
              href="/admin/usuarios"
              className="text-sm font-semibold text-white underline underline-offset-4"
            >
              Administrar cuentas
            </Link>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <StatCard
            label="Publicaciones"
            value={stats.posts}
            footnote={`${stats.ocultos} ocultas`}
            tone="accent"
            spark={stats.postsPorDia}
          />
          <StatCard label="Comentarios" value={stats.comentarios} tone="neutral" />
          <StatCard
            label="Noticias publicadas"
            value={contenido.noticias - contenido.noticiasBorrador}
            footnote={`${contenido.noticiasBorrador} en borrador`}
            tone="primary"
          />
        </div>
      </section>

      {/* ── accesos rápidos ─────────────────────────────────────────────── */}
      <section className="mt-8">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted">
          Accesos rápidos
        </h2>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {ACCESOS.map((a) => (
            <Link key={a.href} href={a.href} className="group">
              <Card variant="outline" padding="lg" interactive>
                <span className="grid size-11 place-items-center rounded-xl bg-primary/10 text-primary transition-colors group-hover:bg-primary group-hover:text-white">
                  {a.icon}
                </span>
                <h3 className="mt-3 font-semibold">{a.label}</h3>
                <p className="mt-1 text-sm text-muted">{a.hint}</p>
                <p className="mt-3 text-xs font-medium text-primary">
                  {contadores[a.href]}
                </p>
              </Card>
            </Link>
          ))}
        </div>
      </section>

      {/* ── lo que viene ─────────────────────────────────────────────────── */}
      <section className="mt-8">
        <Card variant="outline" padding="lg">
          <div className="mb-3 flex items-center justify-between gap-3">
            <div className="min-w-0">
              <h2 className="font-semibold">Lo que viene</h2>
              {/* El día va en el encabezado y no en cada fila: el cronograma es
                  de un solo día, y repetir la fecha cuatro veces no informa. */}
              <p className="text-xs text-muted">{contenido.diaEvento}</p>
            </div>
            <Link href="/admin/cronograma" className="text-sm font-medium text-primary">
              Ver cronograma
            </Link>
          </div>

          {proximos.length === 0 ? (
            <p className="text-sm text-muted">No hay eventos cargados a futuro.</p>
          ) : (
            <ul className="flex flex-col divide-y divide-border">
              {proximos.map((e) => (
                <li key={e.id} className="flex items-start gap-3 py-2.5">
                  <span
                    aria-hidden
                    className={`mt-1.5 size-2.5 shrink-0 rounded-full ${
                      {
                        primary: "bg-primary",
                        success: "bg-success",
                        accent: "bg-accent",
                        muted: "bg-muted",
                        danger: "bg-danger",
                      }[TIPO_EVENTO[e.tipo].color]
                    }`}
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{e.nombre}</p>
                    <p className="text-xs text-muted">
                      {e.horario}
                      {e.lugar && ` · ${e.lugar}`}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </section>
    </>
  );
}
