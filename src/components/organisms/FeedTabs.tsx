"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import {
  Card,
  Poll,
  ProgressBar,
  TabsGlow,
  useSnackbar,
  type PollOption,
  type TabItem,
} from "lib-kit-components";

import { ChevronIcon } from "@/components/atoms/icons";
import { CronogramaDia } from "@/components/organisms/CronogramaDia";
import { useAuth } from "@/lib/auth/AuthContext";
import type {
  Cronograma,
  EncuestaFeedVM,
  NoticiaFeedVM,
} from "@/lib/contenido/queries";
import { votarEncuesta } from "@/lib/contenido/voto";
import { EDICION, PREMIOS } from "@/lib/trap-awards";

/** Las tres solapas de contenido de campaña que van debajo del carrusel del feed.
 *
 *  `TabsGlow` es **siempre controlado** (`value` + `onChange` son requeridos,
 *  no tiene modo no controlado), así que el estado del tab activo vive acá y no
 *  en `FeedClient`: es estado de este bloque, no de la pantalla.
 *
 *  Las tres solapas —premios, cronograma y noticias— salen del servidor, de las
 *  mismas colecciones de Firestore que edita `/admin`. Antes había acá tres
 *  listas hardcodeadas que contradecían al panel sin que nada avisara.
 */

/** El nombre del premio y su tope de opciones no están en el documento de la
 *  encuesta: viven en `lib/trap-awards.ts`, el mismo archivo del que se sembró
 *  la colección, y se cruzan por id —igual que hace `/admin/presentacion`—. Una
 *  encuesta cargada a mano desde el panel no está acá: cae al `pregunta` como
 *  nombre y sin tope. */
const PREMIO_POR_ID = new Map(PREMIOS.map((p) => [p.id, p]));

type Categoria = EncuestaFeedVM & {
  /** el nombre del premio, o la pregunta si no hay premio asociado */
  nombre: string;
  /** tope de opciones cuando es `multiple` (el once ideal son once) */
  maxOpciones?: number;
};

/** Una URL http(s) a secas: es lo que habilita el preview de la media. */
const esUrl = (s: string) => /^https?:\/\/\S+$/i.test(s.trim());
/** Distingue video de imagen por la extensión de la URL. */
const esVideo = (url: string) => /\.(mp4|webm|ogg|mov|m4v)(\?|#|$)/i.test(url.trim());

/** Una opción de encuesta → `PollOption`, con la media en `image`/`video`
 *  cuando la URL es válida. Los conteos van en cero y nunca se muestran: los
 *  resultados se revelan en la gala (lo hace `anonymous` en el `Poll`). */
const aPollOption = (o: { id: string; texto: string; media?: string }): PollOption => {
  const media = o.media?.trim();
  return {
    id: o.id,
    label: o.texto || media?.split(/[/?#]/).filter(Boolean).pop() || "Opción",
    votes: 0,
    ...(media && esUrl(media)
      ? esVideo(media)
        ? { video: media }
        : { image: media }
      : {}),
  };
};

/** El cuerpo de una categoría.
 *
 *  Si todavía no está abierta (`proximamente`) se muestra la lista de opciones
 *  en gris, sin `Poll` — típico de los premios de video mientras no hay clips.
 *  Si está abierta, el `Poll` real con los mismos props que la vista previa del
 *  panel: `anonymous` apaga barras, porcentajes y total, y `allowChangeVote`
 *  deja volver a votar. El "Cambiar voto" violeta del pie es redundante y no
 *  tiene prop para apagarlo, así que se oculta con un selector acotado.
 */
function CategoriaVotacion({
  categoria,
  voto,
  onVotar,
}: {
  categoria: Categoria;
  voto: string[] | null;
  onVotar: (ids: string[]) => void | Promise<void>;
}) {
  if (categoria.proximamente) {
    return (
      <>
        <h3 className="text-base font-bold leading-snug">{categoria.pregunta}</h3>
        <p className="mt-1.5 text-xs text-muted">
          {categoria.descripcion ? `${categoria.descripcion} ` : ""}Se abre cuando la
          votación esté disponible.
        </p>
        <ul className="mt-3 flex flex-col gap-2">
          {categoria.opciones.map((o) => (
            <li
              key={o.id}
              className="flex h-11 items-center rounded-xl border border-dashed border-border px-3.5 text-sm text-muted"
            >
              {o.texto || "Opción sin texto"}
            </li>
          ))}
        </ul>
      </>
    );
  }

  const options = categoria.opciones.map(aPollOption);
  const hayMedia = options.some((o) => o.image || o.video);

  return (
    <div className="[&_footer_button.text-primary]:hidden">
      <Poll
        question={categoria.pregunta}
        description={categoria.descripcion}
        kind={categoria.multiple ? "multi" : "single"}
        maxChoices={categoria.maxOpciones}
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
 *  `grid-template-rows`, 0fr → 1fr). Arrancan plegadas —muchos `Poll` abiertos
 *  a la vez son varias pantallas— salvo la primera, que abre para que la solapa
 *  no se vea vacía. Cada uno maneja su estado: se pueden tener varios abiertos.
 */
function CategoriaFila({
  categoria,
  voto,
  defaultOpen,
  onVotar,
  intento,
}: {
  categoria: Categoria;
  voto: string[] | null;
  defaultOpen: boolean;
  onVotar: (ids: string[]) => void | Promise<void>;
  /** Sube de a uno cada vez que el servidor rechaza un voto de esta categoría.
   *  Va de `key` en el `<Poll>`: un voto bloqueado —sin sesión, votación
   *  cerrada— lo remonta y le borra el "Votado" que se pinta solo. */
  intento: number;
}) {
  const [open, setOpen] = useState(defaultOpen);

  const detalle = categoria.proximamente
    ? "Se abre cuando esté disponible"
    : voto
      ? "Votado"
      : `${categoria.opciones.length} ${
          categoria.opciones.length === 1 ? "opción" : "opciones"
        }`;

  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-surface">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-surface-alt"
      >
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-semibold">{categoria.nombre}</span>
          <span className="block truncate text-xs text-muted">{detalle}</span>
        </span>

        {voto && !categoria.proximamente && (
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
            <CategoriaVotacion
              key={intento}
              categoria={categoria}
              voto={voto}
              onVotar={onVotar}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

export function FeedTabs({
  cronograma,
  encuestas,
  noticias,
}: {
  cronograma: Cronograma;
  encuestas: EncuestaFeedVM[];
  noticias: NoticiaFeedVM[];
}) {
  const { snack } = useSnackbar();
  const router = useRouter();
  const { user, account } = useAuth();
  const [tab, setTab] = useState<string>("encuesta");

  // Qué votó cada uno. Arranca con lo que ya sabía el servidor (`encuesta.voto`,
  // de `trapnexport-encuesta/{id}/voto/{uid}`) y no vacío: si no, recargar la
  // página perdía el "Votado" aunque el voto siguiera en Firestore, y volver a
  // elegir no sumaba de más —eso lo evita el dedupe de `votarEncuesta`— pero sí
  // volvía a pedir votar algo ya votado. Se manda el voto anterior a
  // `votarEncuesta` para que cambiar de opción reste de la vieja.
  const [answers, setAnswers] = useState<Record<string, string[]>>(() =>
    Object.fromEntries(
      encuestas.filter((e) => e.voto).map((e) => [e.id, e.voto as string[]]),
    ),
  );

  // Contador de rechazos por encuesta. `vote` lo sube cuando el servidor no toma
  // el voto (sin sesión, votación cerrada); `CategoriaFila` lo usa de `key` para
  // remontar el `<Poll>`, que marca "Votado" en su estado interno apenas se
  // hace clic —antes de saber si entró— y no se revierte solo.
  const [rechazos, setRechazos] = useState<Record<string, number>>({});
  const rechazar = (encuestaId: string) =>
    setRechazos((prev) => ({ ...prev, [encuestaId]: (prev[encuestaId] ?? 0) + 1 }));

  const categorias: Categoria[] = useMemo(
    () =>
      encuestas.map((e) => {
        const premio = PREMIO_POR_ID.get(e.id);
        return {
          ...e,
          nombre: premio?.nombre ?? e.pregunta,
          maxOpciones: e.multiple ? premio?.maxOpciones : undefined,
        };
      }),
    [encuestas],
  );

  const votables = categorias.filter((c) => !c.proximamente);
  const total = votables.length;
  const answered = votables.filter((c) => answers[c.id]).length;
  const pending = total - answered;

  const vote = async (encuestaId: string, ids: string[]) => {
    // Se ve el feed sin sesión, pero votar no. El chequeo también está en la
    // Server Action —es un endpoint POST y no alcanza con esconder el botón—;
    // acá se corta antes para no pegarle al servidor y para mostrar el "Ingresar".
    if (!account || !user) {
      rechazar(encuestaId);
      snack({
        message: "Necesitás iniciar sesión para votar",
        variant: "neutral",
        action: { label: "Ingresar", onClick: () => router.push("/login") },
      });
      return;
    }

    const previos = answers[encuestaId] ?? [];
    setAnswers((prev) => ({ ...prev, [encuestaId]: ids }));

    // Sin token ni voto anterior: los dos los pone el servidor. Quién vota sale
    // de la cookie de sesión, y qué había votado antes sale de su documento en
    // `trapnexport-encuesta/{id}/voto/{uid}` — mandarlo desde acá era pedirle al
    // navegador un dato que se pierde al recargar y que se puede falsear.
    const r = await votarEncuesta(encuestaId, ids);
    if (!r.ok) {
      rechazar(encuestaId);
      // Revertir al voto que había antes: si no, la tarjeta muestra "Votado"
      // sobre algo que el servidor no registró.
      setAnswers((prev) => {
        const next = { ...prev };
        if (previos.length) next[encuestaId] = previos;
        else delete next[encuestaId];
        return next;
      });
      snack({ message: r.error, variant: "error" });
      return;
    }

    const contestados = new Set(Object.keys(answers));
    contestados.add(encuestaId);
    const quedan = votables.filter((c) => !contestados.has(c.id)).length;

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
            {categorias.length === 0 ? (
              <Card variant="outline" padding="md">
                <p className="py-4 text-center text-sm text-muted">
                  Todavía no hay votaciones abiertas.
                </p>
              </Card>
            ) : (
              <>
                {/* Barra de estado: cuántas encuestas quedan por responder.
                    `segments={total}` en vez de una barra continua porque son
                    unidades enteras — media encuesta no existe. */}
                {total > 0 && (
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
                )}

                <ul className="flex flex-col gap-3">
                  {categorias.map((categoria, i) => (
                    <li key={categoria.id}>
                      <CategoriaFila
                        categoria={categoria}
                        voto={answers[categoria.id] ?? null}
                        defaultOpen={i === 0}
                        intento={rechazos[categoria.id] ?? 0}
                        onVotar={(ids) => vote(categoria.id, ids)}
                      />
                    </li>
                  ))}
                </ul>
              </>
            )}
          </div>
        ),

        cronograma: (
          <Card variant="outline" padding="md">
            <p className="text-xs font-medium uppercase tracking-wide text-muted">
              {EDICION.titulo} · {EDICION.subtitulo}
            </p>
            <h3 className="mt-0.5 text-lg font-semibold capitalize">
              {cronograma.fechaLarga}
            </h3>

            {/* El mismo `CronogramaDia` que el panel, con los mismos datos: el
                día es uno solo y no puede leerse distinto según la pantalla. Sin
                `onEventoClick` las filas son texto — acá el cronograma se lee. */}
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
        ),

        noticias:
          noticias.length === 0 ? (
            <Card variant="outline" padding="md">
              <p className="py-4 text-center text-sm text-muted">
                Todavía no hay noticias publicadas.
              </p>
            </Card>
          ) : (
            <ul className="flex flex-col gap-3">
              {noticias.map((n) => (
                <li key={n.id}>
                  <Card variant="outline" padding="md">
                    <p className="text-xs font-medium uppercase tracking-wide text-muted">
                      {n.fecha} · {n.autor}
                    </p>
                    <h3 className="mt-1 font-semibold">{n.titulo}</h3>
                    <p className="mt-1 text-sm text-muted">{n.copete}</p>
                  </Card>
                </li>
              ))}
            </ul>
          ),
      }}
    />
  );
}
