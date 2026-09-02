import { getUnreadChats } from "@/lib/chat/queries";
import { getNotifications, getSession } from "@/lib/social/queries";
import { AppShell } from "./AppShell";

/** El feed, el chat y el perfil dependen de quién mira: nada de esto se puede
 *  prerenderizar en el build. Puesto en el layout, aplica a todo el subárbol y
 *  no hay que repetirlo en cada página. */
export const dynamic = "force-dynamic";

/** Layout del módulo público. Server Component: sólo resuelve datos y delega.
 *
 *  El límite cliente/servidor está en `AppShell`, no acá: por eso cada pantalla
 *  de abajo sigue siendo `async` y puede exportar `generateMetadata`.
 */
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const [session, notifications, unreadChats] = await Promise.all([
    getSession(),
    getNotifications(),
    getUnreadChats(),
  ]);

  return (
    <AppShell session={session} notifications={notifications} unreadChats={unreadChats}>
      {children}
    </AppShell>
  );
}
