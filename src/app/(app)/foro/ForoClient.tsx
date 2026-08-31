"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AppHeader, BottomSheet, FloatingButton, SafeAreaSpacer } from "lib-kit-components";

import { BellIcon, ChatIcon, HelpIcon, PlusIcon } from "@/components/atoms/icons";
import { ComoInstalarSheet } from "@/components/organisms/ComoInstalarSheet";
import { PostCard } from "@/components/organisms/PostCard";
import { PostComposer } from "@/components/organisms/PostComposer";
import { SharePostSheet } from "@/components/organisms/SharePostSheet";
import { registerShare } from "@/lib/social/actions";
import type { PostVM } from "@/lib/social/queries";
import { useNotifications } from "../notifications-context";

/** El foro: lo que postea la comunidad, de todas las cuentas.
 *
 *  Tomó el lugar del chat en el `BottomNav`. Lleva `AppHeader` con `largeTitle`
 *  y no `AppHeaderCardSlot` por el mismo motivo que la bandeja y la historia
 *  (ver desvío 7 del README): el slot flotante existe para colgarle una card y
 *  acá lo que va abajo del título es la lista, no una card.
 *
 *  Publicar es la acción principal y global de la pantalla, así que va en un
 *  FAB y no en un compositor fijo arriba de la lista: el compositor empujaría
 *  los posteos —que son a lo que se viene— media pantalla para abajo. La hoja
 *  monta el mismo `PostComposer` que el perfil, no una copia.
 *
 *  Sin controles de orden: la lista sale como la manda `getFeed()`, del más
 *  nuevo al más viejo.
 */
export function ForoClient({ posts }: { posts: PostVM[] }) {
  const router = useRouter();
  const { unread, open, session, unreadChats } = useNotifications();
  const [componiendo, setComponiendo] = useState(false);
  const [verInstalar, setVerInstalar] = useState(false);
  const [sharing, setSharing] = useState<PostVM | null>(null);

  return (
    <>
      <AppHeader
        title="Foro"
        subtitle={`${posts.length} ${posts.length === 1 ? "publicación" : "publicaciones"}`}
        largeTitle
        variant="blur"
        sticky
        actions={[
          {
            // El segundo acceso a la ayuda de instalación, además del perfil.
            // Va acá y no en el feed porque el header del feed lleva el lockup
            // de marca centrado y un tercer botón a la derecha le come el
            // ancho al wordmark, que a 360px queda cortado. Acá el título es
            // corto y sobra lugar.
            id: "instalar",
            label: "Cómo instalar la app",
            icon: <HelpIcon />,
            onClick: () => setVerInstalar(true),
          },
          {
            id: "notif",
            label: "Notificaciones",
            icon: <BellIcon />,
            // `unread || false`: un 0 pelado dibuja un badge rojo con un "0"
            badge: unread || false,
            onClick: open,
          },
          {
            // La mensajería directa ya no tiene tab: se levanta desde acá, y
            // con ella el badge de no leídos que antes dibujaba el `BottomNav`.
            id: "chat",
            label: "Mensajes",
            icon: <ChatIcon />,
            badge: unreadChats || false,
            onClick: () => router.push("/chat"),
          },
        ]}
      />

      <div className="mx-auto flex w-full max-w-xl flex-col gap-4 px-4 py-4">
        {posts.length === 0 ? (
          <p className="rounded-2xl border border-border p-6 text-center text-sm text-muted">
            Todavía no hay posteos en el foro. Estrenalo con el botón de abajo.
          </p>
        ) : (
          posts.map((post) => (
            <PostCard key={post.id} post={post} session={session} onShare={setSharing} />
          ))
        )}

        <SafeAreaSpacer edge="bottom" min={8} />
      </div>

      {/* `--bottom-nav` es el alto real que publica `BottomNav` (0px cuando no
          hay nav, que es el caso de ≥md): sin esto el FAB queda tapado por la
          barra en mobile y flotando de más en desktop. Va con `!` porque el
          componente trae su propio `bottom` en la misma clase. */}
      <FloatingButton
        label="Nuevo posteo"
        icon={<PlusIcon />}
        onClick={() => setComponiendo(true)}
        className="!bottom-[calc(var(--bottom-nav)+1rem)]"
      />

      <BottomSheet
        open={componiendo}
        onClose={() => setComponiendo(false)}
        title="Nuevo posteo"
        description="Lo ve toda la comunidad"
        showClose
      >
        <PostComposer session={session} onPublished={() => setComponiendo(false)} />
      </BottomSheet>

      <ComoInstalarSheet open={verInstalar} onClose={() => setVerInstalar(false)} />

      <SharePostSheet
        post={sharing}
        onClose={() => setSharing(null)}
        onShared={(id) => void registerShare(id)}
      />
    </>
  );
}
