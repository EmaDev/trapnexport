import { requireAdmin } from "@/lib/admin/auth";
import { getEncuestas, porOrden } from "@/lib/contenido/queries";
import type { CategoriaVotacion } from "@/lib/presentacion/guion";
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

  // El nombre y el tope ya vienen resueltos de `getEncuestas`: salen del
  // documento, que es lo que edita el panel, y ya no de una lista hardcodeada.
  const categorias: CategoriaVotacion[] = (await getEncuestas())
    .filter((e) => e.estado !== "borrador")
    // `getEncuestas` las devuelve de la más nueva a la más vieja, que es lo que
    // quiere la tabla del panel. La gala las quiere en el orden en que se
    // anuncian, que es el `orden` del documento.
    .sort(porOrden)
    .map((e) => ({
      id: e.id,
      // Sin nombre cargado, la pregunta es lo único que hay para la placa.
      nombre: e.nombre || e.pregunta,
      pregunta: e.pregunta,
      descripcion: e.descripcion,
      opciones: e.opciones.map((o) => ({ id: o.id, texto: o.texto, votos: o.votos })),
      // `maxOpciones` es el tope de lo que **vota** cada uno, que es también
      // cuántos se llevan el premio: once votos, once ganadores. Sin tope, gana
      // uno solo.
      cupos: e.multiple ? (e.maxOpciones ?? 1) : 1,
      totalVotos: e.totalVotos,
    }));

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
