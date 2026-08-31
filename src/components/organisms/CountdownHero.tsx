"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useState } from "react";
import { usePrefersReducedMotion } from "lib-kit-components";

/** Cuenta regresiva grande, para presidir una pantalla o una card.
 *
 *  ⚠️ No sale de `lib-kit-components`: la librería sólo trae `CountdownBanner`,
 *  que es otra cosa — una barra de campaña, fijable arriba/abajo, descartable,
 *  con cajas de `h-9` y `text-sm` y **sin** prop `size`. Servía para "la oferta
 *  termina en", no para un contador que es el centro de la pantalla; llegar a
 *  `size="xl"` con ese componente era pisarle clases internas que no
 *  controlamos y que se rompen en cualquier update.
 *
 *  Si algún día la librería suma un hero de countdown, este archivo se borra y
 *  se cambia el import: la firma de abajo está pensada para eso.
 */

export type CountdownVariant = "blocks" | "flip" | "inline";
export type CountdownSize = "sm" | "md" | "lg" | "xl";
export type CountdownTone = "dark" | "primary" | "accent" | "surface";

export interface CountdownHeroProps {
  /** momento al que se cuenta */
  until: Date | number;
  /** texto chico arriba del contador */
  eyebrow?: string;
  title?: string;
  /** `blocks` = un bloque por unidad · `flip` = igual con dígito animado ·
   *  `inline` = una sola línea `00:00:00`, para espacios angostos */
  variant?: CountdownVariant;
  size?: CountdownSize;
  tone?: CountdownTone;
  /** qué mostrar al llegar a cero. Sin esto, el bloque se oculta. */
  expiredMessage?: React.ReactNode;
  /** se llama una sola vez al llegar a cero */
  onExpire?: () => void;
  className?: string;
}

/* ── escalas ─────────────────────────────────────────────────────────────── */

/** Cada tamaño arranca chico y crece en `sm:`. En 360px, cuatro bloques `xl`
 *  al ancho de escritorio se salen de la card: la escala mobile es la real y
 *  la de escritorio es el premio, no al revés. */
const SIZES: Record<
  CountdownSize,
  { block: string; digit: string; label: string; gap: string; title: string }
> = {
  sm: {
    block: "h-10 w-9 rounded-lg sm:h-12 sm:w-11",
    digit: "text-lg sm:text-xl",
    label: "text-[9px]",
    gap: "gap-1.5",
    title: "text-xs",
  },
  md: {
    block: "h-12 w-11 rounded-xl sm:h-16 sm:w-14",
    digit: "text-xl sm:text-2xl",
    label: "text-[10px]",
    gap: "gap-2",
    title: "text-sm",
  },
  lg: {
    block: "h-14 w-12 rounded-xl sm:h-20 sm:w-[4.25rem]",
    digit: "text-2xl sm:text-4xl",
    label: "text-[10px] sm:text-xs",
    gap: "gap-2",
    title: "text-sm sm:text-base",
  },
  xl: {
    block: "h-16 w-14 rounded-2xl sm:h-24 sm:w-20",
    digit: "text-3xl sm:text-5xl",
    label: "text-[10px] sm:text-xs",
    gap: "gap-2 sm:gap-3",
    title: "text-sm sm:text-base",
  },
};

/** `dark` es negro real y no `bg-foreground`: en tema oscuro el foreground es
 *  casi blanco y un tono llamado "dark" se daría vuelta. Negro sobre blanco y
 *  negro sobre negro (con borde) se sostienen en los dos temas. */
const TONES: Record<CountdownTone, { shell: string; block: string; label: string }> = {
  dark: {
    shell: "bg-black text-white ring-1 ring-white/10",
    block: "bg-white/10",
    label: "text-white/60",
  },
  primary: {
    shell: "bg-primary text-white",
    block: "bg-black/25",
    label: "text-white/70",
  },
  accent: {
    shell: "bg-accent text-white",
    block: "bg-black/25",
    label: "text-white/70",
  },
  surface: {
    shell: "bg-surface-alt text-foreground ring-1 ring-border",
    block: "bg-foreground/10",
    label: "text-muted",
  },
};

/* ── tiempo ──────────────────────────────────────────────────────────────── */

const two = (n: number) => String(n).padStart(2, "0");

function split(ms: number) {
  const s = Math.floor(ms / 1000);
  return {
    d: Math.floor(s / 86400),
    h: Math.floor(s / 3600) % 24,
    m: Math.floor(s / 60) % 60,
    s: s % 60,
  };
}

/* ── componente ──────────────────────────────────────────────────────────── */

export function CountdownHero({
  until,
  eyebrow,
  title,
  variant = "blocks",
  size = "md",
  tone = "dark",
  expiredMessage,
  onExpire,
  className = "",
}: CountdownHeroProps) {
  const deadline = typeof until === "number" ? until : until.getTime();
  const reduced = usePrefersReducedMotion();

  // `left = null` hasta que monta. El servidor y el navegador no comparten
  // reloj: calcular el restante durante el SSR garantiza un mismatch de
  // hidratación cada vez. Renderizamos los mismos bloques con "--" y en el
  // primer efecto aparecen los números, sin salto de layout.
  const [left, setLeft] = useState<number | null>(null);

  useEffect(() => {
    let fired = false;

    const tick = () => {
      const ms = Math.max(0, deadline - Date.now());
      setLeft(ms);
      if (ms === 0 && !fired) {
        fired = true;
        onExpire?.();
      }
    };

    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [deadline, onExpire]);

  const done = left === 0;
  if (done && !expiredMessage) return null;

  const s = SIZES[size];
  const t = TONES[tone];

  const { d, h, m, s: secs } = split(left ?? 0);
  const units: [key: string, value: string, label: string][] =
    left === null
      ? [
          ["d", "--", "días"],
          ["h", "--", "hs"],
          ["m", "--", "min"],
          ["s", "--", "seg"],
        ]
      : [
          // los días sólo ocupan lugar si faltan
          ...(d > 0 ? ([["d", two(d), "días"]] as [string, string, string][]) : []),
          ["h", two(h), "hs"],
          ["m", two(m), "min"],
          ["s", two(secs), "seg"],
        ];

  const heading = (eyebrow || title) && (
    <div className="flex flex-col items-center gap-0.5 text-center">
      {eyebrow && (
        <span className={`text-[10px] font-bold uppercase tracking-widest ${t.label}`}>
          {eyebrow}
        </span>
      )}
      {title && <p className={`font-semibold ${s.title}`}>{title}</p>}
    </div>
  );

  return (
    <div
      className={`flex w-full flex-col items-center ${s.gap} rounded-2xl px-3 py-3 ${t.shell} ${className}`}
    >
      {heading}

      {done ? (
        <p className={`text-center font-semibold ${s.title}`}>{expiredMessage}</p>
      ) : variant === "inline" ? (
        <p className={`font-extrabold tabular-nums tracking-tight ${s.digit}`}>
          {d > 0 && `${two(d)}d `}
          {two(h)}:{two(m)}:{two(secs)}
        </p>
      ) : (
        // aria-live off: un contador que se anuncia cada segundo secuestra el
        // lector de pantalla. El texto de arriba ya dice qué se está contando.
        <ol className={`flex items-start ${s.gap}`} aria-live="off">
          {units.map(([key, value, label]) => (
            <li key={key} className="flex flex-col items-center gap-1">
              <span
                className={`grid place-items-center overflow-hidden ${s.block} ${t.block}`}
              >
                {variant === "flip" && !reduced && left !== null ? (
                  <AnimatePresence mode="popLayout" initial={false}>
                    <motion.span
                      key={value}
                      initial={{ y: "-60%", opacity: 0 }}
                      animate={{ y: 0, opacity: 1 }}
                      exit={{ y: "60%", opacity: 0 }}
                      transition={{ type: "spring", stiffness: 520, damping: 34 }}
                      className={`font-extrabold tabular-nums ${s.digit}`}
                    >
                      {value}
                    </motion.span>
                  </AnimatePresence>
                ) : (
                  <span className={`font-extrabold tabular-nums ${s.digit}`}>{value}</span>
                )}
              </span>
              <span className={`font-medium uppercase tracking-wide ${s.label} ${t.label}`}>
                {label}
              </span>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
