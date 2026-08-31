import { requireAdmin } from "@/lib/admin/auth";
import { getEncuestas } from "@/lib/contenido/queries";
import type { CategoriaVotacion } from "@/lib/presentacion/guion";
import { PREMIOS } from "@/lib/trap-awards";
import { PageHeading } from "../PageHeading";
import { PresentacionClient } from "./PresentacionClient";

export const metadata = { title: "Presentación" };

/** La pantalla que se proyecta en la gala, armada con las votaciones del panel.
 *
 *  Traduce acá, en el servidor, y no adentro del presentador: la encuesta trae
 *  la *pregunta* ("¿Quién fue el mejor arquero del año?") y la placa necesita
 *  el *nombre del premio* ("Mejor arquero"), que vive en `PREMIOS`. Hacer ese
 *  cruce del lado del cliente arrastraría `trap-awards.ts` entero al bundle
 *  para usar dos campos de cada premio.
 *
 *  Las encuestas en borrador quedan afuera. Hoy las únicas en borrador son las
 *  de video, cuyas opciones son de relleno hasta que se carguen los clips:
 *  proyectar "Gol 2 · video pendiente" como ganador de la noche sería peor que
 *  no anunciar la categoría.
 */
export default async function PresentacionPage() {
  await requireAdmin();

  const encuestas = await getEncuestas();
  const premios = new Map(PREMIOS.map((p) => [p.id, p]));

  const categorias: CategoriaVotacion[] = encuestas
    .filter((e) => e.estado !== "borrador")
    // El orden de la gala es el de `PREMIOS`, que es el orden en que se
    // sembraron: `getEncuestas` las devuelve de la más nueva a la más vieja,
    // que proyectado sería la lista al revés.
    .sort((a, b) => a.createdAt - b.createdAt)
    .map((e) => {
      const premio = premios.get(e.id);

      return {
        id: e.id,
        // Sin premio en la lista es una encuesta cargada a mano desde el panel:
        // no tiene "nombre de premio" y la pregunta es lo único que hay.
        nombre: premio?.nombre ?? e.pregunta,
        pregunta: e.pregunta,
        descripcion: e.descripcion,
        opciones: e.opciones.map((o) => ({ id: o.id, texto: o.texto, votos: o.votos })),
        // `maxOpciones` es el tope de lo que **vota** cada uno, que es también
        // cuántos se llevan el premio: el once ideal son once votos y once
        // ganadores. Sin tope, gana uno.
        cupos: e.multiple ? (premio?.maxOpciones ?? 1) : 1,
        totalVotos: e.totalVotos,
      };
    });

  return (
    <>
      <PageHeading
        title="Presentación"
        description="La gala en pantalla completa: espera, apertura, cada premio con su revelación y los resultados."
      />
      <PresentacionClient categorias={categorias} />
    </>
  );
}
