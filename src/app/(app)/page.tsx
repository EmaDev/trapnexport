import type { Metadata } from "next";

import { getCronograma, getEncuestasFeed, getPortada } from "@/lib/contenido/queries";
import { getFeed } from "@/lib/social/queries";
import { FeedClient } from "./FeedClient";

/** El feed es de sesión: no tiene nada que indexar y cambia por usuario.
 *  Lo indexable son `/post/[id]` y `/u/[handle]`, que sí llevan OpenGraph. */
export const metadata: Metadata = {
  title: "Feed",
  robots: { index: false, follow: false },
};

export default async function FeedPage() {
  const [posts, cronograma, encuestas] = await Promise.all([
    getFeed(),
    getCronograma(),
    getEncuestasFeed(),
  ]);
  // Después y no en el `Promise.all`: el contador de la portada puede estar
  // atado al día del cronograma, y pasarle el que ya se leyó evita releer la
  // colección de eventos entera para sacarle la hora de arranque.
  const portada = await getPortada(cronograma);

  return (
    <FeedClient
      posts={posts}
      cronograma={cronograma}
      encuestas={encuestas}
      portada={portada}
    />
  );
}
