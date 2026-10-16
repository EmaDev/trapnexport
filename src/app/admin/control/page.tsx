import { requireAdmin } from "@/lib/admin/auth";
import { ControlClient } from "./ControlClient";

export const metadata = { title: "Control remoto" };

/** El control remoto de la gala: se abre en el celular del que presenta.
 *
 *  No lee nada en el servidor. Todo lo que muestra —qué está proyectado, qué
 *  viene, quién gana— lo publica la proyección en Firestore, y el celular lo
 *  escucha en vivo. La página sólo existe para exigir la sesión de admin antes
 *  de mostrar un botón que revela ganadores.
 */
export default async function ControlPage() {
  await requireAdmin();
  return <ControlClient />;
}
