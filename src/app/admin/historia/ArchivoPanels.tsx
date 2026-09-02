"use client";

import { useState, useTransition } from "react";
import {
  Button,
  DataTable,
  Input,
  Textarea,
  useSnackbar,
  type Column,
} from "lib-kit-components";

import {
  borrarClip,
  borrarFoto,
  borrarFrase,
  guardarClip,
  guardarFoto,
  guardarFrase,
} from "@/lib/historia/actions";
import type { Clip, Photo, Quote } from "@/lib/historia/types";
import { ConfirmDialog, FormModal, RowMenu } from "../Dialogs";
import { ImageField } from "./campos";

/** Las tres solapas cortas de `/admin/historia`: frases, museo y video.
 *
 *  Van juntas en un archivo porque son el mismo ABM tres veces —tabla, modal
 *  de cuatro campos, confirmación de borrado— sobre tres colecciones sueltas
 *  que no anidan nada. Separarlas en tres archivos de ciento cincuenta líneas
 *  casi idénticas sería más ceremonia que código.
 *
 *  Lo que **no** se comparte con las listas embebidas de una temporada o de una
 *  ficha (`medios.tsx`): esas son arrays dentro de otro documento y se guardan
 *  con su padre. Estas son documentos propios, con su tabla y su orden. La
 *  forma del dato coincide; el ciclo de vida no.
 */

const anioActual = new Date().getFullYear();

/* ── frases ──────────────────────────────────────────────────────────────── */

const FRASE_VACIA: Quote = {
  id: "",
  text: "",
  author: "",
  role: "",
  year: anioActual,
  avatar: "",
};

export function FrasesPanel({ quotes }: { quotes: Quote[] }) {
  const { snack } = useSnackbar();
  const [pending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<Quote>(FRASE_VACIA);
  const [aBorrar, setABorrar] = useState<Quote | null>(null);

  const set = <K extends keyof Quote>(k: K, v: Quote[K]) =>
    setForm((f) => ({ ...f, [k]: v }));

  const submit = () => {
    const editando = !!form.id;
    startTransition(async () => {
      const id = await guardarFrase(form);
      if (!id) {
        snack({ message: "Falta el texto de la frase", variant: "error" });
        return;
      }
      setOpen(false);
      snack({
        message: editando ? "Frase actualizada" : "Frase creada",
        variant: "success",
      });
    });
  };

  const columns: Column<Quote>[] = [
    {
      key: "text",
      header: "Frase",
      width: "3fr",
      render: (q) => (
        <div className="min-w-0">
          <p className="line-clamp-2 text-sm">«{q.text}»</p>
          <p className="truncate text-xs text-muted">
            {q.author} · {q.role}
          </p>
        </div>
      ),
    },
    { key: "year", header: "Año", width: "90px" },
  ];

  return (
    <>
      <DataTable
        columns={columns}
        rows={quotes}
        rowKey={(q) => q.id}
        searchable
        searchPlaceholder="Buscar por texto, autor o contexto…"
        pageSize={10}
        density="comfortable"
        stickyHeader
        caption="Las frases célebres de /historia"
        toolbar={
          <Button
            onClick={() => {
              setForm(FRASE_VACIA);
              setOpen(true);
            }}
          >
            Nueva frase
          </Button>
        }
        emptyState={<p className="py-8 text-center text-sm text-muted">Sin frases.</p>}
        rowActions={(q) => (
          <RowMenu
            items={[
              {
                label: "Editar",
                onClick: () => {
                  setForm({ ...q });
                  setOpen(true);
                },
              },
              { label: "", divider: true },
              { label: "Borrar", destructive: true, onClick: () => setABorrar(q) },
            ]}
          />
        )}
      />

      <FormModal
        open={open}
        onClose={() => setOpen(false)}
        title={form.id ? "Editar frase" : "Nueva frase"}
        description="El rol es quién era esa persona cuando lo dijo, no su cargo de hoy."
        submitLabel={form.id ? "Guardar cambios" : "Crear frase"}
        submitting={pending}
        disabled={!form.text.trim()}
        onSubmit={submit}
        size="lg"
      >
        <Textarea
          label="Frase"
          value={form.text}
          maxLength={400}
          showCount
          rows={3}
          autoResize
          autoFocus
          onChange={(e) => set("text", e.target.value)}
        />
        <div className="grid gap-4 sm:grid-cols-[1fr_2fr_1fr]">
          <Input
            label="Autor"
            value={form.author}
            maxLength={80}
            onChange={(e) => set("author", e.target.value)}
          />
          <Input
            label="Contexto"
            value={form.role}
            maxLength={120}
            placeholder="Después de la tercera estrella"
            onChange={(e) => set("role", e.target.value)}
          />
          <Input
            label="Año"
            type="number"
            value={form.year}
            onChange={(e) => set("year", Number(e.target.value))}
          />
        </div>
        <ImageField
          label="Avatar"
          aspect="1 / 1"
          hint="El escudo del club cuando la frase es del equipo y no de una persona."
          value={form.avatar}
          onChange={(v) => set("avatar", v)}
        />
      </FormModal>

      <ConfirmDialog
        open={!!aBorrar}
        onClose={() => setABorrar(null)}
        onConfirm={() => {
          const q = aBorrar;
          if (!q) return;
          setABorrar(null);
          startTransition(async () => {
            await borrarFrase(q.id);
            snack({ message: "Frase eliminada", variant: "error" });
          });
        }}
        title="Borrar frase"
      >
        <p className="text-sm">«{aBorrar?.text}»</p>
      </ConfirmDialog>
    </>
  );
}

/* ── museo ───────────────────────────────────────────────────────────────── */

const FOTO_VACIA: Photo = { id: "", src: "", alt: "", caption: "", year: anioActual };

export function MuseoPanel({ gallery }: { gallery: Photo[] }) {
  const { snack } = useSnackbar();
  const [pending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<Photo>(FOTO_VACIA);
  const [aBorrar, setABorrar] = useState<Photo | null>(null);

  const set = <K extends keyof Photo>(k: K, v: Photo[K]) =>
    setForm((f) => ({ ...f, [k]: v }));

  const submit = () => {
    const editando = !!form.id;
    startTransition(async () => {
      const id = await guardarFoto(form);
      if (!id) {
        snack({ message: "Falta la imagen", variant: "error" });
        return;
      }
      setOpen(false);
      snack({
        message: editando ? "Foto actualizada" : "Foto agregada",
        variant: "success",
      });
    });
  };

  const columns: Column<Photo>[] = [
    {
      key: "caption",
      header: "Foto",
      width: "3fr",
      render: (f) => (
        <div className="flex min-w-0 items-center gap-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={f.src} alt="" className="size-12 shrink-0 rounded-lg object-cover" />
          <div className="min-w-0">
            <p className="line-clamp-1 text-sm font-medium">{f.caption}</p>
            <p className="line-clamp-1 text-xs text-muted">{f.alt}</p>
          </div>
        </div>
      ),
    },
    { key: "year", header: "Año", width: "90px" },
  ];

  return (
    <>
      <DataTable
        columns={columns}
        rows={gallery}
        rowKey={(f) => f.id}
        searchable
        searchPlaceholder="Buscar por epígrafe…"
        pageSize={12}
        density="comfortable"
        stickyHeader
        caption="El museo: las fotos del archivo"
        toolbar={
          <Button
            onClick={() => {
              setForm(FOTO_VACIA);
              setOpen(true);
            }}
          >
            Agregar foto
          </Button>
        }
        emptyState={<p className="py-8 text-center text-sm text-muted">Sin fotos.</p>}
        rowActions={(f) => (
          <RowMenu
            items={[
              {
                label: "Editar",
                onClick: () => {
                  setForm({ ...f });
                  setOpen(true);
                },
              },
              { label: "", divider: true },
              { label: "Borrar", destructive: true, onClick: () => setABorrar(f) },
            ]}
          />
        )}
      />

      <FormModal
        open={open}
        onClose={() => setOpen(false)}
        title={form.id ? "Editar foto" : "Agregar foto"}
        description="Las fotos del museo se ven en el carrusel de /historia, con zoom."
        submitLabel={form.id ? "Guardar cambios" : "Agregar"}
        submitting={pending}
        disabled={!form.src.trim()}
        onSubmit={submit}
        size="lg"
      >
        <ImageField label="Imagen" value={form.src} onChange={(v) => set("src", v)} />
        <div className="grid gap-4 sm:grid-cols-[3fr_1fr]">
          <Input
            label="Epígrafe"
            value={form.caption}
            maxLength={200}
            placeholder="Campeones de la Copa Oro: la tercera estrella"
            onChange={(e) => set("caption", e.target.value)}
          />
          <Input
            label="Año"
            type="number"
            value={form.year}
            onChange={(e) => set("year", Number(e.target.value))}
          />
        </div>
        <Input
          label="Texto alternativo"
          hint="Para lectores de pantalla. Si lo dejás vacío se usa el epígrafe."
          value={form.alt}
          maxLength={160}
          onChange={(e) => set("alt", e.target.value)}
        />
      </FormModal>

      <ConfirmDialog
        open={!!aBorrar}
        onClose={() => setABorrar(null)}
        onConfirm={() => {
          const f = aBorrar;
          if (!f) return;
          setABorrar(null);
          startTransition(async () => {
            await borrarFoto(f.id);
            snack({ message: "Foto eliminada", variant: "error" });
          });
        }}
        title="Borrar foto"
        description="Sale del museo. El archivo subido queda en el bucket."
      >
        <p className="text-sm font-medium">{aBorrar?.caption}</p>
      </ConfirmDialog>
    </>
  );
}

/* ── video ───────────────────────────────────────────────────────────────── */

const CLIP_VACIO: Clip = {
  id: "",
  title: "",
  description: "",
  year: anioActual,
  duration: "",
  poster: "",
  motion: "",
};

export function VideoPanel({ clips }: { clips: Clip[] }) {
  const { snack } = useSnackbar();
  const [pending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<Clip>(CLIP_VACIO);
  const [aBorrar, setABorrar] = useState<Clip | null>(null);

  const set = <K extends keyof Clip>(k: K, v: Clip[K]) =>
    setForm((f) => ({ ...f, [k]: v }));

  const submit = () => {
    const editando = !!form.id;
    startTransition(async () => {
      const id = await guardarClip(form);
      if (!id) {
        snack({ message: "Falta el título del clip", variant: "error" });
        return;
      }
      setOpen(false);
      snack({
        message: editando ? "Clip actualizado" : "Clip agregado",
        variant: "success",
      });
    });
  };

  const columns: Column<Clip>[] = [
    {
      key: "title",
      header: "Clip",
      width: "3fr",
      render: (c) => (
        <div className="flex min-w-0 items-center gap-3">
          {c.poster && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={c.poster} alt="" className="size-12 shrink-0 rounded-lg object-cover" />
          )}
          <div className="min-w-0">
            <p className="truncate text-sm font-medium">{c.title}</p>
            <p className="line-clamp-1 text-xs text-muted">
              {c.src ? "Con video" : "Sólo póster"} · {c.description}
            </p>
          </div>
        </div>
      ),
    },
    { key: "duration", header: "Duración", width: "110px", hideOnMobile: true },
    { key: "year", header: "Año", width: "90px" },
  ];

  return (
    <>
      <DataTable
        columns={columns}
        rows={clips}
        rowKey={(c) => c.id}
        searchable
        searchPlaceholder="Buscar por título…"
        pageSize={10}
        density="comfortable"
        stickyHeader
        caption="Los videos del archivo"
        toolbar={
          <Button
            onClick={() => {
              setForm(CLIP_VACIO);
              setOpen(true);
            }}
          >
            Agregar clip
          </Button>
        }
        emptyState={<p className="py-8 text-center text-sm text-muted">Sin clips.</p>}
        rowActions={(c) => (
          <RowMenu
            items={[
              {
                label: "Editar",
                onClick: () => {
                  setForm({ ...c });
                  setOpen(true);
                },
              },
              { label: "", divider: true },
              { label: "Borrar", destructive: true, onClick: () => setABorrar(c) },
            ]}
          />
        )}
      />

      <FormModal
        open={open}
        onClose={() => setOpen(false)}
        title={form.id ? "Editar clip" : "Agregar clip"}
        description="Sin URL de video la tarjeta muestra el póster y no reproduce."
        submitLabel={form.id ? "Guardar cambios" : "Agregar"}
        submitting={pending}
        disabled={!form.title.trim()}
        onSubmit={submit}
        size="lg"
      >
        <div className="grid gap-4 sm:grid-cols-[3fr_1fr_1fr]">
          <Input
            label="Título"
            value={form.title}
            maxLength={120}
            autoFocus
            onChange={(e) => set("title", e.target.value)}
          />
          <Input
            label="Duración"
            value={form.duration}
            maxLength={12}
            placeholder="2:30"
            onChange={(e) => set("duration", e.target.value)}
          />
          <Input
            label="Año"
            type="number"
            value={form.year}
            onChange={(e) => set("year", Number(e.target.value))}
          />
        </div>

        <Textarea
          label="Descripción"
          value={form.description}
          maxLength={300}
          rows={2}
          autoResize
          onChange={(e) => set("description", e.target.value)}
        />

        <ImageField label="Póster" value={form.poster} onChange={(v) => set("poster", v)} />

        <Input
          label="URL del video"
          hint="Un .mp4 accesible públicamente. Opcional."
          value={form.src ?? ""}
          placeholder="https://…/final.mp4"
          onChange={(e) => set("src", e.target.value)}
        />
      </FormModal>

      <ConfirmDialog
        open={!!aBorrar}
        onClose={() => setABorrar(null)}
        onConfirm={() => {
          const c = aBorrar;
          if (!c) return;
          setABorrar(null);
          startTransition(async () => {
            await borrarClip(c.id);
            snack({ message: "Clip eliminado", variant: "error" });
          });
        }}
        title="Borrar clip"
      >
        <p className="text-sm font-medium">{aBorrar?.title}</p>
      </ConfirmDialog>
    </>
  );
}
