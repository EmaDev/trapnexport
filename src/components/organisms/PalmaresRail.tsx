"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useRef, useState } from "react";
import { CardCarousel, usePrefersReducedMotion } from "lib-kit-components";

import { BackIcon, ChevronIcon, CloseIcon, StarIcon } from "@/components/atoms/icons";
import type { Trophy } from "@/lib/historia";
import { trophyUrl } from "@/lib/media";

/** El palmarés como riel de copas: una card chica por trofeo, dos y media a la
 *  vista, y `VisorCopa` al tocar cualquiera.
 *
 *  Reemplaza a la lista de tres filas que estaba en el hero de `/historia`.
 *  El cambio no es decorativo: los tres títulos son *lo* que cuenta la
 *  pantalla, y como lista de texto ocupaban lo mismo que cualquier otra lista
 *  de la app. Con la foto de cada copa, tres renglones pasan a ser tres
 *  objetos que se reconocen de un vistazo.
 *
 *  Es la variante `snap` del carrusel, y las otras tres se descartaron por
 *  motivos concretos:
 *
 *  - `coverflow` y `peek` centran una sola card y mandan las vecinas atrás,
 *    giradas o atenuadas: se mira una copa por vez.
 *  - `track` con `perView={2}` haría lo que se busca, pero el componente baja
 *    solo a una card por vista abajo de 480px — o sea, en el teléfono, que es
 *    donde se usa la app.
 *
 *  `snap` es la única que da un ancho fijo en px, y con ese ancho las dos
 *  primeras entran enteras en cualquier pantalla sin arrastrar. Ver `ANCHO`.
 *
 *  El fondo de la card lo pone la card, no la imagen: las fotos reales son
 *  PNG recortados con fondo transparente y `trophyUrl` genera el placeholder
 *  con el mismo contrato, así que las dos se apoyan sobre el mismo degradé.
 */
/** Ancho fijo de cada copa, en px.
 *
 *  Es el número que hace que entren dos sin arrastrar: en el teléfono más
 *  angosto que soporta la app (360px) el hero mide 328 de ancho, y dos cards
 *  de 146 con 12 de separación son 304 — quedan 24px, justo lo que se ve de
 *  la tercera y lo que le avisa al ojo que hay más. En desktop entran las
 *  tres con aire. */
const ANCHO = 146;

export function PalmaresRail({ trophies }: { trophies: Trophy[] }) {
  const reduced = usePrefersReducedMotion();
  const [abierta, setAbierta] = useState<number | null>(null);
  const [rotas, setRotas] = useState<string[]>([]);

  if (trophies.length === 0) return null;

  // La copa generada cubre los dos huecos posibles: un trofeo cargado en el
  // panel al que todavía no le subieron la foto (`photo` vacío) y una foto que
  // no cargó (el PNG que falta en `public/trofeos/`, o una URL de Storage que
  // ya no está). Sin esto, el segundo caso deja el ícono de imagen rota en el
  // medio del hero, que es peor que una copa genérica.
  //
  // El `id` como semilla y no el nombre: el nombre se edita, y una copa que
  // cambia de material porque le corrigieron una tilde al torneo es un cambio
  // que nadie pidió.
  const foto = (t: Trophy) =>
    t.photo && !rotas.includes(t.id) ? t.photo : trophyUrl(t.id);

  const ultimo = trophies.length - 1;
  const abierto = abierta === null ? null : (trophies[abierta] ?? trophies[0]);
  const mover = (paso: 1 | -1) =>
    setAbierta((i) =>
      i === null ? i : i + paso < 0 ? ultimo : i + paso > ultimo ? 0 : i + paso,
    );

  return (
    <>
      <CardCarousel
        variant="snap"
        itemWidth={ANCHO}
        gap={12}
        // Sin flechas, dots ni barra: con dos copas y media a la vista, el
        // pedacito que asoma de la tercera ya dice que hay más, y tres
        // indicadores para tres ítems es más chrome que contenido. En desktop
        // entran las tres y no hay nada que indicar.
        arrows={false}
        dots={false}
        progress={false}
        ariaLabel="Palmarés del club"
      >
        {trophies.map((t, i) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setAbierta(i)}
            className="group flex w-full flex-col overflow-hidden rounded-2xl border border-border bg-surface-alt text-left transition-colors hover:border-primary/40"
          >
            {/* 3:4 y no algo más cuadrado: las fotos de las tres copas son de
                663×1087 (0,61), así que con `object-contain` la que manda es
                la altura. En una caja cuadrada la copa entra chiquita con aire
                a los costados; acá llega casi de borde a borde. */}
            <div className="relative aspect-[3/4] w-full overflow-hidden bg-[linear-gradient(160deg,var(--color-primary),var(--color-accent))]">
              {/* El reflector detrás de la copa. Es lo que la despega del
                  degradé: sin esto, un PNG dorado sobre violeta se ve
                  pegoteado en los bordes. */}
              <span
                aria-hidden
                className="absolute left-1/2 top-1/4 h-1/2 w-3/4 -translate-x-1/2 rounded-full bg-white/25 blur-2xl"
              />

              {/* eslint-disable-next-line @next/next/no-img-element -- data-URI o URL de Storage */}
              <img
                src={foto(t)}
                alt={`Trofeo: ${t.name}`}
                loading="lazy"
                draggable={false}
                onError={() => setRotas((r) => (r.includes(t.id) ? r : [...r, t.id]))}
                className={`relative size-full object-contain p-2.5 drop-shadow-[0_6px_12px_rgba(0,0,0,0.35)] transition-transform duration-500 ${
                  reduced ? "" : "group-hover:scale-105"
                }`}
              />

              {t.times > 1 && (
                <span className="absolute right-1.5 top-1.5 rounded-full bg-black/45 px-1.5 py-0.5 text-[10px] font-bold tabular-nums text-white backdrop-blur-sm">
                  ×{t.times}
                </span>
              )}
            </div>

            <div className="flex min-w-0 flex-col gap-0.5 px-2.5 py-2">
              <p className="line-clamp-2 text-xs font-semibold leading-snug">{t.name}</p>
              <p className="flex items-center gap-1 text-[10px] text-muted">
                <StarIcon width={10} height={10} className="shrink-0 text-accent" />
                {t.years}
              </p>
            </div>
          </button>
        ))}
      </CardCarousel>

      {/* Se monta siempre, abierto o no: el visor cierra con una animación de
          salida y desmontarlo desde acá se la comería. */}
      <VisorCopa
        open={abierta !== null}
        onClose={() => setAbierta(null)}
        trophy={abierto ?? trophies[0]}
        src={foto(abierto ?? trophies[0])}
        // El visor recorre el palmarés sin cerrarse, y da la vuelta: llegar al
        // final y quedarse sin flecha sería salir del visor para volver a
        // entrar por la primera.
        onPrev={trophies.length > 1 ? () => mover(-1) : undefined}
        onNext={trophies.length > 1 ? () => mover(1) : undefined}
      />
    </>
  );
}

/* ── el visor ────────────────────────────────────────────────────────────── */

/** La copa sola, en una placa blanca centrada sobre la pantalla oscurecida.
 *
 *  ⚠️ No usa `ImageZoom` de la librería, y no por gusto: ese visor está hecho
 *  para fotos —estira la imagen a `max-h-full` sobre negro y ofrece pan y
 *  zoom—, y con un PNG de 663×1087 eso da una copa del alto de la pantalla,
 *  que es justo lo que no se quería. Acá el alto está topeado en 46vh y la
 *  copa entra entera de un vistazo, con la placa del torneo legible.
 *
 *  El fondo blanco tampoco es decoración: las tres fotos son recortes de
 *  producto sobre blanco, y lo que llevan escrito —el torneo, el año, la
 *  categoría— es texto oscuro chiquito. Sobre el negro del visor anterior esa
 *  placa se perdía contra la base, que es la mitad de lo que hay para mirar
 *  cuando alguien abre una copa en grande.
 *
 *  El blanco va fijo y no sale de los tokens: es el fondo con el que se
 *  fotografiaron las copas, así que tiene que ser el mismo en tema claro y en
 *  oscuro. Por eso el texto del pie también va con neutros explícitos —
 *  `text-foreground` acá saldría blanco sobre blanco.
 */
function VisorCopa({
  open,
  onClose,
  trophy,
  src,
  onPrev,
  onNext,
}: {
  open: boolean;
  onClose: () => void;
  trophy: Trophy;
  src: string;
  onPrev?: () => void;
  onNext?: () => void;
}) {
  const reduced = usePrefersReducedMotion();

  // Los tres callbacks llegan como closures nuevas en cada render del padre.
  // Guardarlas en un ref deja al efecto de abajo dependiendo sólo de `open`:
  // si dependiera de ellas, cada render del carrusel desmontaría y volvería a
  // montar el listener y el bloqueo de scroll.
  const acciones = useRef({ onClose, onPrev, onNext });
  useEffect(() => {
    acciones.current = { onClose, onPrev, onNext };
  });

  // Escape para cerrar y flechas para recorrer, más el scroll del fondo
  // bloqueado: sin eso, arrastrar sobre el visor mueve la pantalla de atrás y
  // al cerrar quedás parado en otra sección.
  useEffect(() => {
    if (!open) return;

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") acciones.current.onClose();
      if (e.key === "ArrowLeft") acciones.current.onPrev?.();
      if (e.key === "ArrowRight") acciones.current.onNext?.();
    };

    const previo = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKey);

    return () => {
      document.body.style.overflow = previo;
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const anim = { duration: reduced ? 0 : 0.22 };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={anim}
          onClick={onClose}
          role="dialog"
          aria-modal="true"
          aria-label={`Trofeo: ${trophy.name}`}
          className="fixed inset-0 z-[200] flex items-center justify-center bg-black/80 p-6 backdrop-blur-sm"
        >
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar"
            className="absolute right-4 top-4 grid size-10 place-items-center rounded-full bg-white/10 text-white transition-colors hover:bg-white/20"
          >
            <CloseIcon width={18} height={18} />
          </button>

          {onPrev && <FlechaVisor lado="izq" onClick={onPrev} />}
          {onNext && <FlechaVisor lado="der" onClick={onNext} />}

          {/* La placa. El click adentro no cierra: sólo el fondo.
              La `key` es el id del trofeo para que cambiar de copa con las
              flechas vuelva a montar esto y se note el cambio; sin eso la
              imagen se reemplaza sin transición y parece que no pasó nada. */}
          <motion.div
            key={trophy.id}
            initial={{ opacity: 0, scale: reduced ? 1 : 0.94 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={anim}
            onClick={(e) => e.stopPropagation()}
            className="flex w-[min(72vw,280px)] flex-col overflow-hidden rounded-3xl bg-white shadow-2xl"
          >
            {/* eslint-disable-next-line @next/next/no-img-element -- data-URI o URL de Storage */}
            <img
              src={src}
              alt={`Trofeo: ${trophy.name}`}
              draggable={false}
              className="max-h-[46vh] w-full object-contain px-6 pb-2 pt-6"
            />

            <div className="border-t border-black/10 px-4 py-3 text-center">
              <p className="text-sm font-semibold leading-snug text-neutral-900">
                {trophy.name}
              </p>
              <p className="mt-0.5 text-xs text-neutral-500">
                {trophy.years}
                {trophy.times > 1 && ` · ×${trophy.times}`}
              </p>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/** Las flechas del visor. Van sobre el fondo y no sobre la placa: encima del
 *  blanco taparían la copa, que en 280px de ancho no sobra por los costados. */
function FlechaVisor({ lado, onClick }: { lado: "izq" | "der"; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      aria-label={lado === "izq" ? "Copa anterior" : "Copa siguiente"}
      className={`absolute top-1/2 grid size-10 -translate-y-1/2 place-items-center rounded-full bg-white/10 text-white transition-colors hover:bg-white/20 ${
        lado === "izq" ? "left-2" : "right-2"
      }`}
    >
      {lado === "izq" ? (
        <BackIcon width={18} height={18} />
      ) : (
        <ChevronIcon width={18} height={18} />
      )}
    </button>
  );
}
