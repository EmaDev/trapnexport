"use client";

import { useMemo, useState, useTransition } from "react";
import {
  Button,
  Card,
  DataTable,
  DatePicker,
  Input,
  Select,
  Tabs,
  Textarea,
  TimePicker,
  useSnackbar,
  type Column,
} from "lib-kit-components";

import { CronogramaDia } from "@/components/organisms/CronogramaDia";
import { deleteEvento, saveEvento, setFechaEvento } from "@/lib/contenido/actions";
import type { EventoRow } from "@/lib/contenido/queries";
import { TIPO_EVENTO, type EventoInput, type TipoEvento } from "@/lib/contenido/types";
import { fromISODate, horaMas, minutosDeHora } from "@/lib/time";
import { ConfirmDialog, EstadoPill, FormModal, RowMenu } from "../Dialogs";

/** ABM del cronograma de **un solo día**.
 *
 *  Todo el cronograma ocurre la misma fecha: el día se elige una vez, arriba,
 *  y cada evento sólo elige su horario dentro de ese día. Por eso los eventos
 *  no guardan fecha (ver `Evento` en `contenido/types.ts`) y el formulario no
 *  tiene `DatePicker`: no hay forma de cargar un evento en otro día.
 *
 *  Dos vistas de los mismos datos:
 *
 *  - **Día**: el programa en orden de hora, con un aviso cuando dos eventos se
 *    pisan. Reemplaza al calendario mensual, que con un solo día activo
 *    mostraba treinta celdas vacías y una con todo encimado adentro. Lo dibuja
 *    `CronogramaDia`, el mismo componente que la solapa del feed: el
 *    cronograma es uno solo y tiene que verse igual de los dos lados.
 *  - **Lista**: para editar y borrar, que es lo que la tabla hace bien.
 */

const VACIO: EventoInput = {
  nombre: "",
  descripcion: "",
  hora: "20:00",
  duracion: 90,
  lugar: "",
  tipo: "partido",
};

const toISO = (d: Date): string => {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
};

const DURACIONES = [
  { value: "15", label: "15 min" },
  { value: "30", label: "30 min" },
  { value: "45", label: "45 min" },
  { value: "60", label: "1 h" },
  { value: "90", label: "1 h 30" },
  { value: "120", label: "2 h" },
  { value: "180", label: "3 h" },
  { value: "240", label: "4 h" },
];

export function CronogramaClient({
  fecha,
  fechaLarga,
  eventos,
}: {
  fecha: string;
  fechaLarga: string;
  eventos: EventoRow[];
}) {
  const { snack } = useSnackbar();
  const [pending, startTransition] = useTransition();

  const [vista, setVista] = useState<"dia" | "lista">("dia");
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<EventoInput>(VACIO);
  const [toDelete, setToDelete] = useState<EventoRow | null>(null);

  const set = <K extends keyof EventoInput>(k: K, v: EventoInput[K]) =>
    setForm((f) => ({ ...f, [k]: v }));

  const openNew = (hora?: string) => {
    setForm({ ...VACIO, hora: hora ?? VACIO.hora });
    setOpen(true);
  };

  const openEdit = (row: EventoRow) => {
    setForm({
      id: row.id,
      nombre: row.nombre,
      descripcion: row.descripcion,
      hora: row.hora,
      duracion: row.duracion,
      lugar: row.lugar,
      tipo: row.tipo,
    });
    setOpen(true);
  };

  const submit = () => {
    const editando = !!form.id;
    startTransition(async () => {
      const id = await saveEvento(form);
      if (!id) {
        snack({ message: "Falta el nombre del evento", variant: "error" });
        return;
      }
      setOpen(false);
      snack({
        message: editando ? "Evento actualizado" : "Evento agregado al cronograma",
        variant: "success",
      });
    });
  };

  const confirmDelete = () => {
    const row = toDelete;
    if (!row) return;
    setToDelete(null);
    startTransition(async () => {
      await deleteEvento(row.id);
      snack({ message: "Evento eliminado", variant: "error" });
    });
  };

  /** Cambiar el día no toca ningún evento: los horarios son los mismos, corridos
   *  de fecha. Por eso va sin confirmación — es un campo, y volver atrás es
   *  elegir la fecha anterior. */
  const cambiarDia = (v: Date | { from?: Date | null; to?: Date | null } | null) => {
    if (!(v instanceof Date)) return;
    const iso = toISO(v);
    if (iso === fecha) return;

    startTransition(async () => {
      const guardada = await setFechaEvento(iso);
      if (!guardada) {
        snack({ message: "Esa fecha no es válida", variant: "error" });
        return;
      }
      snack({ message: "El cronograma se movió de día", variant: "success" });
    });
  };

  /** Qué se pisa con qué. Como todo pasa el mismo día, el cruce es comparar dos
   *  intervalos de minutos: no hace falta `Date` ni mirar la fecha. */
  const cruces = useMemo(() => {
    const rangos = eventos.map((e) => {
      const desde = minutosDeHora(e.hora);
      return { id: e.id, nombre: e.nombre, desde, hasta: desde + e.duracion };
    });

    return new Map(
      rangos.map((a) => [
        a.id,
        rangos.filter((b) => b.id !== a.id && b.desde < a.hasta && a.desde < b.hasta),
      ]),
    );
  }, [eventos]);

  const columns: Column<EventoRow>[] = [
    {
      key: "nombre",
      header: "Evento",
      width: "3fr",
      render: (row) => (
        <div className="min-w-0">
          <p className="truncate font-medium">{row.nombre}</p>
          <p className="line-clamp-1 text-xs text-muted">
            {row.descripcion || "Sin descripción"}
          </p>
        </div>
      ),
    },
    {
      key: "horario",
      header: "Horario",
      width: "150px",
      sortValue: (row) => row.startsAt,
      render: (row) => (
        <span className={`tabular-nums ${row.pasado ? "text-muted" : "font-medium"}`}>
          {row.horario}
        </span>
      ),
    },
    { key: "lugar", header: "Lugar", width: "160px", hideOnMobile: true },
    {
      key: "tipo",
      header: "Tipo",
      width: "130px",
      render: (row) => (
        <EstadoPill
          tone={
            row.tipo === "partido"
              ? "primary"
              : row.tipo === "entrenamiento"
                ? "success"
                : "muted"
          }
        >
          {TIPO_EVENTO[row.tipo].label}
        </EstadoPill>
      ),
    },
    {
      key: "duracion",
      header: "Dura",
      align: "right",
      width: "90px",
      hideOnMobile: true,
      render: (row) => <span className="tabular-nums text-sm">{row.duracion} min</span>,
    },
  ];

  const finForm = horaMas(form.hora, form.duracion);

  return (
    <>
      {/* ── el día, una sola vez para todo el cronograma ─────────────────── */}
      <Card variant="outline" padding="md" className="mb-4">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div className="min-w-0">
            <p className="text-xs font-medium uppercase tracking-wide text-muted">
              Día del evento
            </p>
            <p className="mt-0.5 text-lg font-semibold capitalize">{fechaLarga}</p>
            <p className="mt-1 text-sm text-muted">
              {eventos.length === 0
                ? "Todavía no hay nada cargado en el día."
                : `Los ${eventos.length} eventos del cronograma ocurren este día. Cambiarlo los mueve a todos, con los mismos horarios.`}
            </p>
          </div>

          <DatePicker
            label="Cambiar el día"
            value={fromISODate(fecha)}
            onChange={cambiarDia}
            weekStartsOn={1}
            locale="es-AR"
            className="w-full sm:w-56"
          />
        </div>
      </Card>

      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <Tabs
          items={[
            { id: "dia", label: "Día" },
            { id: "lista", label: "Lista" },
          ]}
          value={vista}
          onChange={(v) => setVista(v as typeof vista)}
          variant="segmented"
          size="sm"
        />
        <Button onClick={() => openNew()}>Nuevo evento</Button>
      </div>

      {vista === "dia" ? (
        <Card variant="outline" padding="md">
          <CronogramaDia
            eventos={eventos}
            cruces={cruces}
            onEventoClick={openEdit}
            vacio={
              <div className="py-10 text-center">
                <p className="text-sm text-muted">El día está vacío.</p>
                <Button className="mt-3" size="sm" onClick={() => openNew("10:00")}>
                  Cargar el primer evento
                </Button>
              </div>
            }
            nota={
              <span className="text-xs text-muted">· Tocá un evento para editarlo</span>
            }
          />
        </Card>
      ) : (
        <DataTable
          columns={columns}
          rows={eventos}
          rowKey={(row) => row.id}
          searchable
          searchPlaceholder="Buscar por nombre, lugar o descripción…"
          pageSize={12}
          density="comfortable"
          stickyHeader
          caption="Cronograma del club"
          emptyState={
            <div className="py-8 text-center">
              <p className="text-sm text-muted">El cronograma está vacío.</p>
              <Button className="mt-3" size="sm" onClick={() => openNew()}>
                Cargar el primer evento
              </Button>
            </div>
          }
          rowActions={(row) => (
            <RowMenu
              items={[
                { label: "Editar", onClick: () => openEdit(row) },
                // Ver el comentario de `NoticiasClient`: `divider: true` en el
                // mismo objeto se come el ítem.
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
      )}

      <FormModal
        open={open}
        onClose={() => setOpen(false)}
        title={form.id ? "Editar evento" : "Nuevo evento"}
        description={`Ocurre el ${fechaLarga}, como todo el cronograma. Acá se elige el horario.`}
        submitLabel={form.id ? "Guardar cambios" : "Agregar al cronograma"}
        submitting={pending}
        disabled={!form.nombre.trim()}
        onSubmit={submit}
        size="lg"
      >
        <Input
          label="Nombre"
          value={form.nombre}
          onChange={(e) => set("nombre", e.target.value)}
          maxLength={120}
          placeholder="Fecha 18 · TNE vs. Deportivo Norte"
          autoFocus
        />

        <Textarea
          label="Descripción"
          value={form.descripcion}
          onChange={(e) => set("descripcion", e.target.value)}
          maxLength={600}
          showCount
          rows={3}
          autoResize
        />

        <div className="grid gap-4 sm:grid-cols-2">
          <TimePicker
            label="Empieza"
            value={form.hora}
            onChange={(v) => set("hora", v ?? "20:00")}
            step={15}
          />
          <Select
            label="Duración"
            options={DURACIONES}
            value={String(form.duracion)}
            onChange={(v) => set("duracion", Number(v))}
            // La hora de fin no se carga, se deduce: mostrarla evita cargar
            // cuatro horas de cena creyendo que terminaba a las 22.
            hint={`Termina ${finForm.hora}${
              finForm.diaSiguiente ? " del día siguiente" : ""
            }`}
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Select
            label="Tipo"
            options={(Object.keys(TIPO_EVENTO) as TipoEvento[]).map((t) => ({
              value: t,
              label: TIPO_EVENTO[t].label,
            }))}
            value={form.tipo}
            onChange={(v) => set("tipo", v as TipoEvento)}
          />
          <Input
            label="Lugar"
            value={form.lugar}
            onChange={(e) => set("lugar", e.target.value)}
            maxLength={120}
            placeholder="Estadio La Cantera"
          />
        </div>
      </FormModal>

      <ConfirmDialog
        open={!!toDelete}
        onClose={() => setToDelete(null)}
        onConfirm={confirmDelete}
        title="Borrar evento"
        description="Sale del cronograma. No se puede deshacer."
      >
        <p className="text-sm font-medium">{toDelete?.nombre}</p>
        <p className="mt-1 text-sm text-muted">{toDelete?.horario}</p>
      </ConfirmDialog>
    </>
  );
}
