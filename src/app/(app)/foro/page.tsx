import type { Metadata } from "next";

import { getFeed } from "@/lib/social/queries";
import { ForoClient } from "./ForoClient";

/** Como el feed: es de sesión —cada post trae si el que mira lo likeó y lo
 *  guardó— y no tiene nada que indexar. Lo indexable son `/post/[id]` y
 *  `/u/[handle]`, que sí llevan OpenGraph. */
export const metadata: Metadata = {
  title: "Foro",
  robots: { index: false, follow: false },
};

export default async function ForoPage() {
  const posts = await getFeed();
  return <ForoClient posts={posts} />;
}
