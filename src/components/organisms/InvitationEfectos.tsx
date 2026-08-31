"use client";

import {
  motion,
  useMotionTemplate,
  useMotionValue,
  useSpring,
  useTransform,
} from "framer-motion";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react";

import { SparkleIcon } from "@/components/atoms/icons";
import type { EfectoInvitacion } from "@/lib/contenido/types";

/** Los tres efectos de movimiento de la tarjeta de invitación.
 *
 *  Cada uno envuelve a `InvitationCard` sin tocarla: la tarjeta sigue siendo la
 *  misma función de sus props, sin estado y sin `"use client"`, y por eso la
 *  ruta pública y la vista previa del panel siguen viendo lo mismo. Todo lo que
 *  se mueve vive acá afuera.
 *
 *  Acá está el movimiento **de la tarjeta ya destapada**. Lo que la tapa —el
 *  sobre lacrado, la cortina, la raspadita— vive en `InvitationRevelacion`, que
 *  es una decisión aparte y combina con cualquiera de estos tres.
 *
 *  Los tres comparten tres reglas:
 *
 *  1 · **Andan igual con dedo y con mouse.** No hay un efecto "de escritorio":
 *      la invitación se abre desde un link de WhatsApp y la enorme mayoría la
 *      va a ver en un teléfono. Donde hay hover hay hover, y donde no, hay
 *      arrastre, tap o giroscopio — nunca una tarjeta quieta.
 *  2 · **`quieto` los apaga.** Es `prefers-reduced-motion` resuelto una vez en
 *      `InvitationStage` y bajado por prop. Apagados no dejan la pantalla a
 *      medias: la aurora deja de derivar, la holográfica se planta derecha y el
 *      flote se queda quieto. La invitación se lee entera en los tres.
 *  3 · **Las partículas salen de una semilla.** El `code` de la invitación
 *      alimenta un PRNG determinista: `Math.random()` acá daría posiciones
 *      distintas en el servidor y en el cliente, y React tiraría el árbol
 *      entero por hidratación en la única pantalla que tiene que abrir rápido.
 */

export interface EfectoProps {
  children: ReactNode;
  /** el `code` de la invitación: siembra las partículas */
  seed: string;
  /** `prefers-reduced-motion`, resuelto arriba */
  quieto: boolean;
  /** Hay una tapa encima (`revelacion` distinta de `directa`).
   *
   *  Cambia una sola cosa, y por eso es un booleano y no el tipo de tapa: con
   *  portada el efecto **no hace su entrada**. Nadie la vería —está tapada— y
   *  para cuando la tapa sale, la animación ya terminó: la tarjeta aparecería
   *  de golpe, ya quieta, en el único momento en que se la está mirando. Con
   *  portada, la entrada la hace la tapa al retirarse; el efecto sólo pone su
   *  movimiento de fondo, que sí corre desde el principio. */
  conPortada: boolean;
  /** Se llama cuando la tarjeta terminó de aparecer y ya se puede leer. Sólo
   *  lo usa `InvitationStage` cuando no hay tapa: con tapa, quien avisa es
   *  ella, que sabe cuándo la sacaron. */
  onRevelado: () => void;
}

/** El aviso de "ya se ve", con el retardo de cada efecto.
 *
 *  Es un temporizador y no el `onAnimationComplete` de Framer a propósito: esa
 *  callback no dispara cuando la animación no corre —con `prefers-reduced-motion`,
 *  o en el sobre, que monta con `initial={false}`— y ahí los botones no
 *  aparecerían nunca. Un techo de tiempo siempre termina.
 */
function useRevelar(onRevelado: () => void, listo: boolean, demoraMs: number) {
  useEffect(() => {
    if (!listo) return;
    const t = setTimeout(onRevelado, demoraMs);
    return () => clearTimeout(t);
  }, [onRevelado, listo, demoraMs]);
}

/* ── utilidades ──────────────────────────────────────────────────────────── */

const acotar = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);

/** Un `Math.random()` determinista por semilla (FNV-1a + mulberry32). */
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

const RESORTE = { stiffness: 150, damping: 20, mass: 0.7 } as const;

/* ══════════════════════════════════════════════════════════════════════════
   HOLOGRÁFICA

   La tarjeta se inclina en 3D y un brillo la recorre siguiendo de dónde viene
   la luz. Tiene tres fuentes de entrada y **se turnan**, no se suman:

     giro    · el giroscopio del teléfono, si hay permiso
     puntero · el mouse encima, o el dedo arrastrando
     idle    · una oscilación lenta cuando no hay ninguna de las dos

   El idle no es relleno. Sin él, alguien que abre el link en la compu y no
   pasa el mouse por arriba ve una tarjeta quieta y no se entera de que se
   mueve: el efecto tiene que anunciarse solo.
   ══════════════════════════════════════════════════════════════════════════ */

/** iOS pide permiso explícito para el giroscopio, y sólo desde un gesto del
 *  usuario. El resto de los navegadores no tiene `requestPermission`. */
type OrientacionConPermiso = typeof DeviceOrientationEvent & {
  requestPermission?: () => Promise<"granted" | "denied">;
};

/** Nada a lo que suscribirse: el soporte de giroscopio de un dispositivo no
 *  cambia mientras la invitación está abierta. */
const sinSuscripcion = () => () => {};

/** Qué se puede hacer con el giroscopio acá. No es estado —no cambia nunca—
 *  sino una lectura del entorno, y por eso va por `useSyncExternalStore` y no
 *  por un `useState` que un efecto corrige después de montar: el servidor
 *  responde "no" y el cliente responde lo que sea, sin un render intermedio
 *  con el valor equivocado.
 *
 *  En escritorio devuelve "no" aunque `DeviceOrientationEvent` exista: el
 *  evento está declarado pero no dispara nunca, y sin el filtro de puntero
 *  grueso el chip de permiso quedaría para siempre en pantalla sin hacer nada.
 */
function useSoporteGiro(): "no" | "pide" | "directo" {
  return useSyncExternalStore(
    sinSuscripcion,
    () => {
      if (!("DeviceOrientationEvent" in window)) return "no" as const;
      if (!window.matchMedia("(pointer: coarse)").matches) return "no" as const;
      const clase = window.DeviceOrientationEvent as OrientacionConPermiso;
      return typeof clase.requestPermission === "function"
        ? ("pide" as const)
        : ("directo" as const);
    },
    () => "no" as const,
  );
}

function EfectoHolo({ children, seed, quieto, conPortada, onRevelado }: EfectoProps) {
  const caja = useRef<HTMLDivElement>(null);

  // 0..1 dentro de la tarjeta; el resorte es lo que hace que la inclinación
  // persiga al dedo en vez de saltar con él.
  const px = useMotionValue(0.5);
  const py = useMotionValue(0.5);
  const sx = useSpring(px, RESORTE);
  const sy = useSpring(py, RESORTE);

  const rotateY = useTransform(sx, [0, 1], [-16, 16]);
  const rotateX = useTransform(sy, [0, 1], [13, -13]);

  const luzX = useTransform(sx, [0, 1], ["8%", "92%"]);
  const luzY = useTransform(sy, [0, 1], ["8%", "92%"]);
  const luz = useMotionTemplate`radial-gradient(42% 46% at ${luzX} ${luzY}, rgba(255,255,255,0.55), rgba(255,255,255,0) 68%)`;

  const tornasolX = useTransform(sx, [0, 1], ["8%", "92%"]);
  const tornasolPos = useMotionTemplate`${tornasolX} 50%`;

  const [fuente, setFuente] = useState<"idle" | "puntero" | "giro">("idle");

  const soporteGiro = useSoporteGiro();
  // Lo único que sí es estado del giroscopio: si la persona ya dijo que sí.
  const [permisoDado, setPermisoDado] = useState(false);
  const giroActivo =
    !quieto && (soporteGiro === "directo" || (soporteGiro === "pide" && permisoDado));

  /* La oscilación de reposo, sólo mientras nadie toca nada. */
  useEffect(() => {
    if (quieto || fuente !== "idle") return;
    let raf = 0;
    const t0 = performance.now();
    const paso = (t: number) => {
      const s = (t - t0) / 1000;
      px.set(0.5 + Math.sin(s * 0.62) * 0.34);
      py.set(0.5 + Math.sin(s * 0.41 + 1.2) * 0.28);
      raf = requestAnimationFrame(paso);
    };
    raf = requestAnimationFrame(paso);
    return () => cancelAnimationFrame(raf);
  }, [quieto, fuente, px, py]);

  useEffect(() => {
    if (!giroActivo) return;

    const alGirar = (e: DeviceOrientationEvent) => {
      if (e.gamma == null || e.beta == null) return;
      // `setFuente` con el mismo valor no re-renderiza: React corta ahí. Sin
      // eso serían sesenta renders por segundo del árbol entero.
      setFuente((f) => (f === "giro" ? f : "giro"));
      // gamma −30..30 es la inclinación lateral cómoda; beta se centra en 50°,
      // que es cómo se sostiene un teléfono mirándolo, no en 0 (acostado).
      px.set(acotar(0.5 + e.gamma / 60));
      py.set(acotar(0.5 + (e.beta - 50) / 60));
    };

    window.addEventListener("deviceorientation", alGirar);
    return () => window.removeEventListener("deviceorientation", alGirar);
  }, [giroActivo, px, py]);

  const pedirGiro = useCallback(async () => {
    const clase = window.DeviceOrientationEvent as OrientacionConPermiso;
    try {
      setPermisoDado((await clase.requestPermission?.()) === "granted");
    } catch {
      setPermisoDado(false);
    }
  }, []);

  const alMover = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      const r = caja.current?.getBoundingClientRect();
      if (!r || quieto) return;
      setFuente((f) => (f === "puntero" ? f : "puntero"));
      px.set(acotar((e.clientX - r.left) / r.width));
      py.set(acotar((e.clientY - r.top) / r.height));
    },
    [px, py, quieto],
  );

  const alSalir = useCallback(() => {
    // Vuelve al reposo, no al centro: plantarla derecha al sacar el mouse
    // corta el movimiento de golpe y se siente un bug, no un final.
    setFuente((f) => (f === "puntero" ? "idle" : f));
  }, []);

  const destellos = useMemo(() => {
    const r = prng(`${seed}-holo`);
    return Array.from({ length: 7 }, (_, i) => ({
      id: i,
      left: `${8 + r() * 84}%`,
      top: `${6 + r() * 88}%`,
      lado: 3 + r() * 4,
      demora: r() * 4,
      z: 50 + r() * 60,
    }));
  }, [seed]);

  // 800 ms: los 700 de la entrada más un respiro. Con tapa no hay entrada y el
  // aviso lo da ella, así que acá no se llama. Los hooks van antes del corte
  // por `quieto` —React no admite hooks condicionales— y por eso lo que se
  // apaga es el retardo, no la llamada.
  useRevelar(onRevelado, !conPortada, quieto ? 0 : 800);

  if (quieto) return <div className="relative">{children}</div>;

  return (
    <div ref={caja} className="relative [perspective:1400px]">
      <motion.div
        initial={conPortada ? false : { opacity: 0, y: 28, scale: 0.93 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
      >
        <motion.div
          onPointerMove={alMover}
          onPointerLeave={alSalir}
          onPointerCancel={alSalir}
          style={{ rotateX, rotateY, transformStyle: "preserve-3d" }}
          className="relative touch-pan-y"
        >
          {/* El halo de atrás, hundido en Z: es lo que le da volumen a la
              inclinación. Sin algo detrás del plano de la tarjeta, rotar en 3D
              se ve igual que un `skew`. */}
          <span
            aria-hidden
            className="pointer-events-none absolute -inset-5 rounded-[2.25rem] bg-primary/45 blur-3xl"
            style={{ transform: "translateZ(-70px)" }}
          />

          <div className="relative overflow-hidden rounded-3xl">
            {children}

            {/* El reflejo especular: la luz que se mueve con la tarjeta. */}
            <motion.span
              aria-hidden
              className="pointer-events-none absolute inset-0 mix-blend-overlay"
              style={{ backgroundImage: luz }}
            />

            {/* El tornasol. `color-dodge` sobre los fondos oscuros de gala y
                cancha da el arcoíris metálico; sobre el fondo claro de mínima
                casi no se ve, que es lo correcto: una tarjeta sobria no tiene
                por qué volverse una calcomanía. */}
            <motion.span
              aria-hidden
              className="pointer-events-none absolute inset-0 opacity-30 mix-blend-color-dodge"
              style={{
                // La banda es angosta y tenue a propósito. `color-dodge` sube
                // muy rápido: con una franja ancha, el rojo y el azul dejan de
                // ser un reflejo y se vuelven el color de la tarjeta — la foto
                // del estadio de la plantilla cancha desaparecía debajo.
                backgroundImage:
                  "linear-gradient(115deg, transparent 30%, rgba(255,0,170,0.34) 42%, rgba(0,225,255,0.34) 52%, rgba(160,255,120,0.26) 60%, transparent 72%)",
                backgroundSize: "220% 220%",
                backgroundPosition: tornasolPos,
              }}
            />

            {/* El barrido que se dispara solo cada seis segundos: el aviso de
                "esto se mueve" para quien la abre y se queda quieto. */}
            <span aria-hidden className="inv-barrido" />
          </div>

          {/* Motas de polvo flotando por delante del plano. */}
          {destellos.map((d) => (
            <span
              key={d.id}
              aria-hidden
              className="inv-mota pointer-events-none absolute rounded-full bg-white"
              style={
                {
                  left: d.left,
                  top: d.top,
                  width: d.lado,
                  height: d.lado,
                  animationDelay: `${d.demora}s`,
                  // La Z va por variable y no por `transform`: el @keyframes de
                  // `.inv-mota` anima `transform` y le gana al inline.
                  "--inv-tz": `${d.z}px`,
                } as React.CSSProperties
              }
            />
          ))}
        </motion.div>
      </motion.div>

      {soporteGiro === "pide" && !permisoDado && (
        <motion.button
          type="button"
          onClick={pedirGiro}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 1.2 }}
          className="mx-auto mt-3 flex items-center gap-1.5 rounded-full border border-white/25 bg-black/40 px-3 py-1.5 text-xs font-medium text-white backdrop-blur"
        >
          <SparkleIcon width={14} height={14} />
          Moverla con el teléfono
        </motion.button>
      )}
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════════════
   FLOTE

   Sólo respira. Ni inclinación, ni luces, ni partículas: la tarjeta sube y baja
   nueve píxeles cada cinco segundos y medio, sobre un halo tenue que la separa
   del fondo.

   Es el tercero a propósito, y no un cuarto efecto llamativo. Los otros dos
   compiten con la revelación —una tarjeta que además se inclina o irradia luz
   le roba el momento a la cortina que se acaba de abrir— y hacía falta uno que
   se corriera del medio. También es el que corresponde cuando la plantilla ya
   trae mucho: la foto del estadio de `cancha` no necesita ayuda.
   ══════════════════════════════════════════════════════════════════════════ */

function EfectoFlote({ children, quieto, conPortada, onRevelado }: EfectoProps) {
  useRevelar(onRevelado, !conPortada, quieto ? 0 : 700);

  if (quieto) return <div className="relative">{children}</div>;

  return (
    <motion.div
      initial={conPortada ? false : { opacity: 0, y: 24, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
      className="relative"
    >
      {/* El halo. Es todo lo que este efecto agrega de suyo, y está por una
          razón y no de adorno: sobre el fondo casi negro de la pantalla, una
          tarjeta oscura sin nada detrás no tiene borde y se lee como un agujero
          en vez de como un objeto apoyado. */}
      <span
        aria-hidden
        className="pointer-events-none absolute -inset-4 rounded-[2.25rem] bg-primary/25 blur-2xl"
      />
      <div className="inv-flota relative overflow-hidden rounded-3xl">{children}</div>
    </motion.div>
  );
}

/* ══════════════════════════════════════════════════════════════════════════
   AURORA

   Tres manchas de luz derivando detrás de la tarjeta, chispas que suben y un
   telón que la descubre de arriba hacia abajo.

   Las manchas van en CSS y no en Framer: son tres bucles infinitos de veinte
   segundos que nadie mira de frente, y el compositor los corre sin tocar el
   hilo principal. Framer queda para lo que sí necesita orquestación —la
   entrada— y para el paralaje, que depende del puntero.
   ══════════════════════════════════════════════════════════════════════════ */

function EfectoAurora({ children, seed, quieto, conPortada, onRevelado }: EfectoProps) {
  const caja = useRef<HTMLDivElement>(null);
  const mx = useMotionValue(0);
  const my = useMotionValue(0);
  const sx = useSpring(mx, { stiffness: 55, damping: 18, mass: 0.9 });
  const sy = useSpring(my, { stiffness: 55, damping: 18, mass: 0.9 });

  // 1,15 s: el telón tarda 1,05 en descubrirla entera. Con tapa no corre.
  useRevelar(onRevelado, !conPortada, quieto ? 0 : 1150);

  const chispas = useMemo(() => {
    const r = prng(`${seed}-aurora`);
    return Array.from({ length: 18 }, (_, i) => ({
      id: i,
      left: `${r() * 100}%`,
      lado: 2 + r() * 4,
      dur: 9 + r() * 9,
      demora: -r() * 14,
      opac: 0.25 + r() * 0.5,
    }));
  }, [seed]);

  const alMover = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      const r = caja.current?.getBoundingClientRect();
      if (!r || quieto) return;
      // Las luces se corren **al revés** que el puntero y poco: es fondo, y un
      // fondo que persigue al dedo compite con la tarjeta en vez de sostenerla.
      mx.set(-((e.clientX - r.left) / r.width - 0.5) * 44);
      my.set(-((e.clientY - r.top) / r.height - 0.5) * 30);
    },
    [mx, my, quieto],
  );

  return (
    <div ref={caja} className="relative isolate" onPointerMove={alMover}>
      {!quieto && (
        <motion.div
          aria-hidden
          style={{
            x: sx,
            y: sy,
            // El `overflow-hidden` es necesario —las chispas suben 720px y sin
            // recorte estirarían la página—, pero recortar un rectángulo deja
            // sus cuatro bordes a la vista: la aurora se veía como una caja de
            // luz apoyada sobre el fondo. La máscara devuelve el recorte al
            // centro y desvanece los bordes, que es lo que hace que las luces
            // parezcan estar detrás de la tarjeta y no dentro de un marco.
            maskImage: "radial-gradient(62% 58% at 50% 46%, #000 38%, transparent 100%)",
            WebkitMaskImage: "radial-gradient(62% 58% at 50% 46%, #000 38%, transparent 100%)",
          }}
          className="pointer-events-none absolute -inset-24 -z-10 overflow-hidden"
        >
          <span className="inv-aurora inv-aurora-1" />
          <span className="inv-aurora inv-aurora-2" />
          <span className="inv-aurora inv-aurora-3" />
          {chispas.map((c) => (
            <span
              key={c.id}
              className="inv-chispa"
              style={{
                left: c.left,
                width: c.lado,
                height: c.lado,
                opacity: c.opac,
                animationDuration: `${c.dur}s`,
                animationDelay: `${c.demora}s`,
              }}
            />
          ))}
        </motion.div>
      )}

      <motion.div
        initial={
          quieto || conPortada
            ? false
            : { opacity: 0, y: 30, scale: 0.95, filter: "blur(16px)", clipPath: "inset(0 0 100% 0)" }
        }
        animate={{ opacity: 1, y: 0, scale: 1, filter: "blur(0px)", clipPath: "inset(0 0 0% 0)" }}
        transition={{ duration: 1.05, ease: [0.16, 1, 0.3, 1] }}
        className="relative"
      >
        <div className={quieto ? "" : "inv-flota-lento"}>
          <div className="relative overflow-hidden rounded-3xl">
            {children}
            {!quieto && <span aria-hidden className="inv-barrido" />}
          </div>
        </div>
      </motion.div>
    </div>
  );
}

/* ── el que elige ────────────────────────────────────────────────────────── */

const EFECTOS: Record<EfectoInvitacion, (p: EfectoProps) => ReactNode> = {
  holo: EfectoHolo,
  aurora: EfectoAurora,
  flote: EfectoFlote,
};

/** Monta el efecto elegido alrededor de la tarjeta.
 *
 *  El `?? EfectoFlote` no es paranoia de tipos: la fila puede venir de una base
 *  sembrada antes de que existiera `efecto`, o guardar el `"sobre"` viejo —que
 *  dejó de ser un efecto para convertirse en la revelación `lacre`—, y en la
 *  ruta pública quedarse sin componente es una pantalla en blanco donde tenía
 *  que haber una invitación. El de respaldo es el sobrio: si no sabemos qué
 *  pidieron, lo mínimo es lo correcto.
 */
export function EfectoTarjeta({
  efecto,
  ...props
}: EfectoProps & { efecto: EfectoInvitacion }) {
  const Elegido = EFECTOS[efecto] ?? EfectoFlote;
  return <Elegido {...props} />;
}
