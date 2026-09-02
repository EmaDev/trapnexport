"use client";

import { useEffect, useRef, useState } from "react";
import { Button, Textarea } from "lib-kit-components";

import type { MessageVM } from "@/lib/chat/queries";

/** El hilo de mensajes de una conversación.
 *
 *  Reemplaza al `Chatbot` de la librería, que era un andamio consciente y ya no
 *  alcanza. `Chatbot` modela los mensajes como `role: "user" | "bot"`: dos
 *  participantes por definición, sin autor por mensaje. Con grupos hay que poder
 *  mostrar **quién** escribió cada uno, y con mensajes de sistema —"Fulano
 *  agregó a Mengano"— hay una tercera forma que no es ninguna de las dos.
 *
 *  Tres formas, entonces:
 *
 *    - propio     — burbuja a la derecha, en color de marca, sin nombre
 *    - de otro    — burbuja a la izquierda, con avatar; el nombre sólo en grupos
 *    - de sistema — centrado, sin burbuja ni avatar
 *
 *  El nombre no se repite en mensajes seguidos de la misma persona: en un grupo
 *  activo, verlo en cada línea es ruido.
 */
export function Hilo({
  mensajes,
  esGrupo,
  onSend,
  enviando,
}: {
  mensajes: MessageVM[];
  esGrupo: boolean;
  onSend: (texto: string) => Promise<void> | void;
  /** deshabilita el envío mientras la conversación no está lista */
  enviando?: boolean;
}) {
  const [texto, setTexto] = useState("");
  const [mandando, setMandando] = useState(false);
  const finRef = useRef<HTMLDivElement>(null);

  /*  Al fondo con cada mensaje nuevo. `mensajes.length` y no el array: el
   *  snapshot devuelve objetos nuevos en cada emisión aunque no haya cambiado
   *  nada, y con el array de dependencia esto se dispararía en cada una,
   *  peleándose con quien esté leyendo hacia arriba. */
  useEffect(() => {
    finRef.current?.scrollIntoView({ block: "end", behavior: "smooth" });
  }, [mensajes.length]);

  const enviar = async () => {
    const limpio = texto.trim();
    if (!limpio || mandando) return;

    // Se limpia el input ANTES de esperar: el mensaje ya está en camino y dejar
    // el texto puesto invita a mandarlo dos veces.
    setTexto("");
    setMandando(true);
    try {
      await onSend(limpio);
    } finally {
      setMandando(false);
    }
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex-1 overflow-y-auto px-3 py-4">
        <ul className="mx-auto flex w-full max-w-2xl flex-col gap-2">
          {mensajes.map((m, i) => {
            if (m.tipo === "sistema") {
              return (
                <li key={m.id} className="my-1 text-center">
                  <span className="rounded-full bg-surface-alt px-3 py-1 text-xs text-muted">
                    {m.texto}
                  </span>
                </li>
              );
            }

            const anterior = mensajes[i - 1];
            // Encadenado: mismo autor que el mensaje de arriba, y el de arriba
            // no es de sistema (que corta la racha visualmente igual).
            const seguido =
              anterior?.tipo === "texto" && anterior.autorId === m.autorId;

            if (m.propio) {
              return (
                <li key={m.id} className="flex justify-end">
                  <div className="max-w-[85%] rounded-2xl rounded-br-sm bg-primary px-3 py-2 text-sm text-white">
                    <p className="whitespace-pre-wrap break-words">{m.texto}</p>
                  </div>
                </li>
              );
            }

            return (
              <li key={m.id} className="flex items-end gap-2">
                {/* El hueco mantiene alineadas las burbujas encadenadas: sin él,
                    la primera de la racha queda corrida respecto de las otras. */}
                <div className="size-7 shrink-0">
                  {!seguido && m.autor?.avatar && (
                    // eslint-disable-next-line @next/next/no-img-element -- URL de Storage
                    <img
                      src={m.autor.avatar}
                      alt=""
                      className="size-7 rounded-full object-cover"
                    />
                  )}
                </div>
                <div className="max-w-[85%] rounded-2xl rounded-bl-sm bg-surface-alt px-3 py-2 text-sm">
                  {/* El nombre sólo en grupos: en una directa ya está en el
                      header y repetirlo en cada burbuja no dice nada nuevo. */}
                  {esGrupo && !seguido && (
                    <p className="mb-0.5 text-xs font-semibold text-primary">
                      {m.autor?.name ?? "Alguien"}
                    </p>
                  )}
                  <p className="whitespace-pre-wrap break-words">{m.texto}</p>
                </div>
              </li>
            );
          })}
        </ul>
        <div ref={finRef} />
      </div>

      <div className="border-t border-border bg-surface px-3 py-2">
        <div className="mx-auto flex w-full max-w-2xl items-end gap-2">
          <Textarea
            value={texto}
            onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setTexto(e.target.value)}
            onKeyDown={(e: React.KeyboardEvent) => {
              // Enter manda, Shift+Enter hace salto de línea. En un teclado
              // táctil no hay Shift a mano, pero ahí el teclado trae su propio
              // botón de enviar y esto no molesta.
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                void enviar();
              }
            }}
            placeholder="Escribí un mensaje…"
            rows={1}
            autoResize
            maxLength={2000}
            aria-label="Mensaje"
            className="flex-1"
          />
          <Button
            onClick={() => void enviar()}
            disabled={!texto.trim() || mandando || enviando}
          >
            Enviar
          </Button>
        </div>
      </div>
    </div>
  );
}
