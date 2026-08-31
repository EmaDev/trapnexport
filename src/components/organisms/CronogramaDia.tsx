import type { ReactNode } from "react";

import type { EventoRow } from "@/lib/contenido/queries";
import { TIPO_EVENTO } from "@/lib/contenido/types";

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
 *  Sólo importa el **tipo** `EventoRow` y `TIPO_EVENTO` —que no importa nada—,
 *  así que entra al bundle del navegador sin arrastrar la base en memoria.
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
              <div className="w-14 shrink-0 text-right tabular-nums">
                <p className={`text-sm font-semibold ${e.pasado ? "text-muted" : ""}`}>
                  {e.hora}
                </p>
                <p className="text-xs text-muted">
                  {e.fin}
                  {e.cruzaMedianoche && " +1"}
                </p>
              </div>

              {/* La barra vertical es el bloque que ocupa el evento: el color
                  dice el tipo sin leer la etiqueta. */}
              <span
                aria-hidden
                className={`w-1 shrink-0 rounded-full ${PUNTO[TIPO_EVENTO[e.tipo].color]} ${
                  e.pasado ? "opacity-40" : ""
                }`}
              />

              <div className="min-w-0 flex-1">
                <p className={`font-medium ${e.pasado ? "text-muted" : ""}`}>{e.nombre}</p>
                {e.descripcion && (
                  <p className="line-clamp-2 text-xs text-muted">{e.descripcion}</p>
                )}
                <p className="mt-1 text-xs text-muted">
                  {TIPO_EVENTO[e.tipo].label} · {e.duracion} min
                  {e.lugar && ` · ${e.lugar}`}
                </p>
                {pisa.length > 0 && (
                  <p className="mt-1 text-xs font-medium text-danger">
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
                  className="flex w-full gap-3 rounded-xl px-2 py-3 text-left transition-colors hover:bg-surface-alt"
                >
                  {contenido}
                </button>
              ) : (
                <div className="flex w-full gap-3 px-2 py-3">{contenido}</div>
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
