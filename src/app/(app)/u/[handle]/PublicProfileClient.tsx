"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { AppHeader, Button, ProfileCard, SafeAreaSpacer } from "lib-kit-components";

import { PostCard } from "@/components/organisms/PostCard";
import { SharePostSheet } from "@/components/organisms/SharePostSheet";
import { registerShare } from "@/lib/social/actions";
import type { PostVM, ProfileVM } from "@/lib/social/queries";
import { useNotifications } from "../../notifications-context";

/** Perfil público — pantalla empujada e indexable.
 *
 *  Lleva `AppHeader` con volver (no `AppHeaderCardSlot`, que es de pantalla
 *  raíz y no es sticky). El `BottomNav` sigue visible: sólo la conversación de
 *  chat lo esconde.
 */
export function PublicProfileClient({
  profile,
  posts,
}: {
  profile: ProfileVM;
  posts: PostVM[];
}) {
  const router = useRouter();
  const { session } = useNotifications();
  const [sharing, setSharing] = useState<PostVM | null>(null);

  return (
    <>
      <AppHeader
        title={profile.name}
        subtitle={`@${profile.handle}`}
        onBack={() => router.back()}
        variant="blur"
        sticky
      />

      <div className="mx-auto flex w-full max-w-xl flex-col gap-4 px-4 py-4">
        <ProfileCard
          name={profile.name}
          role={`@${profile.handle}`}
          avatar={profile.avatar}
          cover
          stats={[{ label: "Posts", value: profile.stats.posts }]}
          // Sin botón de seguir: la app no tiene sistema de seguimiento. Al
          // dueño de la cuenta se le ofrece su propio perfil, que es donde
          // puede editar; a cualquier otro visitante, nada.
          actions={
            profile.isMe ? (
              <Button size="sm" variant="outline" onClick={() => router.push("/perfil")}>
                Ir a tu perfil
              </Button>
            ) : undefined
          }
        />

        {profile.bio && <p className="text-sm text-muted">{profile.bio}</p>}
        <p className="text-xs text-muted">Se unió en {profile.joined}</p>

        {posts.map((post) => (
          <PostCard key={post.id} post={post} session={session} onShare={setSharing} />
        ))}

        <SafeAreaSpacer edge="bottom" min={8} />
      </div>

      <SharePostSheet
        post={sharing}
        onClose={() => setSharing(null)}
        onShared={(id) => void registerShare(id)}
      />
    </>
  );
}
