"use client";

import { useId, useRef, useState } from "react";
import { Button, Input, useSnackbar } from "lib-kit-components";

import { ImageIcon, TrashIcon } from "@/components/atoms/icons";
import { subirImagenHistoria } from "@/lib/storage/historia-image";

/** Los campos que repiten las siete solapas de `/admin/historia`.
 *
 *  No es una abstracción de formulario: cada solapa arma el suyo con sus
 *  campos y su validación. Son las tres piezas que, escritas siete veces, se
 *  desincronizan — el selector de imagen, la lista repetible y el bloque
 *  agrupador— y que además concentran la parte que de verdad tiene lógica: la
 *  subida al bucket.
 *
 *  El equivalente para el resto del panel es `admin/Dialogs.tsx`, que aporta
 *  el modal y la confirmación de borrado. Esto es la capa de adentro.
 */

/* ── imagen ──────────────────────────────────────────────────────────────── */

/** Selector de imagen: miniatura, subir archivo, pegar URL y quitar.
 *
 *  Las **dos** vías existen a propósito y no es indecisión de diseño:
 *
 *  - *Subir* es lo normal y va al bucket (`trapnexport-historia/`), comprimida
 *    en el navegador. Es lo que se usa para las fotos reales del club.
 *  - *Pegar una URL* es la única forma de conservar lo que ya está cargado: la
 *    historia semilla usa data-URI generados por `lib/media.ts`, y un campo que
 *    sólo aceptara archivos obligaría a reemplazar las cien imágenes de relleno
 *    antes de poder corregir una falta de ortografía en un epígrafe.
 *
 *  El campo de texto muestra `data:image/svg+xml,…` recortado para los
 *  generados: el valor entero son miles de caracteres y llenaría el input de
 *  ruido, pero se sigue pudiendo pegar uno nuevo encima.
 */
export function ImageField({
  label,
  hint,
  value,
  onChange,
  aspect = "16 / 9",
}: {
  label: string;
  hint?: string;
  value: string;
  onChange: (src: string) => void;
  /** proporción de la miniatura: cuadrada para retratos y escudos */
  aspect?: string;
}) {
  const { snack } = useSnackbar();
  const input = useRef<HTMLInputElement>(null);
  const [subiendo, setSubiendo] = useState(false);
  const id = useId();

  const generada = value.startsWith("data:");

  const elegir = async (file: File | undefined) => {
    if (!file) return;
    setSubiendo(true);
    try {
      const { src } = await subirImagenHistoria(file);
      onChange(src);
      snack({ message: "Imagen subida", variant: "success" });
    } catch (e) {
      snack({
        message: e instanceof Error ? e.message : "No se pudo subir la imagen.",
        variant: "error",
      });
    } finally {
      setSubiendo(false);
      // El input se limpia siempre: sin esto, volver a elegir el mismo archivo
      // no dispara `change` y el segundo intento no hace nada.
      if (input.current) input.current.value = "";
    }
  };

  return (
    <div className="flex flex-col gap-2">
      <label htmlFor={id} className="text-sm font-medium">
        {label}
      </label>

      <div className="flex gap-3">
        <div
          className="relative shrink-0 overflow-hidden rounded-xl border border-border bg-surface-alt"
          style={{ width: 96, aspectRatio: aspect }}
        >
          {value ? (
            // eslint-disable-next-line @next/next/no-img-element -- data-URI o URL de Storage
            <img src={value} alt="" className="size-full object-cover" />
          ) : (
            <span className="flex size-full items-center justify-center text-muted">
              <ImageIcon width={20} height={20} />
            </span>
          )}
        </div>

        <div className="flex min-w-0 flex-1 flex-col gap-2">
          <Input
            id={id}
            value={generada ? "" : value}
            placeholder={generada ? "Imagen generada — pegá una URL para reemplazarla" : "https://…"}
            onChange={(e) => onChange(e.target.value)}
            hint={hint}
          />

          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              size="sm"
              variant="secondary"
              loading={subiendo}
              onClick={() => input.current?.click()}
            >
              Subir imagen
            </Button>

            {value && (
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={() => onChange("")}
              >
                Quitar
              </Button>
            )}
          </div>

          <input
            ref={input}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => elegir(e.target.files?.[0])}
          />
        </div>
      </div>
    </div>
  );
}

/* ── bloques y listas ────────────────────────────────────────────────────── */

/** Un grupo de campos con título dentro de un formulario largo.
 *
 *  Las fichas de jugador y de temporada tienen veinte campos y cinco listas;
 *  sin separadores el modal es una columna de inputs donde no se distingue
 *  "datos personales" de "carrera". */
export function Bloque({
  title,
  hint,
  children,
  actions,
}: {
  title: string;
  hint?: string;
  children: React.ReactNode;
  actions?: React.ReactNode;
}) {
  return (
    <fieldset className="flex flex-col gap-3 rounded-xl border border-border p-3">
      <legend className="flex items-center gap-2 px-1 text-xs font-semibold uppercase tracking-wide text-muted">
        {title}
      </legend>
      {hint && <p className="-mt-1 text-xs text-muted">{hint}</p>}
      {children}
      {actions}
    </fieldset>
  );
}

/** Lista repetible: agregar, borrar y reordenar filas de cualquier forma.
 *
 *  La usan los hitos de una etapa, los pasos de una carrera, las skills, los
 *  pares label/valor, las fotos y los clips embebidos — seis listas con seis
 *  formas distintas, así que la fila la dibuja quien la usa (`children`) y esto
 *  aporta sólo el marco: el botón de agregar, el de borrar y las flechas.
 *
 *  Reordenar es con flechas y no con drag: el contenido vive dentro de un modal
 *  con scroll, y arrastrar una fila dentro de un contenedor scrolleable dentro
 *  de otro es exactamente donde el drag se pelea con el scroll del teléfono.
 */
export function ListaEditor<T>({
  label,
  hint,
  items,
  onChange,
  nuevo,
  vacio = "Todavía no hay nada acá.",
  agregar = "Agregar",
  max = 60,
  children,
}: {
  label: string;
  hint?: string;
  items: T[];
  onChange: (items: T[]) => void;
  /** cómo se ve una fila nueva */
  nuevo: () => T;
  vacio?: string;
  agregar?: string;
  max?: number;
  /** dibuja una fila; `set` reemplaza ese ítem */
  children: (item: T, i: number, set: (v: T) => void) => React.ReactNode;
}) {
  const set = (i: number, v: T) => onChange(items.map((it, j) => (j === i ? v : it)));

  const quitar = (i: number) => onChange(items.filter((_, j) => j !== i));

  const mover = (i: number, delta: number) => {
    const j = i + delta;
    if (j < 0 || j >= items.length) return;
    const copia = [...items];
    [copia[i], copia[j]] = [copia[j], copia[i]];
    onChange(copia);
  };

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-sm font-medium">{label}</span>
        <span className="text-xs text-muted">
          {items.length}
          {max ? ` / ${max}` : ""}
        </span>
      </div>
      {hint && <p className="-mt-1 text-xs text-muted">{hint}</p>}

      {items.length === 0 && <p className="text-xs text-muted">{vacio}</p>}

      <ul className="flex flex-col gap-3">
        {items.map((item, i) => (
          <li
            key={i}
            className="flex flex-col gap-2 rounded-xl border border-border bg-surface-alt/40 p-3"
          >
            {children(item, i, (v) => set(i, v))}

            <div className="flex items-center justify-end gap-1">
              <Button
                type="button"
                size="sm"
                variant="ghost"
                disabled={i === 0}
                onClick={() => mover(i, -1)}
              >
                ↑
              </Button>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                disabled={i === items.length - 1}
                onClick={() => mover(i, 1)}
              >
                ↓
              </Button>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={() => quitar(i)}
                aria-label={`Quitar ${label.toLowerCase()} ${i + 1}`}
              >
                <TrashIcon width={16} height={16} />
              </Button>
            </div>
          </li>
        ))}
      </ul>

      <div>
        <Button
          type="button"
          size="sm"
          variant="secondary"
          disabled={items.length >= max}
          onClick={() => onChange([...items, nuevo()])}
        >
          {agregar}
        </Button>
      </div>
    </div>
  );
}

/** La lista de pares label/valor que llevan el hero, cada etapa, cada
 *  temporada y cada ficha. Es la única forma de fila que se repite igual en
 *  cuatro solapas, así que va envuelta y no como `children` de `ListaEditor`. */
export function ParesEditor({
  label,
  hint,
  items,
  onChange,
  max = 12,
}: {
  label: string;
  hint?: string;
  items: { label: string; value: string }[];
  onChange: (v: { label: string; value: string }[]) => void;
  max?: number;
}) {
  return (
    <ListaEditor
      label={label}
      hint={hint}
      items={items}
      onChange={onChange}
      max={max}
      agregar="Agregar dato"
      vacio="Sin datos cargados."
      nuevo={() => ({ label: "", value: "" })}
    >
      {(item, i, set) => (
        <div className="grid gap-2 sm:grid-cols-2">
          <Input
            label="Etiqueta"
            value={item.label}
            maxLength={40}
            placeholder="Formato"
            onChange={(e) => set({ ...item, label: e.target.value })}
          />
          <Input
            label="Valor"
            value={item.value}
            maxLength={60}
            placeholder="Fútbol 11"
            onChange={(e) => set({ ...item, value: e.target.value })}
          />
        </div>
      )}
    </ListaEditor>
  );
}

/** Id local para una fila nueva de una lista embebida.
 *
 *  Los ids definitivos los pone la Server Action (`newId` en
 *  `historia/actions.ts`): esto es sólo para que React tenga con qué
 *  identificar la fila mientras se la edita, antes de que exista en la base. */
export const idLocal = (prefijo: string) =>
  `${prefijo}_${Math.random().toString(36).slice(2, 9)}`;
