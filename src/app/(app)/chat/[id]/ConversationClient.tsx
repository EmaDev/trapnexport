"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { AppHeader, Chatbot, type ChatMessage } from "lib-kit-components";

import { backOr } from "@/lib/nav";
import type { AuthorVM, MessageVM } from "@/lib/social/queries";

/** Conversación abierta.
 *
 *  Pantalla empujada: el `AppShell` esconde el `BottomNav` acá (patrón B de la
 *  guía). Se gana alto de pantalla y no hay tab activo que resolver.
 *
 *  ⚠️ La librería no tiene componente de mensajería directa. `Chatbot` con
 *  `variant="inline"` da el hilo (burbujas, envío con estado, "escribiendo…"),
 *  pero modela los mensajes como `role: "user" | "bot"`: alcanza para una
 *  conversación de dos —"bot" es la otra persona— y no sirve para grupos. Es
 *  un andamio consciente, no la pantalla final.
 */
export function ConversationClient({
  conversationId,
  peer,
  messages: initial,
  onSend,
}: {
  conversationId: string;
  peer: AuthorVM;
  messages: MessageVM[];
  onSend: (conversationId: string, text: string) => Promise<void>;
}) {
  const router = useRouter();
  const [messages, setMessages] = useState<ChatMessage[]>(() =>
    initial.map((m) => ({ id: m.id, role: m.role, text: m.text, at: m.at })),
  );

  const send = async (text: string) => {
    const optimistic: ChatMessage = {
      id: `tmp_${Date.now()}`,
      role: "user",
      text,
      at: Date.now(),
      status: "sending",
    };
    setMessages((l) => [...l, optimistic]);

    await onSend(conversationId, text);

    setMessages((l) =>
      l.map((m) => (m.id === optimistic.id ? { ...m, status: "sent" as const } : m)),
    );
  };

  return (
    <div className="flex min-h-0 w-full flex-col">
      <AppHeader
        title={peer.name}
        subtitle={`@${peer.handle}`}
        // `backOr` y no `push("/chat")`: empujar la bandeja deja esta pantalla
        // en el historial, y como la bandeja también retrocede, las dos se
        // apuntan entre sí y no se sale más (ver `lib/nav.ts`).
        onBack={() => backOr(router, "/chat")}
        backLabel="Volver a los chats"
        variant="blur"
        sticky
      />

      <div className="mx-auto w-full max-w-2xl flex-1 px-3 pb-3">
        <Chatbot
          variant="inline"
          messages={messages}
          onSend={send}
          botName={peer.name}
          botStatus={`@${peer.handle}`}
          avatar={
            // eslint-disable-next-line @next/next/no-img-element -- data-URI
            <img src={peer.avatar} alt="" className="size-full rounded-full" />
          }
          placeholder="Escribí un mensaje…"
          className="h-[calc(var(--app-height,100dvh)-8.5rem)]"
        />
      </div>
    </div>
  );
}
