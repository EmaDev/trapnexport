"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useMemo, useState } from "react";

import { Avatar } from "@/components/atoms/Avatar";
import { GifPicker } from "@/components/organisms/GifPicker";
import { relativeTime } from "@/lib/time";
import type { CommentGif } from "@/lib/social/types";

/** La caja de comentarios del feed. Reemplaza al `CommentBox` de
 *  `lib-kit-components`.
 *
 *  **Por qué es propia y no la de la librería.** El `CommentBox` instalado
 *  (`0.1.0`) modela un comentario como texto y nada más: su `Comment` es
 *  `{ id, author, avatar, text, at, likes, liked, parentId, pinned,
 *  authorBadge }`, su `onSubmit` es `(text, parentId)`, y es él —no quien lo
 *  usa— el que dibuja cada burbuja y el compositor. No hay slot, prop ni render
 *  prop por donde entre un GIF: ni para elegirlo al escribir, ni para mostrarlo
 *  en una respuesta ya publicada. Responder con un GIF era, literalmente, la
 *  única cosa que no se podía hacer desde afuera.
 *
 *  Así que esto es ese componente con dos cosas agregadas y nada quitado:
 *
 *  - `Comentario` suma `gif` (ver `CommentGif`), y la burbuja lo dibuja debajo
 *    del texto;
 *  - el compositor suma el botón de GIF y el `GifPicker`, y `onSubmit` pasa a
 *    ser `(text, parentId, gif)`.
 *
 *  Todo lo demás —hilos de una respuesta, "fijado", likes con el pulgar,
 *  contador de caracteres, "ver N más", el orden de fijados primero y después
 *  los más recientes— es lo mismo y se ve igual, a propósito: el día que la
 *  librería sume GIFs, volver atrás es cambiar el import en `PostCard` y borrar
 *  este archivo. Mismo criterio que `CountdownHero`.
 *
 *  Dos diferencias deliberadas con el original, las dos para no tener dos
 *  verdades en la app:
 *
 *  - la hora sale de `relativeTime` (`lib/time.ts`), el mismo formato que usa
 *    `SocialPost.time` para la publicación; el de la librería era otro ("hace
 *    30 s" donde el nuestro dice "recién");
 *  - el avatar es el `Avatar` de `components/atoms`, que ya resuelve el caso sin
 *    foto con la inicial sobre el degradé de marca.
 */

/** Un comentario, como lo dibuja esta caja. Es el `CommentVM` de
 *  `lib/social/queries.ts` — ese es el que lo arma, acá sólo se consume. */
export interface Comentario {
  id: string;
  author: string;
  avatar?: string;
  /** puede venir vacío **si** hay `gif`: un GIF solo es un comentario válido */
  text: string;
  /** timestamp para ordenar; se muestra relativo */
  at: number;
  likes?: number;
  liked?: boolean;
  /** id del comentario padre; `null` o ausente = comentario raíz */
  parentId?: string | null;
  pinned?: boolean;
  authorBadge?: string;
  gif?: CommentGif;
}

interface ComentariosProps {
  comments: Comentario[];
  /** devolvé una promesa para mostrar el estado de envío */
  onSubmit: (
    text: string,
    parentId: string | null,
    gif: CommentGif | null,
  ) => void | Promise<void>;
  onLike?: (id: string, liked: boolean) => void;
  onDelete?: (id: string) => void;
  currentUser?: { name: string; avatar?: string };
  maxLength?: number;
  placeholder?: string;
  /** cuántos se muestran antes de «ver más» */
  pageSize?: number;
  allowReplies?: boolean;
  /** `false` esconde el botón de GIF. Lo usa la caja sin sesión: sin cuenta no
   *  se puede comentar, así que abrir el selector —que además pide sesión en
   *  `/api/giphy`— sería una búsqueda que termina en un 401. */
  allowGif?: boolean;
  /** Si viene, el botón de GIF llama a esto en vez de abrir el selector.
   *
   *  Es para la caja sin sesión: el botón se dibuja igual —esconderlo haría que
   *  un visitante no se enterara nunca de que los comentarios tienen GIFs— y al
   *  tocarlo manda a iniciar sesión. Es el mismo trato que ya recibe el textarea,
   *  que se muestra sin cuenta y al publicar manda a `/login`. */
  onGifSinSesion?: () => void;
  title?: string;
  className?: string;
}

/** Ancho máximo del GIF dentro de una burbuja, en px.
 *
 *  Las rendiciones `fixed_width` de Giphy vienen a 200px; el tope está un poco
 *  arriba para que un GIF más chico se muestre a su tamaño real y ninguno se
 *  estire. Lo que manda el alto es el `aspect-ratio` de sus medidas guardadas:
 *  el hueco queda reservado antes de que la imagen cargue y la lista no salta. */
const GIF_MAX_W = 220;

/** El GIF de un comentario ya publicado. */
function GifComentario({ gif }: { gif: CommentGif }) {
  return (
    <a
      // Al GIF en Giphy, no a la imagen: es el link que pide su atribución y, de
      // paso, el único lugar donde se ve en grande. `noopener` porque es externo.
      href={`https://giphy.com/gifs/${gif.id}`}
      target="_blank"
      rel="noopener noreferrer"
      className="mt-2 block w-fit overflow-hidden rounded-xl border border-border bg-surface"
      style={{ width: Math.min(GIF_MAX_W, gif.width) }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element -- lo sirve el CDN de Giphy; `next/image` lo optimizaría a un fotograma */}
      <img
        src={gif.url}
        alt={gif.title || "GIF"}
        loading="lazy"
        style={{ aspectRatio: `${gif.width} / ${gif.height}` }}
        className="h-auto w-full"
      />
    </a>
  );
}

function Composer({
  user,
  placeholder,
  maxLength,
  allowGif,
  onGifSinSesion,
  onSubmit,
  onCancel,
  autoFocus,
  compact,
}: {
  user?: { name: string; avatar?: string };
  placeholder: string;
  maxLength: number;
  allowGif: boolean;
  onGifSinSesion?: () => void;
  onSubmit: (text: string, gif: CommentGif | null) => void | Promise<void>;
  onCancel?: () => void;
  autoFocus?: boolean;
  compact?: boolean;
}) {
  const [text, setText] = useState("");
  const [gif, setGif] = useState<CommentGif | null>(null);
  const [eligiendo, setEligiendo] = useState(false);
  const [busy, setBusy] = useState(false);
  const [focus, setFocus] = useState(!!autoFocus);
  const left = maxLength - text.length;
  const near = left <= maxLength * 0.15;

  /*  Con un GIF elegido se puede publicar sin escribir nada: el GIF **es** el
   *  comentario. Es la misma regla que valida `addComment` del otro lado. */
  const puedeEnviar = (!!text.trim() || !!gif) && !busy;

  const send = async () => {
    if (!puedeEnviar) return;
    setBusy(true);
    try {
      await onSubmit(text.trim(), gif);
      setText("");
      setGif(null);
      setEligiendo(false);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex gap-3">
      {user && <Avatar name={user.name} src={user.avatar} size={compact ? 30 : 36} />}
      <div className="min-w-0 flex-1">
        <div
          className={`rounded-2xl border bg-surface-alt/60 transition-colors ${focus || gif || eligiendo ? "border-primary" : "border-border"}`}
        >
          {/*  El botón de GIF va acá, al lado del textarea, y **no** en la barra
              de acciones de abajo: esa barra se despliega al enfocar, así que un
              botón adentro no existe hasta que uno ya empezó a escribir — y a un
              botón que no se ve no se le puede ocurrir a nadie. Acá está desde
              el momento en que la caja aparece. */}
          <div className="flex items-start gap-1">
            <textarea
              value={text}
              placeholder={placeholder}
              rows={compact ? 1 : 2}
              autoFocus={autoFocus}
              maxLength={maxLength}
              onFocus={() => setFocus(true)}
              onBlur={() => setFocus(false)}
              onChange={(e) => {
                setText(e.target.value);
                const el = e.target as HTMLTextAreaElement;
                el.style.height = "auto";
                el.style.height = `${Math.min(160, el.scrollHeight)}px`;
              }}
              onKeyDown={(e) => {
                if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
                  e.preventDefault();
                  void send();
                }
              }}
              className="min-w-0 flex-1 resize-none bg-transparent px-3.5 py-2.5 text-sm leading-relaxed text-foreground outline-none placeholder:text-muted"
            />
            {allowGif && (
              <button
                type="button"
                aria-expanded={eligiendo}
                aria-label={eligiendo ? "Cerrar los GIFs" : "Responder con un GIF"}
                title="Responder con un GIF"
                /*  Sin esto el botón no se puede tocar cuando el textarea tiene
                 *  el foco: `onBlur` dispara en el mousedown —antes del click— y
                 *  un re-render en el medio se come el click. `preventDefault`
                 *  evita que el foco se mueva. Es el truco de siempre de las
                 *  barras de herramientas sobre un campo de texto. */
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => {
                  // Sin sesión no se abre el selector: se manda a iniciar sesión,
                  // igual que al intentar publicar.
                  if (onGifSinSesion) {
                    onGifSinSesion();
                    return;
                  }
                  setEligiendo((v) => !v);
                }}
                className={`m-1.5 inline-flex h-8 shrink-0 items-center gap-1 rounded-lg border px-2 text-[11px] font-bold transition-colors ${
                  eligiendo
                    ? "border-primary bg-primary/12 text-primary"
                    : "border-border text-muted hover:bg-surface hover:text-foreground"
                }`}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="2.5" y="4.5" width="19" height="15" rx="3" />
                  <path d="M10 9.5a2.5 2.5 0 1 0 0 5c1 0 1.6-.5 1.6-1.4v-.6h-1.2" />
                  <path d="M14.2 9.5v5M16.8 14.5v-5h3M16.8 12h2.4" />
                </svg>
                GIF
              </button>
            )}
          </div>

          {/*  El GIF elegido, arriba de la barra de acciones: se ve qué se va a
              publicar antes de publicarlo, y se puede sacar sin perder el texto. */}
          <AnimatePresence initial={false}>
            {gif && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="overflow-hidden"
              >
                <div className="px-3.5 pb-1">
                  <div className="relative w-fit overflow-hidden rounded-xl border border-border">
                    {/* eslint-disable-next-line @next/next/no-img-element -- lo sirve el CDN de Giphy */}
                    <img
                      src={gif.url}
                      alt={gif.title || "GIF"}
                      style={{ aspectRatio: `${gif.width} / ${gif.height}` }}
                      className="h-auto w-[120px]"
                    />
                    <button
                      type="button"
                      onClick={() => setGif(null)}
                      aria-label="Quitar el GIF"
                      className="absolute right-1 top-1 inline-flex h-6 w-6 items-center justify-center rounded-full bg-black/60 text-white transition-colors hover:bg-black/80"
                    >
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round">
                        <path d="M18 6 6 18M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/*  La barra de publicar aparece al enfocar, igual que en la librería.
              Se suman dos motivos para que siga abierta: hay un GIF elegido, o el
              selector está abierto —cerrarla ahí escondería el botón de publicar
              justo cuando hace falta, porque tocar el selector saca el foco del
              textarea—. El botón de GIF **no** vive acá: ver arriba. */}
          <AnimatePresence initial={false}>
            {(focus || text || gif || eligiendo) && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="overflow-hidden"
              >
                <div className="flex items-center gap-2 px-3 pb-2.5 pt-0.5">
                  <span
                    className={`text-[11px] tabular-nums ${near ? "font-semibold text-danger" : "text-muted"}`}
                  >
                    {left}
                  </span>
                  <span className="hidden text-[11px] text-muted sm:inline">
                    ⌘/Ctrl + Enter para publicar
                  </span>
                  {onCancel && (
                    <button
                      type="button"
                      // Mismo motivo que el botón de GIF: en una respuesta sin
                      // escribir nada, el blur del mousedown desmontaría la barra
                      // antes de que el click llegue acá.
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={onCancel}
                      className="ml-auto h-8 rounded-lg px-3 text-xs font-semibold text-muted transition-colors hover:bg-surface hover:text-foreground"
                    >
                      Cancelar
                    </button>
                  )}
                  <button
                    type="button"
                    // Ídem. Acá además deja el foco en el textarea después de
                    // publicar, que es donde uno sigue escribiendo.
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => void send()}
                    disabled={!puedeEnviar}
                    className={`${onCancel ? "" : "ml-auto"} h-8 rounded-lg bg-primary px-3.5 text-xs font-bold text-white shadow-sm shadow-primary/25 transition-all hover:bg-primary-hover active:scale-95 disabled:opacity-35 disabled:shadow-none`}
                  >
                    {busy ? "Publicando…" : "Publicar"}
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <AnimatePresence initial={false}>
          {eligiendo && (
            <GifPicker
              key="picker"
              onClose={() => setEligiendo(false)}
              onPick={(g) => {
                // Se guardan los cinco campos de `CommentGif` y se descarta
                // `preview`: la miniatura es de la grilla, no del comentario.
                setGif({ id: g.id, url: g.url, width: g.width, height: g.height, title: g.title });
                setEligiendo(false);
              }}
            />
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

export function Comentarios({
  comments,
  onSubmit,
  onLike,
  onDelete,
  currentUser,
  maxLength = 500,
  placeholder = "Escribí un comentario…",
  pageSize = 4,
  allowReplies = true,
  allowGif = true,
  onGifSinSesion,
  title = "Comentarios",
  className = "",
}: ComentariosProps) {
  const [replyTo, setReplyTo] = useState<string | null>(null);
  const [shown, setShown] = useState(pageSize);

  // fijados primero, después los más recientes. No es configurable.
  const roots = useMemo(
    () =>
      comments
        .filter((c) => !c.parentId)
        .sort((a, b) => (a.pinned !== b.pinned ? (a.pinned ? -1 : 1) : b.at - a.at)),
    [comments],
  );

  const repliesOf = (id: string) =>
    comments.filter((c) => c.parentId === id).sort((a, b) => a.at - b.at);

  const Row = ({ c, depth = 0 }: { c: Comentario; depth?: number }) => (
    <motion.div
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: "spring", stiffness: 320, damping: 28 }}
      className={`flex gap-3 ${depth ? "ml-11" : ""}`}
    >
      <Avatar name={c.author} src={c.avatar} size={depth ? 30 : 36} />
      <div className="min-w-0 flex-1">
        <div className="rounded-2xl border border-border bg-surface-alt px-3.5 py-2.5">
          <p className="flex flex-wrap items-center gap-2">
            <span className="text-[13px] font-bold text-foreground">{c.author}</span>
            {c.authorBadge && (
              <span className="rounded-full bg-primary/12 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-primary">
                {c.authorBadge}
              </span>
            )}
            {c.pinned && (
              <span className="rounded-full bg-accent/12 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-accent">
                Fijado
              </span>
            )}
          </p>
          {/*  El texto se dibuja sólo si hay: un comentario que es puro GIF no
              lleva un párrafo vacío empujando la imagen. */}
          {c.text && (
            <p
              className="mt-1 whitespace-pre-line text-sm leading-relaxed text-foreground"
              style={{ textWrap: "pretty" }}
            >
              {c.text}
            </p>
          )}
          {c.gif && <GifComentario gif={c.gif} />}
        </div>
        <div className="mt-1.5 flex items-center gap-3 px-1">
          <span className="text-[11px] text-muted">{relativeTime(c.at)}</span>
          <button
            type="button"
            onClick={() => onLike?.(c.id, !c.liked)}
            className={`inline-flex items-center gap-1 text-[11px] font-bold transition-colors ${c.liked ? "text-primary" : "text-muted hover:text-foreground"}`}
          >
            <motion.svg
              animate={c.liked ? { scale: [1, 1.3, 1] } : {}}
              transition={{ duration: 0.3 }}
              width="13"
              height="13"
              viewBox="0 0 24 24"
              fill={c.liked ? "currentColor" : "none"}
              stroke="currentColor"
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M7 22V11l4-7 1 1v5h5a2 2 0 0 1 2 2.3l-1.4 8A2 2 0 0 1 15.6 22Z" />
              <path d="M7 11H4v11h3" />
            </motion.svg>
            {c.likes ? <span className="tabular-nums">{c.likes}</span> : "Me gusta"}
          </button>
          {allowReplies && depth === 0 && (
            <button
              type="button"
              onClick={() => setReplyTo((r) => (r === c.id ? null : c.id))}
              className="text-[11px] font-bold text-muted transition-colors hover:text-foreground"
            >
              Responder
            </button>
          )}
          {onDelete && (
            <button
              type="button"
              onClick={() => onDelete(c.id)}
              className="ml-auto text-[11px] font-bold text-muted transition-colors hover:text-danger"
            >
              Eliminar
            </button>
          )}
        </div>

        {allowReplies && depth === 0 && (
          <>
            <div className="mt-3 space-y-3">
              <AnimatePresence initial={false}>
                {repliesOf(c.id).map((r) => (
                  <Row key={r.id} c={r} depth={1} />
                ))}
              </AnimatePresence>
            </div>
            <AnimatePresence>
              {replyTo === c.id && (
                <motion.div
                  initial={{ opacity: 0, y: -6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -6 }}
                  className="ml-11 mt-3"
                >
                  <Composer
                    compact
                    autoFocus
                    user={currentUser}
                    maxLength={maxLength}
                    allowGif={allowGif}
                    onGifSinSesion={onGifSinSesion}
                    placeholder={`Respondiendo a ${c.author}…`}
                    onCancel={() => setReplyTo(null)}
                    onSubmit={async (text, gif) => {
                      await onSubmit(text, c.id, gif);
                      setReplyTo(null);
                    }}
                  />
                </motion.div>
              )}
            </AnimatePresence>
          </>
        )}
      </div>
    </motion.div>
  );

  return (
    <section className={`rounded-2xl border border-border bg-surface p-5 ${className}`}>
      <header className="mb-4">
        <h3 className="text-sm font-bold text-foreground">
          {title}{" "}
          <span className="font-semibold tabular-nums text-muted">({comments.length})</span>
        </h3>
      </header>

      <Composer
        user={currentUser}
        maxLength={maxLength}
        allowGif={allowGif}
        onGifSinSesion={onGifSinSesion}
        placeholder={placeholder}
        onSubmit={(text, gif) => onSubmit(text, null, gif)}
      />

      <div className="mt-5 space-y-4">
        <AnimatePresence initial={false}>
          {roots.slice(0, shown).map((c) => (
            <Row key={c.id} c={c} />
          ))}
        </AnimatePresence>
      </div>

      {roots.length === 0 && (
        <p className="mt-6 text-center text-sm text-muted">
          Todavía no hay comentarios. Sé el primero.
        </p>
      )}

      {roots.length > shown && (
        <button
          type="button"
          onClick={() => setShown((s) => s + pageSize)}
          className="mt-4 h-10 w-full rounded-xl border border-border bg-surface-alt/60 text-xs font-bold text-foreground transition-all hover:bg-surface-alt active:scale-[0.99]"
        >
          Ver {Math.min(pageSize, roots.length - shown)} comentarios más
        </button>
      )}
    </section>
  );
}
