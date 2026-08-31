"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import {
  Button,
  DataTable,
  DatePicker,
  Input,
  Modal,
  Select,
  Textarea,
  TimePicker,
  useClipboard,
  useSnackbar,
  type Column,
} from "lib-kit-components";

import { CheckIcon, LinkIcon, SparkleIcon } from "@/components/atoms/icons";
import { InvitationStage } from "@/components/organisms/InvitationStage";
import {
  deleteInvitacion,
  saveInvitacion,
  saveInvitacionesMasivas,
  setInvitacionEstado,
} from "@/lib/contenido/actions";
import type { InvitacionRow } from "@/lib/contenido/queries";
import {
  EFECTO_INVITACION,
  PLANTILLA_INVITACION,
  REVELACION_INVITACION,
  type EfectoInvitacion,
  type InvitacionInput,
  type InvitacionMasivaInput,
  type PlantillaInvitacion,
  type RevelacionInvitacion,
} from "@/lib/contenido/types";
import { FONDO_INVITACION } from "@/lib/invitacion/fondo";
import { fromISODate } from "@/lib/time";
import { ConfirmDialog, EstadoPill, FormModal, RowMenu } from "../Dialogs";

/** ABM de invitaciones: cargar una invitación **es** generar su link.
 *
 *  El link no es un campo del formulario ni un botón aparte: sale del `code`
 *  que arma `saveInvitacion` al crear, y desde ese momento la fila tiene un
 *  botón para copiarlo. No hay un paso de "generar" porque no hay nada que
 *  decidir en ese paso — la invitación sin link no sirve para nada.
 *
 *  El `code` no cambia al editar, ni si cambia el nombre del invitado: el link
 *  puede estar mandado y renombrarlo lo rompería sin avisar. Para cortar el
 *  acceso está revocar, que apaga la ruta pública y deja la fila.
 *
 *  Hay dos altas y son la misma operación con distinta entrada: la de a una
 *  —con vista previa, para la invitación que se piensa— y la masiva, que toma
 *  un diseño y una lista de nombres y crea una invitación por nombre, cada una
 *  con su propio link. Las dos escriben las mismas filas; la masiva no es un
 *  modo especial ni deja invitaciones distintas.
 *
 *  La vista previa usa el mismo `InvitationStage` que la ruta pública —tarjeta,
 *  efecto y fondo—, así que lo que se ve mientras se escribe es exactamente lo
 *  que abre el invitado. Lo único que le saca son los botones de compartir: la
 *  invitación que se está cargando todavía no tiene link, y unos botones que no
 *  llevan a ningún lado enseñarían mal cómo se va a ver. En "Ver la tarjeta",
 *  que es una invitación ya emitida, la barra está entera y funciona.
 */

const VACIA: InvitacionInput = {
  invitado: "",
  titulo: "",
  mensaje: "",
  fecha: "",
  hora: "21:00",
  lugar: "",
  plantilla: "gala",
  efecto: "flote",
  revelacion: "lacre",
  estado: "activa",
};

/** El alta masiva arranca del mismo molde menos el invitado, que es lo único
 *  que la distingue: ahí van los nombres. */
const VACIA_MASIVA: InvitacionMasivaInput = {
  titulo: "",
  mensaje: "",
  fecha: "",
  hora: "21:00",
  lugar: "",
  plantilla: "gala",
  efecto: "flote",
  revelacion: "lacre",
  estado: "activa",
  nombres: "",
};

/** Cuenta los nombres igual que el servidor: mismo separador, mismo descarte de
 *  vacíos. Si el panel contara distinto, el contador diría 40 y se crearían 38.
 */
const contarNombres = (v: string) =>
  v.split(/[\n;]+/).filter((n) => n.trim()).length;

const toISO = (d: Date): string => {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
};

export function InvitacionesClient({
  invitaciones,
  club,
}: {
  invitaciones: InvitacionRow[];
  /** el nombre y el escudo, para la tarjeta. Llegan por prop y no por import
   *  para no arrastrar `lib/historia` entero al bundle del panel. */
  club: { name: string; crest: string };
}) {
  const { snack } = useSnackbar();
  const { copy } = useClipboard();
  const [pending, startTransition] = useTransition();

  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<InvitacionInput>(VACIA);
  const [toDelete, setToDelete] = useState<InvitacionRow | null>(null);
  const [masiva, setMasiva] = useState(false);
  const [formMasivo, setFormMasivo] = useState<InvitacionMasivaInput>(VACIA_MASIVA);
  const [preview, setPreview] = useState<InvitacionRow | null>(null);

  /** Las animaciones de entrada corren una vez y ahí se quedan. Elegir un
   *  efecto sin poder volver a verlo es elegirlo de memoria, así que la vista
   *  previa tiene un botón que sube este contador: va en el `key` del
   *  `InvitationStage`, y remontarlo vuelve a dispararlas desde cero. */
  const [repeticion, setRepeticion] = useState(0);

  const set = <K extends keyof InvitacionInput>(k: K, v: InvitacionInput[K]) =>
    setForm((f) => ({ ...f, [k]: v }));

  const setM = <K extends keyof InvitacionMasivaInput>(k: K, v: InvitacionMasivaInput[K]) =>
    setFormMasivo((f) => ({ ...f, [k]: v }));

  const openNew = () => {
    setForm(VACIA);
    setOpen(true);
  };

  const openEdit = (row: InvitacionRow) => {
    setForm({
      id: row.id,
      invitado: row.invitado,
      titulo: row.titulo,
      mensaje: row.mensaje,
      fecha: row.fecha,
      hora: row.hora,
      lugar: row.lugar,
      plantilla: row.plantilla,
      efecto: row.efecto,
      revelacion: row.revelacion,
      estado: row.estado,
    });
    setOpen(true);
  };

  const incompleta = !form.invitado.trim() || !form.titulo.trim() || !form.fecha;

  const submit = () => {
    const editando = !!form.id;
    startTransition(async () => {
      const id = await saveInvitacion(form);
      if (!id) {
        snack({ message: "Faltan el invitado, el título o la fecha", variant: "error" });
        return;
      }
      setOpen(false);
      snack({
        message: editando ? "Invitación actualizada" : "Invitación creada, con su link",
        variant: "success",
      });
    });
  };

  const cantidadMasiva = contarNombres(formMasivo.nombres);
  const masivaIncompleta =
    !formMasivo.titulo.trim() || !formMasivo.fecha || cantidadMasiva === 0;

  const submitMasivo = () => {
    startTransition(async () => {
      const r = await saveInvitacionesMasivas(formMasivo);
      if (r.error) {
        snack({ message: r.error, variant: "error" });
        return;
      }
      setMasiva(false);
      setFormMasivo(VACIA_MASIVA);

      // Los repetidos se cuentan aparte y se nombran: "38 de 40" sin decir
      // cuáles son los dos obliga a comparar la tabla contra la lista a mano.
      //
      // "Repetidos" y no "ya existían": un nombre se saltea tanto si ya tenía
      // invitación para este evento como si venía dos veces en el mismo pegado,
      // y decir que ya existía cuando se acaba de pegar dos veces manda a
      // buscar una fila que no está.
      const saltados = r.repetidos.length
        ? ` Repetidos, sin crear: ${r.repetidos.slice(0, 5).join(", ")}${
            r.repetidos.length > 5 ? ` y ${r.repetidos.length - 5} más` : ""
          }.`
        : "";

      snack({
        message: `${r.creadas} ${r.creadas === 1 ? "invitación creada" : "invitaciones creadas"}, cada una con su link.${saltados}`,
        variant: r.creadas ? "success" : "info",
      });
    });
  };

  const copiar = async (row: InvitacionRow) => {
    const ok = await copy(row.url);
    snack({
      message: ok ? `Link de ${row.invitado} copiado` : "No se pudo copiar el link",
      variant: ok ? "success" : "error",
    });
  };

  const toggleEstado = (row: InvitacionRow) => {
    const revocar = row.estado === "activa";
    startTransition(async () => {
      await setInvitacionEstado(row.id, revocar ? "revocada" : "activa");
      snack({
        message: revocar ? "Invitación revocada: el link deja de abrir" : "Invitación reactivada",
        variant: revocar ? "info" : "success",
      });
    });
  };

  const confirmDelete = () => {
    const row = toDelete;
    if (!row) return;
    setToDelete(null);
    startTransition(async () => {
      await deleteInvitacion(row.id);
      snack({ message: "Invitación eliminada", variant: "error" });
    });
  };

  const columns: Column<InvitacionRow>[] = [
    {
      key: "invitado",
      header: "Invitado",
      width: "2fr",
      render: (row) => (
        <div className="min-w-0">
          <p className="truncate font-medium">{row.invitado}</p>
          <p className="truncate text-xs text-muted">{row.titulo}</p>
        </div>
      ),
    },
    { key: "cuando", header: "Cuándo", width: "150px" },
    {
      // Las dos en una sola columna: son las dos mitades de la misma decisión
      // —qué ve el invitado— y separarlas costaría ancho del link, que es lo
      // que de verdad se busca en esta tabla.
      key: "plantilla",
      header: "Diseño",
      width: "170px",
      hideOnMobile: true,
      render: (row) => (
        <div className="min-w-0">
          <p className="truncate text-sm">{PLANTILLA_INVITACION[row.plantilla]}</p>
          <p className="truncate text-xs text-muted">
            {REVELACION_INVITACION[row.revelacion].label} ·{" "}
            {EFECTO_INVITACION[row.efecto].label}
          </p>
        </div>
      ),
    },
    {
      key: "url",
      header: "Link",
      width: "2fr",
      hideOnMobile: true,
      render: (row) => (
        <div className="flex min-w-0 items-center gap-2">
          <code className="truncate rounded bg-surface-alt px-1.5 py-0.5 text-xs">
            /invitacion/{row.code}
          </code>
          <Button
            size="icon"
            variant="ghost"
            aria-label={`Copiar el link de ${row.invitado}`}
            onClick={() => copiar(row)}
          >
            <LinkIcon width={16} height={16} />
          </Button>
        </div>
      ),
    },
    {
      key: "estado",
      header: "Estado",
      width: "110px",
      render: (row) => (
        <EstadoPill tone={row.estado === "activa" ? "success" : "danger"}>
          {row.estado}
        </EstadoPill>
      ),
    },
  ];

  return (
    <>
      <DataTable
        columns={columns}
        rows={invitaciones}
        rowKey={(row) => row.id}
        searchable
        searchPlaceholder="Buscar por invitado, título o link…"
        pageSize={10}
        density="comfortable"
        stickyHeader
        caption="Invitaciones emitidas"
        toolbar={
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={() => setMasiva(true)}>
              Cargar una lista
            </Button>
            <Button onClick={openNew}>Nueva invitación</Button>
          </div>
        }
        emptyState={
          <div className="py-8 text-center">
            <p className="text-sm text-muted">
              Todavía no hay invitaciones. Al crear una se genera su link.
            </p>
            <Button className="mt-3" size="sm" onClick={openNew}>
              Crear la primera
            </Button>
          </div>
        }
        rowActions={(row) => (
          <RowMenu
            items={[
              { label: "Ver la tarjeta", onClick: () => setPreview(row) },
              { label: "Copiar el link", onClick: () => void copiar(row) },
              { label: "Editar", onClick: () => openEdit(row) },
              {
                label: row.estado === "activa" ? "Revocar el link" : "Reactivar",
                onClick: () => toggleEstado(row),
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
        title={form.id ? "Editar invitación" : "Nueva invitación"}
        description={
          form.id
            ? "El link no cambia: puede estar mandado. Para cortar el acceso, revocá."
            : "Al guardar se genera el link para mandarle al invitado."
        }
        submitLabel={form.id ? "Guardar cambios" : "Crear y generar link"}
        submitting={pending}
        disabled={incompleta}
        onSubmit={submit}
        size="xl"
      >
        <div className="grid gap-6 lg:grid-cols-[1fr_20rem]">
          <div className="flex flex-col gap-4">
            <Input
              label="Invitado"
              hint="Es lo único que personaliza la tarjeta, y va en letra grande."
              value={form.invitado}
              onChange={(e) => set("invitado", e.target.value)}
              maxLength={80}
              placeholder="Marta Sosa"
              autoFocus
            />

            <Input
              label="Título del evento"
              value={form.titulo}
              onChange={(e) => set("titulo", e.target.value)}
              maxLength={120}
              placeholder="Cena de los 28 años"
            />

            <Textarea
              label="Mensaje"
              hint="Opcional. Dos o tres líneas, dirigidas a esa persona."
              value={form.mensaje}
              onChange={(e) => set("mensaje", e.target.value)}
              maxLength={400}
              showCount
              rows={3}
              autoResize
            />

            <div className="grid gap-4 sm:grid-cols-2">
              <DatePicker
                label="Fecha"
                value={form.fecha ? fromISODate(form.fecha) : null}
                onChange={(v) => set("fecha", v instanceof Date ? toISO(v) : "")}
                min={new Date()}
              />
              <TimePicker
                label="Hora"
                value={form.hora}
                onChange={(v) => set("hora", v ?? "21:00")}
                step={15}
              />
            </div>

            <Input
              label="Lugar"
              value={form.lugar}
              onChange={(e) => set("lugar", e.target.value)}
              maxLength={120}
              placeholder="Salón de La Cantera"
            />

            <div className="grid gap-4 sm:grid-cols-2">
              <Select
                label="Plantilla"
                hint="Cambia el diseño, no los datos."
                options={(
                  Object.keys(PLANTILLA_INVITACION) as PlantillaInvitacion[]
                ).map((p) => ({ value: p, label: PLANTILLA_INVITACION[p] }))}
                value={form.plantilla}
                onChange={(v) => set("plantilla", v as PlantillaInvitacion)}
              />
              <Select
                label="Efecto"
                /* El hint es la descripción del efecto elegido y no un texto
                   fijo: el nombre de una animación no dice qué hace hasta que
                   ocurre, y acá se la elige antes de verla. */
                hint={EFECTO_INVITACION[form.efecto].descripcion}
                options={(Object.keys(EFECTO_INVITACION) as EfectoInvitacion[]).map((e) => ({
                  value: e,
                  label: EFECTO_INVITACION[e].label,
                }))}
                value={form.efecto}
                onChange={(v) => set("efecto", v as EfectoInvitacion)}
              />
              <Select
                label="Revelación"
                hint={REVELACION_INVITACION[form.revelacion].descripcion}
                options={(Object.keys(REVELACION_INVITACION) as RevelacionInvitacion[]).map(
                  (r) => ({ value: r, label: REVELACION_INVITACION[r].label }),
                )}
                value={form.revelacion}
                onChange={(v) => set("revelacion", v as RevelacionInvitacion)}
              />
              <Select
                label="Estado"
                options={[
                  { value: "activa", label: "Activa" },
                  { value: "revocada", label: "Revocada" },
                ]}
                value={form.estado}
                onChange={(v) => set("estado", v as InvitacionInput["estado"])}
              />
            </div>
          </div>

          {/* La vista previa en vivo: el mismo componente de la ruta pública,
              sobre el mismo fondo. */}
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between gap-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted">
                Así la va a ver
              </p>
              <Button
                size="sm"
                variant="ghost"
                leftIcon={<SparkleIcon width={15} height={15} />}
                onClick={() => setRepeticion((n) => n + 1)}
              >
                Ver de nuevo
              </Button>
            </div>

            <div className={`rounded-2xl p-4 ${FONDO_INVITACION}`}>
              <InvitationStage
                key={`${form.plantilla}-${form.efecto}-${form.revelacion}-${repeticion}`}
                invitado={form.invitado || "Nombre del invitado"}
                titulo={form.titulo || "Título del evento"}
                mensaje={form.mensaje}
                fecha={form.fecha || toISO(new Date())}
                hora={form.hora}
                lugar={form.lugar}
                plantilla={form.plantilla}
                efecto={form.efecto}
                revelacion={form.revelacion}
                club={club}
                url=""
                seed={form.id ?? "preview"}
                conAcciones={false}
              />
            </div>
          </div>
        </div>
      </FormModal>

      {/* Ver la tarjeta de una invitación ya emitida, con su link a mano. */}
      <Modal
        open={!!preview}
        onClose={() => setPreview(null)}
        title={preview ? `Invitación de ${preview.invitado}` : ""}
        description={preview?.titulo}
        size="md"
        showClose
        footer={
          preview && (
            <div className="flex flex-wrap items-center justify-end gap-2">
              <Link
                href={`/invitacion/${preview.code}`}
                target="_blank"
                className="text-sm font-medium text-primary"
              >
                Abrir el link
              </Link>
              <Button
                variant="outline"
                leftIcon={<CheckIcon width={16} height={16} />}
                onClick={() => copiar(preview)}
              >
                Copiar link
              </Button>
            </div>
          )
        }
      >
        {preview && (
          <div className="flex flex-col gap-3">
            <div className={`rounded-2xl p-4 sm:p-6 ${FONDO_INVITACION}`}>
              <InvitationStage
                invitado={preview.invitado}
                titulo={preview.titulo}
                mensaje={preview.mensaje}
                fecha={preview.fecha}
                hora={preview.hora}
                lugar={preview.lugar}
                plantilla={preview.plantilla}
                efecto={preview.efecto}
                revelacion={preview.revelacion}
                club={club}
                url={preview.url}
                seed={preview.code}
              />
            </div>
            <code className="break-all rounded bg-surface-alt px-2 py-1.5 text-xs">
              {preview.url}
            </code>
          </div>
        )}
      </Modal>

      {/* Alta masiva: un diseño, una lista de nombres.

          El formulario es el mismo de arriba menos el campo "Invitado" y más el
          `Textarea` de nombres, y eso es exactamente lo que la operación es: la
          misma invitación repetida cambiando sólo a quién va dirigida. La vista
          previa muestra la tarjeta con el primero de la lista y no con un
          placeholder — es la única forma de ver si el diseño elegido aguanta un
          nombre real, que suele ser más largo que "Nombre del invitado". */}
      <FormModal
        open={masiva}
        onClose={() => setMasiva(false)}
        title="Cargar una lista de invitados"
        description="Un nombre por línea. Se crea una invitación por nombre, cada una con su propio link."
        submitLabel={
          cantidadMasiva
            ? `Generar ${cantidadMasiva} ${cantidadMasiva === 1 ? "invitación" : "invitaciones"}`
            : "Generar invitaciones"
        }
        submitting={pending}
        disabled={masivaIncompleta}
        onSubmit={submitMasivo}
        size="xl"
      >
        <div className="grid gap-6 lg:grid-cols-[1fr_20rem]">
          <div className="flex flex-col gap-4">
            <Textarea
              label="Nombres"
              hint={
                cantidadMasiva
                  ? `${cantidadMasiva} ${cantidadMasiva === 1 ? "nombre" : "nombres"}. Los que ya tengan invitación para este evento se saltean.`
                  : "Uno por línea. Pegá la lista tal cual la tengas."
              }
              value={formMasivo.nombres}
              onChange={(e) => setM("nombres", e.target.value)}
              rows={7}
              autoResize
              placeholder={"Marta Sosa\nMariano Cisterna\nLucía Ferreyra"}
              autoFocus
            />

            <Input
              label="Título del evento"
              hint="El mismo para toda la lista."
              value={formMasivo.titulo}
              onChange={(e) => setM("titulo", e.target.value)}
              maxLength={120}
              placeholder="Cena de los 28 años"
            />

            <Textarea
              label="Mensaje"
              hint="Opcional, y el mismo para todos: acá no va nada dirigido a una persona."
              value={formMasivo.mensaje}
              onChange={(e) => setM("mensaje", e.target.value)}
              maxLength={400}
              showCount
              rows={2}
              autoResize
            />

            <div className="grid gap-4 sm:grid-cols-2">
              <DatePicker
                label="Fecha"
                value={formMasivo.fecha ? fromISODate(formMasivo.fecha) : null}
                onChange={(v) => setM("fecha", v instanceof Date ? toISO(v) : "")}
                min={new Date()}
              />
              <TimePicker
                label="Hora"
                value={formMasivo.hora}
                onChange={(v) => setM("hora", v ?? "21:00")}
                step={15}
              />
            </div>

            <Input
              label="Lugar"
              value={formMasivo.lugar}
              onChange={(e) => setM("lugar", e.target.value)}
              maxLength={120}
              placeholder="Salón de La Cantera"
            />

            <div className="grid gap-4 sm:grid-cols-3">
              <Select
                label="Plantilla"
                options={(Object.keys(PLANTILLA_INVITACION) as PlantillaInvitacion[]).map(
                  (x) => ({ value: x, label: PLANTILLA_INVITACION[x] }),
                )}
                value={formMasivo.plantilla}
                onChange={(v) => setM("plantilla", v as PlantillaInvitacion)}
              />
              <Select
                label="Efecto"
                options={(Object.keys(EFECTO_INVITACION) as EfectoInvitacion[]).map((x) => ({
                  value: x,
                  label: EFECTO_INVITACION[x].label,
                }))}
                value={formMasivo.efecto}
                onChange={(v) => setM("efecto", v as EfectoInvitacion)}
              />
              <Select
                label="Revelación"
                options={(Object.keys(REVELACION_INVITACION) as RevelacionInvitacion[]).map(
                  (x) => ({ value: x, label: REVELACION_INVITACION[x].label }),
                )}
                value={formMasivo.revelacion}
                onChange={(v) => setM("revelacion", v as RevelacionInvitacion)}
              />
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted">
              Así la van a ver
            </p>
            <div className={`rounded-2xl p-4 ${FONDO_INVITACION}`}>
              <InvitationStage
                key={`${formMasivo.plantilla}-${formMasivo.efecto}-${formMasivo.revelacion}`}
                invitado={
                  formMasivo.nombres.split(/[\n;]+/).find((n) => n.trim())?.trim() ||
                  "Nombre del invitado"
                }
                titulo={formMasivo.titulo || "Título del evento"}
                mensaje={formMasivo.mensaje}
                fecha={formMasivo.fecha || toISO(new Date())}
                hora={formMasivo.hora}
                lugar={formMasivo.lugar}
                plantilla={formMasivo.plantilla}
                efecto={formMasivo.efecto}
                revelacion={formMasivo.revelacion}
                club={club}
                url=""
                seed="masiva"
                conAcciones={false}
              />
            </div>
          </div>
        </div>
      </FormModal>

      <ConfirmDialog
        open={!!toDelete}
        onClose={() => setToDelete(null)}
        onConfirm={confirmDelete}
        title="Borrar invitación"
        description="El link deja de existir. Si sólo querés cortar el acceso, revocá: la fila queda."
      >
        <p className="text-sm font-medium">{toDelete?.invitado}</p>
        <p className="mt-1 text-sm text-muted">{toDelete?.titulo}</p>
      </ConfirmDialog>
    </>
  );
}
