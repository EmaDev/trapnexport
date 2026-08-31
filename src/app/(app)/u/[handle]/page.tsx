import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { getPostsByHandle, getProfile } from "@/lib/social/queries";
import { absoluteUrl, APP_NAME } from "@/lib/site";
import { PublicProfileClient } from "./PublicProfileClient";

/** Perfil público: junto con /post/[id], la otra ruta que se comparte hacia
 *  afuera, así que es la otra que lleva OpenGraph. El resto va noindex. */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ handle: string }>;
}): Promise<Metadata> {
  const { handle } = await params;
  const profile = await getProfile(handle);
  if (!profile) return { title: "Perfil no encontrado" };

  const url = absoluteUrl(`/u/${handle}`);
  const title = `${profile.name} (@${profile.handle})`;
  const description = profile.bio ?? `Perfil de ${profile.name} en ${APP_NAME}`;

  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: { type: "profile", url, title, description },
    twitter: { card: "summary" },
  };
}

export default async function PublicProfilePage({
  params,
}: {
  params: Promise<{ handle: string }>;
}) {
  const { handle } = await params;
  const profile = await getProfile(handle);
  if (!profile) notFound();

  const posts = await getPostsByHandle(handle);
  return <PublicProfileClient profile={profile} posts={posts} />;
}
