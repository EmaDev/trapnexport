"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import {
  Card,
  Poll,
  ProgressBar,
  Roadmap,
  TabsGlow,
  useSnackbar,
  type PollOption,
  type RoadmapItem,
  type TabItem,
} from "lib-kit-components";

import { ChevronIcon } from "@/components/atoms/icons";
import { CronogramaDia } from "@/components/organisms/CronogramaDia";
import { useAuth } from "@/lib/auth/AuthContext";
import type { Cronograma } from "@/lib/contenido/queries";
import { shortDate } from "@/lib/time";
import {
  EDICION,
  esPremioDeVideo,
  opcionesDe,
  PREMIOS,
  type Premio,
} from "@/lib/trap-awards";

/** Las tres solapas de contenido de campaña que van debajo del carrusel del feed.
 *
 *  `TabsGlow` es **siempre controlado** (`value` + `onChange` son requeridos,
 *  no tiene modo no controlado), así que el estado del tab activo vive acá y no
 *  en `FeedClient`: es estado de este bloque, no de la pantalla.
 *
 *  El cronograma ya no está hardcodeado: llega por prop desde el servidor, del
 *  mismo `getCronograma()` que lee el panel. Es un solo día —el del evento— y
 *  antes acá había un itinerario de tres, inventado, que contradecía a `/admin`
 *  sin que nada avisara. Los otros dos paneles siguen con datos de campaña y
 *  van por el mismo camino cuando existan.
 */

/** Las diecisiete categorías de los Trap Awards, con sus opciones ya armadas.
 *
 *  No se escriben acá: salen de `lib/trap-awards.ts`, el mismo archivo del que
 *  se siembran las encuestas del panel, así que el feed y `/admin` no pueden
 *  discrepar en una pregunta ni en un nombre del plantel.
 *
 *  Los conteos van en cero y nunca se muestran: los resultados se revelan en la
 *  gala, no en el feed. Eso lo hace el `anonymous` del `Poll` en `PremioVotacion`.
 */
const ENCUESTAS = PREMIOS.map((premio) => ({
  premio,
  options: opcionesDe(premio).map(
    (label, i): PollOption => ({ id: `${premio.id}-${i + 1}`, label, votes: 0 }),
  ),
}));

/** Los tres premios que se votan sobre video no cuentan para "te quedan N por
 *  votar": sus opciones son de relleno hasta que estén los clips. */
const VOTABLES = ENCUESTAS.filter(({ premio }) => !esPremioDeVideo(premio));

/** El cuerpo de una categoría: el `Poll` de verdad, con los mismos props que la
 *  vista previa del panel, para que el feed y `/admin` se vean iguales.
 *
 *  Los resultados no se muestran —se revelan en la gala— y eso lo hace
 *  `anonymous`: apaga barras, porcentajes y total, y al votar deja el mensaje
 *  de confirmación en lugar de la lista. `allowChangeVote` deja volver a votar
 *  desde esa tarjeta.
 *
 *  `allowChangeVote` dibuja **dos** "Cambiar voto": uno en la tarjeta de
 *  confirmación y otro, violeta, en el pie. El del pie es redundante y no hay
 *  prop para apagarlo, así que se oculta con un selector acotado al botón
 *  `text-primary` del `<footer>` del `Poll` (no toca el "Cancelar", que es
 *  `text-muted`).
 *
 *  Los premios de video son la excepción: no hay `Poll` sino la lista de los
 *  clips que faltan, porque todavía no hay nada para votar.
 */
function PremioVotacion({
  premio,
  options,
  voto,
  onVotar,
}: {
  premio: Premio;
  options: PollOption[];
  voto: string[] | null;
  onVotar: (ids: string[]) => void;
}) {
  if (esPremioDeVideo(premio)) {
    return (
      <>
        <h3 className="text-base font-bold leading-snug">{premio.pregunta}</h3>
        <p className="mt-1.5 text-xs text-muted">
          {premio.descripcion} Se abre cuando estén cargados los videos.
        </p>
        <ul className="mt-3 flex flex-col gap-2">
          {options.map((o) => (
            <li
              key={o.id}
              className="flex h-11 items-center rounded-xl border border-dashed border-border px-3.5 text-sm text-muted"
            >
              {o.label}
            </li>
          ))}
        </ul>
      </>
    );
  }

  const hayMedia = options.some((o) => o.image || o.video);

  return (
    <div className="[&_footer_button.text-primary]:hidden">
      <Poll
        question={premio.pregunta}
        description={premio.descripcion}
        kind={premio.multiple ? "multi" : "single"}
        maxChoices={premio.maxOpciones}
        options={options}
        layout={hayMedia ? "media" : "list"}
        mediaSelector
        voted={voto}
        onVote={onVotar}
        anonymous
        anonymousNote="Los resultados se revelan en la gala: acá no se ve ningún voto."
        allowChangeVote
        changeVoteLabel="Cambiar voto"
      />
    </div>
  );
}

/** Cada categoría va dentro de su propio desplegable animado (transición de
 *  `grid-template-rows`, 0fr → 1fr). Arrancan plegadas —diecisiete `Poll`
 *  abiertos a la vez son varias pantallas— salvo la primera, que abre para que
 *  la solapa no se vea vacía. Cada uno maneja su estado: se pueden tener
 *  varios abiertos.
 */
function PremioFila({
  premio,
  options,
  voto,
  defaultOpen,
  onVotar,
}: {
  premio: Premio;
  options: PollOption[];
  voto: string[] | null;
  defaultOpen: boolean;
  onVotar: (ids: string[]) => void;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const sinVideos = esPremioDeVideo(premio);

  const detalle = sinVideos
    ? "Se abre cuando estén los videos"
    : voto
      ? "Votado"
      : `${options.length} ${options.length === 1 ? "opción" : "opciones"}`;

  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-surface">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-surface-alt"
      >
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-semibold">{premio.nombre}</span>
          <span className="block truncate text-xs text-muted">{detalle}</span>
        </span>

        {voto && !sinVideos && (
          <span className="shrink-0 rounded-full bg-success/10 px-2 py-0.5 text-[11px] font-semibold text-success">
            Votado
          </span>
        )}

        <ChevronIcon
          className={`size-4 shrink-0 text-muted transition-transform duration-200 ${
            open ? "-rotate-90" : "rotate-90"
          }`}
        />
      </button>

      <div
        className={`grid transition-[grid-template-rows] duration-200 ease-out ${
          open ? "grid-rows-[1fr]" : "grid-rows-[0fr]"
        }`}
      >
        <div className="overflow-hidden">
          <div className="border-t border-border p-3">
            <PremioVotacion
              premio={premio}
              options={options}
              voto={voto}
              onVotar={onVotar}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

const CRONOGRAMA: RoadmapItem[] = [
  {
    id: "beta",
    title: "Beta cerrada",
    description: "Primer grupo de cuentas invitadas, feed y comentarios andando.",
    quarter: "Q3 2026",
    status: "shipped",
  },
  {
    id: "moderacion",
    title: "Panel de moderación",
    description: "Reportes, suspensión de cuentas y publicaciones ocultas.",
    quarter: "Q3 2026",
    status: "shipped",
  },
  {
    id: "lanzamiento",
    title: "Lanzamiento público",
    description: "Registro abierto para todos, sin invitación.",
    quarter: "Q4 2026",
    status: "in-progress",
  },
  {
    id: "push",
    title: "Notificaciones push",
    description: "Avisos en el teléfono con la app instalada.",
    quarter: "Q4 2026",
    status: "in-progress",
  },
  {
    id: "grupos",
    title: "Mensajes de grupo",
    description: "Conversaciones de más de dos personas.",
    quarter: "Q1 2027",
    status: "planned",
  },
];

/** Fechas absolutas, no `Date.now() - N`: este módulo se evalúa una vez en el
 *  servidor y otra en el navegador, con relojes distintos. Una fecha relativa
 *  calculada al importar puede formatearse distinto en cada lado y romper la
 *  hidratación justo al cruzar la medianoche. */
const NOTICIAS: { id: string; title: string; at: string; summary: string }[] = [
  {
    id: "n-1",
    title: "Ya se puede reservar tu nombre de usuario",
    at: "2026-08-17",
    summary:
      "Hasta el lanzamiento, cada cuenta invitada puede reservar un handle y guardarlo.",
  },
  {
    id: "n-2",
    title: "El panel de moderación entró en producción",
    at: "2026-08-10",
    summary:
      "Reportes, cuentas suspendidas y publicaciones ocultas, con el mismo origen de datos que el feed.",
  },
  {
    id: "n-3",
    title: "Cómo va a funcionar la beta cerrada",
    at: "2026-07-29",
    summary:
      "Invitaciones por tandas, sin lista de espera pública y con un canal directo para reportar bugs.",
  },
];

export function FeedTabs({ cronograma }: { cronograma: Cronograma }) {
  const { snack } = useSnackbar();
  const router = useRouter();
  const { account } = useAuth();
  const [tab, setTab] = useState<string>("encuesta");

  // Sin backend de encuestas, el voto vive en la pantalla. Los conteos se
  // guardan por encuesta y se le suma el voto propio a la opción elegida: si
  // no, quien vota ve su barra un voto corta y parece que no se registró.
  // Lo único que se guarda del voto es qué eligió cada uno. No hay contadores
  // acá: como los resultados no se muestran, sumarlos sería estado muerto.
  const [answers, setAnswers] = useState<Record<string, string[]>>({});

  const total = VOTABLES.length;
  const answered = VOTABLES.filter((e) => answers[e.premio.id]).length;
  const pending = total - answered;

  const vote = (premioId: string, ids: string[]) => {
    // Se ve el feed sin sesión, pero votar no: sin esto `onVote` guardaría el
    // voto igual y recién al refrescar se notaría que nunca se registró.
    if (!account) {
      snack({
        message: "Necesitás iniciar sesión para votar",
        variant: "neutral",
        action: { label: "Ingresar", onClick: () => router.push("/login") },
      });
      return;
    }

    setAnswers((prev) => ({ ...prev, [premioId]: ids }));

    // Cuántos quedan después de este voto. Se recalcula sobre `answers` más el
    // premio recién votado: re-votar uno ya contestado (con `allowChangeVote`)
    // no descuenta de más.
    const contestados = new Set(Object.keys(answers));
    contestados.add(premioId);
    const quedan = VOTABLES.filter((e) => !contestados.has(e.premio.id)).length;

    snack({
      message:
        quedan === 0
          ? "Listo, votaste todos los premios"
          : `Voto registrado · te ${quedan === 1 ? "queda 1 premio" : `quedan ${quedan} premios`}`,
      variant: "success",
    });
  };

  // El badge del tab se esconde con `undefined`, nunca con 0: `TabItem.badge`
  // es `string | number` y un 0 se dibuja como un badge con un "0" adentro.
  const tabs: TabItem[] = useMemo(
    () => [
      { id: "encuesta", label: "Premios", badge: pending || undefined },
      { id: "cronograma", label: "Cronograma" },
      { id: "noticias", label: "Noticias" },
    ],
    [pending],
  );

  return (
    <TabsGlow
      items={tabs}
      value={tab}
      onChange={setTab}
      size="md"
      panels={{
        encuesta: (
          <div className="flex flex-col gap-4">
            {/* Barra de estado: cuántas encuestas quedan por responder.
                `segments={total}` en vez de una barra continua porque son
                unidades enteras — media encuesta no existe, y un relleno a
                mitad de camino diría lo contrario. */}
            <Card variant="outline" padding="md">
              <ProgressBar
                value={answered}
                max={total}
                segments={total}
                size="sm"
                tone={pending === 0 ? "success" : "primary"}
                label={
                  pending === 0
                    ? "Votaste todos los premios"
                    : `Te ${pending === 1 ? "queda 1 premio" : `quedan ${pending} premios`} por votar`
                }
              />
              <p className="mt-2 text-xs text-muted">
                {EDICION.titulo} · {EDICION.subtitulo} — {answered} de {total} votados
              </p>
            </Card>

            <ul className="flex flex-col gap-3">
              {ENCUESTAS.map(({ premio, options }, i) => (
                <li key={premio.id}>
                  <PremioFila
                    premio={premio}
                    options={options}
                    voto={answers[premio.id] ?? null}
                    defaultOpen={i === 0}
                    onVotar={(ids) => vote(premio.id, ids)}
                  />
                </li>
              ))}
            </ul>
          </div>
        ),

        cronograma: (
          <div className="flex flex-col gap-6">
            <Card variant="outline" padding="md">
              <p className="text-xs font-medium uppercase tracking-wide text-muted">
                {EDICION.titulo} · {EDICION.subtitulo}
              </p>
              <h3 className="mt-0.5 text-lg font-semibold capitalize">
                {cronograma.fechaLarga}
              </h3>

              {/* El mismo `CronogramaDia` que el panel, con los mismos datos:
                  el día es uno solo y no puede leerse distinto según la
                  pantalla. Sin `onEventoClick` las filas son texto — acá el
                  cronograma se lee, no se edita. */}
              <CronogramaDia
                eventos={cronograma.eventos}
                className="mt-3"
                vacio={
                  <p className="py-6 text-center text-sm text-muted">
                    Todavía no hay horarios publicados.
                  </p>
                }
              />
            </Card>

            {/* El cronograma es el detalle hora a hora del día del evento; el
                roadmap de abajo es otra escala —qué pasa después del
                lanzamiento— y por eso conviven en vez de repetirse. */}
            <section className="flex flex-col gap-3">
              <h3 className="text-sm font-semibold uppercase tracking-wide text-muted">
                Después del lanzamiento
              </h3>
              <Roadmap items={CRONOGRAMA} />
            </section>
          </div>
        ),

        noticias: (
          <ul className="flex flex-col gap-3">
            {NOTICIAS.map((n) => (
              <li key={n.id}>
                <Card variant="outline" padding="md">
                  <p className="text-xs font-medium uppercase tracking-wide text-muted">
                    {shortDate(new Date(`${n.at}T12:00:00`))}
                  </p>
                  <h3 className="mt-1 font-semibold">{n.title}</h3>
                  <p className="mt-1 text-sm text-muted">{n.summary}</p>
                </Card>
              </li>
            ))}
          </ul>
        ),
      }}
    />
  );
}
