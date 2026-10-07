import type { ReactNode } from "react";

import type { EventoRow } from "@/lib/contenido/queries";
import {
  formatoDescripcion,
  itemsDeDescripcion,
  TIPO_EVENTO,
} from "@/lib/contenido/types";

/** El programa del día del evento, hora por hora.
 *
 *  Lo comparten el panel y el feed a propósito: son la **misma** lista —el
 *  cronograma es uno solo— y escrita dos veces se desincroniza en lo que
 *  importa, que es el color por tipo. Si el partido es violeta en `/admin` y
 *  gris en el feed, la leyenda deja de significar algo.
 *
 *  No sale de `lib-kit-components`. `CalendarGrid` es mensual, y con un solo
 *  día activo dibuja treinta celdas vacías y una con todo encimado adentro.
 *  `ItineraryTimeline` es de varios días y su `ActivityKind` es vocabulario de
 *  viajes (`flight`, `hotel`, `food`): ninguno de sus íconos representa un
 *  partido ni una asamblea, y no pinta el color por tipo, que es lo que hace
 *  legible el día de un golpe.
 *
 *  Sólo importa el **tipo** `EventoRow` y helpers puros de `contenido/types`
 *  —que no importan nada—, así que entra al bundle del navegador sin arrastrar
 *  la base en memoria.
 */

/** El color del tipo, resuelto a clase de Tailwind. Los nombres van completos y
 *  no armados con template: el JIT sólo ve lo que está escrito. */
const PUNTO: Record<string, string> = {
  primary: "bg-primary",
  success: "bg-success",
  accent: "bg-accent",
  muted: "bg-muted",
  danger: "bg-danger",
};

/** La descripción, dibujada como el evento pide.
 *
 *  Las dos formas y no una sola: un bloque del día puede ser una frase o un
 *  programa de seis pasos, y el párrafo corrido de seis pasos obliga a buscar
 *  las comas para saber qué pasa primero. Cuál de las dos se usa lo decide el
 *  dato —`formatoDescripcion`—, no la pantalla: el feed y el panel tienen que
 *  leer lo mismo. Ver `FormatoEvento` en `contenido/types.ts`.
 */
function Descripcion({ evento }: { evento: EventoRow }) {
  if (!evento.descripcion.trim()) return null;

  const apagado = evento.pasado ? "opacity-70" : "";

  if (formatoDescripcion(evento) === "parrafo") {
    return (
      <p className={`mt-1 line-clamp-3 text-[13px] leading-relaxed text-muted ${apagado}`}>
        {evento.descripcion}
      </p>
    );
  }

  const items = itemsDeDescripcion(evento.descripcion);

  return (
    // `whitespace-normal` porque en el panel la fila entera es un `button`, y
    // ahí los ítems heredarían el `text-left` sin el wrap que necesitan.
    <ul className={`mt-1.5 flex flex-col gap-1 whitespace-normal ${apagado}`}>
      {items.map((item, i) => (
        <li key={i} className="flex gap-2 text-[13px] leading-snug text-muted">
          {/* `bg-current`: la viñeta toma el color del texto del ítem —el muted
              del tema, atenuado— y no un token propio que en el tema oscuro
              quedaría casi invisible contra el fondo. */}
          <span
            aria-hidden
            className="mt-1.5 size-1.5 shrink-0 rounded-full bg-current opacity-50"
          />
          <span className="min-w-0">{item}</span>
        </li>
      ))}
    </ul>
  );
}

export function CronogramaDia({
  eventos,
  onEventoClick,
  cruces,
  vacio,
  nota,
  className = "",
}: {
  eventos: EventoRow[];
  /** con handler cada fila es un botón; sin él es texto, que es lo que el feed
   *  necesita — ahí el cronograma se lee, no se edita */
  onEventoClick?: (evento: EventoRow) => void;
  /** id del evento → los que se pisan con él. Es una preocupación del panel:
   *  el que carga el día tiene que verlo, el que lo lee no. */
  cruces?: Map<string, { nombre: string }[]>;
  /** qué mostrar sin eventos; cada pantalla ofrece su propia salida */
  vacio?: ReactNode;
  /** se agrega al pie, después de la leyenda de colores */
  nota?: ReactNode;
  className?: string;
}) {
  if (eventos.length === 0) {
    return (
      <div className={className}>
        {vacio ?? <p className="py-8 text-center text-sm text-muted">El día está vacío.</p>}
      </div>
    );
  }

  return (
    <div className={className}>
      <ol className="flex flex-col">
        {eventos.map((e) => {
          const pisa = cruces?.get(e.id) ?? [];

          const contenido = (
            <>
              {/* La hora arriba y no centrada: con una lista de ítems abajo, la
                  fila crece y una hora al medio deja de leerse como el momento
                  en que empieza. `w-16` entra "23:30" sin romperse en dos. */}
              <div className="w-16 shrink-0 self-start text-right tabular-nums">
                <p
                  className={`text-sm font-semibold leading-5 ${
                    e.pasado ? "text-muted" : ""
                  }`}
                >
                  {e.hora}
                </p>
                <p className="text-xs leading-4 text-muted">
                  {e.fin}
                  {e.cruzaMedianoche && " +1"}
                </p>
              </div>

              {/* La barra vertical es el bloque que ocupa el evento: el color
                  dice el tipo sin leer la etiqueta, y al estirarse con el alto
                  de la fila también dice cuánto texto pertenece a este evento
                  y no al siguiente. */}
              <span
                aria-hidden
                className={`w-1 shrink-0 self-stretch rounded-full ${
                  PUNTO[TIPO_EVENTO[e.tipo].color]
                } ${e.pasado ? "opacity-40" : ""}`}
              />

              <div className="min-w-0 flex-1">
                <p
                  className={`font-medium leading-snug ${e.pasado ? "text-muted" : ""}`}
                >
                  {e.nombre}
                </p>

                {/* El tipo y la duración antes de la descripción: es la ficha
                    del bloque, y debajo de una lista de ocho ítems quedaba
                    colgada del evento siguiente. */}
                <p className="mt-0.5 text-xs text-muted">
                  {TIPO_EVENTO[e.tipo].label} · {e.duracion} min
                  {e.lugar && ` · ${e.lugar}`}
                </p>

                <Descripcion evento={e} />

                {pisa.length > 0 && (
                  <p className="mt-1.5 text-xs font-medium text-danger">
                    Se pisa con {pisa.map((o) => o.nombre).join(", ")}
                  </p>
                )}
              </div>
            </>
          );

          return (
            <li key={e.id} className="border-b border-border last:border-0">
              {onEventoClick ? (
                <button
                  type="button"
                  onClick={() => onEventoClick(e)}
                  className="flex w-full gap-3 rounded-xl px-2 py-3.5 text-left transition-colors hover:bg-surface-alt"
                >
                  {contenido}
                </button>
              ) : (
                <div className="flex w-full gap-3 px-2 py-3.5">{contenido}</div>
              )}
            </li>
          );
        })}
      </ol>

      <div className="mt-4 flex flex-wrap gap-3 border-t border-border pt-3">
        {(Object.keys(TIPO_EVENTO) as (keyof typeof TIPO_EVENTO)[]).map((t) => (
          <span key={t} className="flex items-center gap-1.5 text-xs text-muted">
            <span
              aria-hidden
              className={`size-2.5 rounded-full ${PUNTO[TIPO_EVENTO[t].color]}`}
            />
            {TIPO_EVENTO[t].label}
          </span>
        ))}
        {nota}
      </div>
    </div>
  );
}
