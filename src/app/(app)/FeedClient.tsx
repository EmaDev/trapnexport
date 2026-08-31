"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import {
  AppHeaderCardSlot,
  Button,
  Card,
  Carousel,
  SafeAreaSpacer,
  usePrefersReducedMotion,
  type CarouselImage,
} from "lib-kit-components";

import { BellIcon, ChatIcon, ShieldIcon, TrophyIcon } from "@/components/atoms/icons";
import { CountdownHero } from "@/components/organisms/CountdownHero";
import { FeedTabs } from "@/components/organisms/FeedTabs";
import { PostCard } from "@/components/organisms/PostCard";
import { SharePostSheet } from "@/components/organisms/SharePostSheet";
import { useAuth } from "@/lib/auth/AuthContext";
import { mediaUrl } from "@/lib/media";
import { registerShare } from "@/lib/social/actions";
import type {
  Cronograma,
  EncuestaFeedVM,
  NoticiaFeedVM,
} from "@/lib/contenido/queries";
import type { PostVM } from "@/lib/social/queries";
import { APP_NAME, LAUNCH_DATE } from "@/lib/site";
import { useNotifications } from "./notifications-context";

/** Degradé de marca para `AppHeaderCardSlot` vía `gradientClassName` (reemplaza
 *  el violeta por defecto de la librería). Mismos valores que `--color-primary`
 *  y `--color-accent` del tema claro en globals.css. */
export const HEADER_BRAND_GRADIENT = "bg-[linear-gradient(135deg,#50108b,#752eb8)]";

/** Badges rojos en las acciones del header del feed.
 *
 *  `AppHeaderCardSlot` dibuja el contador de sus acciones en blanco con el
 *  número violeta (`bg-white text-[#4b3fce]`), hardcodeado y sin prop para
 *  cambiarlo. `AppHeader` —la cabecera del resto de las pantallas— lo dibuja
 *  `bg-danger text-white`, así que el mismo contador de mensajes se veía de dos
 *  colores según la pantalla. Esto alinea el feed con el resto.
 *
 *  Va como variante arbitraria sobre el `<header>` porque es el único punto de
 *  entrada que el componente expone. El selector apunta al `span.absolute` que
 *  cuelga de cada botón de acción, que es exactamente el badge: la card del
 *  slot es `CountdownHero` y no tiene un solo `<button>`, así que no hay otro
 *  nodo al que pueda pegarle. */
export const HEADER_RED_BADGES = [
  // `!` para ganarle al `bg-white` propio del componente (misma capa).
  "[&_button>span.absolute]:!bg-danger",
  "[&_button>span.absolute]:!text-white",
  // El anillo original es del violeta viejo de la librería; sobre el degradé
  // del header, un hilo blanco es lo que despega el rojo del fondo.
  "[&_button>span.absolute]:!ring-white/40",
].join(" ");

/** Los cinco slides del carrusel de portada.
 *
 *  Hoy son placeholders generados (`mediaUrl`), en el tono de la marca y sin
 *  pegarle a ningún host. Cuando existan banners de verdad, esto pasa a salir
 *  del servidor como los posts —`getHighlights()` en `queries.ts`, prop del
 *  componente— y no queda nada hardcodeado en el cliente. */
const SLIDES: CarouselImage[] = [
  { src: mediaUrl("Lanzamiento", "slide-1"), alt: "Cuenta regresiva al lanzamiento", caption: "Falta poco" },
  { src: mediaUrl("Comunidad", "slide-2"), alt: "La comunidad de Trap N Export", caption: "Sumate a la conversación" },
  { src: mediaUrl("Novedades", "slide-3"), alt: "Novedades de la semana", caption: "Lo nuevo de esta semana" },
  { src: mediaUrl("Creadores", "slide-4"), alt: "Creadores destacados", caption: "Creadores para seguir" },
  { src: mediaUrl("Historias", "slide-5"), alt: "Historias de la comunidad", caption: "Historias que dejaron marca" },
];

export function FeedClient({
  posts,
  cronograma,
  encuestas,
  noticias,
}: {
  posts: PostVM[];
  cronograma: Cronograma;
  encuestas: EncuestaFeedVM[];
  noticias: NoticiaFeedVM[];
}) {
  const router = useRouter();
  const { unread, open, session, unreadChats } = useNotifications();
  const reduced = usePrefersReducedMotion();
  const [sharing, setSharing] = useState<PostVM | null>(null);
  const { account, loading } = useAuth();

  return (
    <>
      {/* Degradé de marca, escudo centrado en el slot `heroLogo` y badges
          rojos alineados con el resto de la app. */}
      <AppHeaderCardSlot
        gradientClassName={HEADER_BRAND_GRADIENT}
        className={HEADER_RED_BADGES}
        // Trofeo → `/historia` (la pantalla del club).
        leading={<TrophyIcon />}
        onLeadingClick={() => router.push("/historia")}
        // Sólo el escudo (el SVG ya trae el nombre). Necesita alto explícito:
        // sin `width`/`height` propios, como flex-item de `heroLogo` colapsa a 0.
        heroAlign="center"
        heroLogoMaxHeight={90}
        // Achica el `pb-5` que el componente mete fijo bajo el escudo, para
        // pegarlo a la card.
        heroClassName="!pb-1"
        heroLogo={
          /* eslint-disable-next-line @next/next/no-img-element -- SVG estático */
          <img
            src="/escudo.svg"
            alt={APP_NAME}
            className="block h-20 w-auto object-contain drop-shadow-[0_2px_6px_rgba(0,0,0,0.35)]"
          />
        }
        actions={[
          {
            id: "notif",
            label: "Notificaciones",
            icon: <BellIcon />,
            // `unread || false`: un 0 pelado dibuja un badge rojo con un "0"
            badge: unread || false,
            onClick: open,
          },
          {
            // La única puerta a los mensajes directos junto con la del foro:
            // desde que el tab pasó a ser el foro, la mensajería vive acá y
            // se lleva con ella el badge de no leídos.
            id: "chat",
            label: "Mensajes",
            icon: <ChatIcon />,
            badge: unreadChats || false,
            onClick: () => router.push("/chat"),
          },
        ]}
        // `cardOverlap` baja la card (más valor = más lejos del escudo); 0 la
        // deja pegada al bloque del logo.
        cardMinHeight={32}
        cardOverlap={0}
        card={
          <CountdownHero
            until={LAUNCH_DATE}
            variant="blocks"
            size="xl"
            tone="surface"
            eyebrow="Lanzamiento"
            expiredMessage="Ya está acá."
          />
        }
      />

      <div className="mx-auto flex w-full max-w-xl flex-col gap-4 px-4 py-4">
        {/* Portada del feed. `autoplay` se pausa solo al pasar el mouse o al
            arrastrar, pero la librería no mira `prefers-reduced-motion`: un
            carrusel que avanza solo es justamente lo que esa preferencia pide
            frenar, así que se lo apagamos nosotros. */}
        <Carousel
          images={SLIDES}
          autoplay={reduced ? undefined : 5000}
          aspect={16 / 9}
          loop
          dots
          arrows
          className="overflow-hidden rounded-2xl"
        />

        {/* Cartel de sesión: el feed en sí se ve igual sin login (todavía
            corre sobre la cuenta semilla), pero votar sí la pide de verdad —
            ver el gate en `FeedTabs`. `!loading` evita el parpadeo mientras
            Firebase resuelve el primer `onAuthStateChanged`. */}
        {!loading && !account && (
          <Card
            variant="outline"
            padding="md"
            className="flex flex-row items-center gap-3 border-primary/20 bg-primary/5"
          >
            <ShieldIcon className="size-8 shrink-0 text-primary" />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold">Para votar necesitás iniciar sesión</p>
              <p className="text-xs text-muted">Podés mirar el feed igual, pero votar pide cuenta.</p>
            </div>
            <Button size="sm" onClick={() => router.push("/login")}>
              Ingresar
            </Button>
          </Card>
        )}

        {/* Encuesta, cronograma y noticias. El estado del tab activo vive
            adentro —`TabsGlow` es siempre controlado—, así que lo único que
            baja es el cronograma: son datos del servidor, los mismos que edita
            el panel. */}
        <FeedTabs cronograma={cronograma} encuestas={encuestas} noticias={noticias} />

        {posts.map((post) => (
          <PostCard
            key={post.id}
            post={post}
            session={session}
            onShare={setSharing}
          />
        ))}

        <SafeAreaSpacer edge="bottom" min={8} />
      </div>

      <SharePostSheet
        post={sharing}
        onClose={() => setSharing(null)}
        onShared={(id) => void registerShare(id)}
      />
    </>
  );
}
