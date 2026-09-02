import { requireAdmin } from "@/lib/admin/auth";
import { getInvitaciones } from "@/lib/contenido/queries";
import { getClub } from "@/lib/historia/queries";
import { PageHeading } from "../PageHeading";
import { InvitacionesClient } from "./InvitacionesClient";

export const metadata = { title: "Invitaciones" };

export default async function InvitacionesPage() {
  await requireAdmin();

  const [invitaciones, club] = await Promise.all([getInvitaciones(), getClub()]);

  return (
    <>
      <PageHeading
        title="Invitaciones"
        description="Cada invitación genera su propio link con una tarjeta a nombre del invitado."
      />
      {/* El club va por prop y no lo importa el cliente: sale de Firestore con
          el Admin SDK, que sólo corre en el servidor, y de todo el documento
          acá se necesitan dos campos. Se edita en /admin/historia. */}
      <InvitacionesClient
        invitaciones={invitaciones}
        club={{ name: club.name, crest: club.crest }}
      />
    </>
  );
}
