"use client";

import { useState, useTransition } from "react";
import {
  Button,
  Card,
  Input,
  ProgressBar,
  Select,
  Textarea,
  useSnackbar,
} from "lib-kit-components";

import {
  BallIcon,
  BootIcon,
  CakeIcon,
  PencilIcon,
  PinIcon,
  PlusIcon,
  RulerIcon,
  ScaleIcon,
  ShirtIcon,
  TrashIcon,
} from "@/components/atoms/icons";
import { updateFicha } from "@/lib/social/actions";
import { MAX_SKILLS } from "@/lib/social/ficha";
import {
  PIERNA_LABEL,
  POSICION_LABEL,
  type FichaSkill,
  type PlayerFicha,
} from "@/lib/social/types";

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
  /** las skills sí van tipadas: el valor es un número con tope y la barra de
   *  la vista previa lo dibuja mientras se escribe. Un string acá obligaría a
   *  convertir en cada render para pintar la barra. */
  skills: FichaSkill[];
}

/** Las que sugiere el botón de agregar, en orden. No son obligatorias —la
 *  etiqueta es texto libre— pero arrancar con "Pegada" en vez de un campo
 *  vacío es la diferencia entre cargar tres skills y abandonar en la primera. */
const SKILLS_SUGERIDAS = [
  "Pegada",
  "Velocidad",
  "Gambeta",
  "Marca",
  "Visión de juego",
  "Cabezazo",
  "Resistencia",
  "Liderazgo",
];

const toForm = (f: PlayerFicha, bio?: string): Form => ({
  edad: f.edad?.toString() ?? "",
  peso: f.peso?.toString() ?? "",
  altura: f.altura?.toString() ?? "",
  dorsal: f.dorsal?.toString() ?? "",
  posicion: f.posicion ?? "",
  piernaHabil: f.piernaHabil ?? "",
  ciudad: f.ciudad ?? "",
  bio: bio ?? "",
  // Copia y no la referencia: el editor muta la lista al agregar y al borrar, y
  // la de las props es la que el servidor bajó — cancelar tiene que poder
  // volver a ella.
  skills: (f.skills ?? []).map((s) => ({ ...s })),
});

/** `""` viaja como `null` y no como `undefined`: una clave `undefined`
 *  desaparece al serializar la Server Action, y el campo se quedaría con el
 *  valor viejo en vez de borrarse. */
const numOrNull = (v: string) => (v.trim() === "" ? null : Number(v));

/** Panel de información personal del perfil: los datos y las skills.
 *
 *  Dos estados en el mismo lugar: la ficha en modo lectura —una grilla de
 *  datos con su ícono y las skills como barras— y el formulario. No es un
 *  modal: el perfil es la pantalla donde estos datos viven, y sacarlos a una
 *  hoja aparte agrega un paso para cambiar un número de camiseta.
 *
 *  **Lo que se carga acá es lo que muestra `/historia`.** La ficha de
 *  trayectoria del club sigue existiendo y la edita el panel, pero en la
 *  pantalla pública gana lo que cargó la persona: nadie sabe mejor que ella de
 *  qué juega hoy. Lo del club queda de respaldo campo por campo, para el
 *  jugador que no tiene cuenta o que todavía no completó nada — y para eso
 *  mismo el panel tiene su propia solapa que carga esta ficha por quien no la
 *  llenó (`/admin/historia` → Fichas).
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

  const set = <K extends keyof Form>(k: K, v: Form[K]) => setForm((p) => ({ ...p, [k]: v }));

  /* ── skills ────────────────────────────────────────────────────────────── */

  const setSkill = (i: number, v: FichaSkill) =>
    set("skills", form.skills.map((s, j) => (j === i ? v : s)));

  const quitarSkill = (i: number) => set("skills", form.skills.filter((_, j) => j !== i));

  /** La primera sugerencia que todavía no está en la lista, o una fila vacía
   *  cuando ya se usaron todas. Comparar sin distinguir mayúsculas evita
   *  ofrecer "Pegada" a quien ya escribió "pegada". */
  const agregarSkill = () => {
    const usadas = new Set(form.skills.map((s) => s.label.trim().toLowerCase()));
    const sugerida = SKILLS_SUGERIDAS.find((s) => !usadas.has(s.toLowerCase())) ?? "";
    set("skills", [...form.skills, { label: sugerida, value: 70 }]);
  };

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
        // Van siempre, aun vacías: la ficha se reemplaza entera, así que
        // mandar la lista tal como se ve es lo que permite borrar una skill.
        skills: form.skills,
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

  const skills = ficha.skills ?? [];

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
        filas.length === 0 && skills.length === 0 ? (
          <p className="rounded-xl border border-dashed border-border px-4 py-6 text-center text-sm text-muted">
            Todavía no cargaste tus datos. Tocá <strong className="font-semibold">Editar</strong>{" "}
            para completar posición, dorsal, tus skills y el resto. Es lo que se muestra en tu
            ficha de la historia del club.
          </p>
        ) : (
          <>
            {filas.length > 0 && (
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
            )}

            {/* Las mismas barras que dibuja `PlayerSpotlight` en `/historia`:
                lo que se ve acá es literalmente lo que va a ver el resto. */}
            {skills.length > 0 && (
              <section className="flex flex-col gap-2.5">
                <h4 className="text-[11px] font-semibold uppercase tracking-wide text-muted">
                  Skills
                </h4>
                {skills.map((s) => (
                  <div key={s.label}>
                    <div className="mb-1 flex items-baseline justify-between gap-2">
                      <span className="truncate text-[13px] font-medium">{s.label}</span>
                      <span className="text-[13px] font-bold tabular-nums text-primary">
                        {s.value}
                      </span>
                    </div>
                    <ProgressBar
                      value={s.value}
                      max={100}
                      size="sm"
                      tone={s.value >= 90 ? "accent" : "primary"}
                    />
                  </div>
                ))}
              </section>
            )}
          </>
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

          {/* ── skills ──────────────────────────────────────────────────────
              Nombre libre y no una lista cerrada de seis: los seis atributos
              fijos ya existen y son la carta (`PlayerCard`), que se calculan
              del puesto. Esto es lo otro — lo que cada uno dice de sí mismo—,
              y encerrarlo en un vocabulario del sistema le sacaría justamente
              eso. El tope lo pone `MAX_SKILLS`, igual que la ficha del club. */}
          <fieldset className="flex flex-col gap-2 rounded-xl border border-border p-3">
            <legend className="px-1 text-[11px] font-semibold uppercase tracking-wide text-muted">
              Skills
            </legend>
            <p className="-mt-1 text-xs text-muted">
              Lo que mejor te sale, del 0 al 100. Sale en tu ficha de la historia del club y
              alimenta el general de tu carta.
            </p>

            {form.skills.length === 0 && (
              <p className="text-xs text-muted">
                Todavía no cargaste ninguna. Sin skills, tu ficha muestra las que tenga cargadas
                el club.
              </p>
            )}

            <ul className="flex flex-col gap-3">
              {form.skills.map((s, i) => (
                // La clave es el índice y no la etiqueta: la etiqueta se está
                // escribiendo, y una clave que cambia en cada tecla desmonta el
                // input y le saca el foco al segundo caracter.
                <li key={i} className="flex flex-col gap-1.5">
                  <div className="flex items-end gap-2">
                    <Input
                      className="min-w-0 flex-1"
                      label={`Skill ${i + 1}`}
                      value={s.label}
                      maxLength={40}
                      placeholder="Pegada"
                      onChange={(e) => setSkill(i, { ...s, label: e.target.value })}
                    />
                    <span className="w-10 shrink-0 pb-2.5 text-right text-sm font-bold tabular-nums text-primary">
                      {s.value}
                    </span>
                    <Button
                      className="shrink-0"
                      size="sm"
                      variant="ghost"
                      aria-label={`Quitar ${s.label || `skill ${i + 1}`}`}
                      onClick={() => quitarSkill(i)}
                    >
                      <TrashIcon width={16} height={16} />
                    </Button>
                  </div>
                  {/* Nativo y no un componente de la librería: no tiene slider
                      simple, y para esto —un número de 0 a 100 con el pulgar—
                      el control del navegador es el que mejor se toca. */}
                  <input
                    type="range"
                    min={0}
                    max={100}
                    step={1}
                    value={s.value}
                    aria-label={`Nivel de ${s.label || `la skill ${i + 1}`}`}
                    className="h-1.5 w-full cursor-pointer appearance-none rounded-full bg-border accent-primary"
                    onChange={(e) => setSkill(i, { ...s, value: Number(e.target.value) })}
                  />
                </li>
              ))}
            </ul>

            <div>
              <Button
                size="sm"
                variant="secondary"
                disabled={form.skills.length >= MAX_SKILLS}
                leftIcon={<PlusIcon width={16} height={16} />}
                onClick={agregarSkill}
              >
                Agregar skill
              </Button>
            </div>
          </fieldset>

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
