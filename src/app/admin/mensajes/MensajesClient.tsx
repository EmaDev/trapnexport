"use client";

import { useState, useTransition } from "react";
import {
  Button,
  DataTable,
  Select,
  Textarea,
  useSnackbar,
  type Column,
} from "lib-kit-components";

import { enviarDifusion, responderComoClub } from "@/lib/chat/actions";
import type { ConversationVM, DifusionRow } from "@/lib/chat/queries";
import type { DifusionAlcance } from "@/lib/firebase/schema";
import type { AuthorVM } from "@/lib/social/queries";
import { PageHeading } from "../PageHeading";

/** Mensajes del club: el compositor de difusión y la bandeja de respuestas.
 *
 *  Las dos mitades de la misma decisión. La difusión no es un canal de anuncios
 *  de una sola vía —para eso ya está la campanita, que `notifyAll` llena sin que
 *  nadie pueda contestar—: se manda como una conversación privada con **cada**
 *  destinatario, y por eso hay respuestas que atender. Esta pantalla es donde se
 *  atienden.
 *
 *  El alcance es un filtro explícito y no un "a todos" por defecto a propósito:
 *  cada difusión abre tantas conversaciones como destinatarios, y todas caen en
 *  la bandeja de abajo.
 */

const ALCANCES: { value: DifusionAlcance; label: string }[] = [
  { value: "plantel", label: "Sólo el plantel" },
  { value: "todos", label: "Todas las cuentas" },
  { value: "seleccion", label: "Elegir destinatarios" },
];

export function MensajesClient({
  bandeja,
  difusiones,
  cuentas,
}: {
  bandeja: ConversationVM[];
  difusiones: DifusionRow[];
  cuentas: (AuthorVM & { id: string; esPlantel: boolean })[];
}) {
  const { snack } = useSnackbar();
  const [pending, startTransition] = useTransition();

  const [texto, setTexto] = useState("");
  const [alcance, setAlcance] = useState<DifusionAlcance>("plantel");
  const [seleccion, setSeleccion] = useState<string[]>([]);

  const [abierta, setAbierta] = useState<ConversationVM | null>(null);
  const [respuesta, setRespuesta] = useState("");

  /** Cuántos la van a recibir, con lo elegido ahora. Se muestra en el botón: es
   *  la única forma de que "enviar" no sea un salto al vacío. */
  const destinatarios =
    alcance === "todos"
      ? cuentas.length
      : alcance === "plantel"
        ? cuentas.filter((c) => c.esPlantel).length
        : seleccion.length;

  const enviar = () => {
    if (!texto.trim() || !destinatarios) return;

    startTransition(async () => {
      const r = await enviarDifusion(texto, alcance, seleccion);
      if (!r.ok) {
        snack({ message: r.error, variant: "error" });
        return;
      }
      setTexto("");
      setSeleccion([]);
      snack({
        message: `Enviado a ${r.enviados} ${r.enviados === 1 ? "cuenta" : "cuentas"}`,
        variant: "success",
      });
    });
  };

  const responder = () => {
    if (!abierta || !respuesta.trim()) return;

    startTransition(async () => {
      await responderComoClub(abierta.id, respuesta);
      setRespuesta("");
      setAbierta(null);
      snack({ message: "Respuesta enviada" });
    });
  };

  const columnas: Column<DifusionRow>[] = [
    { key: "fecha", header: "Cuándo" },
    { key: "texto", header: "Mensaje" },
    { key: "alcance", header: "Alcance" },
    { key: "destinatarios", header: "Destinatarios" },
    { key: "enviadoPor", header: "Enviado por" },
  ];

  return (
    <>
      <PageHeading
        title="Mensajes"
        description="Escribile al plantel desde la cuenta del club. Cada persona lo recibe como un mensaje privado y puede responder."
      />

      <section className="flex flex-col gap-4 rounded-2xl border border-border p-4">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">
          Nueva difusión
        </h2>

        <Textarea
          label="Mensaje"
          value={texto}
          onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setTexto(e.target.value)}
          rows={4}
          maxLength={2000}
          showCount
          autoResize
          placeholder="Entrenamos el jueves a las 20 en la cancha de siempre."
        />

        <Select
          label="Alcance"
          value={alcance}
          onChange={(value: string) => {
            setAlcance(value as DifusionAlcance);
            // Cambiar de alcance limpia la selección: si no, elegir "sólo el
            // plantel" después de tildar a diez personas dejaría esa lista
            // guardada y volvería sola al elegir "elegir destinatarios".
            setSeleccion([]);
          }}
          options={ALCANCES.map((a) => ({ value: a.value, label: a.label }))}
        />

        {alcance === "seleccion" && (
          <ul className="grid max-h-64 grid-cols-1 gap-1 overflow-y-auto sm:grid-cols-2">
            {cuentas.map((c) => {
              const puesto = seleccion.includes(c.id);
              return (
                <li key={c.id}>
                  <label className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-surface-alt">
                    <input
                      type="checkbox"
                      checked={puesto}
                      onChange={() =>
                        setSeleccion((prev) =>
                          puesto ? prev.filter((x) => x !== c.id) : [...prev, c.id],
                        )
                      }
                    />
                    <span className="truncate text-sm">
                      {c.name} <span className="text-muted">@{c.handle}</span>
                    </span>
                  </label>
                </li>
              );
            })}
          </ul>
        )}

        <div className="flex items-center gap-3">
          <Button onClick={enviar} disabled={pending || !texto.trim() || !destinatarios}>
            {destinatarios
              ? `Enviar a ${destinatarios} ${destinatarios === 1 ? "cuenta" : "cuentas"}`
              : "Sin destinatarios"}
          </Button>
          <p className="text-xs text-muted">
            Se abre una conversación privada con cada uno. Las respuestas llegan acá abajo.
          </p>
        </div>
      </section>

      <section className="mt-8 flex flex-col gap-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">
          Bandeja del club
        </h2>

        {bandeja.length === 0 && (
          <p className="text-sm text-muted">Todavía no hay conversaciones.</p>
        )}

        <ul className="divide-y divide-border">
          {bandeja.map((c) => (
            <li key={c.id}>
              <button
                type="button"
                onClick={() => {
                  setAbierta(c);
                  setRespuesta("");
                }}
                className="flex w-full items-center gap-3 py-3 text-left transition-colors hover:bg-surface-alt"
              >
                {/* eslint-disable-next-line @next/next/no-img-element -- URL de Storage */}
                <img src={c.avatar} alt="" className="size-10 rounded-full object-cover" />
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline gap-2">
                    <span className="truncate font-medium">{c.titulo}</span>
                    <span className="ml-auto shrink-0 text-xs text-muted">{c.time}</span>
                  </div>
                  <p
                    className={`truncate text-sm ${
                      c.unread ? "font-medium text-foreground" : "text-muted"
                    }`}
                  >
                    {c.mine ? "Club: " : ""}
                    {c.lastMessage}
                  </p>
                </div>
                {c.unread > 0 && (
                  <span
                    className="size-2.5 shrink-0 rounded-full bg-primary"
                    aria-label="Sin leer"
                  />
                )}
              </button>

              {/* La respuesta se abre en la misma fila y no en un modal: el
                  contexto de la conversación es la línea de arriba, y taparla
                  con un diálogo obliga a recordarla. */}
              {abierta?.id === c.id && (
                <div className="flex flex-col gap-2 pb-4">
                  <Textarea
                    label={`Responder a ${c.titulo}`}
                    value={respuesta}
                    onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) =>
                      setRespuesta(e.target.value)
                    }
                    rows={3}
                    maxLength={2000}
                    autoResize
                  />
                  <div className="flex gap-2">
                    <Button onClick={responder} disabled={pending || !respuesta.trim()}>
                      Responder como el club
                    </Button>
                    <Button variant="ghost" onClick={() => setAbierta(null)}>
                      Cancelar
                    </Button>
                  </div>
                </div>
              )}
            </li>
          ))}
        </ul>
      </section>

      <section className="mt-8 flex flex-col gap-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">
          Difusiones enviadas
        </h2>
        {/* El registro no es cosmético: sin él no hay forma de saber qué se
            comunicó, a quiénes ni quién lo mandó. */}
        <DataTable columns={columnas} rows={difusiones} rowKey={(d) => d.id} />
      </section>
    </>
  );
}
