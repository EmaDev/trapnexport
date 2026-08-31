"use client";

import { motion, type Variants } from "framer-motion";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from "react";

import type { RevelacionInvitacion } from "@/lib/contenido/types";

/** La tapa: lo que el invitado tiene que sacar para leer su invitación.
 *
 *  Es lo que convierte abrir el link en un momento y no en cargar una página.
 *  Vive separado de `InvitationEfectos` porque son decisiones independientes
 *  —cualquier tapa combina con cualquier movimiento— y porque tenerlas juntas
 *  obligaba a elegir el sobre lacrado renunciando a la tarjeta holográfica.
 *
 *  Las tres comparten la misma mecánica, y no es casual:
 *
 *  1 · **La tapa no desmonta la tarjeta: la cubre.** Se renderiza siempre, con
 *      su tamaño real, y la tapa se apoya encima en `absolute inset-0`. Es la
 *      tarjeta la que define el alto del bloque; una tapa con alto propio
 *      saltaría de tamaño al abrirse, y ese salto se lleva puesta la animación
 *      que venía a lucirse. En la raspadita, además, es la única forma de que
 *      se vea lo que se va descubriendo.
 *  2 · **Se abren solas a los pocos segundos.** El gesto es lo lindo del
 *      efecto, pero no puede ser la única forma de llegar al contenido: alguien
 *      que no entiende que hay que tocar se queda mirando una tapa para
 *      siempre.
 *  3 · **`quieto` las saltea enteras.** Con `prefers-reduced-motion` no hay
 *      nada que destapar: la invitación ya está abierta. Una tapa es, por
 *      definición, movimiento.
 */

export interface RevelacionProps {
  tipo: RevelacionInvitacion;
  children: ReactNode;
  /** el escudo: el lacre del sobre y el emblema de la cortina */
  crest: string;
  /** el `code` de la invitación: siembra los papelitos */
  seed: string;
  quieto: boolean;
  /** Se llama una vez, cuando la tapa terminó de salir. `InvitationStage` lo
   *  usa para recién entonces mostrar los botones de compartir. */
  onAbierta: () => void;
}

/** Los segundos que la tapa espera antes de abrirse sola. La raspadita da más
 *  tiempo: es la única que pide un gesto sostenido y no un toque, y cortarla a
 *  los seis segundos le sacaría el raspado a quien justo estaba raspando. */
const SOLA_MS: Record<Exclude<RevelacionInvitacion, "directa">, number> = {
  lacre: 6000,
  cortina: 5500,
  raspar: 9000,
};

/** Un `Math.random()` determinista por semilla (FNV-1a + mulberry32).
 *
 *  Los papelitos sólo se dibujan después de que alguien tocó la tapa, así que
 *  el azar acá no llega a romper la hidratación. Es determinista igual por una
 *  razón más chica pero real: la misma invitación tiene que verse igual cada
 *  vez que se la abre, y un festejo distinto en cada recarga se nota. */
function prng(seed: string) {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return () => {
    h = (h + 0x6d2b79f5) | 0;
    let t = h;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** El estallido de papelitos, común a las tres tapas.
 *
 *  Vive acá y no en cada una porque es el festejo de *destapar*, no del sobre:
 *  la cortina y la raspadita se merecen el mismo. Sale de la tapa hacia arriba
 *  y cae. */
function Papelitos({ seed }: { seed: string }) {
  const piezas = useMemo(() => {
    const r = prng(`${seed}-papelitos`);
    const tonos = ["#50108b", "#752eb8", "#c8a2eb", "#ffffff", "#f0e0ff"];
    return Array.from({ length: 28 }, (_, i) => ({
      id: i,
      x: (r() - 0.5) * 420,
      alto: -(140 + r() * 300),
      giro: (r() - 0.5) * 900,
      dur: 1.1 + r() * 0.9,
      tono: tonos[Math.floor(r() * tonos.length)],
      w: 5 + r() * 5,
      h: 9 + r() * 9,
    }));
  }, [seed]);

  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 z-20 overflow-visible">
      {piezas.map((p) => (
        <motion.span
          key={p.id}
          initial={{ x: 0, y: 0, rotate: 0, opacity: 1 }}
          animate={{ x: p.x, y: [0, p.alto, p.alto + 420], rotate: p.giro, opacity: [1, 1, 0] }}
          transition={{ duration: p.dur + 0.9, delay: 0.42, ease: "easeOut" }}
          className="absolute left-1/2 top-1/2 rounded-[1px]"
          style={{ width: p.w, height: p.h, backgroundColor: p.tono }}
        />
      ))}
    </div>
  );
}

/* ── el estado compartido ────────────────────────────────────────────────── */

/** `abierta` con su apertura automática y el aviso de "ya está".
 *
 *  El aviso sale con retardo y no en el mismo momento en que se toca: la tapa
 *  tarda en salir, y avisar antes haría aparecer los botones sobre una cortina
 *  todavía a medio abrir. */
function useTapa(quieto: boolean, tipo: RevelacionInvitacion, onAbierta: () => void) {
  const [abrio, setAbrio] = useState(false);
  const abierta = quieto || tipo === "directa" || abrio;

  const abrir = useCallback(() => setAbrio(true), []);

  useEffect(() => {
    if (abierta) return;
    const t = setTimeout(abrir, SOLA_MS[tipo as keyof typeof SOLA_MS] ?? 6000);
    return () => clearTimeout(t);
  }, [abierta, abrir, tipo]);

  useEffect(() => {
    // En `directa` no hay tapa, y quien avisa es el efecto al terminar su
    // entrada. Avisar también desde acá —que sería al instante— le sacaría al
    // efecto su momento: los botones aparecerían mientras la tarjeta todavía
    // está entrando, que es exactamente lo que este aviso viene a evitar.
    if (!abierta || tipo === "directa") return;
    // El retardo es el largo de la animación de salida de la tapa.
    const t = setTimeout(onAbierta, quieto ? 0 : 900);
    return () => clearTimeout(t);
  }, [abierta, onAbierta, quieto, tipo]);

  return { abierta, abrir };
}

/* ══════════════════════════════════════════════════════════════════════════
   LACRE — el sobre

   Llega cerrado. Se toca el lacre, la solapa gira hacia atrás sobre su borde
   superior y el cuerpo se va hacia abajo.
   ══════════════════════════════════════════════════════════════════════════ */

function TapaLacre({
  abierta,
  abrir,
  crest,
}: {
  abierta: boolean;
  abrir: () => void;
  crest: string;
}) {
  return (
    <motion.button
      type="button"
      onClick={abrir}
      aria-label="Abrir la invitación"
      aria-hidden={abierta}
      tabIndex={abierta ? -1 : 0}
      initial="cerrada"
      animate={abierta ? "abierta" : "cerrada"}
      variants={{
        cerrada: { opacity: 1, y: 0 },
        abierta: {
          opacity: 0,
          y: 130,
          transition: { delay: 0.45, duration: 0.5, ease: "easeIn" },
        },
      }}
      className={`absolute inset-0 z-10 block overflow-hidden rounded-3xl [transform-style:preserve-3d] ${
        abierta ? "pointer-events-none" : ""
      }`}
    >
      <span
        aria-hidden
        className="absolute inset-0 rounded-3xl bg-[linear-gradient(155deg,#20083a_0%,#50108b_78%,#2b0a4d_100%)] shadow-[0_30px_70px_-20px_rgba(80,16,139,0.75)]"
      />
      {/* El bolsillo de abajo, que es lo que lo hace leer como un sobre. */}
      <span
        aria-hidden
        className="absolute inset-0 bg-white/[0.07]"
        style={{ clipPath: "polygon(0 100%, 50% 44%, 100% 100%)" }}
      />
      <span
        aria-hidden
        className="absolute inset-0 bg-black/20"
        style={{ clipPath: "polygon(0 0, 0 100%, 50% 50%)" }}
      />

      {/* La solapa: gira sobre su borde superior, hacia atrás. */}
      <motion.span
        aria-hidden
        variants={{
          cerrada: { rotateX: 0 },
          abierta: { rotateX: -172, transition: { duration: 0.65, ease: [0.4, 0, 0.2, 1] } },
        }}
        style={{ transformOrigin: "top center", transformStyle: "preserve-3d" }}
        className="absolute inset-x-0 top-0 h-[56%]"
      >
        {/* El fondo va en el hijo recortado y no en el `motion.span`: el padre
            es la bisagra —es lo que gira— y pintarlo también a él dibujaba el
            rectángulo entero por detrás del triángulo, que es justo lo que hace
            que un sobre no parezca un sobre. */}
        <span
          className="absolute inset-0 bg-[linear-gradient(180deg,#40106f,#22093e)]"
          style={{ clipPath: "polygon(0 0, 100% 0, 50% 100%)" }}
        />
      </motion.span>

      {/* El lacre, en dos capas: el `span` de afuera lo centra con `translate`
          de Tailwind y el `motion.span` de adentro gira y se achica. En un solo
          elemento, el `transform` que escribe Framer pisaría el centrado y el
          lacre se iría a la esquina justo en el cuadro en que se lo mira. */}
      <span
        aria-hidden
        className="absolute left-1/2 top-[52%] z-20 -translate-x-1/2 -translate-y-1/2"
      >
        <motion.span
          variants={{
            cerrada: { scale: 1, rotate: 0, opacity: 1 },
            abierta: { scale: 0, rotate: 150, opacity: 0, transition: { duration: 0.35 } },
          }}
          className="relative flex size-20 items-center justify-center rounded-full bg-[radial-gradient(circle_at_35%_30%,#b4368a,#7a0f4d_70%)] shadow-[0_8px_24px_rgba(0,0,0,0.45)]"
        >
          <span className="inv-anillo absolute inset-0 rounded-full border-2 border-white/60" />
          {/* eslint-disable-next-line @next/next/no-img-element -- SVG local */}
          <img src={crest} alt="" width={40} height={40} style={{ width: 40, height: 40 }} />
        </motion.span>
      </span>

      <Pista abierta={abierta} className="bottom-7">
        Tocá para abrir
      </Pista>
    </motion.button>
  );
}

/* ══════════════════════════════════════════════════════════════════════════
   CORTINA — dos hojas

   Se abren hacia los costados, cada una sobre su propia bisagra vertical, con
   el escudo partido al medio. Es la más rápida de las tres y la que mejor
   funciona cuando la tarjeta de abajo ya tiene mucho movimiento propio: no
   compite, corre el telón y se va.
   ══════════════════════════════════════════════════════════════════════════ */

function TapaCortina({
  abierta,
  abrir,
  crest,
}: {
  abierta: boolean;
  abrir: () => void;
  crest: string;
}) {
  /** Cada hoja gira hacia afuera sobre su borde exterior. `perspective` va en
   *  el contenedor y no en las hojas: puesta en cada una, las dos tendrían su
   *  propio punto de fuga y se abrirían como si fueran dos cortinas distintas
   *  mirando a cámaras distintas. */
  const hoja = (lado: "izq" | "der"): Variants => ({
    cerrada: { rotateY: 0 },
    abierta: {
      rotateY: lado === "izq" ? -105 : 105,
      // El tipo explícito no es adorno: sin él, TypeScript lee la curva como
      // `number[]` en vez de la tupla de cuatro que espera `ease`.
      transition: { duration: 0.75, ease: [0.65, 0, 0.35, 1] },
    },
  });

  return (
    <motion.button
      type="button"
      onClick={abrir}
      aria-label="Abrir la invitación"
      aria-hidden={abierta}
      tabIndex={abierta ? -1 : 0}
      initial="cerrada"
      animate={abierta ? "abierta" : "cerrada"}
      variants={{
        cerrada: { opacity: 1 },
        abierta: { opacity: 0, transition: { delay: 0.6, duration: 0.3 } },
      }}
      className={`absolute inset-0 z-10 block rounded-3xl [perspective:1200px] ${
        abierta ? "pointer-events-none" : ""
      }`}
    >
      {["izq", "der"].map((lado) => (
        <motion.span
          key={lado}
          aria-hidden
          variants={hoja(lado as "izq" | "der")}
          style={{ transformOrigin: lado === "izq" ? "left center" : "right center" }}
          className={`absolute inset-y-0 w-1/2 overflow-hidden bg-[linear-gradient(160deg,#2a0b4d,#50108b_65%,#1b0733)] ${
            lado === "izq"
              ? "left-0 rounded-l-3xl border-r border-white/10"
              : "right-0 rounded-r-3xl"
          }`}
        >
          {/* Los pliegues. Cuatro franjas verticales por hoja alcanzan para que
              lea como tela y no como dos rectángulos violetas. */}
          <span className="absolute inset-0 bg-[repeating-linear-gradient(90deg,rgba(255,255,255,0.07)_0px,rgba(255,255,255,0)_14px,rgba(0,0,0,0.16)_28px,rgba(255,255,255,0)_42px)]" />
        </motion.span>
      ))}

      {/* El escudo va **entre** las hojas y sale antes que ellas: si se fuera
          con la cortina parecería pegado a una de las dos mitades. */}
      <motion.span
        aria-hidden
        variants={{
          cerrada: { opacity: 1, scale: 1 },
          abierta: { opacity: 0, scale: 0.7, transition: { duration: 0.3 } },
        }}
        className="absolute left-1/2 top-1/2 z-10 -translate-x-1/2 -translate-y-1/2"
      >
        <span className="relative flex size-24 items-center justify-center rounded-full bg-black/35 backdrop-blur">
          <span className="inv-anillo absolute inset-0 rounded-full border border-white/50" />
          {/* eslint-disable-next-line @next/next/no-img-element -- SVG local */}
          <img src={crest} alt="" width={52} height={52} style={{ width: 52, height: 52 }} />
        </span>
      </motion.span>

      <Pista abierta={abierta} className="bottom-8">
        Tocá para abrir
      </Pista>
    </motion.button>
  );
}

/* ══════════════════════════════════════════════════════════════════════════
   RASPAR — la raspadita

   Una capa opaca que se borra donde pasa el dedo. Es la única de las tres que
   descubre la tarjeta **de a poco**, y por eso es la que más se disfruta en el
   teléfono: el gesto es el mismo de un raspadito de papel.

   Se dibuja en un canvas y no con máscaras de CSS por una razón concreta: hace
   falta *acumular* el recorrido —cada trazo se suma a los anteriores— y una
   `mask-image` habría que regenerarla entera en cada `pointermove`, sesenta
   veces por segundo, con un `radial-gradient` por punto tocado.

   A partir del 45 % raspado se abre sola. Nadie raspa un cupón hasta la última
   esquina: cuando ya se entiende qué hay abajo, seguir raspando es trabajo.
   ══════════════════════════════════════════════════════════════════════════ */

function TapaRaspar({ abierta, abrir }: { abierta: boolean; abrir: () => void }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const caja = useRef<HTMLDivElement>(null);
  const raspando = useRef(false);
  const ultimo = useRef<{ x: number; y: number } | null>(null);
  const listo = useRef(false);
  /** Cuántos `pointermove` van desde la última medición de cobertura. */
  const desdeMedicion = useRef(0);

  /** El contexto, creado una sola vez y con `willReadFrequently`.
   *
   *  La bandera sólo se aplica al **crear** el contexto: pedirla en un
   *  `getContext` posterior no hace nada, porque el canvas ya devuelve el que
   *  tenía. Sin ella, cada `getImageData` de la medición de cobertura baja la
   *  textura desde la GPU y Chrome avisa por consola en cada raspado. */
  const contexto = useCallback(() => {
    const cv = canvas.current;
    return cv ? cv.getContext("2d", { willReadFrequently: true }) : null;
  }, []);

  /** Pinta la capa y la vuelve a pintar cuando cambia el tamaño.
   *
   *  El canvas trabaja en píxeles de dispositivo (`dpr`) y no en CSS: en un
   *  teléfono a 3× el pincel de 28 px se vería como un raspón de 9 px de ancho,
   *  que es imposible de usar. */
  const pintar = useCallback(() => {
    const cv = canvas.current;
    const box = caja.current;
    if (!cv || !box) return;

    const { width, height } = box.getBoundingClientRect();
    if (!width || !height) return;

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    cv.width = Math.round(width * dpr);
    cv.height = Math.round(height * dpr);

    const ctx = contexto();
    if (!ctx) return;
    // El canvas se limpia solo al cambiarle `width`/`height`, pero la matriz de
    // transformación **no** se resetea: sin esto, cada repintado escalaría
    // sobre el escalado anterior.
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.scale(dpr, dpr);

    const g = ctx.createLinearGradient(0, 0, width, height);
    g.addColorStop(0, "#3b1063");
    g.addColorStop(0.55, "#6b2bb0");
    g.addColorStop(1, "#2a0b4d");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, width, height);

    // El granulado: lo que hace que la capa se lea como la película de un
    // raspadito y no como un rectángulo pintado. Determinista no hace falta —
    // esto se dibuja sólo en el cliente, después de hidratar.
    for (let i = 0; i < Math.round((width * height) / 260); i++) {
      ctx.fillStyle = `rgba(255,255,255,${0.02 + Math.random() * 0.05})`;
      ctx.fillRect(Math.random() * width, Math.random() * height, 2, 2);
    }

    listo.current = true;
  }, [contexto]);

  useEffect(() => {
    pintar();
    const box = caja.current;
    if (!box || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(() => {
      // Sólo mientras no se raspó nada: repintar a mitad de camino le
      // devolvería la capa a alguien que la estaba sacando.
      if (!raspando.current && !listo.current) pintar();
    });
    ro.observe(box);
    return () => ro.disconnect();
  }, [pintar]);

  /** Cuánto se raspó, muestreando una grilla en vez de leer píxel por píxel.
   *  Un canvas de 400×600 a 2× son 1,9 M de píxeles: leerlos enteros en cada
   *  trazo es medio segundo de bloqueo del hilo principal. Una grilla de 32×32
   *  da el mismo número con mil lecturas. */
  const raspado = useCallback(() => {
    const cv = canvas.current;
    const ctx = contexto();
    if (!cv || !ctx) return 0;

    // Una sola lectura del canvas entero y después la grilla sobre el buffer,
    // en vez de un `getImageData` de 1×1 por punto: mil llamadas al canvas por
    // medición eran mil sincronizaciones, y es exactamente lo que hacía falta
    // evitar mientras el dedo se mueve.
    const datos = ctx.getImageData(0, 0, cv.width, cv.height).data;
    const paso = 32;
    let libres = 0;
    let total = 0;
    for (let y = 0; y < cv.height; y += paso) {
      for (let x = 0; x < cv.width; x += paso) {
        total++;
        if (datos[(y * cv.width + x) * 4 + 3] === 0) libres++;
      }
    }
    return total ? libres / total : 0;
  }, [contexto]);

  const borrar = useCallback(
    (x: number, y: number) => {
    const ctx = contexto();
    if (!ctx) return;
    // `destination-out` borra en vez de pintar: es lo que descubre la tarjeta.
    ctx.globalCompositeOperation = "destination-out";
    ctx.lineWidth = 56;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";

    const desde = ultimo.current;
    ctx.beginPath();
    if (desde) {
      // Una línea entre el punto anterior y el actual, no un círculo suelto:
      // un dedo rápido genera puntos separados por 80 px y sin unirlos el
      // raspado sale punteado.
      ctx.moveTo(desde.x, desde.y);
      ctx.lineTo(x, y);
      ctx.stroke();
    }
    ctx.arc(x, y, 28, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalCompositeOperation = "source-over";
    ultimo.current = { x, y };
    },
    [contexto],
  );

  const alMover = useCallback(
    (e: ReactPointerEvent<HTMLDivElement>) => {
      if (!raspando.current || abierta) return;
      const r = caja.current?.getBoundingClientRect();
      if (!r) return;
      borrar(e.clientX - r.left, e.clientY - r.top);

      // Medir la cobertura en cada `pointermove` es leer el canvas entero
      // sesenta veces por segundo. Cada seis alcanza: el umbral es del 45 %, y
      // cinco trazos de más no lo cruzan de golpe.
      desdeMedicion.current += 1;
      if (desdeMedicion.current < 6) return;
      desdeMedicion.current = 0;
      if (raspado() > 0.45) abrir();
    },
    [abierta, abrir, borrar, raspado],
  );

  const alBajar = useCallback((e: ReactPointerEvent<HTMLDivElement>) => {
    raspando.current = true;
    ultimo.current = null;
    // Captura del puntero: sin esto, arrastrar más allá del borde de la tarjeta
    // corta el raspado a mitad de trazo. En `try` porque tira `NotFoundError`
    // si el `pointerId` ya no está activo —pasa con eventos sintéticos y con
    // un dedo que se levantó entre el `down` y este cuadro— y perder la
    // captura no es motivo para perder el raspado.
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      /* se raspa igual, sólo que soltando fuera del borde se corta */
    }
  }, []);

  const alSoltar = useCallback(() => {
    raspando.current = false;
    ultimo.current = null;
  }, []);

  return (
    <motion.div
      ref={caja}
      onPointerDown={alBajar}
      onPointerMove={alMover}
      onPointerUp={alSoltar}
      onPointerCancel={alSoltar}
      aria-hidden={abierta}
      initial={false}
      animate={abierta ? { opacity: 0, scale: 1.04 } : { opacity: 1, scale: 1 }}
      transition={{ duration: 0.55, ease: "easeOut" }}
      className={`absolute inset-0 z-10 overflow-hidden rounded-3xl ${
        abierta ? "pointer-events-none" : "cursor-grab touch-none active:cursor-grabbing"
      }`}
    >
      <canvas ref={canvas} className="block size-full" />

      {/* El botón de escape del gesto. La raspadita es la única tapa que no se
          abre con un toque, y sin esto no hay forma de destaparla con teclado
          ni con lector de pantalla — habría que esperar los nueve segundos. */}
      <button
        type="button"
        onClick={abrir}
        tabIndex={abierta ? -1 : 0}
        className="absolute inset-x-0 bottom-7 mx-auto block w-max rounded-full px-4 py-1.5 text-xs font-semibold uppercase tracking-[0.25em] text-white/80"
      >
        <span className="inv-late inline-block">Raspá para descubrir</span>
      </button>
    </motion.div>
  );
}

/* ── la pista de abajo ───────────────────────────────────────────────────── */

/** "Tocá para abrir". El rebote va en un `span` de adentro porque `.inv-late`
 *  anima `transform` y el `motion.span` de afuera ya anima `opacity`: una
 *  animación CSS le gana al `style` inline y dejaría el `variants` sin efecto. */
function Pista({
  abierta,
  className,
  children,
}: {
  abierta: boolean;
  className: string;
  children: ReactNode;
}) {
  return (
    <motion.span
      variants={{
        cerrada: { opacity: 1 },
        abierta: { opacity: 0, transition: { duration: 0.2 } },
      }}
      aria-hidden={abierta}
      className={`absolute inset-x-0 z-20 text-center ${className}`}
    >
      <span className="inv-late inline-block text-xs font-semibold uppercase tracking-[0.25em] text-white/75">
        {children}
      </span>
    </motion.span>
  );
}

/* ── la que elige ────────────────────────────────────────────────────────── */

export function InvitationRevelacion({
  tipo,
  children,
  crest,
  seed,
  quieto,
  onAbierta,
}: RevelacionProps) {
  const { abierta, abrir } = useTapa(quieto, tipo, onAbierta);

  // La tarjeta se atenúa mientras está tapada en lacre y cortina —que la
  // cubren del todo— pero **no** en la raspadita, donde lo que se descubre
  // tiene que verse tal cual a medida que se raspa.
  const tapadaDelTodo = !abierta && (tipo === "lacre" || tipo === "cortina");

  const tapa = useMemo(() => {
    if (quieto || tipo === "directa") return null;
    if (tipo === "lacre") return <TapaLacre abierta={abierta} abrir={abrir} crest={crest} />;
    if (tipo === "cortina")
      return <TapaCortina abierta={abierta} abrir={abrir} crest={crest} />;
    return <TapaRaspar abierta={abierta} abrir={abrir} />;
  }, [tipo, abierta, abrir, crest, quieto]);

  if (!tapa) return <>{children}</>;

  return (
    <div className="relative [perspective:1600px]">
      <motion.div
        initial={false}
        animate={
          tapadaDelTodo
            ? { opacity: 0, scale: 0.9, y: 40 }
            : { opacity: 1, scale: 1, y: 0 }
        }
        transition={
          tapadaDelTodo
            ? { duration: 0 }
            : { type: "spring", stiffness: 110, damping: 15, mass: 0.9, delay: 0.42 }
        }
        className={tapadaDelTodo ? "pointer-events-none" : ""}
      >
        {children}
      </motion.div>

      {tapa}
      {abierta && <Papelitos seed={seed} />}
    </div>
  );
}
