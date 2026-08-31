"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useCallback, useEffect, useRef, useState } from "react";
import { usePrefersReducedMotion } from "lib-kit-components";

import {
  ArrowDownIcon,
  ArrowUpIcon,
  BackIcon,
  BallIcon,
  ChevronIcon,
  CloseIcon,
  FullscreenExitIcon,
  FullscreenIcon,
  HeartIcon,
  PlayIcon,
  ShieldIcon,
  ShirtIcon,
  StarIcon,
  TicketIcon,
} from "@/components/atoms/icons";
import type { MilestoneKind } from "@/lib/historia";
import {
  fijarOrientacion,
  soltarOrientacion,
  useMantenerPantallaEncendida,
  usePantallaCompleta,
} from "@/lib/presentacion/pantalla";
import type { Orientacion, Vineta } from "@/lib/presentacion/trayectoria";

/** El modo presentación de la trayectoria: la historia del club a pantalla
 *  completa, una card por viñeta, avanzando sobre el riel de la línea de tiempo.
 *
 *  Es hermano del presentador de la gala (`admin/presentacion/Presentador`) y
 *  comparte con él lo que cuesta: pantalla completa, wake lock y orientación
 *  salen los tres de `lib/presentacion/pantalla`. Lo que no comparte es la
 *  pantalla en sí, y por eso es un componente aparte y no una prop del otro:
 *  la gala revela ganadores de a uno y su placa es el centro absoluto; acá lo
 *  que importa es **dónde estás parado en la historia**, así que el riel es
 *  permanente y la card es lo que se mueve sobre él.
 *
 *  Cuatro decisiones que no son obvias:
 *
 *  1 · **El riel se ve entero, siempre.** No scrollea para seguir a la card. Con
 *      veintitantas viñetas, un riel que se desplaza deja al espectador sin
 *      saber cuánto falta, que es justo lo que una línea de tiempo tiene que
 *      contestar. Se dibujan todas las marcas y avanza el relleno.
 *
 *  2 · **La orientación es del usuario, no del dispositivo.** No se deduce de
 *      `matchMedia("(orientation: landscape)")`: alguien puede querer proyectar
 *      en horizontal desde un teléfono que sostiene vertical. Se elige al
 *      entrar y se cambia con la tecla `O` o su botón, y recién entonces se le
 *      pide al teléfono que se fije en esa orientación.
 *
 *  3 · **El avance automático se apaga solo al tocar.** Si alguien toca para
 *      volver una card, es porque quiere leerla: seguir corriendo el reloj le
 *      saca de la pantalla justo lo que fue a buscar.
 *
 *  4 · **No usa los tokens de la app.** Mismo criterio que las placas de la
 *      gala: esto se muestra a pantalla completa y a veces se proyecta, así que
 *      el fondo es negro violáceo y el acento dorado tenga el que presenta el
 *      tema claro o el oscuro.
 */

const ORO = "#e8c46a";

/** Cada milisegundo acá es tiempo de lectura: la card más larga es la
 *  descripción de una etapa, y siete segundos alcanzan para leerla sin que el
 *  que mira sienta que la presentación se colgó. */
const AUTO_MS = 7000;

/** Cuánto se queda quieto el mouse antes de que se escondan los controles. */
const OCULTAR_MS = 2800;

/* ── tipos de hito ───────────────────────────────────────────────────────── */

/** Los mismos tipos que `EraTimeline`, con la paleta de proyección.
 *
 *  No se reusa `KindChip` justamente por eso: aquel pinta con los tokens del
 *  tema (`bg-surface-alt`, `text-accent`) y acá el fondo es negro fijo, así que
 *  en tema claro saldría un chip blanco sobre negro. */
const KINDS: Record<MilestoneKind, { label: string; color: string; icon: React.ReactNode }> = {
  titulo: { label: "Título", color: ORO, icon: <StarIcon width={12} height={12} /> },
  ascenso: { label: "Ascenso", color: "#6ee7a8", icon: <ArrowUpIcon width={12} height={12} /> },
  derrota: { label: "Derrota", color: "#f2879b", icon: <ArrowDownIcon width={12} height={12} /> },
  debut: { label: "Debut", color: "#c9a2f0", icon: <ShirtIcon width={12} height={12} /> },
  obra: { label: "Institucional", color: "#ffffff99", icon: <ShieldIcon width={12} height={12} /> },
  partido: { label: "Partido", color: "#ffffffcc", icon: <BallIcon width={12} height={12} /> },
  homenaje: { label: "Homenaje", color: "#e6d4f5", icon: <HeartIcon width={12} height={12} /> },
  evento: { label: "Evento", color: "#c9a2f0", icon: <TicketIcon width={12} height={12} /> },
};

/** El año con el que se rotula una etapa en el riel.
 *
 *  Sale del `period` —"2022", "2026 — hoy"— quedándose con los primeros cuatro
 *  caracteres: el rango entero no entra debajo de una marca de 8px en un
 *  teléfono, y el año de inicio es lo único que hace falta para ubicarse. */
const anioDe = (periodo: string) => periodo.slice(0, 4);

/* ── el componente ───────────────────────────────────────────────────────── */

export function TrayectoriaPresentador({
  vinetas,
  orientacionInicial,
  onSalir,
}: {
  vinetas: Vineta[];
  orientacionInicial: Orientacion;
  onSalir: () => void;
}) {
  const reducido = usePrefersReducedMotion();
  const contenedor = useRef<HTMLDivElement>(null);
  const pantalla = usePantallaCompleta(contenedor);
  useMantenerPantallaEncendida();

  const [orientacion, setOrientacion] = useState<Orientacion>(orientacionInicial);
  const [indice, setIndice] = useState(0);
  const [direccion, setDireccion] = useState(1);
  const [auto, setAuto] = useState(false);
  const [controles, setControles] = useState(true);

  const actual = vinetas[indice];
  const horizontal = orientacion === "horizontal";
  const total = vinetas.length;

  /* ── arranque y cierre ─────────────────────────────────────────────────── */

  useEffect(() => {
    // Corre a milisegundos del toque que abrió el presentador, que es la única
    // ventana en la que el navegador concede pantalla completa. Pedir la
    // orientación después de entrar y no antes es a propósito: fuera de
    // pantalla completa el bloqueo se rechaza siempre.
    void (async () => {
      await pantalla.entrar();
      await fijarOrientacion(orientacionInicial === "horizontal" ? "landscape" : "portrait");
    })();

    return () => soltarOrientacion();
    // Sólo al montar: `pantalla.entrar` es estable y volver a pedir pantalla
    // completa en cada render la pediría con cada tecla.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // El presentador se monta **encima** de `/historia`, que es una pantalla
  // larga: sin esto, un arrastre que empiece en una card scrollea la página de
  // atrás y al salir el usuario aparece en otro lado del que estaba.
  useEffect(() => {
    const previo = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previo;
    };
  }, []);

  const cerrar = useCallback(() => {
    soltarOrientacion();
    void pantalla.salir();
    onSalir();
  }, [pantalla, onSalir]);

  /* ── navegación ────────────────────────────────────────────────────────── */

  const ir = useCallback(
    (destino: number, manual = true) => {
      const proximo = Math.min(Math.max(destino, 0), total - 1);

      setDireccion(proximo >= indice ? 1 : -1);
      setIndice(proximo);

      // Dos cosas apagan el avance automático, y las dos son eventos —pasan al
      // llegar, no son un estado que haya que corregir después—:
      //
      //   tocar        decisión 3 del encabezado. El temporizador llama con
      //                `manual: false` justamente para no apagarse a sí mismo.
      //   el final     la última card no reinicia: una presentación que vuelve
      //                sola a la portada deja al que mira sin saber si terminó
      //                o si se le escapó algo.
      if (manual || proximo >= total - 1) setAuto(false);
    },
    [indice, total],
  );

  const avanzar = useCallback(() => ir(indice + 1), [ir, indice]);
  const retroceder = useCallback(() => ir(indice - 1), [ir, indice]);

  const girar = useCallback(() => {
    setOrientacion((previa) => {
      const proxima: Orientacion = previa === "horizontal" ? "vertical" : "horizontal";
      void fijarOrientacion(proxima === "horizontal" ? "landscape" : "portrait");
      return proxima;
    });
  }, []);

  /* ── avance automático ─────────────────────────────────────────────────── */

  // Sólo programa el próximo salto. Apagarse al llegar al final es tarea de
  // `ir`, que es donde se sabe que se llegó.
  useEffect(() => {
    if (!auto || indice >= total - 1) return;

    const t = window.setTimeout(() => ir(indice + 1, false), AUTO_MS);
    return () => window.clearTimeout(t);
  }, [auto, indice, total, ir]);

  /* ── teclado ───────────────────────────────────────────────────────────── */

  useEffect(() => {
    const alTeclear = (e: KeyboardEvent) => {
      switch (e.key) {
        case "ArrowRight":
        case "ArrowDown":
        case "PageDown":
        case " ":
        case "Enter":
          e.preventDefault();
          avanzar();
          break;
        case "ArrowLeft":
        case "ArrowUp":
        case "PageUp":
        case "Backspace":
          e.preventDefault();
          retroceder();
          break;
        case "Home":
          e.preventDefault();
          ir(0);
          break;
        case "End":
          e.preventDefault();
          ir(total - 1);
          break;
        case "o":
        case "O":
          girar();
          break;
        case "p":
        case "P":
          setAuto((a) => !a);
          break;
        case "f":
        case "F":
          void (pantalla.activa ? pantalla.salir() : pantalla.entrar());
          break;
        case "Escape":
          // Igual que en la gala: en pantalla completa este `Escape` es el que
          // la cierra —el navegador ya lo procesó— y cerrar acá también sacaría
          // de la presentación de un saque.
          if (!document.fullscreenElement) cerrar();
          break;
      }
    };

    window.addEventListener("keydown", alTeclear);
    return () => window.removeEventListener("keydown", alTeclear);
  }, [avanzar, retroceder, ir, total, girar, pantalla, cerrar]);

  /* ── los controles se esconden solos ───────────────────────────────────── */

  useEffect(() => {
    let temporizador: number;

    const despertar = () => {
      setControles(true);
      window.clearTimeout(temporizador);
      temporizador = window.setTimeout(() => setControles(false), OCULTAR_MS);
    };

    despertar();
    window.addEventListener("mousemove", despertar);
    window.addEventListener("keydown", despertar);
    window.addEventListener("touchstart", despertar);
    return () => {
      window.clearTimeout(temporizador);
      window.removeEventListener("mousemove", despertar);
      window.removeEventListener("keydown", despertar);
      window.removeEventListener("touchstart", despertar);
    };
  }, []);

  /* ── render ────────────────────────────────────────────────────────────── */

  const primera = indice === 0;
  const ultima = indice === total - 1;

  // El desplazamiento de entrada y salida va sobre el eje del riel: en
  // horizontal la card entra desde el costado, en vertical desde abajo. Es lo
  // que hace que el movimiento de la card y el del relleno del riel se lean
  // como el mismo gesto.
  const eje = horizontal ? "x" : "y";
  const desde = { opacity: 0, [eje]: direccion * 48 };
  const hasta = { opacity: 1, [eje]: 0 };
  const sale = { opacity: 0, [eje]: direccion * -48 };

  return (
    <div
      ref={contenedor}
      // `fixed inset-0` y no sólo `requestFullscreen`: si el navegador rechaza
      // la pantalla completa —pestaña embebida, iOS en ventana—, esto igual
      // tapa la app entera y la presentación se ve igual.
      className="fixed inset-0 z-50 select-none overflow-hidden bg-[#07030d] text-white"
      style={{ cursor: controles ? "default" : "none" }}
      role="region"
      aria-label="Presentación de la trayectoria del club"
    >
      <Fondo etapa={actual?.etapaIndice ?? 0} />

      {/* El marco: card y riel, en el eje que se haya elegido. */}
      <div className={`relative z-10 flex h-full w-full ${horizontal ? "flex-col" : "flex-row"}`}>
        <div className="relative min-h-0 min-w-0 flex-1">
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={actual?.id ?? indice}
              className="h-full w-full"
              initial={reducido ? { opacity: 0 } : desde}
              animate={reducido ? { opacity: 1 } : hasta}
              exit={reducido ? { opacity: 0 } : sale}
              transition={{ duration: reducido ? 0 : 0.3, ease: "easeOut" }}
            >
              {actual && <Placa vineta={actual} horizontal={horizontal} />}
            </motion.div>
          </AnimatePresence>
        </div>

        <Riel
          vinetas={vinetas}
          indice={indice}
          horizontal={horizontal}
          reducido={reducido}
          onIr={ir}
        />
      </div>

      {/* Zonas de toque, sobre el eje del riel: en horizontal la mitad
          izquierda vuelve y la derecha avanza; en vertical, arriba y abajo. Es
          lo que espera cualquiera que haya usado una historia de Instagram, y
          hace que la presentación se maneje sin apuntarle a un botón de 40px.
          Van debajo del riel y de los controles, que sí son clickeables. */}
      <button
        type="button"
        className={`absolute z-[15] focus:outline-none ${
          horizontal ? "inset-y-0 left-0 w-[35%]" : "inset-x-0 top-0 h-[35%]"
        }`}
        onClick={retroceder}
        aria-label="Card anterior"
        tabIndex={-1}
      />
      <button
        type="button"
        className={`absolute z-[15] focus:outline-none ${
          horizontal ? "inset-y-0 right-0 w-[65%]" : "inset-x-0 bottom-0 h-[65%]"
        }`}
        onClick={avanzar}
        aria-label="Card siguiente"
        tabIndex={-1}
      />

      {/* ── controles ─────────────────────────────────────────────────────── */}
      <AnimatePresence>
        {controles && (
          <motion.div
            className="pointer-events-none absolute inset-0 z-40"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
          >
            <div className="pointer-events-auto absolute inset-x-0 top-0 flex items-center gap-2 bg-gradient-to-b from-black/70 to-transparent px-3 pb-10 pt-3">
              <span className="min-w-0 flex-1 truncate text-xs text-white/70">
                <span className="tabular-nums text-white/40">
                  {indice + 1}/{total}
                </span>
                <span className="ml-2 text-white/85">{actual?.rotulo}</span>
              </span>

              <BotonControl
                onClick={() => setAuto((a) => !a)}
                label={auto ? "Pausar el avance automático" : "Reproducir solo"}
                activo={auto}
              >
                {auto ? <PausaIcon /> : <PlayIcon width={16} height={16} />}
              </BotonControl>

              <BotonControl
                onClick={girar}
                label={horizontal ? "Pasar a vertical" : "Pasar a horizontal"}
              >
                <GiroIcon horizontal={horizontal} />
              </BotonControl>

              <BotonControl
                onClick={() => void (pantalla.activa ? pantalla.salir() : pantalla.entrar())}
                label={pantalla.activa ? "Salir de pantalla completa" : "Pantalla completa"}
              >
                {pantalla.activa ? (
                  <FullscreenExitIcon width={18} height={18} />
                ) : (
                  <FullscreenIcon width={18} height={18} />
                )}
              </BotonControl>

              <BotonControl onClick={cerrar} label="Terminar la presentación">
                <CloseIcon width={18} height={18} />
              </BotonControl>
            </div>

            {/* Las flechas grandes, sobre el eje del riel. */}
            <FlechaLateral
              sentido="atras"
              horizontal={horizontal}
              onClick={retroceder}
              deshabilitada={primera}
            />
            <FlechaLateral
              sentido="adelante"
              horizontal={horizontal}
              onClick={avanzar}
              deshabilitada={ultima}
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Ayuda de teclado: con los controles y sólo en la portada, que es
          cuando el que presenta todavía está probando. */}
      {controles && primera && (
        <p className="absolute bottom-3 right-4 z-40 hidden text-right text-[11px] leading-relaxed text-white/35 md:block">
          → / espacio avanza · ← retrocede
          <br />O gira · P reproduce solo · F pantalla completa
        </p>
      )}
    </div>
  );
}

/* ── el fondo ────────────────────────────────────────────────────────────── */

/** Dos manchas violetas desenfocadas sobre negro, que **aclaran** a medida que
 *  avanza la historia.
 *
 *  Está en el marco y no en cada card porque tiene que quedarse quieto entre
 *  viñeta y viñeta: si entrara y saliera con cada transición, se vería un
 *  parpadeo negro en cada avance.
 *
 *  La variación entre etapas es de luminosidad y no de tono, igual que en
 *  `lib/media.ts`: el violeta 271° es la marca, y un fondo que va del violeta
 *  al azul contaría una historia de otro club. De 2020 a hoy el fondo se abre
 *  de a poco, que es lo que hace sentir el paso del tiempo sin decirlo.
 */
function Fondo({ etapa }: { etapa: number }) {
  const luz = 24 + Math.min(etapa, 5) * 4; // 24 → 44

  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 z-0 overflow-hidden">
      <div className="absolute inset-0 bg-[#07030d]" />
      <motion.div
        className="absolute -left-[15%] top-[-20%] h-[70vh] w-[70vh] rounded-full opacity-60 blur-[120px]"
        animate={{ background: `radial-gradient(circle, hsl(271 79% ${luz}%) 0%, transparent 70%)` }}
        transition={{ duration: 0.8 }}
      />
      <motion.div
        className="absolute -right-[10%] bottom-[-25%] h-[80vh] w-[80vh] rounded-full opacity-50 blur-[140px]"
        animate={{ background: `radial-gradient(circle, hsl(271 65% ${luz + 12}%) 0%, transparent 70%)` }}
        transition={{ duration: 0.8 }}
      />
      {/* Viñeteado: oscurece los bordes para que el texto gane peso cuando esto
          se ve con luz ambiente. */}
      <div
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse at center, transparent 35%, rgba(0,0,0,0.75) 100%)",
        }}
      />
    </div>
  );
}

/* ── el riel ─────────────────────────────────────────────────────────────── */

/** La línea de tiempo: una marca por viñeta, el relleno hasta donde vas y el
 *  año debajo de cada etapa.
 *
 *  Las marcas son botones: tocar una salta ahí. Es lo que reemplaza al índice
 *  desplegable que sí tiene la gala — acá el índice ya está dibujado.
 */
function Riel({
  vinetas,
  indice,
  horizontal,
  reducido,
  onIr,
}: {
  vinetas: Vineta[];
  indice: number;
  horizontal: boolean;
  reducido: boolean;
  onIr: (i: number) => void;
}) {
  const total = vinetas.length;
  // Con una sola viñeta no hay recorrido que dibujar y `total - 1` sería una
  // división por cero.
  const pct = (i: number) => (total > 1 ? (i / (total - 1)) * 100 : 0);
  const avance = pct(indice);

  return (
    <div
      className={`relative z-30 shrink-0 ${
        horizontal ? "h-[74px] w-full px-[7vw]" : "h-full w-[76px] py-[7vh]"
      }`}
      role="group"
      aria-label="Línea de tiempo"
    >
      <div className="relative h-full w-full">
        {/* la vía */}
        <span
          aria-hidden
          className={`absolute rounded-full bg-white/15 ${
            horizontal ? "inset-x-0 top-[18px] h-[3px]" : "inset-y-0 left-[26px] w-[3px]"
          }`}
        />
        {/* el relleno, hasta donde vas */}
        <motion.span
          aria-hidden
          className={`absolute rounded-full ${
            horizontal ? "left-0 top-[18px] h-[3px]" : "left-[26px] top-0 w-[3px]"
          }`}
          style={{ background: `linear-gradient(${horizontal ? "90deg" : "180deg"}, #752eb8, ${ORO})` }}
          animate={horizontal ? { width: `${avance}%` } : { height: `${avance}%` }}
          transition={{ duration: reducido ? 0 : 0.4, ease: "easeOut" }}
        />

        {vinetas.map((v, i) => {
          const pasada = i <= indice;
          const activa = i === indice;
          const p = `${pct(i)}%`;

          return (
            <button
              key={v.id}
              type="button"
              onClick={() => onIr(i)}
              title={v.rotulo}
              aria-label={v.rotulo}
              aria-current={activa ? "true" : undefined}
              className="absolute grid place-items-center"
              style={
                horizontal
                  ? { left: p, top: "18px", width: 28, height: 28, transform: "translate(-50%,-50%)" }
                  : { top: p, left: "26px", width: 28, height: 28, transform: "translate(-50%,-50%)" }
              }
            >
              <motion.span
                className="block rounded-full"
                animate={{
                  // La marca de la etapa es más grande que la del hito: es lo
                  // que deja leer los capítulos en el riel de un vistazo.
                  width: activa ? 14 : v.abreEtapa ? 10 : 6,
                  height: activa ? 14 : v.abreEtapa ? 10 : 6,
                  backgroundColor: activa ? ORO : pasada ? "#c9a2f0" : "#ffffff40",
                }}
                transition={{ duration: reducido ? 0 : 0.25 }}
                style={activa ? { boxShadow: `0 0 0 4px ${ORO}33` } : undefined}
              />
            </button>
          );
        })}

        {/* Los años, sólo en las etapas: veintitantas marcas rotuladas no
            entran en el ancho de un teléfono. */}
        {vinetas.map((v, i) =>
          v.abreEtapa ? (
            <span
              key={`r-${v.id}`}
              aria-hidden
              className={`absolute whitespace-nowrap text-[10px] font-semibold tabular-nums ${
                i <= indice ? "text-white/70" : "text-white/30"
              }`}
              style={
                horizontal
                  ? { left: pct(i) + "%", top: "38px", transform: "translateX(-50%)" }
                  : { top: pct(i) + "%", left: "46px", transform: "translateY(-50%)" }
              }
            >
              {anioDe(v.periodo)}
            </span>
          ) : null,
        )}
      </div>
    </div>
  );
}

/* ── las cards ───────────────────────────────────────────────────────────── */

/** Todos los tamaños de texto son `clamp(mín, vw, máx)` y ninguno es un `text-`
 *  de la escala de Tailwind: la misma card se ve en un teléfono de 360px y en
 *  un televisor, y una escala en `rem` no se entera de la diferencia. */
function Placa({ vineta, horizontal }: { vineta: Vineta; horizontal: boolean }) {
  // `relative` para que la foto de fondo de la card de etapa se recorte contra
  // la card y no contra el marco del presentador.
  const marco = `relative flex h-full w-full flex-col justify-center gap-[clamp(0.6rem,1.8vh,1.4rem)] ${
    horizontal ? "px-[8vw] py-[4vh]" : "px-[7vw] py-[5vh]"
  }`;

  if (vineta.tipo === "portada") {
    return (
      <div className={`${marco} items-center text-center`}>
        <span className="relative flex items-center justify-center" style={{ width: "clamp(4.5rem,14vh,9rem)", height: "clamp(4.5rem,14vh,9rem)" }}>
          <span
            aria-hidden
            className="absolute inset-[-40%] rounded-full blur-3xl"
            style={{ background: `radial-gradient(circle, ${ORO}59, transparent 70%)` }}
          />
          {/* eslint-disable-next-line @next/next/no-img-element -- SVG estático */}
          <img src="/escudo.svg" alt="" className="relative h-full w-full" />
        </span>

        <h1 className="text-[clamp(1.6rem,5vw,3.6rem)] font-bold leading-tight">
          {vineta.titulo}
        </h1>

        <p aria-label={`${vineta.estrellas} estrellas`} className="flex gap-2">
          {Array.from({ length: vineta.estrellas }, (_, i) => (
            <StarIcon key={i} width="clamp(1.1rem,3vw,2rem)" height="clamp(1.1rem,3vw,2rem)" style={{ color: ORO }} />
          ))}
        </p>

        <p className="text-[clamp(0.85rem,1.8vw,1.3rem)] text-white/60">{vineta.bajada}</p>
      </div>
    );
  }

  if (vineta.tipo === "cierre") {
    return (
      <div className={`${marco} items-center text-center`}>
        <Rotulo>El presente</Rotulo>
        <h2 className="text-[clamp(1.5rem,4.6vw,3.4rem)] font-bold leading-tight" style={{ color: ORO }}>
          {vineta.titulo}
        </h2>
        <p className="text-[clamp(0.9rem,2vw,1.4rem)] italic text-white/70">«{vineta.bajada}»</p>

        <dl className="mt-2 grid w-full max-w-2xl grid-cols-4 gap-[clamp(0.4rem,1.5vw,1rem)]">
          {vineta.stats.map((s) => (
            <div key={s.label} className="rounded-xl border border-white/10 bg-white/5 px-1 py-[clamp(0.5rem,1.5vh,1rem)]">
              <dd className="text-[clamp(1.1rem,3.4vw,2.4rem)] font-bold tabular-nums" style={{ color: ORO }}>
                {s.value}
              </dd>
              <dt className="mt-0.5 text-[clamp(0.55rem,1.1vw,0.8rem)] uppercase tracking-wider text-white/50">
                {s.label}
              </dt>
            </div>
          ))}
        </dl>
      </div>
    );
  }

  if (vineta.tipo === "etapa") {
    return (
      <div className={marco}>
        {/* La foto de la etapa, de fondo y muy tenue: da textura sin pelearle
            al texto, que es lo que hay que poder leer de lejos. */}
        <span aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
          {/* eslint-disable-next-line @next/next/no-img-element -- data-URI */}
          <img src={vineta.foto} alt="" className="h-full w-full object-cover opacity-[0.18]" />
          <span className="absolute inset-0 bg-gradient-to-t from-[#07030d] via-[#07030d]/70 to-[#07030d]/30" />
        </span>

        <div className="relative flex flex-wrap items-center gap-x-3 gap-y-2">
          <Rotulo>{vineta.periodo}</Rotulo>
          {vineta.actual && (
            <span
              className="rounded-full border px-2 py-0.5 text-[clamp(0.55rem,1vw,0.75rem)] font-semibold uppercase tracking-wider"
              style={{ borderColor: `${ORO}59`, color: ORO }}
            >
              En curso
            </span>
          )}
        </div>

        <h2 className="relative text-[clamp(1.5rem,4.4vw,3.2rem)] font-bold leading-[1.05]">
          {vineta.titulo}
        </h2>
        <p className="relative text-[clamp(0.9rem,2.1vw,1.5rem)] leading-snug" style={{ color: ORO }}>
          {vineta.bajada}
        </p>
        {/* `line-clamp` y no el texto entero: la descripción de una etapa son
            seis líneas largas, y en horizontal en un teléfono apaisado la card
            mide 200px de alto. Lo que no entra está en `/historia`. */}
        <p className="relative line-clamp-4 max-w-3xl text-[clamp(0.75rem,1.6vw,1.1rem)] leading-relaxed text-white/65">
          {vineta.cuerpo}
        </p>

        <dl className="relative mt-1 flex flex-wrap gap-[clamp(0.5rem,2vw,1.5rem)]">
          {vineta.stats.map((s) => (
            <div key={s.label}>
              <dd className="text-[clamp(0.95rem,2.4vw,1.8rem)] font-bold tabular-nums text-white">
                {s.value}
              </dd>
              <dt className="text-[clamp(0.55rem,1vw,0.75rem)] uppercase tracking-wider text-white/45">
                {s.label}
              </dt>
            </div>
          ))}
        </dl>
      </div>
    );
  }

  const k = KINDS[vineta.kind];

  return (
    <div className={marco}>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <span
          className="inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[clamp(0.55rem,1.1vw,0.8rem)] font-semibold uppercase tracking-wider"
          style={{ borderColor: `${k.color}4d`, color: k.color, background: `${k.color}14` }}
        >
          {k.icon}
          {k.label}
        </span>
        <span className="text-[clamp(0.65rem,1.3vw,0.95rem)] font-medium text-white/50">
          {vineta.fecha}
        </span>
      </div>

      <h2 className="text-[clamp(1.3rem,4vw,2.9rem)] font-bold leading-[1.1]">{vineta.titulo}</h2>
      <p className="max-w-3xl text-[clamp(0.8rem,1.8vw,1.25rem)] leading-relaxed text-white/70">
        {vineta.cuerpo}
      </p>
    </div>
  );
}

function Rotulo({ children }: { children: React.ReactNode }) {
  return (
    <p
      className="text-[clamp(0.6rem,1.2vw,0.95rem)] font-semibold uppercase"
      style={{ color: ORO, letterSpacing: "0.3em" }}
    >
      {children}
    </p>
  );
}

/* ── controles ───────────────────────────────────────────────────────────── */

function BotonControl({
  onClick,
  children,
  label,
  activo,
}: {
  onClick: () => void;
  children: React.ReactNode;
  label: string;
  activo?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={label}
      aria-label={label}
      className={`grid h-9 w-9 shrink-0 place-items-center rounded-lg transition-colors ${
        activo ? "bg-white/20 text-white" : "text-white/80 hover:bg-white/10"
      }`}
    >
      {children}
    </button>
  );
}

/** La flecha grande, puesta sobre el eje del riel: a los costados en
 *  horizontal, arriba y abajo en vertical. */
function FlechaLateral({
  sentido,
  horizontal,
  onClick,
  deshabilitada,
}: {
  sentido: "atras" | "adelante";
  horizontal: boolean;
  onClick: () => void;
  deshabilitada: boolean;
}) {
  const atras = sentido === "atras";

  const lugar = horizontal
    ? `top-1/2 -translate-y-1/2 ${atras ? "left-3" : "right-3"}`
    : `left-1/2 -translate-x-1/2 ${atras ? "top-14" : "bottom-3"}`;

  const Icono = horizontal ? (atras ? BackIcon : ChevronIcon) : atras ? ArrowUpIcon : ArrowDownIcon;

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={deshabilitada}
      aria-label={atras ? "Card anterior" : "Card siguiente"}
      className={`pointer-events-auto absolute grid h-12 w-12 place-items-center rounded-full border border-white/15 bg-black/35 text-white/80 backdrop-blur transition hover:bg-black/60 disabled:pointer-events-none disabled:opacity-0 ${lugar}`}
    >
      <Icono width={22} height={22} />
    </button>
  );
}

/** Pausa. No está en el set de `icons.tsx` porque es el único lugar de la app
 *  donde algo se pausa: las dos barras viven acá. */
function PausaIcon() {
  return (
    <svg viewBox="0 0 24 24" width={16} height={16} fill="currentColor" aria-hidden focusable="false">
      <rect x="6.5" y="5" width="3.5" height="14" rx="1" />
      <rect x="14" y="5" width="3.5" height="14" rx="1" />
    </svg>
  );
}

/** El ícono del botón que gira la presentación: un rectángulo apaisado o
 *  parado, según lo que se vaya a obtener al tocarlo. */
function GiroIcon({ horizontal }: { horizontal: boolean }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={18}
      height={18}
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      focusable="false"
    >
      {horizontal ? (
        <rect x="8" y="3.5" width="8" height="17" rx="2" />
      ) : (
        <rect x="3.5" y="8" width="17" height="8" rx="2" />
      )}
    </svg>
  );
}
