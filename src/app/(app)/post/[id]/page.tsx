import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { getPost } from "@/lib/social/queries";
import { absoluteUrl, APP_NAME } from "@/lib/site";
import { PostDetailClient } from "./PostDetailClient";

/** Un link compartido sin metadata es un link muerto: WhatsApp, Telegram y
 *  Twitter leen esto para armar el preview. La `url` del canonical es la MISMA
 *  que recibe `ShareButton` — si difieren, el preview apunta a otro lado. */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const post = await getPost(id);
  if (!post) return { title: "Publicación no encontrada" };

  const url = absoluteUrl(`/post/${id}`);
  // Las imágenes de relleno son data-URI: ningún crawler las resuelve y
  // meterlas en un <meta> genera una etiqueta de decenas de KB. Cuando la media
  // pase a storage real (URLs http), esto empieza a emitirlas solo.
  const cover = post.media[0]?.src;
  const ogImages = cover && !cover.startsWith("data:") ? [cover] : [];

  return {
    title: `${post.author.name} en ${APP_NAME}`,
    description: post.text.slice(0, 155),
    alternates: { canonical: url },
    openGraph: {
      type: "article",
      url,
      title: `${post.author.name} en ${APP_NAME}`,
      description: post.text.slice(0, 155),
      images: ogImages,
    },
    twitter: { card: "summary_large_image" },
  };
}

export default async function PostPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const post = await getPost(id);
  if (!post) notFound();

  return <PostDetailClient post={post} />;
}
