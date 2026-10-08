"use client";

import { useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button, Dropdown, Modal, SocialPost, useSnackbar } from "lib-kit-components";

import { Comentarios } from "@/components/organisms/Comentarios";
import { LikesSheet } from "@/components/organisms/LikesSheet";
import {
  addComment,
  deleteComment,
  deleteMyPost,
  toggleCommentLike,
  toggleLike,
  toggleSave,
} from "@/lib/social/actions";
import type { LikerVM, PostVM, SessionVM } from "@/lib/social/queries";

/** Un post con su caja de comentarios. Se usa en el feed, en el perfil y en el
 *  detalle — cambia `mode`, no el componente.
 *
 *  ⚠️ Desvío respecto de la guía, a propósito: la guía describe un `SocialPost`
 *  con caja de comentarios incluida (`comments`, `onAddComment`, `currentUser`,
 *  `visibleComments`). La versión de `lib-kit-components` instalada acá **no
 *  tiene esas props** — su `SocialPostProps` termina en `children`. Así que la
 *  caja va siempre en el slot `children`, en las dos variantes:
 *
 *    mode="feed"    → compacta: 2 comentarios, sin hilos
 *    mode="detail"  → completa: hilos, borrar
 *
 *  El orden lo fija la caja (fijados primero, después recientes); ya no es
 *  configurable.
 *
 *  Eso cumple igual la regla dura de la guía —nunca dos cajas de escritura en
 *  el mismo post— y el día que la librería se actualice, el feed puede pasar a
 *  la caja incluida sin tocar nada más que este archivo.
 *
 *  Y esa caja es `Comentarios`, nuestra, no el `CommentBox` de la librería: es
 *  el mismo componente con GIFs de Giphy agregados, porque el de la librería
 *  modela un comentario como texto y nada más y no deja entrar una imagen por
 *  ninguna prop. El porqué completo está arriba de ese archivo.
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
 *
 *  ⚠️ Tercer desvío: tocar los likes abre `LikesSheet` con la lista de quiénes
 *  los dieron. `SocialPost` dibuja ese renglón —el corazón, el número y "Naza y
 *  11 más"— con `span`s y sin un solo handler: `likedBy` es un `string[]` de
 *  nombres y no hay nada parecido a un `onLikes`. Así que el click se agarra
 *  por delegación en el wrapper y se decide por la forma del DOM; el detalle
 *  está en `abrirLikesSiEsElRenglon`.
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
  const [verLikes, setVerLikes] = useState(false);

  /*  La lista que abre la hoja, corregida con el estado optimista del botón.
   *
   *  `post.likers` viene del servidor y hasta que vuelva el `revalidatePath` de
   *  `toggleLike` no tiene el like que la persona acaba de dar —ni se le fue el
   *  que acaba de quitar—. Sin esto, darle me gusta y abrir la lista es no
   *  encontrarse ahí, que es exactamente lo primero que uno va a mirar.
   *
   *  Mientras el botón diga lo mismo que trajo el servidor no se toca nada: la
   *  lista de allá ya es la correcta y además está en el orden real. */
  const likers = useMemo<LikerVM[]>(() => {
    if (!session || liked === post.liked) return post.likers;
    if (!liked) return post.likers.filter((l) => l.id !== session.id);
    // Al final, que es donde va: es el último like que entró.
    return [
      ...post.likers,
      { id: session.id, name: session.name, handle: session.handle, avatar: session.avatar },
    ];
  }, [post.likers, post.liked, liked, session]);

  /** Abre la hoja de likes si el click cayó en la mitad izquierda de la "línea
   *  social" de `SocialPost`.
   *
   *  La línea no es nuestra y no recibe handlers, así que se la reconoce por su
   *  forma —el mismo truco que `.post-foto-entera` en `globals.css`, que apunta
   *  a la grilla de fotos de la librería—:
   *
   *    - es el único `div` hijo directo del `article` con tipografía de 11px;
   *    - adentro, el `span` con `ml-auto` es donde arrancan los contadores de
   *      comentarios y compartidos. Esos no son likes: un click ahí no abre
   *      nada, y sin el corte "3 comentarios" abriría la lista de me gusta.
   *
   *  Si una versión nueva de la librería cambia esas clases, esto deja de
   *  abrir la hoja y no rompe nada más: el renglón vuelve a ser el texto muerto
   *  que era, y el botón de abajo —el que usa el teclado— sigue entrando. */
  const abrirLikesSiEsElRenglon = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!likers.length) return;

    const target = e.target as HTMLElement;
    const linea = target.closest<HTMLElement>("article > div");
    if (!linea?.className.includes("text-[11px]")) return;

    const celdas = [...linea.children] as HTMLElement[];
    const tocada = celdas.findIndex((c) => c.contains(target));
    const contadores = celdas.findIndex((c) => c.className.includes("ml-auto"));
    if (tocada === -1 || (contadores !== -1 && tocada >= contadores)) return;

    setVerLikes(true);
  };

  const detail = mode === "detail";
  /*  El autor y nadie más. `post.mine` ya sale del uid de la sesión, pero el
   *  `session` se pide igual: sin cookie la acción no escribe nada y el menú
   *  sería un botón que no hace nada. */
  const puedeBorrar = post.mine && !!session;

  /** A iniciar sesión, y de vuelta a este post. Lo usan las dos puertas de la
   *  caja de comentarios sin cuenta: publicar y el botón de GIF. */
  const irALogin = () => router.push(`/login?next=/post/${post.id}`);

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

  /*  Con una sola foto la tarjeta se adapta a la foto en vez de recortarla a
   *  16:10 (ver `.post-foto-entera` en `globals.css`). Con dos o más manda la
   *  grilla cuadrada de la librería. */
  const fotoEntera = post.media.length === 1;

  return (
    <div
      ref={box}
      /*  `post-likes-click` le pone el cursor de mano a los likes del renglón
          de la librería (ver `globals.css`): sin eso, el único que sabe que
          ahí se puede tocar es quien lo programó. */
      className={`relative${fotoEntera ? " post-foto-entera" : ""}${likers.length ? " post-likes-click" : ""}`}
      onClick={abrirLikesSiEsElRenglon}
    >
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
        {/*  El mismo "ver quiénes" para quien navega con teclado: la línea
            social de la librería son `span`s, no hay forma de tabular hasta
            ahí. Invisible hasta que recibe el foco. */}
        {!!likers.length && (
          <button
            type="button"
            onClick={() => setVerLikes(true)}
            className="sr-only focus-visible:not-sr-only focus-visible:mb-2 focus-visible:inline-block focus-visible:rounded-lg focus-visible:bg-surface-alt focus-visible:px-3 focus-visible:py-1.5 focus-visible:text-xs focus-visible:font-semibold"
          >
            Ver a quiénes les gusta
          </button>
        )}

        <Comentarios
          comments={post.comments}
          // `currentUser` es opcional: sin sesión la caja se dibuja sin avatar
          // en vez de con el de nadie.
          currentUser={session ? { name: session.name, avatar: session.avatar } : undefined}
          /*  El botón de GIF se dibuja con sesión y sin ella; lo que cambia es lo
           *  que hace. Sin cuenta no abre el selector —`/api/giphy` pide sesión y
           *  sería buscar para recibir un 401— sino que manda a iniciar sesión,
           *  igual que al intentar publicar. Esconderlo haría que un visitante no
           *  se enterara nunca de que los comentarios tienen GIFs. */
          onGifSinSesion={session ? undefined : irALogin}
          onSubmit={(text, parentId, gif) => {
            // Comentar sin cuenta no falla en silencio: la Server Action lo
            // rechazaría igual (lee el uid de la cookie), pero recién después de
            // que la persona escribió el comentario entero.
            if (!session) {
              irALogin();
              return;
            }
            return addComment(post.id, text, parentId, gif);
          }}
          onLike={(id, isLiked) => void toggleCommentLike(id, isLiked)}
          onDelete={
            detail && session
              ? (id) => {
                  const removed = post.comments.find((c) => c.id === id);
                  void deleteComment(id);
                  undo("Comentario eliminado", () => {
                    // El deshacer repone el comentario entero, GIF incluido: sin
                    // `removed.gif` un comentario que era sólo un GIF volvería
                    // vacío — y `addComment` lo descartaría sin escribir nada.
                    if (removed) {
                      void addComment(post.id, removed.text, removed.parentId, removed.gif);
                    }
                  });
                }
              : undefined
          }
          allowReplies={detail}
          pageSize={detail ? 10 : 2}
          title={detail ? "Comentarios" : `Comentarios (${post.counts.comments})`}
        />
      </SocialPost>

      <LikesSheet
        open={verLikes}
        likers={likers}
        meId={session?.id}
        onClose={() => setVerLikes(false)}
      />

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
