import { requireAdmin } from "@/lib/admin/auth";
import { getCuentas, getSolicitudes } from "@/lib/admin/cuentas";
import { PageHeading } from "../PageHeading";
import { UsuariosClient } from "./UsuariosClient";

export const metadata = { title: "Usuarios" };

/** Cuentas reales y autorización de vínculos con el plantel.
 *
 *  Lee Firestore con el Admin SDK, no el store en memoria: acá están las
 *  personas que se registraron, no el contenido semilla del feed.
 *
 *  `force-dynamic`: la cola de solicitudes es lo que trae a alguien a esta
 *  pantalla, y una versión cacheada mostraría una solicitud ya resuelta —o
 *  peor, escondería una nueva. */
export const dynamic = "force-dynamic";

export default async function UsuariosPage() {
  await requireAdmin();

  const [cuentas, solicitudes] = await Promise.all([getCuentas(), getSolicitudes()]);

  return (
    <>
      <PageHeading
        title="Usuarios"
        description="Confirmá quién es del plantel antes de que la cuenta quede activa. Suspender saca una cuenta del feed sin borrar nada."
      />
      <UsuariosClient cuentas={cuentas} solicitudes={solicitudes} />
    </>
  );
}
