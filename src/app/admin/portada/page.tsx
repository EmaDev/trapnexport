import { requireAdmin } from "@/lib/admin/auth";
import { getCronograma, getPortadaConfig } from "@/lib/contenido/queries";
import { PageHeading } from "../PageHeading";
import { PortadaClient } from "./PortadaClient";

export const metadata = { title: "Portada" };

export default async function PortadaPage() {
  await requireAdmin();

  // El cronograma no se edita acá: se muestra para que quien deja el contador
  // atado a él vea a qué día y a qué hora está contando, sin ir a la otra
  // pantalla a confirmarlo.
  const [inicial, cronograma] = await Promise.all([getPortadaConfig(), getCronograma()]);

  return (
    <>
      <PageHeading
        title="Portada"
        description="Lo primero que se ve al abrir la app: la cuenta regresiva y el carrusel de la home."
      />
      <PortadaClient
        inicial={inicial}
        fechaCronograma={cronograma.fecha}
        fechaLargaCronograma={cronograma.fechaLarga}
        eventos={cronograma.eventos.map((e) => ({ nombre: e.nombre, hora: e.hora }))}
      />
    </>
  );
}
