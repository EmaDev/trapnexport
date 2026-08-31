"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { Button, DataTable, Modal, useSnackbar, type Column } from "lib-kit-components";

import { deletePost, setPostHidden } from "@/lib/social/actions";
import type { AdminPostRow } from "@/lib/social/queries";
import { RowMenu } from "../Dialogs";

/** Moderación de publicaciones.
 *
 *  Ocultar es reversible y es la acción por defecto. Borrar no lo es —se lleva
 *  también los comentarios—, así que pasa por un `Modal` de confirmación: es
 *  la única acción destructiva del panel y no debería estar a un click.
 */
export function PublicacionesClient({ posts }: { posts: AdminPostRow[] }) {
  const { snack, undo } = useSnackbar();
  const [pending, startTransition] = useTransition();
  const [toDelete, setToDelete] = useState<AdminPostRow | null>(null);

  const toggleHidden = (row: AdminPostRow) => {
    const hide = row.estado === "publicado";
    startTransition(async () => {
      await setPostHidden(row.id, hide);
      if (hide) {
        undo("Publicación oculta", () => void setPostHidden(row.id, false));
      } else {
        snack({ message: "Publicación visible otra vez", variant: "success" });
      }
    });
  };

  const confirmDelete = () => {
    const row = toDelete;
    if (!row) return;
    setToDelete(null);
    startTransition(async () => {
      await deletePost(row.id);
      snack({ message: "Publicación eliminada", variant: "error" });
    });
  };

  const columns: Column<AdminPostRow>[] = [
    {
      key: "texto",
      header: "Publicación",
      width: "3fr",
      render: (row) => (
        <div className="min-w-0">
          <p className="line-clamp-2 text-sm">{row.texto}</p>
          <Link href={`/post/${row.id}`} className="text-xs text-primary">
            Ver en la app
          </Link>
        </div>
      ),
    },
    {
      key: "autor",
      header: "Autor",
      width: "160px",
      render: (row) => (
        <Link href={`/u/${row.handle}`} className="text-sm">
          {row.autor}
        </Link>
      ),
    },
    { key: "fecha", header: "Fecha", width: "120px", hideOnMobile: true },
    { key: "likes", header: "Likes", align: "right", width: "80px", hideOnMobile: true },
    {
      key: "comentarios",
      header: "Coment.",
      align: "right",
      width: "90px",
      hideOnMobile: true,
    },
    {
      key: "estado",
      header: "Estado",
      width: "120px",
      render: (row) => (
        <span
          className={`rounded-full px-2 py-0.5 text-xs font-medium ${
            row.estado === "publicado"
              ? "bg-success/10 text-success"
              : "bg-danger/10 text-danger"
          }`}
        >
          {row.estado}
        </span>
      ),
    },
  ];

  return (
    <>
      <DataTable
        columns={columns}
        rows={posts}
        rowKey={(row) => row.id}
        searchable
        searchPlaceholder="Buscar en el texto o por autor…"
        pageSize={10}
        density="comfortable"
        stickyHeader
        caption="Publicaciones de la comunidad"
        rowActions={(row) => (
          <RowMenu
            items={[
              {
                label: row.estado === "publicado" ? "Ocultar" : "Mostrar",
                disabled: pending,
                onClick: () => toggleHidden(row),
              },
              { label: "", divider: true },
              { label: "Borrar", destructive: true, onClick: () => setToDelete(row) },
            ]}
          />
        )}
      />

      <Modal
        open={!!toDelete}
        onClose={() => setToDelete(null)}
        title="Borrar publicación"
        description="Se elimina también todos sus comentarios. No se puede deshacer."
        size="sm"
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setToDelete(null)}>
              Cancelar
            </Button>
            <Button variant="danger" onClick={confirmDelete}>
              Borrar definitivamente
            </Button>
          </div>
        }
      >
        <p className="text-sm text-muted">{toDelete?.texto}</p>
      </Modal>
    </>
  );
}
