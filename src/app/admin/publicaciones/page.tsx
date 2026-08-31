import { requireAdmin } from "@/lib/admin/auth";
import { getAdminPosts } from "@/lib/social/queries";
import { PageHeading } from "../PageHeading";
import { PublicacionesClient } from "./PublicacionesClient";

export const metadata = { title: "Publicaciones" };

export default async function PublicacionesPage() {
  await requireAdmin();

  const posts = await getAdminPosts();

  return (
    <>
      <PageHeading
        title="Publicaciones"
        description="Ocultar es reversible; borrar se lleva también los comentarios."
      />
      <PublicacionesClient posts={posts} />
    </>
  );
}
