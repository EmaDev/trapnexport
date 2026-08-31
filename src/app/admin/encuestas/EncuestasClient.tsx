"use client";

import { useState, useTransition } from "react";
import {
  Button,
  CheckboxGroup,
  DataTable,
  Input,
  Poll,
  Select,
  Switch,
  Textarea,
  useSnackbar,
  type Column,
  type PollOption,
} from "lib-kit-components";

import { ChevronIcon, CloseIcon, PlusIcon } from "@/components/atoms/icons";
import { deleteEncuesta, saveEncuesta, setEncuestaEstado } from "@/lib/contenido/actions";
import type { EncuestaRow } from "@/lib/contenido/queries";
import { ESTADO_ENCUESTA, type EncuestaInput, type OpcionInput } from "@/lib/contenido/types";
import { JUGADORES } from "@/lib/trap-awards";
import { ConfirmDialog, EstadoPill, FormModal, RowMenu } from "../Dialogs";

/** ABM de encuestas.
 *
 *  Dos cosas que no son obvias y están acá a propósito:
 *
 *  1 · Las opciones salen de dos lados que conviven. Lo normal es elegir del
 *      plantel: un desplegable con todos los jugadores y una casilla "Todos".
 *      Lo elegido se guarda con el nombre tal cual —es lo que espera el feed—.
 *      Aparte están las opciones escritas a mano, para lo que no es un jugador
 *      ("Voto en blanco", "Ninguno", una frase) y para videos o imágenes: cada
 *      opción manual puede llevar una URL en `media` y entonces se vota sobre
 *      la imagen o el video, no sobre el texto. Las dos listas se concatenan
 *      en `form.opciones` como `[...jugadores, ...manuales]`.
 *
 *  2 · La vista previa es el mismo `Poll` que ve el socio, en modo resultados.
 *      Es la única forma de ver antes de publicar si la pregunta y las opciones
 *      entran, que es el error más común al cargar una encuesta.
 */

const VACIA: EncuestaInput = {
  pregunta: "",
  descripcion: "",
  opciones: [],
  multiple: false,
  resultadosVisibles: true,
  estado: "borrador",
};

/** Los nombres del plantel, para separar en `form.opciones` lo que es un
 *  jugador de lo que se escribió a mano. El match es por nombre exacto: es lo
 *  que guarda `OpcionEncuesta.texto` y lo que devuelve `opcionesDe` en el feed. */
const NOMBRES_JUGADORES = JUGADORES.map((j) => j.nombre);
const ES_JUGADOR = new Set(NOMBRES_JUGADORES);

/** Una URL http(s) a secas: es lo que habilita el preview de la media. */
const esUrl = (s: string) => /^https?:\/\/\S+$/i.test(s.trim());

/** Distingue video de imagen por la extensión de la URL. Todo lo que no sea un
 *  contenedor de video conocido se trata como imagen. */
const esVideo = (url: string) => /\.(mp4|webm|ogg|mov|m4v)(\?|#|$)/i.test(url.trim());

/** Una opción del formulario → `PollOption`, con la media en `video`/`image`
 *  cuando la URL es válida. El `label` cae al texto, y si no hay, al nombre del
 *  archivo o a "Opción N": `Poll` lo necesita sí o sí. */
const aPollOption = (o: OpcionInput, i: number): PollOption => {
  const media = o.media?.trim();
  const label =
    o.texto.trim() || (media ? media.split(/[/?#]/).filter(Boolean).pop() : "") || `Opción ${i + 1}`;
  return {
    id: `p${i}`,
    label,
    votes: 0,
    ...(media && esUrl(media) ? (esVideo(media) ? { video: media } : { image: media }) : {}),
  };
};

export function EncuestasClient({ encuestas }: { encuestas: EncuestaRow[] }) {
  const { snack } = useSnackbar();
  const [pending, startTransition] = useTransition();

  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<EncuestaInput>(VACIA);
  const [toDelete, setToDelete] = useState<EncuestaRow | null>(null);
  // El desplegable del plantel: `<details>` no anima la apertura, así que va
  // controlado y el panel se abre con una transición de `grid-template-rows`.
  const [plantelOpen, setPlantelOpen] = useState(false);

  const set = <K extends keyof EncuestaInput>(k: K, v: EncuestaInput[K]) =>
    setForm((f) => ({ ...f, [k]: v }));

  // `form.opciones` es una sola lista; estas dos vistas la parten en jugadores
  // y manuales para editarlas por separado. Un jugador es una opción cuyo
  // `texto` está en el plantel y no tiene media.
  const jugadoresSel = form.opciones
    .filter((o) => ES_JUGADOR.has(o.texto) && !o.media)
    .map((o) => o.texto);
  const manuales = form.opciones.filter((o) => !ES_JUGADOR.has(o.texto) || o.media);

  /** Reescribe `opciones` como `[...jugadores en orden de plantel, ...manuales]`.
   *  Reordenar no mueve votos —el match es por texto/URL— pero deja la lista
   *  estable entre ediciones. */
  const rearmar = (jugadores: string[], manual: OpcionInput[]) =>
    setForm((f) => ({
      ...f,
      opciones: [
        ...NOMBRES_JUGADORES.filter((n) => jugadores.includes(n)).map((texto) => ({ texto })),
        ...manual,
      ],
    }));

  const setJugadores = (nombres: string[]) => rearmar(nombres, manuales);

  const setManual = (i: number, campo: keyof OpcionInput, valor: string) =>
    rearmar(
      jugadoresSel,
      manuales.map((o, j) => (j === i ? { ...o, [campo]: valor } : o)),
    );

  const addManual = () => rearmar(jugadoresSel, [...manuales, { texto: "" }]);

  const removeManual = (i: number) =>
    rearmar(jugadoresSel, manuales.filter((_, j) => j !== i));

  const openNew = () => {
    setForm(VACIA);
    setPlantelOpen(false);
    setOpen(true);
  };

  const openEdit = (row: EncuestaRow) => {
    setPlantelOpen(false);
    setForm({
      id: row.id,
      pregunta: row.pregunta,
      descripcion: row.descripcion ?? "",
      opciones: row.opciones.map((o) => ({ texto: o.texto, media: o.media })),
      multiple: row.multiple,
      resultadosVisibles: row.resultadosVisibles,
      estado: row.estado,
    });
    setOpen(true);
  };

  const validas = form.opciones.filter((o) => o.texto.trim() || o.media?.trim()).length;
  const incompleta = !form.pregunta.trim() || validas < 2;

  // La vista previa: las opciones ya como `PollOption`. Si alguna trae media,
  // el `Poll` pasa a `layout="media"` y se votan desde el carrusel.
  const opcionesPreview = form.opciones
    .filter((o) => o.texto.trim() || o.media?.trim())
    .map(aPollOption);
  const hayMedia = opcionesPreview.some((o) => o.image || o.video);

  const submit = () => {
    const editando = !!form.id;
    startTransition(async () => {
      const id = await saveEncuesta(form);
      if (!id) {
        snack({ message: "Hace falta la pregunta y dos opciones", variant: "error" });
        return;
      }
      setOpen(false);
      snack({
        message: editando ? "Encuesta actualizada" : "Encuesta creada",
        variant: "success",
      });
    });
  };

  const cambiarEstado = (row: EncuestaRow) => {
    // Ciclo de vida de una sola vía: borrador → abierta → cerrada. Reabrir una
    // encuesta cerrada dejaría entrar votos después del corte que ya se
    // comunicó, así que desde "cerrada" no hay botón.
    const siguiente = row.estado === "borrador" ? "abierta" : "cerrada";
    startTransition(async () => {
      await setEncuestaEstado(row.id, siguiente);
      snack({
        message: siguiente === "abierta" ? "Encuesta abierta" : "Encuesta cerrada",
        variant: siguiente === "abierta" ? "success" : "info",
      });
    });
  };

  const confirmDelete = () => {
    const row = toDelete;
    if (!row) return;
    setToDelete(null);
    startTransition(async () => {
      await deleteEncuesta(row.id);
      snack({ message: "Encuesta eliminada", variant: "error" });
    });
  };

  const columns: Column<EncuestaRow>[] = [
    {
      key: "pregunta",
      header: "Pregunta",
      width: "3fr",
      render: (row) => (
        <div className="min-w-0">
          <p className="truncate font-medium">{row.pregunta}</p>
          <p className="text-xs text-muted">
            {row.opciones.length} opciones · {row.multiple ? "múltiple" : "única"} ·{" "}
            {row.resultadosVisibles ? "resultados visibles" : "resultados ocultos"}
          </p>
        </div>
      ),
    },
    {
      key: "totalVotos",
      header: "Votos",
      align: "right",
      width: "90px",
      render: (row) => <span className="tabular-nums">{row.totalVotos}</span>,
    },
    {
      key: "estado",
      header: "Estado",
      width: "110px",
      render: (row) => (
        <EstadoPill
          tone={
            row.estado === "abierta"
              ? "success"
              : row.estado === "cerrada"
                ? "danger"
                : "muted"
          }
        >
          {ESTADO_ENCUESTA[row.estado]}
        </EstadoPill>
      ),
    },
    { key: "creada", header: "Creada", width: "150px", hideOnMobile: true },
  ];

  return (
    <>
      <DataTable
        columns={columns}
        rows={encuestas}
        rowKey={(row) => row.id}
        searchable
        searchPlaceholder="Buscar por pregunta…"
        pageSize={10}
        density="comfortable"
        stickyHeader
        caption="Encuestas del club"
        toolbar={<Button onClick={openNew}>Nueva encuesta</Button>}
        emptyState={
          <div className="py-8 text-center">
            <p className="text-sm text-muted">Todavía no hay encuestas.</p>
            <Button className="mt-3" size="sm" onClick={openNew}>
              Crear la primera
            </Button>
          </div>
        }
        rowActions={(row) => (
          <RowMenu
            items={[
              { label: "Editar", onClick: () => openEdit(row) },
              // Desde "cerrada" no hay siguiente estado: el ítem se deshabilita
              // en vez de desaparecer, así el menú no cambia de alto por fila.
              {
                label:
                  row.estado === "borrador"
                    ? "Abrir la votación"
                    : row.estado === "abierta"
                      ? "Cerrar la votación"
                      : "Votación cerrada",
                disabled: row.estado === "cerrada",
                onClick: () => cambiarEstado(row),
              },
              // El separador es su **propio** ítem: `Dropdown` renderiza sólo
              // una línea cuando ve `divider: true` y descarta el `label` y el
              // `onClick` de ese mismo objeto. Puesto junto, "Borrar" no se
              // dibujaba: la acción destructiva desaparecía del menú.
              { label: "", divider: true },
              {
                label: "Borrar",
                destructive: true,
                onClick: () => setToDelete(row),
              },
            ]}
          />
        )}
      />

      <FormModal
        open={open}
        onClose={() => setOpen(false)}
        title={form.id ? "Editar encuesta" : "Nueva encuesta"}
        description="Editar una encuesta abierta conserva los votos de las opciones que no cambian."
        submitLabel={form.id ? "Guardar cambios" : "Crear encuesta"}
        submitting={pending}
        disabled={incompleta}
        onSubmit={submit}
        size="lg"
      >
        <Input
          label="Pregunta"
          value={form.pregunta}
          onChange={(e) => set("pregunta", e.target.value)}
          maxLength={160}
          placeholder="¿Cuál fue el mejor gol de la temporada?"
          autoFocus
        />

        <Textarea
          label="Descripción"
          hint="Opcional. Sirve para aclarar hasta cuándo se vota o cómo se usa el resultado."
          value={form.descripcion ?? ""}
          onChange={(e) => set("descripcion", e.target.value)}
          maxLength={320}
          rows={2}
          autoResize
        />

        <fieldset className="flex flex-col gap-3">
          <legend className="mb-1 text-sm font-medium">Opciones</legend>

          {/* Jugadores: el caso normal. Un desplegable con todo el plantel y
              una casilla "Todos". Controlado y no `<details>` para poder animar
              la apertura; el panel se rendea siempre y se colapsa con una
              transición de `grid-template-rows` (0fr → 1fr). */}
          <div className="rounded-lg border border-border">
            <button
              type="button"
              aria-expanded={plantelOpen}
              onClick={() => setPlantelOpen((o) => !o)}
              className="flex w-full items-center justify-between px-3 py-2 text-left text-sm"
            >
              <span>
                {jugadoresSel.length === 0
                  ? "Elegir del plantel"
                  : jugadoresSel.length === NOMBRES_JUGADORES.length
                    ? "Todo el plantel"
                    : `${jugadoresSel.length} ${
                        jugadoresSel.length === 1 ? "jugador" : "jugadores"
                      }`}
              </span>
              <ChevronIcon
                width={14}
                height={14}
                className={`transition-transform duration-200 ${
                  plantelOpen ? "-rotate-90" : "rotate-90"
                }`}
              />
            </button>
            <div
              className={`grid transition-[grid-template-rows] duration-200 ease-out ${
                plantelOpen ? "grid-rows-[1fr]" : "grid-rows-[0fr]"
              }`}
            >
              <div className="overflow-hidden">
                <div className="max-h-64 overflow-y-auto border-t border-border p-3">
                  <CheckboxGroup
                    selectAllLabel="Todos"
                    size="sm"
                    options={NOMBRES_JUGADORES.map((n) => ({ value: n, label: n }))}
                    value={jugadoresSel}
                    onChange={setJugadores}
                  />
                </div>
              </div>
            </div>
          </div>

          {jugadoresSel.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {jugadoresSel.map((n) => (
                <span
                  key={n}
                  className="inline-flex items-center gap-1 rounded-full bg-surface-alt px-2 py-0.5 text-xs"
                >
                  {n}
                  <button
                    type="button"
                    aria-label={`Quitar a ${n}`}
                    className="text-muted hover:text-foreground"
                    onClick={() =>
                      setJugadores(jugadoresSel.filter((x) => x !== n))
                    }
                  >
                    <CloseIcon width={12} height={12} />
                  </button>
                </span>
              ))}
            </div>
          )}

          {/* Opciones escritas a mano, para lo que no es un jugador ("Voto en
              blanco", "Ninguno", una frase) y para videos o imágenes. El
              rótulo va en `label` y no en `placeholder`: el `Input` de la
              librería es de etiqueta flotante y sin `label` renderiza
              `placeholder=""`. La URL es opcional: con ella la opción se vota
              como media y el texto pasa a ser el pie. */}
          {manuales.map((o, i) => {
            const url = o.media?.trim();
            return (
              <div
                key={i}
                className="flex flex-col gap-2 rounded-lg border border-border p-3"
              >
                <div className="flex items-center gap-2">
                  <Input
                    label={`Opción manual ${i + 1}`}
                    value={o.texto}
                    onChange={(e) => setManual(i, "texto", e.target.value)}
                    maxLength={120}
                    className="flex-1"
                  />
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    aria-label={`Quitar la opción manual ${i + 1}`}
                    onClick={() => removeManual(i)}
                  >
                    <CloseIcon width={16} height={16} />
                  </Button>
                </div>

                <Input
                  label="URL de imagen o video (opcional)"
                  value={o.media ?? ""}
                  onChange={(e) => setManual(i, "media", e.target.value)}
                  maxLength={400}
                  placeholder="https://…"
                  error={
                    url && !esUrl(url) ? "Tiene que empezar con http:// o https://" : undefined
                  }
                />

                {url && esUrl(url) && (
                  <div className="overflow-hidden rounded-lg border border-border bg-surface-alt">
                    {esVideo(url) ? (
                      <video
                        src={url}
                        controls
                        preload="metadata"
                        className="max-h-40 w-full object-contain"
                      />
                    ) : (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={url}
                        alt=""
                        className="max-h-40 w-full object-contain"
                      />
                    )}
                  </div>
                )}
              </div>
            );
          })}

          <Button
            type="button"
            size="sm"
            variant="outline"
            leftIcon={<PlusIcon width={14} height={14} />}
            onClick={addManual}
            className="self-start"
          >
            Agregar opción manual
          </Button>

          <p className="text-xs text-muted">
            Hacen falta al menos dos opciones entre jugadores y manuales. Pegá
            una URL para votar sobre una imagen o un video.
          </p>
        </fieldset>

        <Select
          label="Estado"
          options={[
            { value: "borrador", label: "Borrador" },
            { value: "abierta", label: "Abierta" },
            { value: "cerrada", label: "Cerrada" },
          ]}
          value={form.estado}
          onChange={(v) => set("estado", v as EncuestaInput["estado"])}
        />

        <Switch
          checked={form.multiple}
          onChange={(v) => set("multiple", v)}
          label="Permitir elegir más de una opción"
        />

        <Switch
          checked={form.resultadosVisibles}
          onChange={(v) => set("resultadosVisibles", v)}
          label="Mostrar los resultados (porcentajes)"
          description="Apagado, la votación no muestra barras, totales ni el voto propio hasta que la cierres."
        />

        {/* La vista previa es el componente real, no una maqueta. Refleja el
            toggle de resultados: con `resultadosVisibles` va `revealBeforeVote`
            (porcentajes a la vista); sin él, `anonymous` (ni barras ni totales).
            No se usa `closed`: escribiría "ENCUESTA CERRADA" arriba, que en una
            previa es información falsa sobre lo que se está creando. */}
        <div className="rounded-xl border border-border bg-surface-alt p-3">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">
            Vista previa
          </p>
          <Poll
            question={form.pregunta || "Tu pregunta acá"}
            description={form.descripcion || undefined}
            kind={form.multiple ? "multi" : "single"}
            options={opcionesPreview}
            layout={hayMedia ? "media" : "list"}
            mediaSelector
            revealBeforeVote={form.resultadosVisibles}
            anonymous={!form.resultadosVisibles}
          />
        </div>
      </FormModal>

      <ConfirmDialog
        open={!!toDelete}
        onClose={() => setToDelete(null)}
        onConfirm={confirmDelete}
        title="Borrar encuesta"
        description="Se borra con sus votos. No se puede deshacer."
      >
        <p className="text-sm font-medium">{toDelete?.pregunta}</p>
        <p className="mt-1 text-sm text-muted">{toDelete?.totalVotos} votos emitidos</p>
      </ConfirmDialog>
    </>
  );
}
