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

import { deleteNoticia, saveNoticia, setNoticiaEstado } from "@/lib/contenido/actions";
import type { NoticiaRow } from "@/lib/contenido/queries";
import { ESTADO_NOTICIA, type NoticiaInput } from "@/lib/contenido/types";
import { ConfirmDialog, EstadoPill, FormModal, RowMenu } from "../Dialogs";

/** ABM de noticias.
 *
 *  Alta y modificación son el mismo formulario y la misma acción (`saveNoticia`
 *  con o sin `id`). Publicar/pasar a borrador es un botón suelto en la fila:
 *  es la operación que más se repite y no vale abrir un modal para cambiar un
 *  campo. Borrar es lo único que pide confirmación.
 *
 *  El estado del formulario se **rearma al abrir** en vez de reiniciarse con un
 *  `key`: el modal es uno solo y sus campos son `children` del `FormModal`, así
 *  que el reset tiene que ser explícito o la próxima alta arranca con lo que
 *  quedó escrito en la edición anterior.
 */

const VACIA: NoticiaInput = {
  titulo: "",
  copete: "",
  cuerpo: "",
  estado: "borrador",
  autor: "Prensa TNE",
  destacada: false,
};

export function NoticiasClient({ noticias }: { noticias: NoticiaRow[] }) {
  const { snack } = useSnackbar();
  const [pending, startTransition] = useTransition();

  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<NoticiaInput>(VACIA);
  const [toDelete, setToDelete] = useState<NoticiaRow | null>(null);

  const set = <K extends keyof NoticiaInput>(k: K, v: NoticiaInput[K]) =>
    setForm((f) => ({ ...f, [k]: v }));

  const openNew = () => {
    setForm(VACIA);
    setOpen(true);
  };

  const openEdit = (row: NoticiaRow) => {
    setForm({
      id: row.id,
      titulo: row.titulo,
      copete: row.copete,
      cuerpo: row.cuerpo,
      estado: row.estado,
      autor: row.autor,
      destacada: row.destacada ?? false,
    });
    setOpen(true);
  };

  const submit = () => {
    const editando = !!form.id;
    startTransition(async () => {
      const id = await saveNoticia(form);
      if (!id) {
        snack({ message: "Falta el título", variant: "error" });
        return;
      }
      setOpen(false);
      snack({
        message: editando ? "Noticia actualizada" : "Noticia creada",
        variant: "success",
      });
    });
  };

  const togglePublicada = (row: NoticiaRow) => {
    const publicar = row.estado === "borrador";
    startTransition(async () => {
      await setNoticiaEstado(row.id, publicar ? "publicada" : "borrador");
      snack({
        message: publicar ? "Noticia publicada" : "Noticia pasada a borrador",
        variant: publicar ? "success" : "info",
      });
    });
  };

  const confirmDelete = () => {
    const row = toDelete;
    if (!row) return;
    setToDelete(null);
    startTransition(async () => {
      await deleteNoticia(row.id);
      snack({ message: "Noticia eliminada", variant: "error" });
    });
  };

  const columns: Column<NoticiaRow>[] = [
    {
      key: "titulo",
      header: "Noticia",
      width: "3fr",
      render: (row) => (
        <div className="flex min-w-0 items-start gap-3">
          {row.cover && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={row.cover}
              alt=""
              className="hidden size-12 shrink-0 rounded-lg object-cover sm:block"
            />
          )}
          <div className="min-w-0">
            <p className="flex items-center gap-1.5 font-medium">
              <span className="truncate">{row.titulo}</span>
              {row.destacada && (
                <span className="shrink-0 rounded bg-accent/10 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-accent">
                  Destacada
                </span>
              )}
            </p>
            <p className="line-clamp-1 text-xs text-muted">{row.copete}</p>
          </div>
        </div>
      ),
    },
    { key: "autor", header: "Autor", width: "140px", hideOnMobile: true },
    {
      key: "estado",
      header: "Estado",
      width: "110px",
      render: (row) => (
        <EstadoPill tone={row.estado === "publicada" ? "success" : "muted"}>
          {ESTADO_NOTICIA[row.estado]}
        </EstadoPill>
      ),
    },
    { key: "creada", header: "Últ. cambio", width: "150px", hideOnMobile: true },
  ];

  return (
    <>
      <DataTable
        columns={columns}
        rows={noticias}
        rowKey={(row) => row.id}
        searchable
        searchPlaceholder="Buscar por título, copete o autor…"
        pageSize={10}
        density="comfortable"
        stickyHeader
        caption="Noticias del club"
        toolbar={<Button onClick={openNew}>Nueva noticia</Button>}
        emptyState={
          <div className="py-8 text-center">
            <p className="text-sm text-muted">Todavía no hay noticias.</p>
            <Button className="mt-3" size="sm" onClick={openNew}>
              Crear la primera
            </Button>
          </div>
        }
        rowActions={(row) => (
          <RowMenu
            items={[
              { label: "Editar", onClick: () => openEdit(row) },
              {
                label: row.estado === "publicada" ? "Pasar a borrador" : "Publicar",
                onClick: () => togglePublicada(row),
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
        title={form.id ? "Editar noticia" : "Nueva noticia"}
        description="El copete es lo que se lee en el listado; el cuerpo, al abrirla."
        submitLabel={form.id ? "Guardar cambios" : "Crear noticia"}
        submitting={pending}
        disabled={!form.titulo.trim()}
        onSubmit={submit}
        size="lg"
      >
        <Input
          label="Título"
          value={form.titulo}
          onChange={(e) => set("titulo", e.target.value)}
          maxLength={120}
          placeholder="Ferreiro renovó hasta 2030"
          autoFocus
        />

        <Textarea
          label="Copete"
          hint="Una o dos oraciones. Es lo único que se ve en el listado."
          value={form.copete}
          onChange={(e) => set("copete", e.target.value)}
          maxLength={320}
          showCount
          rows={2}
          autoResize
        />

        <Textarea
          label="Cuerpo"
          value={form.cuerpo}
          onChange={(e) => set("cuerpo", e.target.value)}
          maxLength={8000}
          rows={8}
          autoResize
        />

        <div className="grid gap-4 sm:grid-cols-2">
          <Input
            label="Autor"
            value={form.autor}
            onChange={(e) => set("autor", e.target.value)}
            maxLength={80}
          />
          <Select
            label="Estado"
            options={[
              { value: "borrador", label: "Borrador" },
              { value: "publicada", label: "Publicada" },
            ]}
            value={form.estado}
            onChange={(v) => set("estado", v as NoticiaInput["estado"])}
          />
        </div>

        <Switch
          checked={!!form.destacada}
          onChange={(v) => set("destacada", v)}
          label="Destacada en la portada"
          description="Sólo una a la vez: al marcar esta se apaga la anterior."
        />
      </FormModal>

      <ConfirmDialog
        open={!!toDelete}
        onClose={() => setToDelete(null)}
        onConfirm={confirmDelete}
        title="Borrar noticia"
        description="No se puede deshacer. Si sólo querés sacarla de la portada, pasala a borrador."
      >
        <p className="text-sm font-medium">{toDelete?.titulo}</p>
        <p className="mt-1 text-sm text-muted">{toDelete?.copete}</p>
      </ConfirmDialog>
    </>
  );
}
