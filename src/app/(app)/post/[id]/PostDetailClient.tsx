"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { AppHeader, SafeAreaSpacer, ShareButton } from "lib-kit-components";

import { PostCard } from "@/components/organisms/PostCard";
import { SharePostSheet } from "@/components/organisms/SharePostSheet";
import { registerShare } from "@/lib/social/actions";
import type { PostVM } from "@/lib/social/queries";
import { absoluteUrl, APP_NAME } from "@/lib/site";
import { useNotifications } from "../../notifications-context";

/** Detalle del post: el post ES la pantalla.
 *
 *  Acá compartir va sin intermediarios —`ShareButton variant="icon"`, un toque,
 *  hoja del sistema—; la hoja con opciones in-app es cosa del feed. La `url`
 *  es la misma absoluta que el `canonical` de `generateMetadata`.
 */
export function PostDetailClient({ post }: { post: PostVM }) {
  const router = useRouter();
  const { session } = useNotifications();
  const [sharing, setSharing] = useState<PostVM | null>(null);
  const url = absoluteUrl(`/post/${post.id}`);

  return (
    <>
      <AppHeader
        title="Publicación"
        subtitle={`de ${post.author.name}`}
        onBack={() => router.back()}
        variant="blur"
        sticky
      >
        <div className="flex justify-end">
          <ShareButton
            variant="icon"
            label="Compartir"
            title={`${post.author.name} en ${APP_NAME}`}
            text={post.text.slice(0, 120)}
            url={url}
            onShared={() => void registerShare(post.id)}
          />
        </div>
      </AppHeader>

      <div className="mx-auto w-full max-w-xl px-4 py-4">
        <PostCard post={post} session={session} mode="detail" onShare={setSharing} />
        <SafeAreaSpacer edge="bottom" min={8} />
      </div>

      {/* El botón de compartir del propio post abre la hoja con las opciones
          in-app; el del header es el atajo directo a la hoja del sistema. */}
      <SharePostSheet
        post={sharing}
        onClose={() => setSharing(null)}
        onShared={(id) => void registerShare(id)}
      />
    </>
  );
}
