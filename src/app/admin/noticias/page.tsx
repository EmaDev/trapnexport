import { requireAdmin } from "@/lib/admin/auth";
import { getNoticias } from "@/lib/contenido/queries";
import { PageHeading } from "../PageHeading";
import { NoticiasClient } from "./NoticiasClient";

export const metadata = { title: "Noticias" };

export default async function NoticiasPage() {
  await requireAdmin();

  const noticias = await getNoticias();

  return (
    <>
      <PageHeading
        title="Noticias"
        description="Los borradores no se ven en la app. Sólo una noticia puede estar destacada."
      />
      <NoticiasClient noticias={noticias} />
    </>
  );
}
