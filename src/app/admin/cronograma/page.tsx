import { requireAdmin } from "@/lib/admin/auth";
import { getCronograma } from "@/lib/contenido/queries";
import { PageHeading } from "../PageHeading";
import { CronogramaClient } from "./CronogramaClient";

export const metadata = { title: "Cronograma" };

export default async function CronogramaPage() {
  await requireAdmin();

  const { fecha, fechaLarga, eventos } = await getCronograma();

  return (
    <>
      <PageHeading
        title="Cronograma"
        description="El programa del día del evento. El día se elige una vez; cada actividad sólo elige su horario."
      />
      <CronogramaClient fecha={fecha} fechaLarga={fechaLarga} eventos={eventos} />
    </>
  );
}
