"use client";

import { useState, useTransition } from "react";
import {
  Button,
  DataTable,
  Input,
  Select,
  Textarea,
  useSnackbar,
  type Column,
} from "lib-kit-components";

import {
  borrarTemporada,
  guardarTemporada,
  type SeasonInput,
} from "@/lib/historia/actions";
import type { MilestoneKind, Player, Season } from "@/lib/historia/types";
import { ConfirmDialog, FormModal, RowMenu } from "../Dialogs";
import { Bloque, ImageField, ListaEditor, ParesEditor, idLocal } from "./campos";
import { KIND_OPCIONES } from "./EtapasPanel";
import { ClipsEditor, FotosEditor, FraseEditor } from "./medios";

/** Solapa "Temporadas": una fila por año, cada una con su página en
 *  `/historia/:año`.
 *
 *  El año es el id del documento (ver `TemporadaDoc`), así que editarlo es
 *  mover la temporada de URL. El formulario avisa y la acción hace el traslado
 *  —escribe el año nuevo y borra el viejo— en vez de dejar dos páginas con el
 *  mismo contenido.
 *
 *  El salón de la fama guarda `playerId`, no el jugador entero: por eso el
 *  campo es un `Select` con el plantel cargado y no un texto libre. Un id que
 *  no existe deja la fila fuera de la pantalla pública sin ningún error
 *  visible, que es la clase de dato roto que nadie encuentra.
 */

const VACIA: SeasonInput = {
  year: new Date().getFullYear(),
  title: "",
  tagline: "",
  cover: "",
  competition: "",
  position: "",
  captain: "Sin registro",
  topScorer: "Sin registro",
  stats: [],
  highlights: [],
  hallOfFame: [],
  gallery: [],
  clips: [],
};

export function TemporadasPanel({
  seasons,
  players,
}: {
  seasons: Season[];
  players: Player[];
}) {
  const { snack } = useSnackbar();
  const [pending, startTransition] = useTransition();

  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<SeasonInput>(VACIA);
  const [aBorrar, setABorrar] = useState<Season | null>(null);

  const set = <K extends keyof SeasonInput>(k: K, v: SeasonInput[K]) =>
    setForm((f) => ({ ...f, [k]: v }));

  const opcionesJugador = players.map((p) => ({ value: p.id, label: p.name }));

  const abrirNueva = () => {
    setForm(VACIA);
    setOpen(true);
  };

  const abrirEdicion = (s: Season) => {
    setForm({
      ...s,
      originalYear: s.year,
      stats: [...s.stats],
      highlights: [...s.highlights],
      hallOfFame: [...s.hallOfFame],
      gallery: [...s.gallery],
      clips: [...s.clips],
    });
    setOpen(true);
  };

  const submit = () => {
    const editando = !!form.originalYear;
    startTransition(async () => {
      const id = await guardarTemporada(form);
      if (!id) {
        snack({ message: "Faltan el año y el título", variant: "error" });
        return;
      }
      setOpen(false);
      snack({
        message: editando ? "Temporada actualizada" : "Temporada creada",
        variant: "success",
      });
    });
  };

  const confirmarBorrado = () => {
    const s = aBorrar;
    if (!s) return;
    setABorrar(null);
    startTransition(async () => {
      await borrarTemporada(s.year);
      snack({ message: "Temporada eliminada", variant: "error" });
    });
  };

  const columns: Column<Season>[] = [
    {
      key: "title",
      header: "Temporada",
      width: "3fr",
      render: (s) => (
        <div className="flex min-w-0 items-start gap-3">
          {s.cover && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={s.cover}
              alt=""
              className="hidden size-12 shrink-0 rounded-lg object-cover sm:block"
            />
          )}
          <div className="min-w-0">
            <p className="truncate font-medium">
              {s.year} · {s.title}
            </p>
            <p className="line-clamp-1 text-xs text-muted">{s.competition}</p>
          </div>
        </div>
      ),
    },
    { key: "position", header: "Cierre", width: "160px", hideOnMobile: true },
    {
      key: "highlights",
      header: "Hitos",
      width: "80px",
      hideOnMobile: true,
      render: (s) => <span className="tabular-nums">{s.highlights.length}</span>,
    },
  ];

  return (
    <>
      <DataTable
        columns={columns}
        rows={seasons}
        rowKey={(s) => String(s.year)}
        searchable
        searchPlaceholder="Buscar por año, título o torneo…"
        pageSize={10}
        density="comfortable"
        stickyHeader
        caption="Las temporadas, de la más reciente a la más vieja"
        toolbar={<Button onClick={abrirNueva}>Nueva temporada</Button>}
        emptyState={
          <div className="py-8 text-center">
            <p className="text-sm text-muted">Todavía no hay temporadas.</p>
            <Button className="mt-3" size="sm" onClick={abrirNueva}>
              Crear la primera
            </Button>
          </div>
        }
        rowActions={(s) => (
          <RowMenu
            items={[
              { label: "Editar", onClick: () => abrirEdicion(s) },
              { label: "Ver la página pública", href: `/historia/${s.year}` },
              { label: "", divider: true },
              { label: "Borrar", destructive: true, onClick: () => setABorrar(s) },
            ]}
          />
        )}
      />

      <FormModal
        open={open}
        onClose={() => setOpen(false)}
        title={form.originalYear ? `Editar la temporada ${form.originalYear}` : "Nueva temporada"}
        description="El año es la URL de la temporada: /historia/2026."
        submitLabel={form.originalYear ? "Guardar cambios" : "Crear temporada"}
        submitting={pending}
        disabled={!form.title.trim() || !form.year}
        onSubmit={submit}
        size="xl"
      >
        <div className="grid gap-4 sm:grid-cols-[1fr_3fr]">
          <Input
            label="Año"
            type="number"
            hint={
              form.originalYear && form.originalYear !== form.year
                ? `La página pasa a /historia/${form.year}`
                : "Es la URL"
            }
            value={form.year}
            onChange={(e) => set("year", Number(e.target.value))}
          />
          <Input
            label="Título"
            value={form.title}
            maxLength={120}
            placeholder="La tercera estrella"
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

        <ImageField
          label="Portada"
          value={form.cover}
          onChange={(v) => set("cover", v)}
        />

        <div className="grid gap-4 sm:grid-cols-2">
          <Input
            label="Competencia"
            value={form.competition}
            maxLength={160}
            placeholder="Copa Oro · Fútbol 11"
            onChange={(e) => set("competition", e.target.value)}
          />
          <Input
            label="Cómo terminó"
            hint="Una posición o la frase que la resume"
            value={form.position}
            maxLength={80}
            placeholder="Campeón"
            onChange={(e) => set("position", e.target.value)}
          />
          <Input
            label="Capitán"
            value={form.captain}
            maxLength={80}
            onChange={(e) => set("captain", e.target.value)}
          />
          <Input
            label="Goleador"
            value={form.topScorer}
            maxLength={80}
            onChange={(e) => set("topScorer", e.target.value)}
          />
        </div>

        <ParesEditor
          label="Números de la temporada"
          items={form.stats}
          onChange={(v) => set("stats", v)}
        />

        <Bloque title="Hitos" hint="Mes a mes, lo que pasó en el año.">
          <ListaEditor
            label="Hitos"
            items={form.highlights}
            onChange={(v) => set("highlights", v)}
            agregar="Agregar hito"
            vacio="La temporada todavía no tiene hitos."
            nuevo={() => ({
              id: idLocal("h"),
              month: "",
              title: "",
              description: "",
              kind: "evento" as MilestoneKind,
            })}
          >
            {(h, i, setH) => (
              <>
                <div className="grid gap-2 sm:grid-cols-[1fr_2fr_1fr]">
                  <Input
                    label="Mes"
                    value={h.month}
                    maxLength={40}
                    placeholder="Diciembre"
                    onChange={(e) => setH({ ...h, month: e.target.value })}
                  />
                  <Input
                    label="Título"
                    value={h.title}
                    maxLength={160}
                    onChange={(e) => setH({ ...h, title: e.target.value })}
                  />
                  <Select
                    label="Tipo"
                    options={KIND_OPCIONES}
                    value={h.kind}
                    onChange={(v) => setH({ ...h, kind: v as MilestoneKind })}
                  />
                </div>
                <Textarea
                  label="Descripción"
                  value={h.description}
                  maxLength={1200}
                  rows={2}
                  autoResize
                  onChange={(e) => setH({ ...h, description: e.target.value })}
                />
              </>
            )}
          </ListaEditor>
        </Bloque>

        <Bloque
          title="Salón de la temporada"
          hint="Quiénes la marcaron. Los jugadores salen de la solapa Jugadores."
        >
          <ListaEditor
            label="Destacados"
            items={form.hallOfFame}
            onChange={(v) => set("hallOfFame", v)}
            max={30}
            agregar="Agregar jugador"
            vacio={
              players.length
                ? "Nadie destacado todavía."
                : "Primero cargá jugadores en la solapa Jugadores."
            }
            nuevo={() => ({ playerId: players[0]?.id ?? "", reason: "" })}
          >
            {(h, i, setH) => (
              <div className="grid gap-2 sm:grid-cols-[1fr_2fr]">
                <Select
                  label="Jugador"
                  options={opcionesJugador}
                  value={h.playerId}
                  onChange={(v) => setH({ ...h, playerId: v })}
                />
                <Input
                  label="Motivo"
                  value={h.reason}
                  maxLength={200}
                  placeholder="El gol de la final"
                  onChange={(e) => setH({ ...h, reason: e.target.value })}
                />
              </div>
            )}
          </ListaEditor>
        </Bloque>

        <Bloque title="Álbum" hint="Las fotos y los videos de esa temporada.">
          <FotosEditor items={form.gallery} onChange={(v) => set("gallery", v)} />
          <ClipsEditor items={form.clips} onChange={(v) => set("clips", v)} />
        </Bloque>

        <FraseEditor
          value={form.quote}
          onChange={(v) => set("quote", v)}
          hint="La cita que cierra la página de la temporada."
        />
      </FormModal>

      <ConfirmDialog
        open={!!aBorrar}
        onClose={() => setABorrar(null)}
        onConfirm={confirmarBorrado}
        title="Borrar temporada"
        description="Se lleva sus hitos, su álbum y su página pública. No se puede deshacer."
      >
        <p className="text-sm font-medium">
          {aBorrar?.year} · {aBorrar?.title}
        </p>
        <p className="mt-1 text-sm text-muted">/historia/{aBorrar?.year}</p>
      </ConfirmDialog>
    </>
  );
}
