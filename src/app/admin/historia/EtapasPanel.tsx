"use client";

import { useState, useTransition } from "react";
import {
  Button,
  DataTable,
  Input,
  Select,
  Switch,
  Textarea,
  useSnackbar,
  type Column,
} from "lib-kit-components";

import { borrarEra, guardarEra, moverEra, type EraInput } from "@/lib/historia/actions";
import type { Era, Milestone, MilestoneKind } from "@/lib/historia/types";
import { ConfirmDialog, EstadoPill, FormModal, RowMenu } from "../Dialogs";
import { Bloque, ImageField, ListaEditor, ParesEditor, idLocal } from "./campos";

/** Solapa "Etapas": los capítulos de la línea de tiempo de `/historia`.
 *
 *  Cada etapa lleva sus hitos adentro (`milestones`), y por eso el formulario
 *  es largo: son dos niveles en un solo modal. La alternativa —una pantalla
 *  aparte por etapa para cargar sus hitos— multiplicaría por dos los clicks de
 *  la operación más común, que es agregar un hito a la etapa en curso.
 *
 *  El orden se cambia con flechas en el menú de la fila y no arrastrando: es
 *  una lista de seis, y `moverEra` lo resuelve con dos escrituras.
 */

/** Los tipos de hito con su etiqueta. El `kind` define el color y el ícono en
 *  el timeline, así que la lista se comparte con `TemporadasPanel`: los hitos
 *  de una temporada usan exactamente los mismos. */
export const KIND_OPCIONES: { value: MilestoneKind; label: string }[] = [
  { value: "titulo", label: "Título" },
  { value: "ascenso", label: "Ascenso" },
  { value: "derrota", label: "Derrota" },
  { value: "debut", label: "Debut" },
  { value: "obra", label: "Hito / obra" },
  { value: "partido", label: "Partido" },
  { value: "homenaje", label: "Homenaje" },
  { value: "evento", label: "Evento" },
];

const VACIA: EraInput = {
  id: "",
  period: "",
  title: "",
  tagline: "",
  description: "",
  photo: "",
  stats: [],
  milestones: [],
};

export function EtapasPanel({ eras }: { eras: Era[] }) {
  const { snack } = useSnackbar();
  const [pending, startTransition] = useTransition();

  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<EraInput>(VACIA);
  const [aBorrar, setABorrar] = useState<Era | null>(null);

  const set = <K extends keyof EraInput>(k: K, v: EraInput[K]) =>
    setForm((f) => ({ ...f, [k]: v }));

  // El estado se rearma al abrir en vez de reiniciarse con un `key`: el modal
  // es uno solo, así que el reset tiene que ser explícito o la próxima alta
  // arranca con lo que quedó de la edición anterior. Mismo criterio que
  // `NoticiasClient`.
  const abrirNueva = () => {
    setForm(VACIA);
    setOpen(true);
  };

  const abrirEdicion = (era: Era) => {
    setForm({ ...era, stats: [...era.stats], milestones: [...era.milestones] });
    setOpen(true);
  };

  const submit = () => {
    const editando = !!form.id;
    startTransition(async () => {
      const id = await guardarEra(form);
      if (!id) {
        snack({ message: "Falta el título de la etapa", variant: "error" });
        return;
      }
      setOpen(false);
      snack({
        message: editando ? "Etapa actualizada" : "Etapa creada",
        variant: "success",
      });
    });
  };

  const mover = (era: Era, direccion: "sube" | "baja") =>
    startTransition(async () => {
      await moverEra(era.id, direccion);
    });

  const confirmarBorrado = () => {
    const era = aBorrar;
    if (!era) return;
    setABorrar(null);
    startTransition(async () => {
      await borrarEra(era.id);
      snack({ message: "Etapa eliminada", variant: "error" });
    });
  };

  const columns: Column<Era>[] = [
    {
      key: "title",
      header: "Etapa",
      width: "3fr",
      render: (era) => (
        <div className="flex min-w-0 items-start gap-3">
          {era.photo && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={era.photo}
              alt=""
              className="hidden size-12 shrink-0 rounded-lg object-cover sm:block"
            />
          )}
          <div className="min-w-0">
            <p className="flex items-center gap-1.5 font-medium">
              <span className="truncate">{era.title}</span>
              {era.current && <EstadoPill tone="success">En curso</EstadoPill>}
            </p>
            <p className="line-clamp-1 text-xs text-muted">{era.tagline}</p>
          </div>
        </div>
      ),
    },
    { key: "period", header: "Período", width: "120px" },
    {
      key: "milestones",
      header: "Hitos",
      width: "80px",
      hideOnMobile: true,
      render: (era) => <span className="tabular-nums">{era.milestones.length}</span>,
    },
  ];

  return (
    <>
      <DataTable
        columns={columns}
        rows={eras}
        rowKey={(era) => era.id}
        searchable
        searchPlaceholder="Buscar por título, período o bajada…"
        pageSize={10}
        density="comfortable"
        stickyHeader
        caption="Las etapas de la línea de tiempo, de la más vieja a la más nueva"
        toolbar={<Button onClick={abrirNueva}>Nueva etapa</Button>}
        emptyState={
          <div className="py-8 text-center">
            <p className="text-sm text-muted">Todavía no hay etapas.</p>
            <Button className="mt-3" size="sm" onClick={abrirNueva}>
              Crear la primera
            </Button>
          </div>
        }
        rowActions={(era) => (
          <RowMenu
            items={[
              { label: "Editar", onClick: () => abrirEdicion(era) },
              { label: "Subir en la línea de tiempo", onClick: () => mover(era, "sube") },
              { label: "Bajar en la línea de tiempo", onClick: () => mover(era, "baja") },
              // El separador es su propio ítem: ver el comentario en
              // `NoticiasClient`. Puesto junto a "Borrar", la acción
              // destructiva desaparece del menú.
              { label: "", divider: true },
              { label: "Borrar", destructive: true, onClick: () => setABorrar(era) },
            ]}
          />
        )}
      />

      <FormModal
        open={open}
        onClose={() => setOpen(false)}
        title={form.id ? "Editar etapa" : "Nueva etapa"}
        description="El período hace de número del capítulo; la bajada es la línea que se lee bajo el título."
        submitLabel={form.id ? "Guardar cambios" : "Crear etapa"}
        submitting={pending}
        disabled={!form.title.trim()}
        onSubmit={submit}
        size="xl"
      >
        <div className="grid gap-4 sm:grid-cols-[1fr_2fr]">
          <Input
            label="Período"
            hint='"2023" o "2020 — 2022"'
            value={form.period}
            maxLength={40}
            onChange={(e) => set("period", e.target.value)}
          />
          <Input
            label="Título"
            value={form.title}
            maxLength={120}
            placeholder="El año que lo cambió todo"
            autoFocus
            onChange={(e) => set("title", e.target.value)}
          />
        </div>

        <Input
          label="Bajada"
          value={form.tagline}
          maxLength={200}
          onChange={(e) => set("tagline", e.target.value)}
        />

        <Textarea
          label="Descripción"
          value={form.description}
          maxLength={4000}
          showCount
          rows={5}
          autoResize
          onChange={(e) => set("description", e.target.value)}
        />

        <ImageField
          label="Foto de la etapa"
          value={form.photo}
          onChange={(v) => set("photo", v)}
        />

        <Switch
          checked={!!form.current}
          onChange={(v) => set("current", v)}
          label="Etapa en curso"
          description="Marca el capítulo como abierto en el timeline y en la presentación."
        />

        <ParesEditor
          label="Números de la etapa"
          hint="Los tres o cuatro datos que la resumen: formato, torneo, cancha…"
          items={form.stats}
          onChange={(v) => set("stats", v)}
        />

        <Bloque title="Hitos" hint="Los hechos puntuales dentro del capítulo.">
          <ListaEditor
            label="Hitos"
            items={form.milestones}
            onChange={(v) => set("milestones", v)}
            agregar="Agregar hito"
            vacio="La etapa todavía no tiene hitos."
            // El tipo de retorno va anotado: sin él, TypeScript infiere
            // `kind: string` de la fila nueva y `ListaEditor` deduce un `T` más
            // ancho que `Milestone`.
            nuevo={(): Milestone => ({
              id: idLocal("m"),
              date: "",
              title: "",
              description: "",
              kind: "evento",
            })}
          >
            {(m, i, setM) => (
              <>
                <div className="grid gap-2 sm:grid-cols-[1fr_2fr_1fr]">
                  <Input
                    label="Fecha"
                    hint="Tal como se muestra"
                    value={m.date}
                    maxLength={40}
                    placeholder="Mayo 2025"
                    onChange={(e) => setM({ ...m, date: e.target.value })}
                  />
                  <Input
                    label="Título"
                    value={m.title}
                    maxLength={160}
                    onChange={(e) => setM({ ...m, title: e.target.value })}
                  />
                  <Select
                    label="Tipo"
                    options={KIND_OPCIONES}
                    value={m.kind}
                    onChange={(v) => setM({ ...m, kind: v as MilestoneKind })}
                  />
                </div>
                <Textarea
                  label="Descripción"
                  value={m.description}
                  maxLength={1200}
                  rows={2}
                  autoResize
                  onChange={(e) => setM({ ...m, description: e.target.value })}
                />
              </>
            )}
          </ListaEditor>
        </Bloque>
      </FormModal>

      <ConfirmDialog
        open={!!aBorrar}
        onClose={() => setABorrar(null)}
        onConfirm={confirmarBorrado}
        title="Borrar etapa"
        description="Se borra con todos sus hitos y no se puede deshacer."
      >
        <p className="text-sm font-medium">
          {aBorrar?.period} · {aBorrar?.title}
        </p>
        <p className="mt-1 text-sm text-muted">
          {aBorrar?.milestones.length} hito(s) se van con ella.
        </p>
      </ConfirmDialog>
    </>
  );
}
