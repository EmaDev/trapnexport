"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { AppHeader, NotificationPanel, SafeAreaSpacer, type AppNotification } from "lib-kit-components";

import {
  dismissNotification,
  markAllNotificationsRead,
  markNotificationRead,
} from "@/lib/social/actions";
import type { NotificationVM } from "@/lib/social/queries";

/** Pantalla dedicada del historial — el destino del "Ver todas" del drawer.
 *
 *  Mismo dato y misma lista que el `NotificationSidebar`, sin backdrop:
 *  `NotificationPanel` es la versión embebida del mismo componente. El filtro
 *  "Todas / No leídas" es por instancia, así que este panel y el drawer no lo
 *  comparten; para eso habría que controlarlos con `filter`/`onFilterChange`
 *  desde un mismo estado, y para dos vistas del mismo historial no vale la pena.
 */
export function NotificacionesClient({ items: initial }: { items: NotificationVM[] }) {
  const router = useRouter();
  const [items, setItems] = useState<AppNotification[]>(() =>
    initial.map((n) => ({
      id: n.id,
      title: n.title,
      description: n.description,
      date: n.date,
      read: n.read,
      avatar: n.avatar,
      href: n.href,
      tone: n.tone,
    })),
  );

  return (
    <>
      <AppHeader
        title="Notificaciones"
        subtitle={`${items.filter((n) => !n.read).length} sin leer`}
        onBack={() => router.back()}
        variant="blur"
        sticky
      />

      <div className="mx-auto w-full max-w-xl px-4 py-4">
        <NotificationPanel
          items={items}
          onRead={(id) => {
            setItems((l) => l.map((n) => (n.id === id ? { ...n, read: true } : n)));
            void markNotificationRead(id);
          }}
          onReadAll={() => {
            setItems((l) => l.map((n) => ({ ...n, read: true })));
            void markAllNotificationsRead();
          }}
          onDismiss={(id) => {
            setItems((l) => l.filter((n) => n.id !== id));
            void dismissNotification(id);
          }}
          onItemClick={(n) => n.href && router.push(n.href)}
        />
        <SafeAreaSpacer edge="bottom" min={8} />
      </div>
    </>
  );
}
