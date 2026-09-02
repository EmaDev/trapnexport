import { requireAdmin } from "@/lib/admin/auth";
import { estadoDeCarga, getHistoria } from "@/lib/historia/queries";
import { PageHeading } from "../PageHeading";
import { HistoriaAdminClient } from "./HistoriaAdminClient";

export const metadata = { title: "Historia del club" };

export default async function HistoriaAdminPage() {
  await requireAdmin();

  // Las dos lecturas van en paralelo: `getHistoria` ya trae las siete
  // colecciones y `estadoDeCarga` sólo cuenta si cada una tiene algo. Pedirlas
  // en fila serían dos viajes por una pantalla que se abre entera de una vez.
  const [historia, cargado] = await Promise.all([getHistoria(), estadoDeCarga()]);

  return (
    <>
      <PageHeading
        title="Historia del club"
        description="Todo lo que se ve en /historia: identidad, etapas, temporadas, jugadores, frases, museo y video. Los cambios salen a la app apenas se guardan."
      />
      <HistoriaAdminClient historia={historia} cargado={cargado} />
    </>
  );
}
