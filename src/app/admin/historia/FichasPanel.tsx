"use client";

import { useState, useTransition } from "react";
import { DataTable, Input, Select, useSnackbar, type Column } from "lib-kit-components";

import { guardarFichaDeCuenta } from "@/lib/admin/acciones";
import type { FichaCuentaRow } from "@/lib/admin/cuentas";
import type { Player } from "@/lib/historia/types";
import { MAX_SKILLS, type FichaInput } from "@/lib/social/ficha";
import { PIERNA_LABEL, POSICION_LABEL, type FichaSkill } from "@/lib/social/types";
import { EstadoPill, FormModal, RowMenu } from "../Dialogs";
import { Bloque, ListaEditor } from "./campos";

/** Solapa "Fichas": los datos y las skills que cada jugador carga de sí mismo.
 *
 *  ## Por qué existe
 *
 *  `PlayerSpotlight` muestra en `/historia` la ficha que la persona editó en
 *  `/perfil` —puesto, dorsal, medidas, ciudad y skills— antes que la que anotó
 *  el club en la solapa "Jugadores". Eso es lo correcto mientras la persona la
 *  cargue: nadie sabe mejor que ella de qué juega hoy. El problema es que es
 *  opcional, y en la práctica media docena de fichas quedan vacías porque
 *  alguien no quiso completarlas o se olvidó. Esta solapa las carga por ellos.
 *
 *  ## Qué edita, exactamente
 *
 *  **La cuenta de la persona**, no la ficha del club: escribe
 *  `trapnexport-user/{uid}.ficha`, el mismo documento y la misma clave que
 *  escribiría ella desde su perfil. No es una copia ni un valor por defecto —
 *  si después entra y edita su ficha, lo que cargue pisa esto, y está bien que
 *  así sea.
 *
 *  Eso también explica lo que **no** está acá: nombre, apodo, foto, bio,
 *  trayectoria y álbum. Todo eso es la ficha del club y vive en la solapa
 *  "Jugadores", que es otra colección. Dos formularios distintos porque son dos
 *  documentos distintos, y meterlos en un solo Guardar escondería que se está
 *  escribiendo la cuenta de otra persona.
 *
 *  ## Las dos razones por las que una ficha cargada no se ve
 *
 *  `getPlayers()` cruza las cuentas con las fichas de trayectoria por
 *  `playerId`, y sólo toma las **verificadas** y no suspendidas. Así que una
 *  cuenta sin vínculo con el plantel, o con el reclamo todavía sin aprobar, se
 *  puede cargar igual pero no aparece en `/historia`. La tabla lo dice en su
 *  columna de estado y el formulario lo repite arriba: cargar veinte campos y
 *  no ver ningún cambio es la clase de silencio que hace desconfiar del panel.
 */

const POSICIONES = Object.entries(POSICION_LABEL).map(([value, label]) => ({ value, label }));
const PIERNAS = Object.entries(PIERNA_LABEL).map(([value, label]) => ({ value, label }));

/** El formulario trabaja con strings porque los `<input type="number">`
 *  devuelven strings y el vacío tiene que poder viajar como "borrá este
 *  campo". Es la misma forma que usa `FichaEditor` en el perfil, y a propósito:
 *  los dos terminan en `saneaFicha`, que es quien convierte y acota. */
interface Form {
  edad: string;
  peso: string;
  altura: string;
  dorsal: string;
  posicion: string;
  piernaHabil: string;
  ciudad: string;
  skills: FichaSkill[];
}

const VACIO: Form = {
  edad: "",
  peso: "",
  altura: "",
  dorsal: "",
  posicion: "",
  piernaHabil: "",
  ciudad: "",
  skills: [],
};

const toForm = (c: FichaCuentaRow): Form => ({
  edad: c.ficha.edad?.toString() ?? "",
  peso: c.ficha.peso?.toString() ?? "",
  altura: c.ficha.altura?.toString() ?? "",
  dorsal: c.ficha.dorsal?.toString() ?? "",
  posicion: c.ficha.posicion ?? "",
  piernaHabil: c.ficha.piernaHabil ?? "",
  ciudad: c.ficha.ciudad ?? "",
  skills: (c.ficha.skills ?? []).map((s) => ({ ...s })),
});

/** `""` viaja como `null` y no como `undefined`: una clave `undefined`
 *  desaparece al serializar la Server Action, y el campo se quedaría con el
 *  valor viejo en vez de borrarse. */
const numOrNull = (v: string) => (v.trim() === "" ? null : Number(v));

const aInput = (f: Form): FichaInput => ({
  edad: numOrNull(f.edad),
  peso: numOrNull(f.peso),
  altura: numOrNull(f.altura),
  dorsal: numOrNull(f.dorsal),
  posicion: f.posicion || null,
  piernaHabil: f.piernaHabil || null,
  ciudad: f.ciudad || null,
  skills: f.skills,
});

/** Cuántos de los siete datos personales tiene cargados. Es el número de la
 *  columna: "3/7" dice más que "incompleta", que es casi todo el mundo. */
const cuantosDatos = (c: FichaCuentaRow) =>
  [
    c.ficha.dorsal,
    c.ficha.posicion,
    c.ficha.piernaHabil,
    c.ficha.edad,
    c.ficha.peso,
    c.ficha.altura,
    c.ficha.ciudad,
  ].filter((v) => v !== undefined && v !== "").length;

const TOTAL_DATOS = 7;

export function FichasPanel({
  cuentas,
  players,
}: {
  cuentas: FichaCuentaRow[];
  players: Player[];
}) {
  const { snack } = useSnackbar();
  const [pending, startTransition] = useTransition();

  const [editando, setEditando] = useState<FichaCuentaRow | null>(null);
  const [form, setForm] = useState<Form>(VACIO);

  const set = <K extends keyof Form>(k: K, v: Form[K]) => setForm((f) => ({ ...f, [k]: v }));

  /** El nombre del jugador vinculado, para no mostrar el slug pelado. Sale de
   *  las fichas que ya bajó la pantalla: son las mismas que edita la solapa de
   *  al lado, así que no hace falta pedir nada. */
  const nombreJugador = (playerId?: string) =>
    playerId ? (players.find((p) => p.id === playerId)?.name ?? playerId) : "";

  /** Se ve en `/historia` sólo si está vinculada, verificada y no suspendida:
   *  es exactamente el filtro de `fichasDeCuentas()` en `historia/queries`. */
  const sePublica = (c: FichaCuentaRow) => Boolean(c.playerId) && c.verified && !c.suspended;

  const abrir = (c: FichaCuentaRow) => {
    setForm(toForm(c));
    setEditando(c);
  };

  const submit = () => {
    const c = editando;
    if (!c) return;
    startTransition(async () => {
      const r = await guardarFichaDeCuenta(c.uid, aInput(form));
      if (!r.ok) {
        snack({ message: r.error, variant: "error" });
        return;
      }
      setEditando(null);
      snack({ message: `Ficha de ${c.name} guardada`, variant: "success" });
    });
  };

  const columns: Column<FichaCuentaRow>[] = [
    {
      key: "name",
      header: "Cuenta",
      width: "3fr",
      render: (c) => (
        <div className="flex min-w-0 items-center gap-3">
          {c.avatar && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={c.avatar} alt="" className="size-9 shrink-0 rounded-full object-cover" />
          )}
          <div className="min-w-0">
            <p className="truncate font-medium">{c.name}</p>
            <p className="truncate text-xs text-muted">@{c.handle}</p>
          </div>
        </div>
      ),
    },
    {
      key: "playerId",
      header: "Jugador",
      width: "2fr",
      hideOnMobile: true,
      render: (c) =>
        c.playerId ? (
          <span className="truncate">{nombreJugador(c.playerId)}</span>
        ) : (
          <span className="text-muted">Sin vínculo</span>
        ),
    },
    {
      key: "ficha",
      header: "Cargado",
      width: "160px",
      render: (c) => {
        const datos = cuantosDatos(c);
        const skills = c.ficha.skills?.length ?? 0;

        if (datos === 0 && skills === 0) return <EstadoPill tone="muted">Sin cargar</EstadoPill>;

        return (
          <span className="flex flex-wrap items-center gap-1">
            <EstadoPill tone={datos === TOTAL_DATOS ? "success" : "primary"}>
              {datos}/{TOTAL_DATOS} datos
            </EstadoPill>
            {skills > 0 && (
              <EstadoPill tone="primary">
                {skills} {skills === 1 ? "skill" : "skills"}
              </EstadoPill>
            )}
          </span>
        );
      },
    },
    {
      key: "verified",
      header: "En /historia",
      width: "130px",
      hideOnMobile: true,
      render: (c) =>
        sePublica(c) ? (
          <EstadoPill tone="success">Se ve</EstadoPill>
        ) : (
          <EstadoPill tone="muted">
            {!c.playerId ? "Sin vínculo" : c.suspended ? "Suspendida" : "Sin verificar"}
          </EstadoPill>
        ),
    },
  ];

  return (
    <>
      <DataTable
        columns={columns}
        rows={cuentas}
        rowKey={(c) => c.uid}
        searchable
        searchPlaceholder="Buscar por nombre o usuario…"
        pageSize={12}
        density="comfortable"
        stickyHeader
        caption="Las fichas que los jugadores cargan desde su perfil. Lo que se guarde acá es lo que muestra /historia."
        emptyState={
          <div className="py-8 text-center">
            <p className="text-sm text-muted">Todavía no hay cuentas registradas.</p>
          </div>
        }
        rowActions={(c) => (
          <RowMenu
            items={[
              { label: "Cargar ficha", onClick: () => abrir(c) },
              { label: "Ver el perfil", href: `/u/${c.handle}` },
              ...(c.playerId
                ? [{ label: "Ver en la app", href: `/historia?jugador=${c.playerId}` }]
                : []),
            ]}
          />
        )}
      />

      <FormModal
        open={!!editando}
        onClose={() => setEditando(null)}
        title={editando ? `Ficha de ${editando.name}` : "Ficha"}
        description={
          editando
            ? `Se guarda en la cuenta @${editando.handle}, el mismo lugar donde la edita ${editando.name}.`
            : undefined
        }
        submitLabel="Guardar ficha"
        submitting={pending}
        onSubmit={submit}
        size="lg"
      >
        {editando && !sePublica(editando) && (
          /*  El aviso va adentro del formulario y no como un botón apagado:
              cargar la ficha de alguien que todavía no está aprobado es válido
              —queda lista para cuando lo esté—; lo que no es válido es no
              enterarse de que no se está viendo. */
          <p className="rounded-xl border border-dashed border-border px-4 py-3 text-sm text-muted">
            {!editando.playerId
              ? "Esta cuenta no está vinculada a ningún jugador del plantel, así que su ficha no aparece en /historia. Se puede cargar igual: el vínculo se aprueba en Usuarios."
              : editando.suspended
                ? "La cuenta está suspendida: no se muestra en /historia ni en el feed hasta que se reactive."
                : "El vínculo con el plantel todavía no está confirmado, así que la ficha no aparece en /historia. Se aprueba en Usuarios."}
          </p>
        )}

        <Bloque title="Datos personales" hint="La grilla que abre su ficha en /historia.">
          <div className="grid gap-4 sm:grid-cols-2">
            <Input
              label="Dorsal"
              type="number"
              min={1}
              max={99}
              placeholder="10"
              value={form.dorsal}
              onChange={(e) => set("dorsal", e.target.value)}
            />
            <Input
              label="Edad"
              type="number"
              min={10}
              max={80}
              placeholder="27"
              value={form.edad}
              onChange={(e) => set("edad", e.target.value)}
            />
            <Input
              label="Peso (kg)"
              type="number"
              min={30}
              max={200}
              step={0.5}
              placeholder="74"
              value={form.peso}
              onChange={(e) => set("peso", e.target.value)}
            />
            <Input
              label="Altura (cm)"
              type="number"
              min={120}
              max={230}
              placeholder="178"
              value={form.altura}
              onChange={(e) => set("altura", e.target.value)}
            />
            <Select
              label="Posición"
              options={POSICIONES}
              value={form.posicion}
              placeholder="Elegí el puesto"
              onChange={(v) => set("posicion", v as string)}
            />
            <Select
              label="Pierna hábil"
              options={PIERNAS}
              value={form.piernaHabil}
              placeholder="Elegí una"
              onChange={(v) => set("piernaHabil", v as string)}
            />
            <Input
              label="Ciudad"
              placeholder="De dónde es"
              maxLength={40}
              value={form.ciudad}
              onChange={(e) => set("ciudad", e.target.value)}
            />
          </div>
        </Bloque>

        <Bloque
          title="Skills"
          hint="De 0 a 100 — es la escala de la barra, no una nota sobre 10. Sin ninguna, la ficha cae a las que tenga cargadas la trayectoria del club en la solapa Jugadores."
        >
          <ListaEditor
            label="Skills"
            items={form.skills}
            onChange={(v) => set("skills", v)}
            max={MAX_SKILLS}
            agregar="Agregar skill"
            vacio="Sin skills cargadas."
            nuevo={() => ({ label: "", value: 70 })}
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
      </FormModal>
    </>
  );
}
