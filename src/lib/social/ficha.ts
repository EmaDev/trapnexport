import type { FichaSkill, PiernaHabil, PlayerFicha, Posicion } from "@/lib/social/types";

/** El saneador de la ficha deportiva, en un solo lugar.
 *
 *  Hay **dos** caminos que escriben la misma ficha y tienen que dejarla igual:
 *
 *    `updateFicha`            el propio jugador, desde `/perfil`
 *    `guardarFichaDeCuenta`   el admin, desde `/admin/historia` → Fichas
 *
 *  El segundo existe porque la ficha es opcional y mucha gente no la completa:
 *  el panel la carga por ellos. Si cada uno validara por su cuenta, el día que
 *  se agregue un campo uno de los dos se olvidaría, y el que se olvide guarda
 *  basura en la misma clave que el otro defiende.
 *
 *  No es un archivo de acciones: no lleva `"use server"` ni toca Firestore. Es
 *  una función pura que recibe lo que mandó un formulario —strings, `null`,
 *  `NaN`, lo que sea— y devuelve una `PlayerFicha` válida. Quien la guarda
 *  decide sobre qué documento.
 *
 *  Los rangos se validan acá y no sólo en el `<input type="number">`: el input
 *  frena a un dedo distraído, esto frena a cualquiera que llame la acción.
 */

/** Lo que puede llegar de un formulario: todo opcional y anulable.
 *
 *  `null` y `undefined` significan lo mismo —"este campo queda vacío"— porque
 *  la ficha se reemplaza entera en cada guardado. El `null` explícito es el que
 *  manda el editor: una clave `undefined` desaparece al serializar una Server
 *  Action, y sin ella el campo se quedaría con el valor viejo en vez de
 *  borrarse. */
export interface FichaInput {
  edad?: number | null;
  peso?: number | null;
  altura?: number | null;
  dorsal?: number | null;
  piernaHabil?: string | null;
  posicion?: string | null;
  ciudad?: string | null;
  skills?: { label?: string; value?: number }[] | null;
}

/** Cuántas skills entran en una ficha. Es el mismo tope que la ficha de
 *  trayectoria del club (`guardarJugador`): las dos se dibujan con la misma
 *  lista de barras, y doce ya es más de lo que alguien mira de un scroll. */
export const MAX_SKILLS = 12;

export const POSICIONES = [
  "arquero",
  "defensor",
  "mediocampista",
  "delantero",
  "polifuncional",
] as const satisfies readonly Posicion[];

export const PIERNAS = [
  "derecha",
  "izquierda",
  "ambidiestro",
] as const satisfies readonly PiernaHabil[];

/** Número dentro de rango, o `undefined` (que borra el campo). Rechaza NaN,
 *  negativos y decimales donde no corresponde. */
const num = (v: number | null | undefined, min: number, max: number, dec = 0) => {
  if (v === null || v === undefined || Number.isNaN(v)) return undefined;
  if (v < min || v > max) return undefined;
  return dec === 0 ? Math.round(v) : Math.round(v * 10 ** dec) / 10 ** dec;
};

const enumOf = <T extends string>(v: string | null | undefined, valid: readonly T[]) =>
  v && (valid as readonly string[]).includes(v) ? (v as T) : undefined;

/** Las skills cargadas, o `undefined` si no quedó ninguna.
 *
 *  Una fila sin etiqueta se descarta en vez de guardarse vacía: el editor deja
 *  agregar una fila y no llenarla, y una barra sin nombre en `/historia` es una
 *  ficha rota, no un dato pendiente.
 *
 *  Devuelve `undefined` y no `[]` cuando no queda nada, y la diferencia es la
 *  que decide de dónde saca las skills la pantalla de historia: una lista vacía
 *  guardada taparía las del club sin poner nada en su lugar. */
const saneaSkills = (v: FichaInput["skills"]): FichaSkill[] | undefined => {
  const limpias = (v ?? [])
    .slice(0, MAX_SKILLS)
    .map((s) => ({
      label: (s?.label ?? "").trim().slice(0, 40),
      value: num(s?.value, 0, 100) ?? 0,
    }))
    .filter((s) => s.label !== "");

  return limpias.length ? limpias : undefined;
};

/** La ficha lista para guardar, con los campos vacíos **ausentes**.
 *
 *  Firestore rechaza `undefined`, así que las claves sin valor no se incluyen:
 *  como la ficha se reemplaza entera, un campo que no viene es un campo
 *  borrado — que es justo lo que espera quien limpia el input y guarda. */
export function saneaFicha(input: FichaInput): PlayerFicha {
  const ficha: PlayerFicha = {
    edad: num(input.edad, 10, 80),
    peso: num(input.peso, 30, 200, 1),
    altura: num(input.altura, 120, 230),
    dorsal: num(input.dorsal, 1, 99),
    piernaHabil: enumOf(input.piernaHabil, PIERNAS),
    posicion: enumOf(input.posicion, POSICIONES),
    ciudad: input.ciudad?.trim().slice(0, 40) || undefined,
    skills: saneaSkills(input.skills),
  };

  return Object.fromEntries(
    Object.entries(ficha).filter(([, v]) => v !== undefined),
  ) as PlayerFicha;
}

/** Si la ficha tiene algo cargado. Lo usan las pantallas para no dibujar una
 *  sección vacía y el panel para marcar las cuentas que faltan completar. */
export const fichaVacia = (f: PlayerFicha | undefined): boolean =>
  !f || Object.keys(f).length === 0;
