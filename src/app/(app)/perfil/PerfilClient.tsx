"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { AppHeader, Button, Card, SafeAreaSpacer, Skeleton } from "lib-kit-components";

import {
  BellIcon,
  ChatIcon,
  HelpIcon,
  ShirtIcon,
  UserIcon,
} from "@/components/atoms/icons";
import { AvatarPicker } from "@/components/organisms/AvatarPicker";
import { ComoInstalarSheet } from "@/components/organisms/ComoInstalarSheet";
import { FichaEditor } from "@/components/organisms/FichaEditor";
import { PersonalMediaUploader } from "@/components/organisms/PersonalMediaUploader";
import { PostCard } from "@/components/organisms/PostCard";
import { PlayerCardSheet } from "@/components/organisms/PlayerCardSheet";
import { PostComposer } from "@/components/organisms/PostComposer";
import { SharePostSheet } from "@/components/organisms/SharePostSheet";
import { useAuth } from "@/lib/auth/AuthContext";
import type { CartaVM } from "@/lib/carta/carta";
import { registerShare } from "@/lib/social/actions";
import type { PostVM, ProfileVM } from "@/lib/social/queries";
import { useNotifications } from "../notifications-context";

/** Perfil propio.
 *
 *  Usa `AppHeader` —la cabecera básica de la librería: título, acciones y
 *  nada más— y no `AppHeaderCardSlot`. El slot flotante existe para colgar una
 *  card de la cabecera, y acá lo que va debajo del título ya no es una card
 *  sino cuatro paneles editables (identidad, ficha, carrete, compositor).
 *  Meterlos en el slot los apretaría contra el borde superior y dejaría la
 *  pantalla en un scroll horizontal en 360px. El degradé de marca se va con
 *  él: `AppHeader` es superficie plana, como corresponde a una pantalla de
 *  edición.
 *
 *  Orden de la pantalla, de arriba abajo: quién sos (avatar + identidad), qué
 *  jugás (ficha), qué tenés (carrete), qué publicás (compositor + posts).
 *
 *  Sin botón de instalación: el perfil propio es la pantalla de "mis cosas" y
 *  el instalador ya vive en `PwaInstallPrompt`, que `AppShell` monta para toda
 *  la app — lo que sí hay es el ícono de ayuda del header, que explica cómo
 *  instalarla. Tampoco hay seguidores ni seguidos: la app no tiene sistema de
 *  seguimiento — se removió del modelo entero, no sólo de esta pantalla.
 *
 *  **Sin sesión no se muestra nada.** Es la única pantalla del módulo público
 *  que es enteramente "lo tuyo" —avatar, ficha, carrete, carta, publicaciones—
 *  y sin saber quién sos no hay nada honesto que poner: queda el cartel para
 *  entrar o registrarse y se acabó.
 *
 *  ⚠️ El corte es del lado del cliente (`useAuth`), como el gate de votar en
 *  `FeedTabs`: el servidor todavía no sabe quién mira —`getMyProfile()` lee
 *  `db.currentUserId`, la cuenta semilla— así que los datos igual viajan en la
 *  carga inicial aunque no se dibujen. Se cierra de verdad el día que la
 *  sesión sea una cookie que el servidor pueda leer; hasta entonces esto es
 *  una pantalla que no muestra, no un permiso que no da.
 */
export function PerfilClient({
  profile,
  posts,
  carta,
}: {
  profile: ProfileVM;
  posts: PostVM[];
  carta: CartaVM;
}) {
  const router = useRouter();
  const { unread, open, session, unreadChats } = useNotifications();
  const { user, loading } = useAuth();
  const [sharing, setSharing] = useState<PostVM | null>(null);
  const [verCarta, setVerCarta] = useState(false);
  const [verInstalar, setVerInstalar] = useState(false);

  /** El header sin las acciones que dependen de la cuenta. La ayuda de
   *  instalación queda: sirve igual —o más— para quien todavía no entró. */
  const cabecera = (
    <AppHeader
      title="Mi perfil"
      subtitle={user ? `@${profile.handle}` : undefined}
      variant="solid"
      // `leading` de `AppHeader` es un nodo suelto, no un botón: no tiene
      // `onClick`. Acá va la marca, que no navega a ningún lado.
      leading={
        /* eslint-disable-next-line @next/next/no-img-element -- SVG estático */
        <img src="/escudo.svg" alt="" className="size-7 object-contain" />
      }
      actions={[
        {
          id: "instalar",
          label: "Cómo instalar la app",
          icon: <HelpIcon />,
          onClick: () => setVerInstalar(true),
        },
      ]}
    />
  );

  // Mientras Firebase resuelve el primer `onAuthStateChanged` no se sabe si hay
  // sesión. Dibujar el perfil y taparlo un tick después —o al revés— es un
  // parpadeo, así que el intermedio es un esqueleto.
  if (loading) {
    return (
      <>
        {cabecera}
        <div className="mx-auto flex w-full max-w-xl flex-col gap-4 px-4 py-4">
          {/* `variant="rounded"` y no `rect` + una clase de radio: el radio de
              `Skeleton` sale de su propia tabla (`rect` da `rounded-none`) y
              cuál gana depende del orden en la hoja compilada, no del orden en
              el string. */}
          <Skeleton variant="rounded" height={128} className="w-full" />
          <Skeleton variant="rounded" height={96} className="w-full" />
        </div>
      </>
    );
  }

  if (!user) {
    return (
      <>
        {cabecera}
        <div className="mx-auto flex w-full max-w-xl flex-col gap-4 px-4 py-6">
          <Card variant="outline" padding="lg" className="flex flex-col items-center gap-4 text-center">
            <span className="grid size-14 place-items-center rounded-full bg-primary/10 text-primary">
              <UserIcon className="size-7" width="1em" height="1em" />
            </span>
            <div>
              <h2 className="text-lg font-semibold">Tu perfil te espera</h2>
              <p className="mt-1 text-sm text-muted">
                Acá van tu foto, tu ficha de jugador, tus fotos y videos y tu carta.
                Para verlo y editarlo necesitás iniciar sesión o crear tu cuenta.
              </p>
            </div>
            <div className="flex w-full flex-col gap-2 sm:flex-row">
              <Button fullWidth onClick={() => router.push("/login")}>
                Iniciar sesión
              </Button>
              <Button variant="outline" fullWidth onClick={() => router.push("/registro")}>
                Crear cuenta
              </Button>
            </div>
          </Card>

          <SafeAreaSpacer edge="bottom" min={8} />
        </div>

        <ComoInstalarSheet open={verInstalar} onClose={() => setVerInstalar(false)} />
      </>
    );
  }

  return (
    <>
      <AppHeader
        title="Mi perfil"
        subtitle={`@${profile.handle}`}
        variant="solid"
        // `leading` de `AppHeader` es un nodo suelto, no un botón: no tiene
        // `onClick`. Así que acá va la marca (el escudo, que no navega) y lo
        // que sí navega —el panel— va como acción, a la derecha, con el resto.
        leading={
          /* eslint-disable-next-line @next/next/no-img-element -- SVG estático */
          <img src="/escudo.svg" alt="" className="size-7 object-contain" />
        }
        actions={[
          {
            // La ayuda va primero porque es la única de las tres que no
            // navega a ningún lado: abre una hoja y devuelve a esta misma
            // pantalla. Agrupada con las que sí navegan se lee como una más.
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
            // Ver el comentario del mismo bloque en `ForoClient`: el sobre es
            // la entrada a los mensajes directos desde que no son un tab.
            id: "chat",
            label: "Mensajes",
            icon: <ChatIcon />,
            badge: unreadChats || false,
            onClick: () => router.push("/chat"),
          },
        ]}
      />

      <div className="mx-auto flex w-full max-w-xl flex-col gap-4 px-4 py-4">
        {/* Identidad. El avatar es el selector: tocarlo abre la hoja con la
            subida y los avatares generados. */}
        <Card variant="outline" padding="md" className="flex flex-col gap-4">
          <div className="flex items-center gap-4">
            <AvatarPicker src={profile.avatar} name={profile.name} handle={profile.handle} />
            <div className="min-w-0 flex-1">
              <p className="truncate font-semibold">{profile.name}</p>
              <p className="truncate text-sm text-muted">@{profile.handle}</p>
              <p className="mt-0.5 text-xs text-muted">
                {profile.stats.posts}{" "}
                {profile.stats.posts === 1 ? "publicación" : "publicaciones"} · se unió en{" "}
                {profile.joined}
              </p>
            </div>
          </div>

          {profile.bio && <p className="text-sm text-muted">{profile.bio}</p>}

          {/* La carta va en la card de identidad y no como panel propio: es
              una vista de quien sos, no un dato mas que editar. Muestra el
              general para que el boton diga algo antes de abrirse. */}
          <Button
            variant="outline"
            fullWidth
            leftIcon={<ShirtIcon className="size-5" width="1em" height="1em" />}
            onClick={() => setVerCarta(true)}
          >
            Ver carta jugador
            <span className="ml-1 rounded-md bg-primary/10 px-1.5 py-0.5 text-xs font-bold text-primary tabular-nums">
              {carta.general}
            </span>
          </Button>
        </Card>

        <FichaEditor ficha={profile.ficha} bio={profile.bio} />

        <PersonalMediaUploader items={profile.gallery} />

        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">
          Publicar
        </h2>
        <PostComposer session={session} />

        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">
          Tus publicaciones
        </h2>

        {posts.length === 0 && (
          <p className="rounded-2xl border border-border p-6 text-center text-sm text-muted">
            Todavía no publicaste nada. Usá el compositor de acá arriba.
          </p>
        )}

        {posts.map((post) => (
          <PostCard key={post.id} post={post} session={session} onShare={setSharing} />
        ))}

        <SafeAreaSpacer edge="bottom" min={8} />
      </div>

      <PlayerCardSheet carta={carta} open={verCarta} onClose={() => setVerCarta(false)} />

      <ComoInstalarSheet open={verInstalar} onClose={() => setVerInstalar(false)} />

      <SharePostSheet
        post={sharing}
        onClose={() => setSharing(null)}
        onShared={(id) => void registerShare(id)}
      />
    </>
  );
}
