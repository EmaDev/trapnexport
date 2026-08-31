"use client";

import { useState, useTransition } from "react";
import { Button, Card, Input, Select, Textarea, useSnackbar } from "lib-kit-components";

import {
  BallIcon,
  BootIcon,
  CakeIcon,
  PencilIcon,
  PinIcon,
  RulerIcon,
  ScaleIcon,
  ShirtIcon,
} from "@/components/atoms/icons";
import { updateFicha } from "@/lib/social/actions";
import { PIERNA_LABEL, POSICION_LABEL, type PlayerFicha } from "@/lib/social/types";

/** Las opciones salen de los mismos mapas que usa la lectura (`types.ts`), así
 *  que agregar una posición es tocar un archivo y no dos. */
const POSICIONES = Object.entries(POSICION_LABEL).map(([value, label]) => ({ value, label }));
const PIERNAS = Object.entries(PIERNA_LABEL).map(([value, label]) => ({ value, label }));

/** El formulario trabaja con strings porque los `<input type="number">`
 *  devuelven strings y el vacío tiene que poder viajar como "borrá este
 *  campo". La conversión a número, y el rango, se hacen en `updateFicha`: el
 *  `min`/`max` del input frena a un dedo distraído, no a quien llame la
 *  action. */
interface Form {
  edad: string;
  peso: string;
  altura: string;
  dorsal: string;
  posicion: string;
  piernaHabil: string;
  ciudad: string;
  bio: string;
}

const toForm = (f: PlayerFicha, bio?: string): Form => ({
  edad: f.edad?.toString() ?? "",
  peso: f.peso?.toString() ?? "",
  altura: f.altura?.toString() ?? "",
  dorsal: f.dorsal?.toString() ?? "",
  posicion: f.posicion ?? "",
  piernaHabil: f.piernaHabil ?? "",
  ciudad: f.ciudad ?? "",
  bio: bio ?? "",
});

/** `""` viaja como `null` y no como `undefined`: una clave `undefined`
 *  desaparece al serializar la Server Action, y el campo se quedaría con el
 *  valor viejo en vez de borrarse. */
const numOrNull = (v: string) => (v.trim() === "" ? null : Number(v));

/** Panel de información personal del perfil.
 *
 *  Dos estados en el mismo lugar: la ficha en modo lectura —una grilla de
 *  datos con su ícono— y el formulario. No es un modal: el perfil es la
 *  pantalla donde estos datos viven, y sacarlos a una hoja aparte agrega un
 *  paso para cambiar un número de camiseta.
 *
 *  La bio se edita acá aunque no sea parte de `PlayerFicha`: para quien usa la
 *  app "mis datos" es una sola cosa y son un solo Guardar. La separación entre
 *  dato de jugador y dato de cuenta vive en el modelo, no en la pantalla.
 */
export function FichaEditor({ ficha, bio }: { ficha: PlayerFicha; bio?: string }) {
  const { snack } = useSnackbar();
  const [editando, setEditando] = useState(false);
  const [form, setForm] = useState<Form>(() => toForm(ficha, bio));
  const [pending, startTransition] = useTransition();

  const set = <K extends keyof Form>(k: K, v: string) => setForm((p) => ({ ...p, [k]: v }));

  const abrir = () => {
    // Rearma el formulario desde las props: si se canceló una edición previa,
    // los valores descartados siguen en el estado y reaparecerían al reabrir.
    setForm(toForm(ficha, bio));
    setEditando(true);
  };

  const guardar = () => {
    startTransition(async () => {
      await updateFicha({
        edad: numOrNull(form.edad),
        peso: numOrNull(form.peso),
        altura: numOrNull(form.altura),
        dorsal: numOrNull(form.dorsal),
        posicion: form.posicion || null,
        piernaHabil: form.piernaHabil || null,
        ciudad: form.ciudad || null,
        bio: form.bio || null,
      });
      setEditando(false);
      snack({ message: "Datos actualizados" });
    });
  };

  const filas = [
    { icon: <ShirtIcon />, label: "Dorsal", value: ficha.dorsal ? `#${ficha.dorsal}` : null },
    {
      icon: <BallIcon />,
      label: "Posición",
      value: ficha.posicion ? POSICION_LABEL[ficha.posicion] : null,
    },
    {
      icon: <BootIcon />,
      label: "Pierna hábil",
      value: ficha.piernaHabil ? PIERNA_LABEL[ficha.piernaHabil] : null,
    },
    { icon: <CakeIcon />, label: "Edad", value: ficha.edad ? `${ficha.edad} años` : null },
    { icon: <ScaleIcon />, label: "Peso", value: ficha.peso ? `${ficha.peso} kg` : null },
    { icon: <RulerIcon />, label: "Altura", value: ficha.altura ? `${ficha.altura} cm` : null },
    { icon: <PinIcon />, label: "Ciudad", value: ficha.ciudad ?? null },
  ].filter((f) => f.value !== null);

  return (
    <Card variant="outline" padding="md" className="flex flex-col gap-4">
      <div className="flex items-center gap-3">
        <h3 className="text-sm font-semibold">Información personal</h3>
        {!editando && (
          <Button
            className="ml-auto shrink-0"
            size="sm"
            variant="ghost"
            leftIcon={<PencilIcon className="size-4" width="1em" height="1em" />}
            onClick={abrir}
          >
            Editar
          </Button>
        )}
      </div>

      {!editando ? (
        filas.length === 0 ? (
          <p className="rounded-xl border border-dashed border-border px-4 py-6 text-center text-sm text-muted">
            Todavía no cargaste tus datos. Tocá <strong className="font-semibold">Editar</strong>{" "}
            para completar posición, dorsal y el resto.
          </p>
        ) : (
          <dl className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {filas.map((f) => (
              <div
                key={f.label}
                className="flex items-center gap-2.5 rounded-xl bg-surface-alt px-3 py-2.5"
              >
                <span className="shrink-0 text-primary [&>svg]:size-5">{f.icon}</span>
                <div className="min-w-0">
                  <dt className="text-[11px] uppercase tracking-wide text-muted">{f.label}</dt>
                  <dd className="truncate text-sm font-semibold">{f.value}</dd>
                </div>
              </div>
            ))}
          </dl>
        )
      ) : (
        <div className="flex flex-col gap-3">
          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Dorsal"
              type="number"
              inputMode="numeric"
              min={1}
              max={99}
              placeholder="10"
              value={form.dorsal}
              onChange={(e) => set("dorsal", e.target.value)}
            />
            <Input
              label="Edad"
              type="number"
              inputMode="numeric"
              min={10}
              max={80}
              placeholder="27"
              value={form.edad}
              onChange={(e) => set("edad", e.target.value)}
            />
            <Input
              label="Peso (kg)"
              type="number"
              inputMode="decimal"
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
              inputMode="numeric"
              min={120}
              max={230}
              placeholder="178"
              value={form.altura}
              onChange={(e) => set("altura", e.target.value)}
            />
          </div>

          <Select
            label="Posición"
            options={POSICIONES}
            value={form.posicion}
            placeholder="Elegí tu puesto"
            onChange={(v) => set("posicion", v)}
          />
          <Select
            label="Pierna hábil"
            options={PIERNAS}
            value={form.piernaHabil}
            placeholder="Elegí una"
            onChange={(v) => set("piernaHabil", v)}
          />
          <Input
            label="Ciudad"
            placeholder="De dónde sos"
            maxLength={40}
            value={form.ciudad}
            onChange={(e) => set("ciudad", e.target.value)}
          />
          <Textarea
            label="Bio"
            rows={2}
            autoResize
            maxLength={160}
            showCount
            placeholder="Una línea sobre vos"
            value={form.bio}
            onChange={(e) => set("bio", e.target.value)}
          />

          <div className="flex gap-2">
            <Button loading={pending} onClick={guardar}>
              Guardar
            </Button>
            <Button variant="ghost" disabled={pending} onClick={() => setEditando(false)}>
              Cancelar
            </Button>
          </div>
        </div>
      )}
    </Card>
  );
}
