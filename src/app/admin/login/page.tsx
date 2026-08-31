import Link from "next/link";
import { Card } from "lib-kit-components";

import { isAdminAuthEnabled } from "@/lib/admin/auth";
import { PageHeading } from "../PageHeading";

export const metadata = { title: "Ingresar" };

/** Destino del guard cuando falta la sesión.
 *
 *  Todavía no tiene formulario a propósito: la app no tiene Firebase Auth
 *  conectado y un formulario que no autentica es peor que ninguno. Existe
 *  porque el middleware necesita a dónde redirigir cuando encendés
 *  `ADMIN_AUTH_ENABLED`, y porque es el archivo donde va el login cuando se
 *  conecte (`signInWithEmailAndPassword` → canje por session cookie → volver a
 *  `next`).
 */
export default async function AdminLoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next } = await searchParams;
  const enabled = isAdminAuthEnabled();

  return (
    <>
      <PageHeading title="Ingresar" description="Acceso al panel de administración." />

      <Card variant="outline" padding="lg" className="max-w-md">
        {enabled ? (
          <>
            <p className="text-sm">
              El guard está activo y no encontramos una sesión válida
              {next ? ` para ${next}` : ""}.
            </p>
            <p className="mt-3 text-sm text-muted">
              Todavía no hay formulario: falta conectar Firebase Auth. Los pasos están
              en <code>src/lib/admin/auth.ts</code>.
            </p>
          </>
        ) : (
          <>
            <p className="text-sm">
              La autenticación del panel está desactivada, así que esta pantalla no hace
              falta: entrá directo.
            </p>
            <Link href="/admin" className="mt-4 inline-block text-sm font-medium text-primary">
              Ir al panel
            </Link>
          </>
        )}
      </Card>
    </>
  );
}
