import type { Metadata } from "next";

import { getCronograma } from "@/lib/contenido/queries";
import { getFeed } from "@/lib/social/queries";
import { FeedClient } from "./FeedClient";

/** El feed es de sesión: no tiene nada que indexar y cambia por usuario.
 *  Lo indexable son `/post/[id]` y `/u/[handle]`, que sí llevan OpenGraph. */
export const metadata: Metadata = {
  title: "Feed",
  robots: { index: false, follow: false },
};

export default async function FeedPage() {
  const [posts, cronograma] = await Promise.all([getFeed(), getCronograma()]);
  return <FeedClient posts={posts} cronograma={cronograma} />;
}
