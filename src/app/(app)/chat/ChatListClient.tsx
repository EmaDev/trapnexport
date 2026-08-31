"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { AppHeader, SafeAreaSpacer } from "lib-kit-components";

import { BellIcon } from "@/components/atoms/icons";
import { backOr } from "@/lib/nav";
import type { ConversationVM } from "@/lib/social/queries";
import { useNotifications } from "../notifications-context";

/** Lista de conversaciones.
 *
 *  Ya no es una pantalla raíz: los mensajes directos se levantan desde el
 *  header —el sobre del feed y el del foro— y su lugar en el `BottomNav` lo
 *  tomó el foro. Por eso lleva flecha de regreso y `AppShell` la esconde de la
 *  nav (`PUSHED`): es una pantalla empujada, como la conversación.
 *
 *  Sigue con `AppHeader` y no `AppHeaderCardSlot`: esa cabecera existe para
 *  colgarle una card (compositor, stats) y acá no hay ninguna. `largeTitle` da
 *  el título grande que colapsa al scrollear, que es lo que corresponde a una
 *  bandeja.
 */
export function ChatListClient({ conversations }: { conversations: ConversationVM[] }) {
  const router = useRouter();
  const { unread, open } = useNotifications();

  return (
    <>
      <AppHeader
        title="Mensajes"
        subtitle={`${conversations.length} conversaciones`}
        // Vuelve a la pantalla que la abrió —el sobre está en los cuatro
        // headers—, y al feed si se entró de una a `/chat`.
        onBack={() => backOr(router, "/")}
        largeTitle
        variant="blur"
        sticky
        actions={[
          {
            id: "notif",
            label: "Notificaciones",
            icon: <BellIcon />,
            badge: unread || false,
            onClick: open,
          },
        ]}
      />

      {conversations.length === 0 && (
        <p className="mx-auto w-full max-w-xl px-4 py-6 text-center text-sm text-muted">
          Todavía no tenés mensajes.
        </p>
      )}

      <ul className="mx-auto w-full max-w-xl divide-y divide-border px-2">
        {conversations.map((c) => (
          <li key={c.id}>
            <Link
              href={`/chat/${c.id}`}
              className="flex items-center gap-3 rounded-2xl px-2 py-3 transition-colors hover:bg-surface-alt"
            >
              {/* eslint-disable-next-line @next/next/no-img-element -- data-URI */}
              <img src={c.peer.avatar} alt="" className="size-12 shrink-0 rounded-full" />

              <div className="min-w-0 flex-1">
                <div className="flex items-baseline gap-2">
                  <span className="truncate font-semibold">{c.peer.name}</span>
                  <span className="ml-auto shrink-0 text-xs text-muted">{c.time}</span>
                </div>
                <p
                  className={`truncate text-sm ${
                    c.unread ? "font-medium text-foreground" : "text-muted"
                  }`}
                >
                  {c.mine ? "Vos: " : ""}
                  {c.lastMessage}
                </p>
              </div>

              {c.unread > 0 && (
                <span
                  className="size-2.5 shrink-0 rounded-full bg-primary"
                  aria-label="Mensajes sin leer"
                />
              )}
            </Link>
          </li>
        ))}
      </ul>

      <SafeAreaSpacer edge="bottom" min={8} />
    </>
  );
}
