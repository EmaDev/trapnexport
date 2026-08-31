"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import {
  BottomNav,
  NotificationSidebar,
  PwaInstallPrompt,
  SafeArea,
  SnackbarProvider,
  SplashScreen,
  UpdatePrompt,
  useSplash,
  type AppNotification,
  type BottomNavItem,
} from "lib-kit-components";

import { ForumIcon, HomeIcon, TrophyIcon, UserIcon } from "@/components/atoms/icons";
import { loadSession } from "@/lib/session";
import {
  dismissNotification,
  markAllNotificationsRead,
  markNotificationRead,
} from "@/lib/social/actions";
import type { NotificationVM, SessionVM } from "@/lib/social/queries";
import { APP_NAME, APP_TAGLINE } from "@/lib/site";
import { NotificationsCtx } from "./notifications-context";

/** El único `"use client"` "de arriba" del módulo público.
 *
 *  Monta, una sola vez, las piezas de plataforma: splash, safe areas,
 *  instalador, drawer de notificaciones, `BottomNav` y `SnackbarProvider`.
 *  `layout.tsx` y todas las páginas siguen siendo Server Components y pueden
 *  hacer `await` de datos y exportar `generateMetadata`.
 *
 *  Orden de montaje (define quién tapa a quién):
 *
 *    SnackbarProvider                 provider, el envoltorio más externo
 *    └── NotificationsCtx.Provider
 *        ├── SplashScreen             fixed z-200
 *        ├── PwaInstallPrompt         fixed bottom z-120
 *        ├── SafeArea → <main>        el contenido
 *        ├── BottomNav                fixed bottom z-40, md:hidden
 *        └── NotificationSidebar      fixed z-50
 */

const NAV: BottomNavItem[] = [
  { label: "Feed", href: "/", icon: <HomeIcon /> },
  // El foro le sacó el lugar al chat: es una pantalla donde uno se queda
  // —leer lo que postea la comunidad— y esa es la vara de un tab. La
  // mensajería directa pasó al header (ver `PUSHED` y `unreadChats`).
  { label: "Foro", href: "/foro", icon: <ForumIcon /> },
  // "Historia" y no "Salón de la fama": son cuatro tabs y en 360px un label
  // de tres palabras se corta. El nombre largo va en el título de la pantalla.
  { label: "Historia", href: "/historia", icon: <TrophyIcon /> },
  { label: "Perfil", href: "/perfil", icon: <UserIcon /> },
];

/** Pantallas empujadas: se abren "encima" y no muestran la nav (patrón B).
 *
 *  `/chat` entero, no sólo la conversación: los mensajes directos ya no son un
 *  tab, se levantan desde el header. Sin esto la bandeja dejaría marcado el tab
 *  del feed —`BottomNav` resuelve el activo por sección y ninguna coincide— y
 *  se leería como una pantalla raíz que ya no es. */
const PUSHED = [/^\/chat(?:\/|$)/];

const toAppNotification = (n: NotificationVM): AppNotification => ({
  id: n.id,
  title: n.title,
  description: n.description,
  date: n.date,
  read: n.read,
  avatar: n.avatar,
  href: n.href,
  tone: n.tone,
});

export function AppShell({
  children,
  session,
  notifications,
  unreadChats,
}: {
  children: React.ReactNode;
  session: SessionVM;
  notifications: NotificationVM[];
  unreadChats: number;
}) {
  const router = useRouter();
  const pathname = usePathname();

  // `until` espera la sesión antes de destapar el feed. Hoy resuelve enseguida
  // (la inyecta el servidor); con Firebase Auth pasa a ser onAuthStateChanged.
  const { visible, progress } = useSplash({
    minDuration: 1200,
    oncePerSession: true,
    until: loadSession,
  });

  const [notifOpen, setNotifOpen] = useState(false);
  const [items, setItems] = useState<AppNotification[]>(() =>
    notifications.map(toAppNotification),
  );

  // `items` es estado local para que marcar leída / descartar respondan al
  // toque. Pero cuando algo dispara `router.refresh()` (publicar un post,
  // volver del panel) el servidor manda una lista nueva con las notificaciones
  // recién creadas y hay que adoptarla. Es el patrón de "ajustar estado cuando
  // cambia una prop" de React —comparar contra la prop anterior en el render, no
  // un efecto—: `getNotifications` ya trae las lecturas y descartes previos, así
  // que reemplazar la lista entera no pierde nada.
  const [prevNotifs, setPrevNotifs] = useState(notifications);
  if (prevNotifs !== notifications) {
    setPrevNotifs(notifications);
    setItems(notifications.map(toAppNotification));
  }

  const unread = items.filter((n) => !n.read).length;

  const ctx = useMemo(
    () => ({ items, unread, open: () => setNotifOpen(true), session, unreadChats }),
    [items, unread, session, unreadChats],
  );

  // Sin esto, /post/123 o /u/luciaf no marcan ningún tab: `BottomNav` resuelve
  // el activo con igualdad exacta de pathname (patrón A de la guía).
  const navItems = useMemo(() => {
    const section = NAV.find((i) => i.href !== "/" && pathname.startsWith(i.href)) ?? NAV[0];
    return NAV.map((i) => ({ ...i, href: i === section ? pathname : i.href }));
  }, [pathname]);

  const showNav = !PUSHED.some((re) => re.test(pathname));

  const markRead = (id: string) => {
    setItems((l) => l.map((n) => (n.id === id ? { ...n, read: true } : n)));
    void markNotificationRead(id);
  };

  return (
    // gap 80 = alto del BottomNav (64) + aire: con el default (16) la snackbar
    // queda tapada por la nav.
    <SnackbarProvider position="bottom-center" gap={80}>
      <NotificationsCtx.Provider value={ctx}>
        <SplashScreen
          visible={visible}
          progress={progress}
          appName={APP_NAME}
          tagline={APP_TAGLINE}
          // El escudo, no la inicial: es lo primero que se ve al abrir la app.
          //
          // `size-full object-contain` y no un tamaño fijo: `SplashScreen`
          // encierra el `icon` en una caja de 80×80 con `overflow-hidden`, así
          // que un `<img>` más grande se recorta y uno más chico deja la placa
          // blanca a la vista. Con esto el escudo la llena y no se corta.
          //
          // Va como `<img>` y no como `next/image` porque un SVG no gana nada
          // con el optimizador —no hay qué recomprimir ni variantes que servir—
          // y `next/image` lo pediría con `dangerouslyAllowSVG`.
          icon={
            /* eslint-disable-next-line @next/next/no-img-element -- SVG estático */
            <img src="/escudo.svg" alt="" className="size-full object-contain p-1" />
          }
          variant="zoom"
          background="brand"
        />

        {/* El instalador (z-120) y el aviso de actualización (z-125) quedan por
            ENCIMA del drawer (z-50), que no expone forma de subirle el z-index:
            la salida es no renderizarlos mientras está abierto. */}
        {!notifOpen && (
          <>
            <PwaInstallPrompt
              appName={APP_NAME}
              tagline="El feed, en tu pantalla de inicio"
              snoozeDays={14}
            />
            <UpdatePrompt />
          </>
        )}

        {/* edges sin "top": lo aplica AppHeaderCardSlot. Sin "bottom": lo
            reserva BottomNav midiendo su alto real. */}
        <SafeArea
          edges={["left", "right"]}
          fillViewport
          className="flex flex-col bg-surface text-foreground"
        >
          <main className="min-w-0 flex-1 md:pb-8">{children}</main>
        </SafeArea>

        {showNav && <BottomNav items={navItems} />}

        <NotificationSidebar
          open={notifOpen}
          onClose={() => setNotifOpen(false)}
          side="right"
          items={items}
          onRead={markRead}
          onReadAll={() => {
            setItems((l) => l.map((n) => ({ ...n, read: true })));
            void markAllNotificationsRead();
          }}
          onDismiss={(id) => {
            setItems((l) => l.filter((n) => n.id !== id));
            void dismissNotification(id);
          }}
          onItemClick={(n) => {
            markRead(n.id);
            if (n.href) {
              setNotifOpen(false);
              router.push(n.href);
            }
          }}
          footer={
            <Link
              href="/notificaciones"
              onClick={() => setNotifOpen(false)}
              className="block w-full py-1 text-center text-sm font-medium text-primary"
            >
              Ver todas
            </Link>
          }
        />
      </NotificationsCtx.Provider>
    </SnackbarProvider>
  );
}
