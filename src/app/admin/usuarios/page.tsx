import { requireAdmin } from "@/lib/admin/auth";
import { getAdminUsers, getPendingClaims } from "@/lib/social/queries";
import { PageHeading } from "../PageHeading";
import { UsuariosClient } from "./UsuariosClient";

export const metadata = { title: "Usuarios" };

export default async function UsuariosPage() {
  await requireAdmin();

  const [users, claims] = await Promise.all([getAdminUsers(), getPendingClaims()]);

  return (
    <>
      <PageHeading
        title="Usuarios"
        description="Suspender una cuenta la saca del feed público sin borrar nada."
      />
      <UsuariosClient users={users} claims={claims} />
    </>
  );
}
