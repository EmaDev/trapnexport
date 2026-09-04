import { requireAdmin } from "@/lib/admin/auth";
import { getFichasDeCuentas } from "@/lib/admin/cuentas";
import { estadoDeCarga, getHistoria } from "@/lib/historia/queries";
import { PageHeading } from "../PageHeading";
import { HistoriaAdminClient } from "./HistoriaAdminClient";

export const metadata = { title: "Historia del club" };

/** La solapa "Fichas" lista cuentas reales, que cambian sin que nadie toque
 *  esta pantalla: alguien se registra, otro completa su ficha desde el
 *  teléfono. Una versión cacheada mostraría el plantel de la última vez que se
 *  buildeó — el mismo motivo por el que `/admin/usuarios` es dinámica. */
export const dynamic = "force-dynamic";

export default async function HistoriaAdminPage() {
  await requireAdmin();

  // Las tres lecturas van en paralelo: `getHistoria` ya trae las siete
  // colecciones, `estadoDeCarga` sólo cuenta si cada una tiene algo y las
  // fichas salen del directorio de cuentas. Pedirlas en fila serían tres
  // viajes por una pantalla que se abre entera de una vez.
  const [historia, fichas, cargado] = await Promise.all([
    getHistoria(),
    getFichasDeCuentas(),
    estadoDeCarga(),
  ]);

  return (
    <>
      <PageHeading
        title="Historia del club"
        description="Todo lo que se ve en /historia: identidad, etapas, temporadas, jugadores, fichas, frases, museo y video. Los cambios salen a la app apenas se guardan."
      />
      <HistoriaAdminClient historia={historia} fichas={fichas} cargado={cargado} />
    </>
  );
}
