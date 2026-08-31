"use client";

import {
  motion,
  useMotionTemplate,
  useMotionValue,
  useSpring,
  useTransform,
} from "framer-motion";
import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";

import { SparkleIcon } from "@/components/atoms/icons";
import { PALETAS, type CartaVM, type EstiloCarta } from "@/lib/carta/carta";

/** La carta de jugador, animada.
 *
 *  Es el mismo movimiento del efecto holográfico de las invitaciones
 *  (`InvitationEfectos.tsx`) y por la misma razón: una carta coleccionable
 *  quieta se ve como una imagen, y lo que la hace parecer una carta es que la
 *  luz se le mueva por encima. Las tres fuentes de entrada **se turnan**, no se
 *  suman:
 *
 *    giro    · el giroscopio del teléfono, si hay permiso (iOS lo pide)
 *    puntero · el mouse encima, o el dedo arrastrando
 *    idle    · una oscilación lenta cuando no hay ninguna de las dos
 *
 *  El idle no es relleno: sin él, quien la abre en la compu y no pasa el mouse
 *  por arriba ve una carta quieta y no se entera de que se mueve.
 *
 *  No reusa `EfectoTarjeta` de las invitaciones porque ese componente sólo se
 *  exporta como despachador sobre `EfectoInvitacion` —el tipo del contenido
 *  editorial— y arrastra la revelación, el sobre y los papelitos. Lo que sí se
 *  reusa son las clases de `globals.css` (`inv-barrido`, `inv-mota`), que ya
 *  traen sus `@keyframes` y su respaldo de `prefers-reduced-motion`.
 *
 *  `quieto` llega resuelto de arriba (`usePrefersReducedMotion`), igual que en
 *  las invitaciones: apagado, la carta se planta derecha y se lee entera.
 */

const RESORTE = { stiffness: 150, damping: 20, mass: 0.7 } as const;

const acotar = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);

/** FNV-1a + mulberry32, el mismo PRNG determinista del resto del proyecto:
 *  `Math.random()` acá daría motas en distinta posición en el servidor y en el
 *  cliente, y React tiraría el árbol por hidratación. */
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

/** iOS pide permiso explícito para el giroscopio, y sólo desde un gesto. */
type OrientacionConPermiso = typeof DeviceOrientationEvent & {
  requestPermission?: () => Promise<"granted" | "denied">;
};

const sinSuscripcion = () => () => {};

/** Qué se puede hacer con el giroscopio acá. No es estado —el soporte no cambia
 *  mientras la carta está abierta— sino una lectura del entorno, y por eso va
 *  por `useSyncExternalStore`: el servidor contesta "no" y el cliente contesta
 *  lo que sea, sin un render intermedio con el valor equivocado. En escritorio
 *  devuelve "no" aunque la clase exista: el evento está declarado pero no
 *  dispara nunca, y el chip de permiso quedaría en pantalla sin hacer nada. */
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

export function PlayerCard({
  carta,
  estilo,
  quieto,
}: {
  carta: CartaVM;
  estilo: EstiloCarta;
  quieto: boolean;
}) {
  const caja = useRef<HTMLDivElement>(null);
  const p = PALETAS[estilo];

  // 0..1 dentro de la carta; el resorte es lo que hace que la inclinación
  // persiga al dedo en vez de saltar con él.
  const px = useMotionValue(0.5);
  const py = useMotionValue(0.5);
  const sx = useSpring(px, RESORTE);
  const sy = useSpring(py, RESORTE);

  const rotateY = useTransform(sx, [0, 1], [-15, 15]);
  const rotateX = useTransform(sy, [0, 1], [12, -12]);

  const luzX = useTransform(sx, [0, 1], ["8%", "92%"]);
  const luzY = useTransform(sy, [0, 1], ["8%", "92%"]);
  const luz = useMotionTemplate`radial-gradient(40% 44% at ${luzX} ${luzY}, rgba(255,255,255,0.5), rgba(255,255,255,0) 68%)`;

  const tornasolX = useTransform(sx, [0, 1], ["8%", "92%"]);
  const tornasolPos = useMotionTemplate`${tornasolX} 50%`;

  const [fuente, setFuente] = useState<"idle" | "puntero" | "giro">("idle");
  const soporteGiro = useSoporteGiro();
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
      px.set(0.5 + Math.sin(s * 0.6) * 0.32);
      py.set(0.5 + Math.sin(s * 0.4 + 1.2) * 0.26);
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

  // Vuelve al reposo, no al centro: plantarla derecha al sacar el mouse corta
  // el movimiento de golpe y se siente un bug, no un final.
  const alSalir = useCallback(() => {
    setFuente((f) => (f === "puntero" ? "idle" : f));
  }, []);

  const motas = useMemo(() => {
    const r = prng(`${carta.handle}-carta`);
    return Array.from({ length: 8 }, (_, i) => ({
      id: i,
      left: `${8 + r() * 84}%`,
      top: `${6 + r() * 88}%`,
      lado: 3 + r() * 4,
      demora: r() * 4,
      z: 50 + r() * 60,
    }));
  }, [carta.handle]);

  const cara = <CaraCarta carta={carta} estilo={estilo} />;

  if (quieto) {
    return (
      <div className="relative mx-auto w-full max-w-[19rem]">
        <div className="overflow-hidden rounded-[1.75rem]">{cara}</div>
      </div>
    );
  }

  return (
    <div ref={caja} className="relative mx-auto w-full max-w-[19rem] [perspective:1200px]">
      <motion.div
        // `key` en el estilo: cambiar de carta la vuelve a presentar en vez de
        // mutar los colores en el lugar. Es un objeto distinto, no el mismo
        // repintado, y la entrada corta lo dice sin explicarlo.
        key={estilo}
        initial={{ opacity: 0, y: 22, scale: 0.94, rotateY: -12 }}
        animate={{ opacity: 1, y: 0, scale: 1, rotateY: 0 }}
        transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
      >
        <motion.div
          onPointerMove={alMover}
          onPointerLeave={alSalir}
          onPointerCancel={alSalir}
          style={{ rotateX, rotateY, transformStyle: "preserve-3d" }}
          className="relative touch-pan-y"
        >
          {/* El halo de atrás, hundido en Z: es lo que le da volumen a la
              inclinación. Sin algo detrás del plano de la carta, rotar en 3D se
              ve igual que un `skew`. */}
          <span
            aria-hidden
            className="pointer-events-none absolute -inset-5 rounded-[2.25rem] blur-3xl"
            style={{ background: p.halo, transform: "translateZ(-70px)" }}
          />

          <div className="relative overflow-hidden rounded-[1.75rem]">
            {cara}

            {/* El reflejo especular: la luz que se mueve con la carta. */}
            <motion.span
              aria-hidden
              className="pointer-events-none absolute inset-0 mix-blend-overlay"
              style={{ backgroundImage: luz }}
            />

            {/* El tornasol. `color-dodge` sube muy rápido, así que la banda es
                angosta; sobre el dorado va todavía más tenue (`p.tornasol`) o
                la carta deja de ser dorada y se vuelve una calcomanía. */}
            <motion.span
              aria-hidden
              className="pointer-events-none absolute inset-0 mix-blend-color-dodge"
              style={{
                opacity: p.tornasol,
                backgroundImage:
                  "linear-gradient(115deg, transparent 30%, rgba(255,0,170,0.34) 42%, rgba(0,225,255,0.34) 52%, rgba(160,255,120,0.26) 60%, transparent 72%)",
                backgroundSize: "220% 220%",
                backgroundPosition: tornasolPos,
              }}
            />

            {/* El barrido cada seis segundos y medio: el aviso de "esto se
                mueve" para quien la abre y se queda quieto. */}
            <span aria-hidden className="inv-barrido" />
          </div>

          {/* Motas por delante del plano. */}
          {motas.map((m) => (
            <span
              key={m.id}
              aria-hidden
              className="inv-mota pointer-events-none absolute rounded-full bg-white"
              style={
                {
                  left: m.left,
                  top: m.top,
                  width: m.lado,
                  height: m.lado,
                  animationDelay: `${m.demora}s`,
                  // La Z va por variable y no por `transform`: el @keyframes de
                  // `.inv-mota` anima `transform` y le gana al inline.
                  "--inv-tz": `${m.z}px`,
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
          transition={{ delay: 1 }}
          className="mx-auto mt-3 flex items-center gap-1.5 rounded-full border border-border bg-surface-alt px-3 py-1.5 text-xs font-medium"
        >
          <SparkleIcon width={14} height={14} />
          Moverla con el teléfono
        </motion.button>
      )}
    </div>
  );
}


/* ── las tres caras ──────────────────────────────────────────────────────── */

/** Despacha al maquetado del estilo.
 *
 *  Las tres caras son funciones puras de sus props, sin estado, por lo mismo
 *  que `InvitationCard` está separada de `InvitationEfectos`: así la versión
 *  con `prefers-reduced-motion` renderiza exactamente lo mismo sin duplicar el
 *  maquetado, y el efecto no sabe qué está envolviendo.
 *
 *  Cada una espeja a su función hermana en `lib/carta/render.ts`, que dibuja lo
 *  mismo en un canvas para compartir. Si movés algo acá, movelo allá: la gracia
 *  es que la imagen compartida sea la carta que la persona estaba mirando.
 */
function CaraCarta({ carta, estilo }: { carta: CartaVM; estilo: EstiloCarta }) {
  if (estilo === "retrato") return <CaraRetrato carta={carta} />;
  if (estilo === "ficha") return <CaraFicha carta={carta} />;
  return <CaraClasica carta={carta} />;
}

/** El marco común: proporción, degradé de fondo y filete. Es lo único que las
 *  tres comparten — de la retícula de adentro no se comparte nada. */
function Marco({
  estilo,
  children,
  className = "",
}: {
  estilo: EstiloCarta;
  children: React.ReactNode;
  className?: string;
}) {
  const p = PALETAS[estilo];
  return (
    <div
      className={`relative aspect-[7/10] w-full select-none ${className}`}
      style={{
        background: `linear-gradient(160deg, ${p.fondo[0]} 0%, ${p.fondo[1]} 52%, ${p.fondo[2]} 100%)`,
        color: p.texto,
        boxShadow: `inset 0 0 0 2px ${p.filete}`,
      }}
    >
      {children}
    </div>
  );
}

/** El pie con los datos de la ficha personal.
 *
 *  `line-clamp-2`: es de largo libre —con ciudad y las cinco medidas se pasa de
 *  una línea a 360px— y a la tercera empujaría la retícula fuera de la carta.
 *  El `title` lleva los rótulos, que en la carta se omiten por espacio. */
function PieDatos({
  carta,
  color,
  className = "",
}: {
  carta: CartaVM;
  color: string;
  className?: string;
}) {
  if (carta.pieDatos.length === 0) return null;
  return (
    <p
      className={`line-clamp-2 text-balance text-center text-[0.625rem] font-medium leading-snug ${className}`}
      style={{ color }}
      title={carta.pieDatos.map((d) => `${d.label}: ${d.valor}`).join(" · ")}
    >
      {carta.pieDatos.map((d) => d.valor).join("  ·  ")}
    </p>
  );
}

/* ── clásica ─────────────────────────────────────────────────────────────── */

/** La del videojuego: el general manda, el retrato es redondo y los seis
 *  atributos van en dos columnas de tres. */
function CaraClasica({ carta }: { carta: CartaVM }) {
  const p = PALETAS.clasica;

  return (
    <Marco estilo="clasica" className="px-5 py-5">
      {/* El filete interior: es lo que hace que se lea como acuñada y no como
          un rectángulo de color. */}
      <span
        aria-hidden
        className="pointer-events-none absolute inset-2 rounded-[1.35rem]"
        style={{ boxShadow: `inset 0 0 0 1px ${p.regla}` }}
      />

      <div className="relative flex h-full flex-col">
        <div className="flex items-start gap-2">
          <div className="shrink-0 text-center leading-none">
            <p className="text-[3.25rem] font-extrabold tabular-nums">{carta.general}</p>
            <p className="mt-1 text-lg font-bold tracking-[0.12em]">{carta.puesto}</p>
            {carta.dorsal > 0 && (
              <>
                <span
                  aria-hidden
                  className="mx-auto mt-2 block h-px w-10"
                  style={{ background: p.regla }}
                />
                <p className="mt-2 text-sm font-semibold" style={{ color: p.suave }}>
                  #{carta.dorsal}
                </p>
              </>
            )}
          </div>

          <div className="ml-auto shrink-0">
            {/* eslint-disable-next-line @next/next/no-img-element -- data-URI */}
            <img
              src={carta.avatar}
              alt=""
              className="size-28 rounded-full object-cover"
              style={{ boxShadow: `0 0 0 2px ${p.filete}` }}
            />
          </div>
        </div>

        <div className="mt-auto text-center">
          {carta.apodo.toLowerCase() !== carta.nombre.toLowerCase() && (
            <p
              className="text-[0.625rem] font-semibold tracking-[0.22em]"
              style={{ color: p.suave }}
            >
              {carta.apodo.toUpperCase()}
            </p>
          )}
          <p className="mt-0.5 truncate text-xl font-extrabold tracking-tight">
            {carta.nombre.toUpperCase()}
          </p>
          <span aria-hidden className="mt-2 block h-px w-full" style={{ background: p.regla }} />
        </div>

        <dl className="mt-3 grid grid-cols-2 gap-x-5 gap-y-1.5">
          {carta.atributos.map((a) => (
            <div key={a.sigla} className="flex items-baseline gap-2">
              <dd className="w-7 text-right text-lg font-extrabold tabular-nums">{a.valor}</dd>
              <dt className="text-xs font-bold tracking-wide" style={{ color: p.suave }}>
                <span className="sr-only">{a.label}: </span>
                <span aria-hidden>{a.sigla}</span>
              </dt>
            </div>
          ))}
        </dl>

        <PieDatos carta={carta} color={p.suave} className="mt-3" />
      </div>
    </Marco>
  );
}

/* ── retrato ─────────────────────────────────────────────────────────────── */

/** La foto a sangre: el avatar ocupa la carta entera y todo lo demás flota
 *  encima. Los velos no son decoración — sin ellos, un texto blanco sobre una
 *  foto clara no llega a contraste en ningún lado, y el avatar puede ser
 *  cualquier foto que la persona haya subido. */
function CaraRetrato({ carta }: { carta: CartaVM }) {
  const p = PALETAS.retrato;

  return (
    <Marco estilo="retrato" className="overflow-hidden">
      {/* eslint-disable-next-line @next/next/no-img-element -- data-URI */}
      <img src={carta.avatar} alt="" className="absolute inset-0 size-full object-cover" />

      <span
        aria-hidden
        className="absolute inset-x-0 bottom-0 h-3/5"
        style={{
          background:
            "linear-gradient(to top, rgba(0,0,0,0.93) 14%, rgba(0,0,0,0.72) 44%, rgba(0,0,0,0))",
        }}
      />
      <span
        aria-hidden
        className="absolute inset-x-0 top-0 h-1/3"
        style={{ background: "linear-gradient(to bottom, rgba(0,0,0,0.62), rgba(0,0,0,0))" }}
      />

      <div className="relative flex h-full flex-col p-4">
        <div className="flex items-start">
          <div className="leading-none">
            <p className="text-[2.75rem] font-extrabold tabular-nums">{carta.general}</p>
            <p className="mt-1 text-sm font-bold tracking-[0.18em]" style={{ color: p.filete }}>
              {carta.puesto}
            </p>
          </div>

          {carta.dorsal > 0 && (
            <span
              className="ml-auto grid size-10 shrink-0 place-items-center rounded-full text-sm font-bold"
              style={{ background: "rgba(0,0,0,0.45)", boxShadow: `inset 0 0 0 1px ${p.filete}` }}
            >
              {carta.dorsal}
            </span>
          )}
        </div>

        <div className="mt-auto">
          {carta.apodo.toLowerCase() !== carta.nombre.toLowerCase() && (
            <p
              className="text-[0.625rem] font-semibold tracking-[0.22em]"
              style={{ color: p.filete }}
            >
              {carta.apodo.toUpperCase()}
            </p>
          )}
          <p className="truncate text-2xl font-extrabold leading-tight tracking-tight">
            {carta.nombre.toUpperCase()}
          </p>

          <span aria-hidden className="my-2.5 block h-px w-full" style={{ background: p.regla }} />

          {/* Los seis en UNA fila. Es lo que distingue a este maquetado, y lo
              que obliga a poner el número arriba de la sigla: seis pares en
              línea no entran de otra forma a 360px. */}
          <dl className="grid grid-cols-6 gap-1 text-center">
            {carta.atributos.map((a) => (
              <div key={a.sigla}>
                <dd className="text-base font-extrabold leading-none tabular-nums">{a.valor}</dd>
                <dt
                  className="mt-0.5 text-[0.5rem] font-bold tracking-wide"
                  style={{ color: p.suave }}
                >
                  <span className="sr-only">{a.label}</span>
                  <span aria-hidden>{a.sigla}</span>
                </dt>
              </div>
            ))}
          </dl>

          <PieDatos carta={carta} color={p.suave} className="mt-2.5" />
        </div>
      </div>
    </Marco>
  );
}

/* ── ficha ───────────────────────────────────────────────────────────────── */

/** La sobria: sin número gigante. El retrato es chico y va en el encabezado, y
 *  los seis atributos se leen como barras — el nivel se compara de un vistazo,
 *  que es justo lo que una retícula de números sueltos no deja hacer. */
function CaraFicha({ carta }: { carta: CartaVM }) {
  const p = PALETAS.ficha;

  return (
    <Marco estilo="ficha" className="px-4 py-4">
      <div className="relative flex h-full flex-col">
        <div className="flex items-center gap-3">
          {/* eslint-disable-next-line @next/next/no-img-element -- data-URI */}
          <img
            src={carta.avatar}
            alt=""
            className="size-14 shrink-0 rounded-xl object-cover"
            style={{ boxShadow: `0 0 0 1px ${p.filete}` }}
          />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-extrabold uppercase tracking-tight">
              {carta.nombre}
            </p>
            <p
              className="truncate text-[0.625rem] font-semibold tracking-wide"
              style={{ color: p.suave }}
            >
              {carta.puestoLargo}
              {carta.dorsal > 0 && ` · #${carta.dorsal}`}
            </p>
          </div>

          {/* El general, chico y encuadrado: acá es un dato más, no el titular. */}
          <div
            className="shrink-0 rounded-lg px-2 py-1 text-center"
            style={{ boxShadow: `inset 0 0 0 1px ${p.filete}` }}
          >
            <p className="text-xl font-extrabold leading-none tabular-nums">{carta.general}</p>
            <p
              className="mt-0.5 text-[0.5rem] font-bold tracking-[0.14em]"
              style={{ color: p.suave }}
            >
              GEN
            </p>
          </div>
        </div>

        <span aria-hidden className="my-3 block h-px w-full" style={{ background: p.regla }} />

        <dl className="flex flex-1 flex-col justify-center gap-2">
          {carta.atributos.map((a) => (
            <div key={a.sigla} className="flex items-center gap-2">
              <dt
                className="w-8 shrink-0 text-[0.625rem] font-bold tracking-wide"
                style={{ color: p.suave }}
              >
                <span className="sr-only">{a.label}</span>
                <span aria-hidden>{a.sigla}</span>
              </dt>
              {/* La barra lleva su propio `role="img"` con `aria-label`: sin eso
                  el lector de pantalla lee el número suelto y no dice de qué es,
                  porque la sigla de al lado está marcada `aria-hidden`. */}
              <div
                className="h-1.5 flex-1 overflow-hidden rounded-full"
                style={{ background: p.regla }}
                role="img"
                aria-label={`${a.label}: ${a.valor} de 99`}
              >
                <span
                  className="block h-full rounded-full"
                  style={{ width: `${(a.valor / 99) * 100}%`, background: p.filete }}
                />
              </div>
              <dd className="w-6 shrink-0 text-right text-xs font-extrabold tabular-nums">
                {a.valor}
              </dd>
            </div>
          ))}
        </dl>

        <span aria-hidden className="my-3 block h-px w-full" style={{ background: p.regla }} />

        <PieDatos carta={carta} color={p.suave} />
      </div>
    </Marco>
  );
}
