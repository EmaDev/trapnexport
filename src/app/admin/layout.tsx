import type { Metadata } from "next";

import { getAdminSession } from "@/lib/admin/auth";
import { AdminShell } from "./AdminShell";

/** Layout del módulo privado. Server Component: verifica y delega.
 *
 *  `noindex, nofollow` para todo el subárbol; el proxy repite la orden en la
 *  cabecera `X-Robots-Tag`. Un panel de moderación no se indexa nunca.
 */
export const metadata: Metadata = {
  title: { default: "Administración", template: "%s · Administración" },
  robots: { index: false, follow: false, nocache: true },
};

/** Lee la cookie de sesión en cada request: nunca prerenderizado. */
export const dynamic = "force-dynamic";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  // Sin redirigir: este layout también envuelve a /admin/login. El corte lo
  // hacen el proxy (antes de renderizar) y el `requireAdmin()` de cada página
  // del panel y de cada Server Action.
  const admin = await getAdminSession();

  return <AdminShell adminEmail={admin?.email ?? "sin sesión"}>{children}</AdminShell>;
}
