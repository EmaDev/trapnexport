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

import { borrarJugador, guardarJugador, type PlayerInput } from "@/lib/historia/actions";
import type { Player, PlayerStatus } from "@/lib/historia/types";
import { ConfirmDialog, EstadoPill, FormModal, RowMenu } from "../Dialogs";
import { Bloque, ImageField, ListaEditor, ParesEditor, idLocal } from "./campos";
import { ClipsEditor, FotosEditor, FraseEditor } from "./medios";

/** Solapa "Jugadores": las fichas de trayectoria de `/historia`.
 *
 *  Es la ficha larga del panel —veinte campos y cinco listas— porque es la
 *  pantalla más larga de la app pública: `PlayerSpotlight` muestra datos
 *  personales, skills, carrera, álbum y frase.
 *
 *  Dos cosas que el formulario deja explícitas y conviene no perder:
 *
 *  - **El id no se edita.** Sale del nombre la primera vez (`naza-sochan`) y
 *    después queda fijo: es el `?jugador=` que se comparte por WhatsApp y el
 *    `playerId` con el que lo referencia el salón de cada temporada. Cambiarlo
 *    rompería los dos.
 *  - **Las skills y la frase pueden ir vacías.** No es un formulario a medio
 *    llenar: `PlayerSpotlight` tiene un guard para eso, y existe por la ficha
 *    de Yannick Castelo, que va sin datos inventados a propósito.
 */

const ESTADOS: { value: PlayerStatus; label: string }[] = [
  { value: "plantel", label: "En el plantel" },
  { value: "leyenda", label: "Leyenda" },
];

const VACIO: PlayerInput = {
  id: "",
  name: "",
  nickname: "",
  number: 0,
  position: "",
  years: "",
  status: "plantel",
  foot: "",
  height: "",
  birthplace: "",
  photo: "",
  avatar: "",
  bio: "",
  stats: [],
  skills: [],
  career: [],
  gallery: [],
  clips: [],
};

export function JugadoresPanel({ players }: { players: Player[] }) {
  const { snack } = useSnackbar();
  const [pending, startTransition] = useTransition();

  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<PlayerInput>(VACIO);
  const [aBorrar, setABorrar] = useState<Player | null>(null);

  const set = <K extends keyof PlayerInput>(k: K, v: PlayerInput[K]) =>
    setForm((f) => ({ ...f, [k]: v }));

  const abrirNuevo = () => {
    setForm(VACIO);
    setOpen(true);
  };

  const abrirEdicion = (p: Player) => {
    setForm({
      ...p,
      stats: [...p.stats],
      skills: [...p.skills],
      career: [...p.career],
      gallery: [...p.gallery],
      clips: [...p.clips],
    });
    setOpen(true);
  };

  const submit = () => {
    const editando = !!form.id;
    startTransition(async () => {
      const id = await guardarJugador(form);
      if (!id) {
        snack({ message: "Falta el nombre del jugador", variant: "error" });
        return;
      }
      setOpen(false);
      snack({
        message: editando ? "Ficha actualizada" : "Ficha creada",
        variant: "success",
      });
    });
  };

  const confirmarBorrado = () => {
    const p = aBorrar;
    if (!p) return;
    setABorrar(null);
    startTransition(async () => {
      await borrarJugador(p.id);
      snack({ message: "Ficha eliminada", variant: "error" });
    });
  };

  const columns: Column<Player>[] = [
    {
      key: "name",
      header: "Jugador",
      width: "3fr",
      render: (p) => (
        <div className="flex min-w-0 items-center gap-3">
          {p.avatar && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={p.avatar} alt="" className="size-9 shrink-0 rounded-full object-cover" />
          )}
          <div className="min-w-0">
            <p className="flex items-center gap-1.5 font-medium">
              <span className="truncate">{p.name}</span>
              {p.status === "leyenda" && <EstadoPill tone="primary">Leyenda</EstadoPill>}
            </p>
            <p className="truncate text-xs text-muted">
              {p.position || "Sin posición"} · {p.years || "sin años"}
            </p>
          </div>
        </div>
      ),
    },
    {
      key: "number",
      header: "N°",
      width: "70px",
      render: (p) => <span className="tabular-nums">{p.number || "—"}</span>,
    },
    { key: "id", header: "Id", width: "160px", hideOnMobile: true },
  ];

  return (
    <>
      <DataTable
        columns={columns}
        rows={players}
        rowKey={(p) => p.id}
        searchable
        searchPlaceholder="Buscar por nombre, apodo o posición…"
        pageSize={12}
        density="comfortable"
        stickyHeader
        caption="Las fichas de trayectoria"
        toolbar={<Button onClick={abrirNuevo}>Nuevo jugador</Button>}
        emptyState={
          <div className="py-8 text-center">
            <p className="text-sm text-muted">Todavía no hay fichas.</p>
            <Button className="mt-3" size="sm" onClick={abrirNuevo}>
              Crear la primera
            </Button>
          </div>
        }
        rowActions={(p) => (
          <RowMenu
            items={[
              { label: "Editar", onClick: () => abrirEdicion(p) },
              { label: "Ver en la app", href: `/historia?jugador=${p.id}` },
              { label: "", divider: true },
              { label: "Borrar", destructive: true, onClick: () => setABorrar(p) },
            ]}
          />
        )}
      />

      <FormModal
        open={open}
        onClose={() => setOpen(false)}
        title={form.id ? `Editar la ficha de ${form.name}` : "Nueva ficha"}
        description={
          form.id
            ? `Link público: /historia?jugador=${form.id}`
            : "El link público sale del nombre y después queda fijo."
        }
        submitLabel={form.id ? "Guardar cambios" : "Crear ficha"}
        submitting={pending}
        disabled={!form.name.trim()}
        onSubmit={submit}
        size="xl"
      >
        <Bloque title="Quién es">
          <div className="grid gap-4 sm:grid-cols-2">
            <Input
              label="Nombre"
              value={form.name}
              maxLength={80}
              autoFocus
              onChange={(e) => set("name", e.target.value)}
            />
            <Input
              label="Apodo"
              value={form.nickname}
              maxLength={60}
              onChange={(e) => set("nickname", e.target.value)}
            />
            <Input
              label="Número"
              type="number"
              min={0}
              value={form.number}
              onChange={(e) => set("number", Number(e.target.value))}
            />
            <Input
              label="Posición"
              value={form.position}
              maxLength={60}
              placeholder="Volante central"
              onChange={(e) => set("position", e.target.value)}
            />
            <Input
              label="Años en el club"
              hint='"2020 — hoy"'
              value={form.years}
              maxLength={40}
              onChange={(e) => set("years", e.target.value)}
            />
            <Select
              label="Estado"
              options={ESTADOS}
              value={form.status}
              onChange={(v) => set("status", v as PlayerStatus)}
            />
            <Input
              label="Pierna hábil"
              value={form.foot}
              maxLength={40}
              onChange={(e) => set("foot", e.target.value)}
            />
            <Input
              label="Altura"
              value={form.height}
              maxLength={40}
              placeholder="1,78 m"
              onChange={(e) => set("height", e.target.value)}
            />
            <Input
              label="De dónde es"
              value={form.birthplace}
              maxLength={80}
              onChange={(e) => set("birthplace", e.target.value)}
            />
          </div>

          <Textarea
            label="Bio"
            value={form.bio}
            maxLength={4000}
            showCount
            rows={4}
            autoResize
            onChange={(e) => set("bio", e.target.value)}
          />
        </Bloque>

        <Bloque title="Imágenes">
          <div className="grid gap-4 sm:grid-cols-2">
            <ImageField
              label="Foto"
              aspect="3 / 4"
              value={form.photo}
              onChange={(v) => set("photo", v)}
            />
            <ImageField
              label="Avatar"
              aspect="1 / 1"
              hint="El redondito de las listas."
              value={form.avatar}
              onChange={(v) => set("avatar", v)}
            />
          </div>
        </Bloque>

        <ParesEditor
          label="Datos de la ficha"
          hint="Partidos, goles, títulos… lo que se muestra como pares."
          items={form.stats}
          onChange={(v) => set("stats", v)}
        />

        <Bloque
          title="Skills"
          hint="De 0 a 100 — es la escala de la barra, no una nota sobre 10. Se puede dejar vacío: la ficha simplemente no muestra la sección."
        >
          <ListaEditor
            label="Skills"
            items={form.skills}
            onChange={(v) => set("skills", v)}
            max={12}
            agregar="Agregar skill"
            vacio="Sin skills: la ficha no muestra la sección."
            nuevo={() => ({ label: "", value: 50 })}
          >
            {(s, i, setS) => (
              <div className="grid gap-2 sm:grid-cols-[2fr_1fr]">
                <Input
                  label="Skill"
                  value={s.label}
                  maxLength={40}
                  placeholder="Pegada"
                  onChange={(e) => setS({ ...s, label: e.target.value })}
                />
                <Input
                  label="Valor"
                  type="number"
                  min={0}
                  max={100}
                  value={s.value}
                  onChange={(e) => setS({ ...s, value: Number(e.target.value) })}
                />
              </div>
            )}
          </ListaEditor>
        </Bloque>

        <Bloque title="Carrera" hint="Los pasos de su trayectoria, en orden.">
          <ListaEditor
            label="Pasos"
            items={form.career}
            onChange={(v) => set("career", v)}
            max={40}
            agregar="Agregar paso"
            vacio="Sin trayectoria cargada."
            nuevo={() => ({
              id: idLocal("p"),
              season: "",
              title: "",
              description: "",
              status: "done" as const,
            })}
          >
            {(c, i, setC) => (
              <>
                <div className="grid gap-2 sm:grid-cols-[1fr_2fr_1fr]">
                  <Input
                    label="Temporada"
                    value={c.season}
                    maxLength={40}
                    placeholder="2025"
                    onChange={(e) => setC({ ...c, season: e.target.value })}
                  />
                  <Input
                    label="Título"
                    value={c.title}
                    maxLength={160}
                    onChange={(e) => setC({ ...c, title: e.target.value })}
                  />
                  <Select
                    label="Estado"
                    options={[
                      { value: "done", label: "Cumplido" },
                      { value: "current", label: "En curso" },
                    ]}
                    value={c.status}
                    onChange={(v) => setC({ ...c, status: v as "done" | "current" })}
                  />
                </div>
                <Textarea
                  label="Descripción"
                  value={c.description}
                  maxLength={1200}
                  rows={2}
                  autoResize
                  onChange={(e) => setC({ ...c, description: e.target.value })}
                />
              </>
            )}
          </ListaEditor>
        </Bloque>

        <Bloque title="Álbum" hint="Sus fotos y sus clips.">
          <FotosEditor items={form.gallery} onChange={(v) => set("gallery", v)} />
          <ClipsEditor items={form.clips} onChange={(v) => set("clips", v)} />
        </Bloque>

        <FraseEditor
          value={form.quote}
          onChange={(v) => set("quote", v)}
          hint="Una cita suya. Dejala apagada si no hay una frase real que atribuirle."
        />
      </FormModal>

      <ConfirmDialog
        open={!!aBorrar}
        onClose={() => setABorrar(null)}
        onConfirm={confirmarBorrado}
        title="Borrar ficha"
        description="Se lleva su trayectoria y su álbum, y lo saca del salón de las temporadas que lo nombran. No se puede deshacer."
      >
        <p className="text-sm font-medium">{aBorrar?.name}</p>
        <p className="mt-1 text-sm text-muted">/historia?jugador={aBorrar?.id}</p>
      </ConfirmDialog>
    </>
  );
}
