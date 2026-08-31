import { QuoteIcon } from "@/components/atoms/icons";

/** Frase célebre: la cita grande, y abajo quién la dijo y cuándo.
 *
 *  ⚠️ No sale de `lib-kit-components`: la librería no tiene ningún componente
 *  de cita. `CommentBox` y `TimelineComments` son lo más parecido y son otra
 *  cosa —comentarios de usuarios, con autor, hora y caja de escritura—; una
 *  frase histórica no se responde ni se ordena por fecha.
 *
 *  Dos variantes, y la diferencia es de jerarquía, no de estilo: `featured`
 *  preside una sección (degradé de marca, texto grande) y `card` es una de
 *  varias en una fila (borde, texto normal).
 *
 *  El degradé va con `[linear-gradient(...)]` sobre las CSS vars y no con
 *  `bg-gradient-to-br from-primary to-accent` por una razón concreta: las
 *  utilidades `from-*`/`to-*` de Tailwind resuelven contra la paleta del build
 *  y acá los tokens los pisa `globals.css` en runtime (`.dark`), así que el
 *  degradé tiene que leer las variables, no los valores compilados.
 */

export interface QuoteBlockProps {
  text: string;
  author: string;
  /** quién era esa persona cuando lo dijo */
  role: string;
  year: number;
  avatar: string;
  variant?: "featured" | "card";
  className?: string;
}

export function QuoteBlock({
  text,
  author,
  role,
  year,
  avatar,
  variant = "card",
  className = "",
}: QuoteBlockProps) {
  const featured = variant === "featured";

  return (
    <figure
      className={[
        "relative flex h-full flex-col overflow-hidden rounded-2xl",
        featured
          ? "bg-[linear-gradient(135deg,var(--color-primary),var(--color-accent))] p-5 text-white sm:p-7"
          : "border border-border bg-surface-alt p-5",
        className,
      ].join(" ")}
    >
      {/* La comilla de fondo es decorativa y grande a propósito: es lo que hace
          que el bloque se lea como cita antes de leer una sola palabra. */}
      <QuoteIcon
        aria-hidden
        width={featured ? 104 : 68}
        height={featured ? 104 : 68}
        className={
          featured
            ? "pointer-events-none absolute -top-3 right-1 text-white/15"
            : "pointer-events-none absolute -top-2 right-1 text-primary/10"
        }
      />

      <blockquote
        className={[
          "relative text-pretty font-semibold",
          featured ? "text-lg leading-snug sm:text-2xl" : "text-[15px] leading-snug",
        ].join(" ")}
      >
        {`“${text}”`}
      </blockquote>

      <figcaption
        className={[
          "relative mt-auto flex items-center gap-3 border-t pt-4",
          featured ? "border-white/20" : "border-border",
        ].join(" ")}
      >
        {/* eslint-disable-next-line @next/next/no-img-element -- data-URI */}
        <img src={avatar} alt="" className="size-10 shrink-0 rounded-full" />
        <div className="min-w-0">
          <p className={featured ? "font-semibold" : "text-sm font-semibold"}>{author}</p>
          <p className={["truncate text-xs", featured ? "text-white/75" : "text-muted"].join(" ")}>
            {role} · {year}
          </p>
        </div>
      </figcaption>
    </figure>
  );
}
