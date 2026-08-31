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
import type { Cronograma } from "@/lib/contenido/queries";
import type { PostVM } from "@/lib/social/queries";
import { APP_NAME, LAUNCH_DATE } from "@/lib/site";
import { useNotifications } from "./notifications-context";

/** El degradé de `AppHeaderCardSlot` está hardcodeado en la librería
 *  (`from-[#6d5bf0] to-[#4b3fce]`) y no sale de los tokens del tema: la única
 *  forma de alinearlo con la marca es pisarlo con el modificador importante de
 *  Tailwind. Son los mismos dos valores que `--color-primary` y
 *  `--color-accent` del tema claro en globals.css — si cambia la paleta, esta
 *  constante se actualiza con ella. */
export const HEADER_BRAND_GRADIENT = "!bg-[linear-gradient(135deg,#50108b,#752eb8)]";

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
  // Con `!`: el `bg-white` del badge es una clase propia del componente y las
  // dos reglas viven en la misma capa, así que sin importante gana la que
  // Tailwind haya emitido última. (El `!` va adelante, como en la constante de
  // arriba; la v4 acepta las dos posiciones y el archivo ya usa esta.)
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
}: {
  posts: PostVM[];
  cronograma: Cronograma;
}) {
  const router = useRouter();
  const { unread, open, session, unreadChats } = useNotifications();
  const reduced = usePrefersReducedMotion();
  const [sharing, setSharing] = useState<PostVM | null>(null);
  const { user, loading } = useAuth();

  return (
    <>
      {/* `AppHeaderCardSlot` (lib-kit-components) no tiene slots de marca —su
          interfaz sólo expone `leading`/`actions`/`card`, confirmado contra el
          código instalado y su doc, que dice explícito "no tiene title ni
          onBack"—, así que el escudo y el wordmark van superpuestos por
          afuera, en un wrapper `relative` propio, y no como props del
          componente. */}
      <div className="relative">
        <AppHeaderCardSlot
          className={`${HEADER_BRAND_GRADIENT} ${HEADER_RED_BADGES}`}
          // El botón de la izquierda conserva su destino de siempre —`/historia`,
          // la pantalla del club— pero con el ícono que le corresponde: el
          // escudo va en el hero, y dejarlo acá sería la tercera marca.
          leading={<TrophyIcon />}
          onLeadingClick={() => router.push("/historia")}
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
          // El componente traslada la card `cardMinHeight / 2` hacia abajo y
          // reserva esa misma mitad de alto. Con el default (96) la card baja
          // 48px y abre un hueco muerto entre el escudo y el contador; 32 la
          // sube casi contra el hero y deja sólo un solape mínimo, que es el
          // efecto "flotante" sin el aire de más.
          cardMinHeight={32}
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

        {/* Escudo y nombre van juntos, en fila, como un solo lockup de marca.
            Separados —cada uno centrado por su cuenta— se pisan: el header sólo
            expone una franja de 56px antes de la card, no hay lugar para
            apilarlos.

            `px-20` deja libres los ~72px de botones que el header tiene a cada
            lado (leading + notificaciones + avatar), y `pointer-events-none`
            evita que este bloque les robe los clicks.

            El nombre sale de `APP_NAME` y no de un literal para que renombrar
            la app siga siendo un solo cambio en `site.ts`. */}
        <div className="pointer-events-none absolute inset-x-0 top-0 z-20 flex h-14 items-center justify-center gap-2 px-20">
          {/* eslint-disable-next-line @next/next/no-img-element -- SVG estático */}
          <img
            src="/escudo.svg"
            alt=""
            className="h-9 w-auto shrink-0 object-contain drop-shadow-[0_2px_6px_rgba(0,0,0,0.35)]"
          />
          <span className="truncate text-[17px] font-black tracking-tight text-white">
            {APP_NAME}
          </span>
        </div>
      </div>

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
        {!loading && !user && (
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
        <FeedTabs cronograma={cronograma} />

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
