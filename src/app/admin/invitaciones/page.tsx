import { requireAdmin } from "@/lib/admin/auth";
import { getInvitaciones } from "@/lib/contenido/queries";
import { CLUB } from "@/lib/historia";
import { PageHeading } from "../PageHeading";
import { InvitacionesClient } from "./InvitacionesClient";

export const metadata = { title: "Invitaciones" };

export default async function InvitacionesPage() {
  await requireAdmin();

  const invitaciones = await getInvitaciones();

  return (
    <>
      <PageHeading
        title="Invitaciones"
        description="Cada invitación genera su propio link con una tarjeta a nombre del invitado."
      />
      {/* El club va por prop y no lo importa el cliente: `lib/historia` son
          1400 líneas de contenido editorial y sólo se necesitan dos campos. */}
      <InvitacionesClient
        invitaciones={invitaciones}
        club={{ name: CLUB.name, crest: CLUB.crest }}
      />
    </>
  );
}
