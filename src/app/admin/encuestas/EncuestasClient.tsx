"use client";

import { useState, useTransition } from "react";
import {
  Button,
  CheckboxGroup,
  DataTable,
  Input,
  Select,
  Switch,
  Textarea,
  useSnackbar,
  type Column,
  type PollOption,
} from "lib-kit-components";

import { ChevronIcon, CloseIcon, PlusIcon } from "@/components/atoms/icons";
import { EncuestaPoll } from "@/components/organisms/EncuestaPoll";
import { VideoEncuesta } from "@/components/organisms/VideoEncuesta";
import { deleteEncuesta, saveEncuesta, setEncuestaEstado } from "@/lib/contenido/actions";
import { esUrl, esVideo, imagenDeOpcion, videoDeEncuesta } from "@/lib/contenido/media";
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
 *      ("Voto en blanco", "Ninguno", una frase) y para las imágenes: cada
 *      opción manual puede llevar una URL en `media` y entonces se vota sobre
 *      la imagen y no sobre el texto. Las dos listas se concatenan en
 *      `form.opciones` como `[...jugadores, ...manuales]`.
 *
 *  2 · La media tiene **dos** campos y no uno. El video es de la encuesta
 *      (`form.video`): es uno solo, se muestra arriba y las opciones van
 *      debajo como lista. Las imágenes son de la opción (`media`): una por
 *      opción, y se votan desde un carrusel. Ver `lib/contenido/media.ts`.
 *
 *  3 · La vista previa es el mismo `EncuestaPoll` que ve el socio, en modo
 *      resultados. Es la única forma de ver antes de publicar si la pregunta y
 *      las opciones entran, que es el error más común al cargar una encuesta.
 */

const VACIA: EncuestaInput = {
  nombre: "",
  pregunta: "",
  descripcion: "",
  video: "",
  opciones: [],
  multiple: false,
  maxOpciones: 0,
  orden: undefined,
  resultadosVisibles: true,
  estado: "borrador",
};

/** Los nombres del plantel, para separar en `form.opciones` lo que es un
 *  jugador de lo que se escribió a mano. El match es por nombre exacto: es lo
 *  que guarda `OpcionEncuesta.texto` y lo que devuelve `opcionesDe` en el feed. */
const NOMBRES_JUGADORES = JUGADORES.map((j) => j.nombre);
const ES_JUGADOR = new Set(NOMBRES_JUGADORES);

/** Una opción del formulario → `PollOption`, con la imagen en `image` cuando
 *  la URL es válida. El video no entra acá: es de la encuesta. El `label` cae
 *  al texto, y si no hay, al nombre del archivo o a "Opción N": `Poll` lo
 *  necesita sí o sí. */
const aPollOption = (o: OpcionInput, i: number): PollOption => {
  const imagen = imagenDeOpcion(o.media);
  const label =
    o.texto.trim() ||
    (imagen ? imagen.split(/[/?#]/).filter(Boolean).pop() : "") ||
    `Opción ${i + 1}`;
  return {
    id: `p${i}`,
    label,
    votes: 0,
    ...(imagen ? { image: imagen } : {}),
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
      nombre: row.nombre ?? "",
      pregunta: row.pregunta,
      descripcion: row.descripcion ?? "",
      video: row.video ?? "",
      opciones: row.opciones.map((o) => ({ texto: o.texto, media: o.media })),
      multiple: row.multiple,
      maxOpciones: row.maxOpciones ?? 0,
      orden: row.orden,
      resultadosVisibles: row.resultadosVisibles,
      estado: row.estado,
    });
    setOpen(true);
  };

  const validas = form.opciones.filter((o) => o.texto.trim() || o.media?.trim()).length;
  const incompleta = !form.pregunta.trim() || validas < 2;

  // La vista previa: las opciones ya como `PollOption`. Qué vista le toca
  // —video arriba, carrusel de imágenes o lista— lo decide `EncuestaPoll` con
  // la media, igual que en el feed.
  const opcionesPreview = form.opciones
    .filter((o) => o.texto.trim() || o.media?.trim())
    .map(aPollOption);
  const videoPreview = videoDeEncuesta(form.video, form.opciones);
  const videoInvalido = !!form.video?.trim() && !esUrl(form.video);

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
          {/* El nombre arriba y la pregunta debajo: es el mismo par que ve el
              socio —título del desplegable y pregunta adentro— y así se nota
              desde la tabla si una categoría quedó con el nombre de otra. */}
          <p className="truncate font-medium">{row.nombre || row.pregunta}</p>
          <p className="truncate text-xs text-muted">{row.pregunta}</p>
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
        {/* El nombre es lo que **titula** la categoría: el desplegable del feed
            y la placa de la gala. Es distinto de la pregunta a propósito —la
            placa anuncia, no pregunta— y va primero porque es el campo que antes
            no existía: el título salía de una lista hardcodeada cruzada por id,
            así que renombrar una votación acá no cambiaba lo que se veía. */}
        <Input
          label="Nombre del premio"
          hint="Corto: es el título del desplegable en el feed y el de la placa en la gala. Vacío, se usa la pregunta."
          value={form.nombre ?? ""}
          onChange={(e) => set("nombre", e.target.value)}
          maxLength={60}
          placeholder="Mejor gol"
          autoFocus
        />

        <Input
          label="Pregunta"
          value={form.pregunta}
          onChange={(e) => set("pregunta", e.target.value)}
          maxLength={160}
          placeholder="¿Cuál fue el mejor gol de la temporada?"
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

        {/* El video es de la encuesta y no de la opción: es uno solo, va
            arriba y las opciones quedan debajo como lista. Acepta un archivo
            (.mp4, .webm…) o un link de YouTube en cualquiera de sus formas
            —`watch?v=`, `youtu.be`, `/shorts/`—: lo que se pega es la URL que
            copia el navegador, sin tocarla. */}
        <Input
          label="URL del video (opcional)"
          hint="Un solo video para toda la encuesta: va arriba y las opciones quedan debajo. Archivo .mp4 o link de YouTube."
          value={form.video ?? ""}
          onChange={(e) => set("video", e.target.value)}
          maxLength={400}
          placeholder="https://www.youtube.com/watch?v=…"
          error={videoInvalido ? "Tiene que empezar con http:// o https://" : undefined}
        />

        {videoPreview && (
          <div className="overflow-hidden rounded-lg border border-border bg-surface-alt">
            <VideoEncuesta video={videoPreview} />
          </div>
        )}

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
              blanco", "Ninguno", una frase) y para las imágenes. El rótulo va
              en `label` y no en `placeholder`: el `Input` de la librería es de
              etiqueta flotante y sin `label` renderiza `placeholder=""`. La
              URL es opcional: con ella la opción se vota como imagen y el
              texto pasa a ser el pie. */}
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
                  label="URL de imagen (opcional)"
                  hint="Una imagen por opción: se votan desde un carrusel."
                  value={o.media ?? ""}
                  onChange={(e) => setManual(i, "media", e.target.value)}
                  maxLength={400}
                  placeholder="https://…"
                  error={
                    url && !esUrl(url) ? "Tiene que empezar con http:// o https://" : undefined
                  }
                />

                {url &&
                  esUrl(url) &&
                  /* Un video pegado en una opción no se vota desde el carrusel:
                     sube al encabezado como el video de la encuesta (lo hace
                     `videoDeEncuesta`). Se avisa en vez de rechazarlo, porque
                     es lo que quedó cargado en las encuestas de antes de que el
                     video fuera uno solo. */
                  (esVideo(url) ? (
                    <p className="text-xs text-muted">
                      Es un video: se usa como el video de la encuesta, arriba de las opciones.
                      Si querés otro, cargalo en{" "}
                      <b className="text-foreground">URL del video</b>.
                    </p>
                  ) : (
                    <div className="overflow-hidden rounded-lg border border-border bg-surface-alt">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={url} alt="" className="max-h-40 w-full object-contain" />
                    </div>
                  ))}
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
            una URL de imagen para votar sobre las imágenes, una por opción.
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

        {/* El orden en que se anuncian las categorías, en el feed y en la gala.
            Vacío cae al orden de los premios sembrados y, si tampoco es uno de
            esos, al final por fecha de alta. */}
        <Input
          label="Orden"
          type="number"
          hint="En qué puesto se anuncia. Vacío, va al final."
          value={form.orden ?? ""}
          onChange={(e) =>
            set("orden", e.target.value === "" ? undefined : Number(e.target.value))
          }
          min={0}
          placeholder="1"
        />

        <Switch
          checked={form.multiple}
          onChange={(v) => set("multiple", v)}
          label="Permitir elegir más de una opción"
        />

        {/* El tope sólo aplica a las múltiples, y es también cuántas ganan: el
            once ideal son once votos y once ganadores. En 0 no hay tope y la
            gala anuncia una sola ganadora. */}
        {form.multiple && (
          <Input
            label="Cuántas se pueden elegir"
            type="number"
            hint="Es también cuántas ganan. 0 = sin tope y gana una sola."
            value={form.maxOpciones ?? 0}
            onChange={(e) => set("maxOpciones", Number(e.target.value) || 0)}
            min={0}
            max={form.opciones.length || undefined}
          />
        )}

        <Switch
          checked={form.resultadosVisibles}
          onChange={(v) => set("resultadosVisibles", v)}
          label="Mostrar los resultados (porcentajes)"
          description="Apagado, la votación no muestra barras, totales ni el voto propio hasta que la cierres."
        />

        {/* La vista previa es el componente real, no una maqueta: el mismo
            `EncuestaPoll` del feed, así que la vista —video arriba, carrusel de
            imágenes o lista— la elige él y no puede diferir de la del socio.
            Refleja el toggle de resultados: con `resultadosVisibles` va
            `revealBeforeVote` (porcentajes a la vista); sin él, `anonymous` (ni
            barras ni totales). No se usa `closed`: escribiría "ENCUESTA
            CERRADA" arriba, que en una previa es información falsa sobre lo que
            se está creando. */}
        <div className="rounded-xl border border-border bg-surface-alt p-3">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">
            Vista previa
          </p>
          <EncuestaPoll
            question={form.pregunta || "Tu pregunta acá"}
            description={form.descripcion || undefined}
            kind={form.multiple ? "multi" : "single"}
            maxChoices={form.multiple ? form.maxOpciones || undefined : undefined}
            options={opcionesPreview}
            video={videoPreview}
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
