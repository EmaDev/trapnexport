"use client";

import { motion } from "framer-motion";

import { StarIcon, TrophyIcon } from "@/components/atoms/icons";
import { avatarUrl } from "@/lib/media";
import type { Diapositiva, Ganador } from "@/lib/presentacion/guion";
import { EDICION } from "@/lib/trap-awards";

/** Las placas que se proyectan, una por tipo de viñeta.
 *
 *  **No usan los tokens de la app.** Ni `bg-surface`, ni `text-foreground`, ni
 *  la clase `dark`. Una gala se proyecta sobre una pared en un salón a media
 *  luz: el fondo es negro violáceo y el acento es dorado siempre, tenga el
 *  navegador del que presenta el tema claro o el oscuro. Si estas placas
 *  siguieran el tema, el que abre el panel en claro proyectaría una pared
 *  blanca a las once de la noche.
 *
 *  Todos los tamaños de texto son `clamp(mín, vw, máx)` y ninguno es un `text-`
 *  de la escala de Tailwind: la misma placa se ve en el notebook del que
 *  presenta y en un proyector de 3 metros, y una escala en `rem` no se entera
 *  de la diferencia. El `vw` sí.
 */

const ORO = "#e8c46a";

/* ── piezas compartidas ──────────────────────────────────────────────────── */

/** El fondo de todas las placas: dos manchas violetas desenfocadas sobre negro.
 *
 *  Está en el marco y no en cada placa porque tiene que **quedarse quieto**
 *  entre viñeta y viñeta: si entrara y saliera con cada transición, el salón
 *  vería un parpadeo negro cada vez que el presentador avanza.
 */
export function Fondo() {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
      <div className="absolute inset-0 bg-[#07030d]" />
      <div
        className="absolute -left-[15%] top-[-20%] h-[70vh] w-[70vh] rounded-full opacity-60 blur-[120px]"
        style={{ background: "radial-gradient(circle, #50108b 0%, transparent 70%)" }}
      />
      <div
        className="absolute -right-[10%] bottom-[-25%] h-[80vh] w-[80vh] rounded-full opacity-50 blur-[140px]"
        style={{ background: "radial-gradient(circle, #752eb8 0%, transparent 70%)" }}
      />
      {/* Viñeteado: oscurece los bordes para que el texto del centro gane peso
          en una proyección con luz ambiente. */}
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

/** El rótulo chico de arriba: "CATEGORÍA 4 DE 17", "NOMINADOS". */
function Rotulo({ children }: { children: React.ReactNode }) {
  return (
    <p
      className="font-semibold uppercase text-[clamp(0.7rem,1.3vw,1.1rem)]"
      style={{ color: ORO, letterSpacing: "0.35em" }}
    >
      {children}
    </p>
  );
}

/** La línea dorada corta que separa el rótulo del título. */
function Filete() {
  return (
    <span
      aria-hidden
      className="block h-px w-[clamp(3rem,8vw,7rem)]"
      style={{ background: `linear-gradient(90deg, transparent, ${ORO}, transparent)` }}
    />
  );
}

/** El escudo con su halo, para las placas de marco. */
function Escudo({ tam = "clamp(4rem,10vw,9rem)" }: { tam?: string }) {
  return (
    <span className="relative flex items-center justify-center" style={{ width: tam, height: tam }}>
      <span
        aria-hidden
        className="absolute inset-[-40%] rounded-full blur-3xl"
        style={{ background: "radial-gradient(circle, rgba(232,196,106,0.35), transparent 70%)" }}
      />
      {/* eslint-disable-next-line @next/next/no-img-element -- SVG estático */}
      <img src="/escudo.svg" alt="" className="relative h-full w-full" />
    </span>
  );
}

/** Marca de agua con la edición, abajo de todo. Es lo que hace que una foto
 *  suelta de la proyección se sepa de qué gala es. */
function PieDeEdicion() {
  return (
    <p
      className="absolute bottom-[clamp(1rem,3vh,2.5rem)] left-1/2 -translate-x-1/2 whitespace-nowrap text-[clamp(0.65rem,1.1vw,0.9rem)] uppercase text-white/25"
      style={{ letterSpacing: "0.3em" }}
    >
      {EDICION.titulo} · {EDICION.subtitulo}
    </p>
  );
}

/** El contenedor de toda placa: centra, respeta los bordes de la proyección y
 *  deja lugar abajo para la barra de controles. */
function Centro({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-full w-full flex-col items-center justify-center gap-[clamp(0.75rem,2vh,1.75rem)] px-[6vw] pb-[clamp(3rem,8vh,6rem)] text-center">
      {children}
    </div>
  );
}

/** La ficha de una persona: avatar circular y nombre. La usan nominados y
 *  ganadores; cambia el tamaño y el brillo, no la forma, para que el salón
 *  reconozca en la placa del ganador la misma ficha que vio en la de
 *  nominados. */
function Ficha({
  texto,
  tam,
  destacada = false,
  pie,
}: {
  texto: string;
  /** el lado del avatar, en unidades CSS */
  tam: string;
  destacada?: boolean;
  pie?: string;
}) {
  return (
    <div className="flex min-w-0 flex-col items-center gap-[0.6em]">
      <span className="relative" style={{ width: tam, height: tam }}>
        {destacada && (
          <span
            aria-hidden
            className="absolute inset-[-18%] rounded-full blur-2xl"
            style={{ background: "radial-gradient(circle, rgba(232,196,106,0.55), transparent 70%)" }}
          />
        )}
        {/* eslint-disable-next-line @next/next/no-img-element -- data-URI generado */}
        <img
          src={avatarUrl(texto)}
          alt=""
          className="relative h-full w-full rounded-full object-cover"
          style={{
            border: destacada ? `3px solid ${ORO}` : "2px solid rgba(255,255,255,0.18)",
          }}
        />
      </span>
      <p
        className="max-w-[14ch] font-semibold leading-tight"
        style={{
          fontSize: destacada ? "clamp(1rem,2.4vw,2rem)" : "clamp(0.8rem,1.5vw,1.35rem)",
          color: destacada ? ORO : "rgba(255,255,255,0.88)",
        }}
      >
        {texto}
      </p>
      {pie && (
        <p className="text-[clamp(0.65rem,1.1vw,0.95rem)] text-white/45">{pie}</p>
      )}
    </div>
  );
}

/** El texto de votos de un ganador.
 *
 *  El porcentaje se muestra sólo cuando la categoría es de un solo cupo. En el
 *  once ideal cada uno vota once nombres, así que la suma de votos es once
 *  veces la de votantes y "8%" al lado del más votado del plantel sería un
 *  número que no significa nada.
 */
function votosLabel(g: Ganador, cupos: number): string {
  const votos = `${g.votos} ${g.votos === 1 ? "voto" : "votos"}`;
  return cupos === 1 ? `${votos} · ${g.porcentaje}%` : votos;
}

/* ── animación ───────────────────────────────────────────────────────────── */

/** Entrada escalonada: el contenedor no se mueve, va escalonando a los hijos.
 *  Con `reducido` los tiempos se van a cero en vez de desaparecer la animación:
 *  así el mismo árbol de `motion` sirve para los dos casos. */
const contenedor = (reducido: boolean) => ({
  oculto: {},
  visible: {
    transition: {
      staggerChildren: reducido ? 0 : 0.12,
      delayChildren: reducido ? 0 : 0.1,
    },
  },
});

const subir = (reducido: boolean) => ({
  oculto: { opacity: 0, y: reducido ? 0 : 28 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: reducido ? 0 : 0.55, ease: [0.16, 1, 0.3, 1] as const },
  },
});

/* ── las placas ──────────────────────────────────────────────────────────── */

export function Placa({
  diapositiva,
  reducido,
}: {
  diapositiva: Diapositiva;
  reducido: boolean;
}) {
  const vars = { variants: contenedor(reducido), initial: "oculto", animate: "visible" };
  const item = subir(reducido);

  switch (diapositiva.tipo) {
    /* ── en espera: lo que está puesto mientras se llena el salón ────────── */
    case "standby":
      return (
        <motion.div className="h-full w-full" {...vars}>
          <Centro>
            <motion.div variants={item}>
              <Escudo tam="clamp(5rem,13vw,12rem)" />
            </motion.div>

            <motion.h1
              variants={item}
              className="font-black uppercase leading-[0.95] text-white text-[clamp(2.5rem,9vw,8rem)]"
              style={{ letterSpacing: "-0.02em" }}
            >
              {EDICION.titulo}
            </motion.h1>

            <motion.p
              variants={item}
              className="font-semibold uppercase text-[clamp(0.9rem,2vw,1.6rem)]"
              style={{ color: ORO, letterSpacing: "0.4em" }}
            >
              {EDICION.subtitulo}
            </motion.p>

            <motion.div variants={item} className="mt-[clamp(1rem,4vh,3rem)]">
              <span className="inline-flex items-center gap-3 rounded-full border border-white/15 bg-white/5 px-[1.4em] py-[0.7em] text-[clamp(0.85rem,1.7vw,1.35rem)] text-white/70">
                {/* El punto que late es lo único que se mueve en esta placa: es
                    la señal de que la proyección está viva y no congelada. */}
                <motion.span
                  aria-hidden
                  className="h-[0.7em] w-[0.7em] rounded-full"
                  style={{ background: ORO }}
                  animate={reducido ? undefined : { opacity: [1, 0.25, 1] }}
                  transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
                />
                En unos minutos comenzamos
              </span>
            </motion.div>
          </Centro>
        </motion.div>
      );

    /* ── arranca la gala ─────────────────────────────────────────────────── */
    case "apertura":
      return (
        <motion.div className="h-full w-full" {...vars}>
          <Centro>
            <motion.div variants={item}>
              <Rotulo>{EDICION.titulo}</Rotulo>
            </motion.div>
            <motion.div variants={item}>
              <Filete />
            </motion.div>

            <motion.h1
              variants={item}
              className="font-black uppercase leading-[0.92] text-white text-[clamp(3rem,12vw,11rem)]"
              style={{ letterSpacing: "-0.03em", textShadow: "0 0 80px rgba(232,196,106,0.25)" }}
            >
              Ya
              <br />
              comenzamos
            </motion.h1>

            <motion.p
              variants={item}
              className="max-w-[26ch] text-[clamp(1rem,2.2vw,1.8rem)] text-white/60"
            >
              Diecisiete premios, una sola noche. Que empiece.
            </motion.p>
          </Centro>
          <PieDeEdicion />
        </motion.div>
      );

    /* ── se anuncia la categoría ─────────────────────────────────────────── */
    case "categoria":
      return (
        <motion.div className="h-full w-full" {...vars}>
          <Centro>
            <motion.div variants={item}>
              <Rotulo>
                Categoría {diapositiva.numero} de {diapositiva.total}
              </Rotulo>
            </motion.div>
            <motion.div variants={item}>
              <Filete />
            </motion.div>

            <motion.h2
              variants={item}
              className="font-black uppercase leading-[0.95] text-white text-[clamp(2.5rem,10vw,9rem)]"
              style={{ letterSpacing: "-0.02em" }}
            >
              {diapositiva.categoria.nombre}
            </motion.h2>

            <motion.p
              variants={item}
              className="max-w-[30ch] text-[clamp(1rem,2.4vw,2rem)] text-white/65"
            >
              {diapositiva.categoria.pregunta}
            </motion.p>
          </Centro>
          <PieDeEdicion />
        </motion.div>
      );

    /* ── los nominados ───────────────────────────────────────────────────── */
    case "nominados": {
      const { opciones, nombre, descripcion } = diapositiva.categoria;
      // Con más de doce nominados —el plantel entero son dieciocho— las fichas
      // con avatar no entran sin achicarse hasta ser ilegibles de lejos. A
      // partir de ahí se muestran como una grilla de nombres.
      const enGrilla = opciones.length > 12;

      return (
        <motion.div className="h-full w-full" {...vars}>
          <Centro>
            <motion.div variants={item}>
              <Rotulo>{nombre} · nominados</Rotulo>
            </motion.div>

            {descripcion && (
              <motion.p
                variants={item}
                className="max-w-[40ch] text-[clamp(0.85rem,1.6vw,1.25rem)] text-white/50"
              >
                {descripcion}
              </motion.p>
            )}

            <motion.ul
              variants={item}
              className={
                enGrilla
                  ? "grid w-full max-w-[85vw] grid-cols-2 gap-x-[clamp(1rem,4vw,4rem)] gap-y-[clamp(0.4rem,1.4vh,1rem)] sm:grid-cols-3"
                  : "flex flex-wrap items-start justify-center gap-[clamp(1rem,3vw,3rem)]"
              }
            >
              {opciones.map((o) => (
                <li key={o.id} className={enGrilla ? "min-w-0" : ""}>
                  {enGrilla ? (
                    <span className="block truncate text-[clamp(0.95rem,2.1vw,1.7rem)] font-medium text-white/85">
                      {o.texto}
                    </span>
                  ) : (
                    <Ficha texto={o.texto} tam="clamp(4rem,9vw,8rem)" />
                  )}
                </li>
              ))}
            </motion.ul>
          </Centro>
          <PieDeEdicion />
        </motion.div>
      );
    }

    /* ── el suspenso ─────────────────────────────────────────────────────── */
    case "suspenso":
      return (
        <motion.div className="h-full w-full" {...vars}>
          <Centro>
            <motion.div variants={item}>
              <Rotulo>{diapositiva.categoria.nombre}</Rotulo>
            </motion.div>

            <motion.h2
              variants={item}
              className="font-black uppercase leading-[0.95] text-white text-[clamp(2.2rem,8vw,7rem)]"
              style={{ letterSpacing: "-0.02em" }}
            >
              Y el ganador es
              {/* Los tres puntos entran de a uno con el redoble: es el único
                  reloj que ve el salón mientras el presentador decide cuándo
                  cortar. */}
              <span aria-hidden>
                {[0, 1, 2].map((i) => (
                  <motion.span
                    key={i}
                    style={{ color: ORO }}
                    animate={reducido ? undefined : { opacity: [0.15, 1, 0.15] }}
                    transition={{
                      duration: 1.5,
                      repeat: Infinity,
                      delay: i * 0.35,
                      ease: "easeInOut",
                    }}
                  >
                    .
                  </motion.span>
                ))}
              </span>
            </motion.h2>

            {/* El pulso dorado detrás del texto acompaña al redoble. */}
            <motion.div
              aria-hidden
              className="pointer-events-none absolute inset-0 -z-10"
              animate={reducido ? undefined : { opacity: [0.15, 0.4, 0.15] }}
              transition={{ duration: 1.6, repeat: Infinity, ease: "easeInOut" }}
              style={{
                background:
                  "radial-gradient(circle at center, rgba(232,196,106,0.25), transparent 60%)",
              }}
            />
          </Centro>
          <PieDeEdicion />
        </motion.div>
      );

    /* ── la revelación ───────────────────────────────────────────────────── */
    case "ganador": {
      const { categoria, ganadores } = diapositiva;

      if (ganadores.length === 0) {
        return (
          <motion.div className="h-full w-full" {...vars}>
            <Centro>
              <motion.div variants={item}>
                <Rotulo>{categoria.nombre}</Rotulo>
              </motion.div>
              <motion.h2
                variants={item}
                className="font-bold text-white/70 text-[clamp(1.6rem,5vw,4rem)]"
              >
                Sin votos todavía
              </motion.h2>
              <motion.p
                variants={item}
                className="max-w-[34ch] text-[clamp(0.9rem,1.8vw,1.4rem)] text-white/45"
              >
                Esta categoría no recibió ni un voto. No hay ganador que anunciar.
              </motion.p>
            </Centro>
            <PieDeEdicion />
          </motion.div>
        );
      }

      // Un solo ganador manda la placa entera; varios (el once ideal) van en
      // grilla y el tamaño de ficha baja con la cantidad.
      const uno = ganadores.length === 1;
      const tamFicha = uno
        ? "clamp(8rem,20vw,18rem)"
        : ganadores.length <= 4
          ? "clamp(5rem,11vw,10rem)"
          : "clamp(3.5rem,7vw,6.5rem)";

      return (
        <motion.div className="h-full w-full" {...vars}>
          <Centro>
            <motion.div variants={item} className="flex flex-col items-center gap-[0.8em]">
              {/* El tamaño va por `style` y no por `width`: `clamp()` es una
                  función de CSS y no un `<length>` de SVG — puesta en el
                  atributo, el ícono no la entiende y sale del tamaño que se le
                  ocurra al navegador. */}
              <TrophyIcon
                style={{
                  color: ORO,
                  width: "clamp(2rem,4vw,3.5rem)",
                  height: "clamp(2rem,4vw,3.5rem)",
                }}
              />
              <Rotulo>
                {categoria.nombre} · {uno ? "ganador" : `${ganadores.length} elegidos`}
              </Rotulo>
            </motion.div>

            {uno ? (
              <motion.div
                variants={item}
                className="flex flex-col items-center gap-[clamp(0.75rem,2vh,1.5rem)]"
              >
                <span className="relative" style={{ width: tamFicha, height: tamFicha }}>
                  <span
                    aria-hidden
                    className="absolute inset-[-20%] rounded-full blur-3xl"
                    style={{
                      background:
                        "radial-gradient(circle, rgba(232,196,106,0.5), transparent 70%)",
                    }}
                  />
                  {/* eslint-disable-next-line @next/next/no-img-element -- data-URI generado */}
                  <img
                    src={avatarUrl(ganadores[0].texto)}
                    alt=""
                    className="relative h-full w-full rounded-full"
                    style={{ border: `4px solid ${ORO}` }}
                  />
                </span>

                <h2
                  className="font-black uppercase leading-[0.95] text-[clamp(2.2rem,9vw,8rem)]"
                  style={{
                    color: ORO,
                    letterSpacing: "-0.02em",
                    textShadow: "0 0 60px rgba(232,196,106,0.35)",
                  }}
                >
                  {ganadores[0].texto}
                </h2>

                <p className="text-[clamp(0.9rem,2vw,1.6rem)] text-white/60">
                  {votosLabel(ganadores[0], categoria.cupos)}
                </p>
              </motion.div>
            ) : (
              <motion.ul
                variants={item}
                className="flex max-w-[88vw] flex-wrap items-start justify-center gap-x-[clamp(1rem,3vw,2.5rem)] gap-y-[clamp(1rem,3vh,2rem)]"
              >
                {ganadores.map((g) => (
                  <li key={g.opcionId}>
                    <Ficha
                      texto={g.texto}
                      tam={tamFicha}
                      destacada
                      pie={votosLabel(g, categoria.cupos)}
                    />
                  </li>
                ))}
              </motion.ul>
            )}

            {/* El empate no se puede deducir de la placa: dos fichas doradas en
                una categoría de un solo cupo se leen como "ganaron los dos" sin
                decir por qué. Acá se dice. */}
            {categoria.cupos < ganadores.length && (
              <motion.p
                variants={item}
                className="text-[clamp(0.8rem,1.5vw,1.2rem)] text-white/45"
              >
                Empate en el corte: entran los {ganadores.length}.
              </motion.p>
            )}
          </Centro>
          <PieDeEdicion />
        </motion.div>
      );
    }

    /* ── la tabla completa ───────────────────────────────────────────────── */
    case "resultados": {
      const { categoria, filas } = diapositiva;
      // Diez filas es lo que entra en una proyección sin que la barra se
      // vuelva un hilo. El resto se resume en una línea abajo, que es mejor que
      // recortar en silencio.
      const TOPE = 10;
      const visibles = filas.slice(0, TOPE);
      const restantes = filas.length - visibles.length;

      return (
        <motion.div className="h-full w-full" {...vars}>
          <div className="flex h-full w-full flex-col justify-center gap-[clamp(0.75rem,2vh,1.5rem)] px-[8vw] pb-[clamp(3rem,8vh,6rem)]">
            <motion.div variants={item} className="flex flex-col items-center gap-[0.6em]">
              <Rotulo>{categoria.nombre} · resultados</Rotulo>
              <p className="text-[clamp(0.75rem,1.3vw,1.05rem)] text-white/40">
                {categoria.totalVotos} {categoria.totalVotos === 1 ? "voto" : "votos"} en total
              </p>
            </motion.div>

            <motion.ul variants={item} className="flex flex-col gap-[clamp(0.3rem,1vh,0.7rem)]">
              {visibles.map((f, i) => (
                <li key={f.opcionId} className="flex items-center gap-[clamp(0.5rem,1.5vw,1.25rem)]">
                  <span
                    className="w-[2.2ch] shrink-0 text-right tabular-nums text-[clamp(0.75rem,1.4vw,1.15rem)]"
                    style={{ color: f.ganadora ? ORO : "rgba(255,255,255,0.3)" }}
                  >
                    {f.posicion}
                  </span>

                  <div className="relative min-w-0 flex-1">
                    {/* La barra es el fondo del renglón y el nombre va encima:
                        nombre a la izquierda y barra a la derecha partiría la
                        placa en dos columnas angostas y ninguna se leería de
                        lejos. */}
                    <motion.div
                      className="absolute inset-y-0 left-0 rounded-md"
                      style={{
                        background: f.ganadora
                          ? "linear-gradient(90deg, rgba(232,196,106,0.42), rgba(232,196,106,0.14))"
                          : "linear-gradient(90deg, rgba(117,46,184,0.5), rgba(117,46,184,0.12))",
                      }}
                      initial={{ width: reducido ? `${f.ancho}%` : 0 }}
                      animate={{ width: `${f.ancho}%` }}
                      transition={{
                        duration: reducido ? 0 : 0.9,
                        delay: reducido ? 0 : 0.25 + i * 0.07,
                        ease: [0.16, 1, 0.3, 1],
                      }}
                    />
                    <div className="relative flex items-center justify-between gap-4 px-[0.8em] py-[clamp(0.35rem,1vh,0.7rem)]">
                      <span
                        className="min-w-0 truncate text-[clamp(0.85rem,1.9vw,1.5rem)] font-medium"
                        style={{ color: f.ganadora ? ORO : "rgba(255,255,255,0.85)" }}
                      >
                        {f.ganadora && (
                          <StarIcon
                            width="0.8em"
                            height="0.8em"
                            className="mr-[0.5em] inline-block align-[-0.05em]"
                          />
                        )}
                        {f.texto}
                      </span>
                      <span
                        className="shrink-0 tabular-nums text-[clamp(0.8rem,1.6vw,1.3rem)]"
                        style={{ color: f.ganadora ? ORO : "rgba(255,255,255,0.55)" }}
                      >
                        {f.votos}
                        {categoria.cupos === 1 && (
                          <span className="ml-[0.5em] text-white/35">{f.porcentaje}%</span>
                        )}
                      </span>
                    </div>
                  </div>
                </li>
              ))}
            </motion.ul>

            {restantes > 0 && (
              <motion.p
                variants={item}
                className="text-center text-[clamp(0.7rem,1.2vw,1rem)] text-white/35"
              >
                {restantes} {restantes === 1 ? "opción más" : "opciones más"} sin mostrar
              </motion.p>
            )}
          </div>
          <PieDeEdicion />
        </motion.div>
      );
    }

    /* ── el final ────────────────────────────────────────────────────────── */
    case "cierre":
      return (
        <motion.div className="h-full w-full" {...vars}>
          <Centro>
            <motion.div variants={item}>
              <Escudo />
            </motion.div>

            <motion.h1
              variants={item}
              className="font-black uppercase leading-[0.95] text-white text-[clamp(2.5rem,10vw,9rem)]"
              style={{ letterSpacing: "-0.02em" }}
            >
              Gracias
            </motion.h1>

            <motion.p
              variants={item}
              className="max-w-[30ch] text-[clamp(1rem,2.2vw,1.8rem)] text-white/60"
            >
              {diapositiva.entregados}{" "}
              {diapositiva.entregados === 1 ? "premio entregado" : "premios entregados"}. Nos
              vemos en la próxima edición.
            </motion.p>

            <motion.div variants={item}>
              <Filete />
            </motion.div>

            <motion.p
              variants={item}
              className="font-semibold uppercase text-[clamp(0.8rem,1.8vw,1.4rem)]"
              style={{ color: ORO, letterSpacing: "0.4em" }}
            >
              {EDICION.titulo} · {EDICION.subtitulo}
            </motion.p>
          </Centro>
        </motion.div>
      );
  }
}
