"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CommentBox, SocialPost, useSnackbar } from "lib-kit-components";

import {
  addComment,
  deleteComment,
  toggleCommentLike,
  toggleLike,
  toggleSave,
} from "@/lib/social/actions";
import type { PostVM, SessionVM } from "@/lib/social/queries";

/** Un post con su caja de comentarios. Se usa en el feed, en el perfil y en el
 *  detalle — cambia `mode`, no el componente.
 *
 *  ⚠️ Desvío respecto de la guía, a propósito: la guía describe un `SocialPost`
 *  con caja de comentarios incluida (`comments`, `onAddComment`, `currentUser`,
 *  `visibleComments`). La versión de `lib-kit-components` instalada acá **no
 *  tiene esas props** — su `SocialPostProps` termina en `children`. Así que la
 *  caja es siempre un `CommentBox` en el slot `children`, en las dos variantes:
 *
 *    mode="feed"    → compacta: 2 comentarios, sin hilos
 *    mode="detail"  → completa: hilos, borrar
 *
 *  El orden lo fija `CommentBox` (fijados primero, después recientes); ya no es
 *  configurable.
 *
 *  Eso cumple igual la regla dura de la guía —nunca dos cajas de escritura en
 *  el mismo post— y el día que la librería se actualice, el feed puede pasar a
 *  la caja incluida sin tocar nada más que este archivo.
 */
export function PostCard({
  post,
  session,
  onShare,
  mode = "feed",
}: {
  post: PostVM;
  session: SessionVM;
  onShare: (post: PostVM) => void;
  mode?: "feed" | "detail";
}) {
  const router = useRouter();
  const { snack, undo } = useSnackbar();
  const box = useRef<HTMLDivElement>(null);
  const [, startTransition] = useTransition();

  const [liked, setLiked] = useState(post.liked);
  const [saved, setSaved] = useState(post.saved);

  const detail = mode === "detail";

  return (
    <div ref={box}>
      <SocialPost
        author={post.author}
        time={post.time}
        text={post.text}
        media={post.media}
        counts={post.counts}
        liked={liked}
        saved={saved}
        likedBy={post.likedBy}
        // en el detalle el post ES la pantalla: sin marco y sin recortar el texto
        variant={detail ? "flat" : "card"}
        clampAt={detail ? undefined : 240}
        onLike={(v) => {
          setLiked(v);
          startTransition(() => void toggleLike(post.id, v));
        }}
        onSave={(v) => {
          setSaved(v);
          startTransition(() => void toggleSave(post.id, v));
          snack({ message: v ? "Guardado" : "Quitado de guardados" });
        }}
        // enfoca la caja de abajo; NO navega — el usuario perdería lo que escribió
        onComment={() => {
          const input = box.current?.querySelector("textarea");
          input?.scrollIntoView({ block: "center", behavior: "smooth" });
          input?.focus();
        }}
        onShare={() => onShare(post)}
        onMedia={() => {
          if (!detail) router.push(`/post/${post.id}`);
        }}
      >
        <CommentBox
          comments={post.comments}
          currentUser={{ name: session.name, avatar: session.avatar }}
          onSubmit={(text, parentId) => addComment(post.id, text, parentId)}
          onLike={(id, isLiked) => void toggleCommentLike(id, isLiked)}
          onDelete={
            detail
              ? (id) => {
                  const removed = post.comments.find((c) => c.id === id);
                  void deleteComment(id);
                  undo("Comentario eliminado", () => {
                    if (removed) void addComment(post.id, removed.text, removed.parentId);
                  });
                }
              : undefined
          }
          allowReplies={detail}
          pageSize={detail ? 10 : 2}
          title={detail ? "Comentarios" : `Comentarios (${post.counts.comments})`}
        />
      </SocialPost>
    </div>
  );
}
