"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button, CommentBox, Dropdown, Modal, SocialPost, useSnackbar } from "lib-kit-components";

import {
  addComment,
  deleteComment,
  deleteMyPost,
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
 *
 *  ⚠️ Segundo desvío, también a propósito: el menú de "⋯" es nuestro y va
 *  encima del de la librería. `SocialPost` dibuja un `⋯` en el header que no
 *  recibe ningún handler —es decorativo— y no expone ningún slot para las
 *  acciones del autor. Así que el menú real se monta en el wrapper, en
 *  `absolute` y sobre esas mismas coordenadas (`right-4 top-4`, los 32px que
 *  deja el `px-4 pt-4` del header), que es donde la persona ya lo busca. Va en
 *  el wrapper y no dentro del `article` porque el `article` es
 *  `overflow-hidden`: el panel del `Dropdown` se posiciona absoluto dentro del
 *  trigger, sin portal, y adentro quedaría recortado.
 */
export function PostCard({
  post,
  session,
  onShare,
  mode = "feed",
}: {
  post: PostVM;
  /** `null` sin sesión: la publicación se lee igual —está hecha para
   *  compartirse por link— y lo que cambia es la caja de comentarios, que en vez
   *  de escribir manda a `/login`. */
  session: SessionVM | null;
  onShare: (post: PostVM) => void;
  mode?: "feed" | "detail";
}) {
  const router = useRouter();
  const { snack, undo } = useSnackbar();
  const box = useRef<HTMLDivElement>(null);
  const [, startTransition] = useTransition();

  const [liked, setLiked] = useState(post.liked);
  const [saved, setSaved] = useState(post.saved);
  const [confirmando, setConfirmando] = useState(false);
  const [borrado, setBorrado] = useState(false);

  const detail = mode === "detail";
  /*  El autor y nadie más. `post.mine` ya sale del uid de la sesión, pero el
   *  `session` se pide igual: sin cookie la acción no escribe nada y el menú
   *  sería un botón que no hace nada. */
  const puedeBorrar = post.mine && !!session;

  const borrar = () => {
    setConfirmando(false);
    /*  En el feed la tarjeta se saca de la pantalla acá mismo: la Server Action
     *  revalida y el post desaparece igual, pero recién cuando vuelve la
     *  respuesta, y hasta entonces seguiría ahí como si el botón no hubiera
     *  hecho nada. En el detalle no se oculta: se sale de la pantalla, que
     *  quedaría vacía. */
    if (detail) {
      startTransition(async () => {
        await deleteMyPost(post.id);
        snack({ message: "Publicación eliminada", variant: "error" });
        router.replace("/");
      });
      return;
    }
    setBorrado(true);
    startTransition(async () => {
      await deleteMyPost(post.id);
      snack({ message: "Publicación eliminada", variant: "error" });
    });
  };

  if (borrado) return null;

  return (
    <div ref={box} className="relative">
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
          // `currentUser` es opcional en la librería: sin sesión la caja se
          // dibuja sin avatar en vez de con el de nadie.
          currentUser={session ? { name: session.name, avatar: session.avatar } : undefined}
          onSubmit={(text, parentId) => {
            // Comentar sin cuenta no falla en silencio: la Server Action lo
            // rechazaría igual (lee el uid de la cookie), pero recién después de
            // que la persona escribió el comentario entero.
            if (!session) {
              router.push(`/login?next=/post/${post.id}`);
              return;
            }
            return addComment(post.id, text, parentId);
          }}
          onLike={(id, isLiked) => void toggleCommentLike(id, isLiked)}
          onDelete={
            detail && session
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

      {puedeBorrar && (
        <Dropdown
          className="absolute right-4 top-4"
          align="end"
          items={[
            {
              label: "Borrar publicación",
              destructive: true,
              onClick: () => setConfirmando(true),
            },
          ]}
          trigger={
            <button
              type="button"
              aria-label="Más opciones"
              className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-muted transition-colors hover:bg-surface-alt hover:text-foreground"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                <circle cx="5" cy="12" r="1.8" />
                <circle cx="12" cy="12" r="1.8" />
                <circle cx="19" cy="12" r="1.8" />
              </svg>
            </button>
          }
        />
      )}

      {/* Borrar se lleva los comentarios y las fotos del bucket: no hay
          "deshacer" posible, así que no va con un snackbar de undo como los
          comentarios, va con una confirmación. Es el mismo criterio que
          `/admin/publicaciones`. */}
      <Modal
        open={confirmando}
        onClose={() => setConfirmando(false)}
        title="Borrar publicación"
        description="Se eliminan también sus comentarios y sus fotos. No se puede deshacer."
        size="sm"
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setConfirmando(false)}>
              Cancelar
            </Button>
            <Button variant="danger" onClick={borrar}>
              Borrar definitivamente
            </Button>
          </div>
        }
      >
        <p className="line-clamp-3 text-sm text-muted">
          {post.text || "Publicación con fotos"}
        </p>
      </Modal>
    </div>
  );
}
