import type { Metadata } from "next";

import { getAdminSession, isAdminAuthEnabled } from "@/lib/admin/auth";
import { AdminShell } from "./AdminShell";

/** Layout del módulo privado. Server Component: verifica y delega.
 *
 *  `noindex, nofollow` para todo el subárbol; el middleware repite la orden en
 *  la cabecera `X-Robots-Tag`. Un panel de moderación no se indexa nunca.
 */
export const metadata: Metadata = {
  title: { default: "Administración", template: "%s · Administración" },
  robots: { index: false, follow: false, nocache: true },
};

/** El panel refleja el estado de moderación en vivo y, cuando entre Firebase,
 *  leerá la cookie de sesión: nunca prerenderizado. */
export const dynamic = "force-dynamic";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  // Sin redirigir: este layout también envuelve a /admin/login. El corte lo
  // hacen el middleware (antes de renderizar) y el `requireAdmin()` de cada
  // página del panel.
  const admin = await getAdminSession();

  return (
    <AdminShell
      adminEmail={admin?.email ?? "sin sesión"}
      authEnabled={isAdminAuthEnabled()}
    >
      {children}
    </AdminShell>
  );
}
