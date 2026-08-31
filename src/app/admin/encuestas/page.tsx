import { requireAdmin } from "@/lib/admin/auth";
import { getEncuestas } from "@/lib/contenido/queries";
import { PageHeading } from "../PageHeading";
import { EncuestasClient } from "./EncuestasClient";

export const metadata = { title: "Encuestas" };

export default async function EncuestasPage() {
  await requireAdmin();

  const encuestas = await getEncuestas();

  return (
    <>
      <PageHeading
        title="Encuestas"
        description="Borrador → abierta → cerrada. Una vez cerrada no se reabre: los votos ya se comunicaron."
      />
      <EncuestasClient encuestas={encuestas} />
    </>
  );
}
