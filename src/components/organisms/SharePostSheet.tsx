"use client";

import { useRouter } from "next/navigation";
import { BottomSheet, Button, ShareButton, useClipboard, useSnackbar } from "lib-kit-components";

import { ChatIcon, LinkIcon } from "@/components/atoms/icons";
import { absoluteUrl, APP_NAME } from "@/lib/site";
import type { PostVM } from "@/lib/social/queries";

/** La hoja de "compartir" del feed.
 *
 *  `SocialPost` dibuja su propio botón de compartir y lo entrega por `onShare`
 *  — no es un `ShareButton`, así que el componente no puede reemplazarlo. El
 *  patrón es: `onShare` abre esta hoja con las opciones in-app y, adentro, un
 *  `ShareButton` que salta a la hoja del sistema.
 *
 *  La `url` es SIEMPRE absoluta y coincide con el `canonical` de `/post/[id]`:
 *  sin `url`, `ShareButton` toma `window.location.href` y desde el feed
 *  compartirías la portada en vez del post.
 */
export function SharePostSheet({
  post,
  onClose,
  onShared,
}: {
  post: PostVM | null;
  onClose: () => void;
  onShared?: (postId: string) => void;
}) {
  const router = useRouter();
  const { snack } = useSnackbar();
  const { copy } = useClipboard();

  const url = post ? absoluteUrl(`/post/${post.id}`) : "";

  return (
    <BottomSheet open={!!post} onClose={onClose} title="Compartir publicación" size="auto">
      {post && (
        <div className="flex flex-col gap-2 pb-2">
          <Button
            variant="ghost"
            fullWidth
            leftIcon={<ChatIcon />}
            className="justify-start"
            onClick={() => {
              onClose();
              router.push("/chat");
            }}
          >
            Enviar por chat
          </Button>

          <Button
            variant="ghost"
            fullWidth
            leftIcon={<LinkIcon />}
            className="justify-start"
            onClick={async () => {
              const ok = await copy(url);
              onClose();
              snack({
                message: ok ? "Link copiado" : "No se pudo copiar el link",
                variant: ok ? "success" : "error",
              });
              if (ok) onShared?.(post.id);
            }}
          >
            Copiar link
          </Button>

          <ShareButton
            variant="button"
            label="Compartir en otra app"
            title={`${post.author.name} en ${APP_NAME}`}
            text={post.text.slice(0, 120)}
            url={url}
            onShared={() => {
              onShared?.(post.id);
              onClose();
            }}
          />
        </div>
      )}
    </BottomSheet>
  );
}
