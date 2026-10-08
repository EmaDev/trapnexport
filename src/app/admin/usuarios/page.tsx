import { requireAdmin } from "@/lib/admin/auth";
import { getCuentas, getSolicitudes } from "@/lib/admin/cuentas";
import { getClaimablePlayers } from "@/lib/auth/roster";
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

  /*  El plantel es para el diálogo de "cambiar el tipo de cuenta": es la misma
   *  lista que ofrece el alta —misma función, mismo `claimedBy`— y no una
   *  consulta propia, porque también es la que crea las filas de reclamo que
   *  falten. Sin ellas, vincular a un jugador cargado después del último seed
   *  fallaría al escribir un documento que no existe. */
  const [cuentas, solicitudes, plantel] = await Promise.all([
    getCuentas(),
    getSolicitudes(),
    getClaimablePlayers(),
  ]);

  return (
    <>
      <PageHeading
        title="Usuarios"
        description="Confirmá quién es del plantel antes de que la cuenta quede activa. Suspender saca una cuenta del feed sin borrar nada, y el tipo de cuenta se puede corregir si alguien del plantel se registró como hincha."
      />
      <UsuariosClient cuentas={cuentas} solicitudes={solicitudes} plantel={plantel} />
    </>
  );
}
