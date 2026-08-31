import type { Metadata } from "next";

import { getNotifications } from "@/lib/social/queries";
import { NotificacionesClient } from "./NotificacionesClient";

export const metadata: Metadata = {
  title: "Notificaciones",
  robots: { index: false, follow: false },
};

export default async function NotificacionesPage() {
  const items = await getNotifications();
  return <NotificacionesClient items={items} />;
}
