"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { AppHeader, BottomSheet } from "lib-kit-components";

import { UsersIcon } from "@/components/atoms/icons";
import { Hilo } from "@/components/organisms/Hilo";
import { marcarLeida, salirDelGrupo, sendMessage } from "@/lib/chat/actions";
import type { ConversationHeadVM, MessageVM } from "@/lib/chat/queries";
import { escucharMensajes } from "@/lib/chat/vivo";
import { backOr } from "@/lib/nav";
import type { AuthorVM } from "@/lib/social/queries";

/** Conversación abierta, en vivo.
 *
 *  Pantalla empujada: el `AppShell` esconde el `BottomNav` acá (patrón B de la
 *  guía). Se gana alto de pantalla y no hay tab activo que resolver.
 *
 *  Los mensajes llegan por `onSnapshot` directo desde el navegador, que es la
 *  primera lectura del cliente a Firestore en el módulo social. La primera tanda
 *  igual la trae el servidor por props: sin eso, abrir un chat muestra un hueco
 *  hasta que responde Firestore, y con conexión de celular eso se nota.
 *
 *  Escribir sigue yendo por Server Action. No es incoherente: un mensaje mueve
 *  también el `ultimoMensaje` de la conversación y dispara la campanita de cada
 *  participante, y eso no puede quedar en manos del cliente.
 */
export function ConversationClient({
  head,
  viewerId,
  mensajes: iniciales,
}: {
  head: ConversationHeadVM;
  viewerId: string;
  mensajes: MessageVM[];
}) {
  const router = useRouter();
  const [mensajes, setMensajes] = useState<MessageVM[]>(iniciales);
  const [verParticipantes, setVerParticipantes] = useState(false);

  const esGrupo = head.tipo === "grupo";

  /*  El mapa de autores se arma una vez con lo que trajo el servidor: el
   *  snapshot sólo devuelve uid, y resolver el nombre por mensaje sería una
   *  lectura de `trapnexport-user` por burbuja. */
  const autores: Record<string, AuthorVM> = Object.fromEntries(
    head.participantes.map((p) => [p.id, p as AuthorVM]),
  );

  useEffect(() => {
    const stop = escucharMensajes(head.id, viewerId, autores, setMensajes);
    return stop;
    // `autores` sale de `head` y se rearma en cada render; volver a suscribirse
    // por eso cortaría y recrearía la escucha sin motivo.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [head.id, viewerId]);

  /*  Marcar leída al abrir y cada vez que llega algo nuevo estando acá: si sólo
   *  se marcara al abrir, un mensaje que llega con la pantalla abierta quedaría
   *  contando como no leído para siempre. */
  useEffect(() => {
    void marcarLeida(head.id);
  }, [head.id, mensajes.length]);

  return (
    <div className="flex min-h-0 w-full flex-1 flex-col">
      <AppHeader
        title={head.titulo}
        subtitle={head.subtitulo}
        // `backOr` y no `push("/chat")`: empujar la bandeja deja esta pantalla
        // en el historial, y como la bandeja también retrocede, las dos se
        // apuntan entre sí y no se sale más (ver `lib/nav.ts`).
        onBack={() => backOr(router, "/chat")}
        backLabel="Volver a los chats"
        variant="blur"
        sticky
        actions={
          esGrupo
            ? [
                {
                  id: "participantes",
                  label: "Participantes",
                  icon: <UsersIcon />,
                  onClick: () => setVerParticipantes(true),
                },
              ]
            : undefined
        }
      />

      <Hilo
        mensajes={mensajes}
        esGrupo={esGrupo}
        onSend={(texto) => sendMessage(head.id, texto)}
      />

      <BottomSheet
        open={verParticipantes}
        onClose={() => setVerParticipantes(false)}
        title={head.titulo}
        description={`${head.participantes.length} participantes`}
        showClose
      >
        <ul className="flex flex-col gap-3">
          {head.participantes.map((p) => (
            <li key={p.id} className="flex items-center gap-3">
              {/* eslint-disable-next-line @next/next/no-img-element -- URL de Storage */}
              <img src={p.avatar} alt="" className="size-9 rounded-full object-cover" />
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">{p.name}</p>
                <p className="truncate text-xs text-muted">@{p.handle}</p>
              </div>
            </li>
          ))}
        </ul>

        <button
          type="button"
          className="mt-6 font-medium text-danger"
          onClick={async () => {
            await salirDelGrupo(head.id);
            router.replace("/chat");
          }}
        >
          Salir del grupo
        </button>
      </BottomSheet>
    </div>
  );
}
