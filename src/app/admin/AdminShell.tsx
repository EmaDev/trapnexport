"use client";

import Link from "next/link";
import { SideBar, SnackbarProvider, Navbar, type SidebarSection } from "lib-kit-components";

import {
  CalendarIcon,
  ChatIcon,
  DashboardIcon,
  NewsIcon,
  PollIcon,
  PostsIcon,
  PresentIcon,
  ShieldIcon,
  TicketIcon,
  UsersIcon,
} from "@/components/atoms/icons";
import { APP_NAME } from "@/lib/site";
import { SalirDelPanel } from "./SalirDelPanel";

/** Shell del módulo privado. Deliberadamente NO comparte nada con el shell
 *  público más allá del tema:
 *
 *  - sin splash, sin instalador, sin `BottomNav`, sin drawer de notificaciones;
 *  - navegación de escritorio (`SideBar` colapsable) y `Navbar` con hamburguesa
 *    debajo de `md`, en vez de la barra inferior mobile-first;
 *  - su propio `SnackbarProvider` con `gap` por defecto: acá no hay una nav de
 *    64px abajo que tape la snackbar, así que el 80 del módulo público sobra.
 *
 *  Son dos apps que comparten dominio y datos, no una app con dos secciones.
 */

/** El orden es el del trabajo del día: primero el panel, después lo que se
 *  **carga** (contenido), lo que se usa **en vivo**, lo que se **manda**
 *  (comunicación) y al final lo que se **revisa** (moderación). El panel viejo
 *  tenía moderación arriba porque era lo único que había. */
const SECTIONS: SidebarSection[] = [
  {
    title: "General",
    links: [{ label: "Panel", href: "/admin", icon: <DashboardIcon /> }],
  },
  {
    title: "Contenido",
    links: [
      { label: "Noticias", href: "/admin/noticias", icon: <NewsIcon /> },
      { label: "Encuestas", href: "/admin/encuestas", icon: <PollIcon /> },
      { label: "Invitaciones", href: "/admin/invitaciones", icon: <TicketIcon /> },
      { label: "Cronograma", href: "/admin/cronograma", icon: <CalendarIcon /> },
      // Última del grupo y no primera: las cuatro de arriba son la carga del
      // día a día; la historia del club se toca de vez en cuando y en tandas
      // largas.
      { label: "Historia", href: "/admin/historia", icon: <ShieldIcon /> },
    ],
  },
  // Grupo propio y no un ítem más de "Contenido": esto no carga nada. Es la
  // herramienta que se usa **la noche de la gala**, con el proyector prendido,
  // y sale a pantalla completa apenas se aprieta. Mezclarla con los ABM la
  // pondría a un click de distraído de la lista de encuestas.
  {
    title: "En vivo",
    links: [
      { label: "Presentación", href: "/admin/presentacion", icon: <PresentIcon /> },
    ],
  },
  // Tampoco es "Contenido": lo de arriba se publica para que alguien lo
  // encuentre, esto se le manda a cada persona a su bandeja y admite respuesta.
  // El grupo propio es lo que recuerda que hay algo que atender del otro lado.
  {
    title: "Comunicación",
    links: [{ label: "Mensajes", href: "/admin/mensajes", icon: <ChatIcon /> }],
  },
  {
    title: "Moderación",
    links: [
      { label: "Usuarios", href: "/admin/usuarios", icon: <UsersIcon /> },
      { label: "Publicaciones", href: "/admin/publicaciones", icon: <PostsIcon /> },
    ],
  },
];

const LINKS = SECTIONS.flatMap((s) => s.links).map(({ label, href, icon }) => ({
  label,
  href,
  icon,
}));

function Brand() {
  return (
    <Link href="/admin" className="flex items-center gap-2">
      {/* eslint-disable-next-line @next/next/no-img-element -- SVG estático */}
      <img src="/escudo.svg" alt="" width={32} height={32} className="shrink-0" />
      <span className="flex flex-col leading-tight">
        <span className="text-sm font-semibold">{APP_NAME}</span>
        <span className="text-xs text-muted">Administración</span>
      </span>
    </Link>
  );
}

export function AdminShell({
  children,
  adminEmail,
}: {
  children: React.ReactNode;
  adminEmail: string;
}) {
  return (
    <SnackbarProvider position="bottom-right">
      <div className="flex min-h-screen bg-surface-alt">
        <div className="hidden md:block">
          <SideBar
            brand={<Brand />}
            sections={SECTIONS}
            footer={
              <div className="flex flex-col gap-1 text-xs">
                <span className="truncate text-muted">{adminEmail}</span>
                <Link href="/" className="font-medium text-primary">
                  Volver a la app
                </Link>
                <SalirDelPanel />
              </div>
            }
          />
        </div>

        <div className="flex min-w-0 flex-1 flex-col">
          <Navbar
            className="md:hidden"
            brand={<Brand />}
            links={LINKS}
            actions={
              <div className="flex items-center gap-3 text-sm">
                <Link href="/" className="font-medium text-primary">
                  Ver app
                </Link>
                <SalirDelPanel />
              </div>
            }
          />

          <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 md:px-8">
            {children}
          </main>
        </div>
      </div>
    </SnackbarProvider>
  );
}
