"use client";

import { useEffect, useState } from "react";
import { Modal } from "lib-kit-components";

import type { EncuestaRow } from "@/lib/contenido/queries";
import { getVotantes, type VotantesEncuesta } from "@/lib/contenido/votantes";

/** Quién votó qué en una encuesta. Sólo se monta en desarrollo: ver
 *  `lib/contenido/votantes.ts`.
 *
 *  Dos vistas de lo mismo, una debajo de la otra: por opción —para ver el
 *  resultado con nombres— y por persona —para ver cuándo votó y si cambió—.
 *  Pide los datos al abrir y no los trae la tabla: son una lectura por voto y
 *  sólo hacen falta para la encuesta que se está mirando.
 */
export function VotantesModal({
  encuesta,
  onClose,
}: {
  encuesta: EncuestaRow | null;
  onClose: () => void;
}) {
  // La respuesta guarda de qué encuesta es: "cargando" es que la que está
  // abierta no es ésa, sin un segundo estado que resetear al cambiar de fila.
  const [resultado, setResultado] = useState<{
    id: string;
    data: VotantesEncuesta | null;
  } | null>(null);

  useEffect(() => {
    if (!encuesta) return;
    let vigente = true;
    getVotantes(encuesta.id)
      .catch(() => null)
      .then((data) => {
        if (vigente) setResultado({ id: encuesta.id, data });
      });
    return () => {
      vigente = false;
    };
  }, [encuesta]);

  const cargando = !!encuesta && resultado?.id !== encuesta.id;
  const data = cargando ? null : (resultado?.data ?? null);

  // Los contadores de la encuesta y los documentos de voto se escriben en la
  // misma transacción, así que tendrían que coincidir. Si no coinciden son
  // votos de antes del dedupe, que sumaron sin dejar documento.
  const sinDocumento = data
    ? data.porOpcion.reduce((n, o) => n + Math.max(0, o.votos - o.nombres.length), 0)
    : 0;

  return (
    <Modal
      open={!!encuesta}
      onClose={onClose}
      title={encuesta?.nombre || encuesta?.pregunta || "Votos"}
      description="Quién votó qué. Sólo visible en desarrollo."
      size="lg"
    >
      {cargando && <p className="py-6 text-center text-sm text-muted">Cargando votos…</p>}

      {!cargando && data && data.votantes.length === 0 && (
        <p className="py-6 text-center text-sm text-muted">Todavía nadie votó.</p>
      )}

      {!cargando && data && data.votantes.length > 0 && (
        <div className="flex flex-col gap-6">
          <section>
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">
              Por opción
            </h3>
            <ul className="flex flex-col gap-2">
              {[...data.porOpcion]
                .sort((a, b) => b.nombres.length - a.nombres.length)
                .map((o) => (
                  <li key={o.id} className="rounded-lg border border-border p-3">
                    <div className="flex items-baseline justify-between gap-3">
                      <p className="truncate font-medium">{o.texto}</p>
                      <span className="shrink-0 tabular-nums text-sm text-muted">
                        {o.nombres.length}
                      </span>
                    </div>
                    {o.nombres.length > 0 && (
                      <p className="mt-1 text-sm text-muted">{o.nombres.join(", ")}</p>
                    )}
                  </li>
                ))}
            </ul>
            {sinDocumento > 0 && (
              <p className="mt-2 text-xs text-muted">
                Hay {sinDocumento} {sinDocumento === 1 ? "voto" : "votos"} en los contadores sin
                persona asociada: son de antes de que cada voto guardara quién lo emitió.
              </p>
            )}
          </section>

          <section>
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">
              Por persona ({data.votantes.length})
            </h3>
            <ul className="divide-y divide-border rounded-lg border border-border">
              {data.votantes.map((v) => (
                <li key={v.uid} className="flex flex-col gap-0.5 px-3 py-2 text-sm">
                  <div className="flex items-baseline justify-between gap-3">
                    <p className="truncate">
                      <span className="font-medium">{v.name}</span>
                      {v.handle && <span className="text-muted"> @{v.handle}</span>}
                    </p>
                    <span className="shrink-0 text-xs tabular-nums text-muted">
                      {v.votoEl}
                      {v.cambioEl && ` · cambió ${v.cambioEl}`}
                    </span>
                  </div>
                  <p className="text-muted">{v.opciones.join(", ") || "—"}</p>
                </li>
              ))}
            </ul>
          </section>
        </div>
      )}
    </Modal>
  );
}
