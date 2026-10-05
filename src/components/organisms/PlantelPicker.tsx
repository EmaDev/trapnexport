"use client";

import { useMemo, useState } from "react";
import { Input } from "lib-kit-components";

import { CheckIcon, SearchIcon } from "@/components/atoms/icons";
import type { ClaimablePlayerVM } from "@/lib/auth/roster";

/** Elegir quién sos del plantel, en el alta y en `/completar-perfil`.
 *
 *  ## Por qué no es un `Select`
 *
 *  Antes era `Select` de la lib y faltaban jugadores. No faltaban en Firestore:
 *  el desplegable se abre `absolute` adentro de una `Card`, y `Card` es
 *  `overflow-hidden`, así que lo que pasa del borde de la tarjeta se recorta.
 *  En `/completar-perfil` el selector queda a unos 200px del fondo de la
 *  tarjeta y el panel pide 264px: la lista se cortaba literalmente al medio y
 *  el resto del plantel no había forma de alcanzarlo. En el registro entraba
 *  justo, pero `max-h-64` muestra seis nombres de dieciocho sin ninguna pista
 *  de que hay scroll adentro — que es la misma queja con otra cara.
 *
 *  Acá la lista va **en el flujo**, no `absolute`: nada la puede recortar, el
 *  scroll es el del propio bloque y se ve. Y el plantel no es una lista
 *  cualquiera de opciones: son dieciocho personas que se buscan por nombre,
 *  apodo o handle, así que lleva buscador y el contador de cuántas quedan a la
 *  vista. El contador está justamente para que "faltan jugadores" no pueda
 *  volver a pasar sin que se note.
 */
const sinTildes = (s: string) =>
  s
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .trim();

export function PlantelPicker({
  players,
  value,
  onChange,
  label = "Sos…",
}: {
  /** `null` mientras se lee el plantel */
  players: ClaimablePlayerVM[] | null;
  value: string;
  onChange: (id: string) => void;
  label?: string;
}) {
  const [q, setQ] = useState("");
  const filtro = sinTildes(q);

  const visibles = useMemo(() => {
    if (!filtro) return players ?? [];
    return (players ?? []).filter((p) =>
      sinTildes(`${p.name} ${p.nickname} ${p.handle}`).includes(filtro),
    );
  }, [players, filtro]);

  if (players === null) {
    return (
      <div>
        <p className="mb-1.5 pl-1 text-xs font-medium text-muted">{label}</p>
        <div className="grid h-24 place-items-center rounded-xl border-2 border-border bg-surface text-sm text-muted">
          Cargando el plantel…
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-1.5 flex items-baseline justify-between gap-2 pl-1">
        <p className="text-xs font-medium text-muted">{label}</p>
        {/* Cuántos nombres hay realmente. Con filtro dice "X de Y" para que se
            entienda que los que no están los escondió la búsqueda. */}
        <p className="text-xs text-muted">
          {filtro ? `${visibles.length} de ${players.length}` : `${players.length} jugadores`}
        </p>
      </div>

      {/* El buscador aparece sólo si hay lista como para perderse en ella. */}
      {players.length > 8 && (
        <Input
          aria-label="Buscar en el plantel"
          placeholder="Buscá tu nombre o apodo"
          value={q}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => setQ(e.target.value)}
          leftIcon={<SearchIcon className="size-4" width="1em" height="1em" />}
          className="mb-2"
        />
      )}

      <ul
        aria-label={label}
        className="max-h-72 overflow-y-auto overscroll-contain rounded-xl border-2 border-border bg-surface p-1.5"
      >
        {visibles.map((p) => {
          const active = p.id === value;
          return (
            <li key={p.id}>
              <button
                type="button"
                aria-pressed={active}
                disabled={p.claimed}
                onClick={() => onChange(p.id)}
                className={[
                  "flex w-full items-center gap-3 rounded-lg px-2.5 py-2 text-left",
                  "transition-colors duration-150",
                  "disabled:opacity-40 disabled:pointer-events-none",
                  active ? "bg-primary/10 text-primary" : "text-foreground hover:bg-surface-alt",
                ].join(" ")}
              >
                {/* eslint-disable-next-line @next/next/no-img-element -- data-URI o downloadURL */}
                <img
                  src={p.avatar}
                  alt=""
                  className="size-9 shrink-0 rounded-full object-cover"
                />
                <span className="min-w-0 flex-1">
                  <span className={`block truncate text-sm ${active ? "font-semibold" : "font-medium"}`}>
                    {p.name}
                  </span>
                  <span className="block truncate text-xs text-muted">
                    {p.claimed ? "ya registrado" : `@${p.handle}`}
                  </span>
                </span>
                {active && <CheckIcon className="size-4 shrink-0" width="1em" height="1em" />}
              </button>
            </li>
          );
        })}

        {visibles.length === 0 && (
          <li className="px-2.5 py-6 text-center text-sm text-muted">
            Nadie del plantel coincide con “{q}”.
          </li>
        )}
      </ul>
    </div>
  );
}
