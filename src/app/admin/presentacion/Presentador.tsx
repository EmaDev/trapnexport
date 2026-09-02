"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useCallback, useEffect, useRef, useState } from "react";
import { Confetti, usePrefersReducedMotion } from "lib-kit-components";

import {
  BackIcon,
  ChevronIcon,
  CloseIcon,
  FullscreenExitIcon,
  FullscreenIcon,
  SoundOffIcon,
  SoundOnIcon,
} from "@/components/atoms/icons";
import type { Diapositiva } from "@/lib/presentacion/guion";
import {
  useMantenerPantallaEncendida,
  usePantallaCompleta,
} from "@/lib/presentacion/pantalla";
import { crearMotorSonido, type MotorSonido } from "@/lib/presentacion/sonido";
import { crearLocutor, type Locutor } from "@/lib/presentacion/voz";
import { Fondo, Placa } from "./Placas";

/** El presentador: la pantalla completa que se proyecta en la gala.
 *
 *  Cinco decisiones que no son obvias:
 *
 *  1 · **Se monta recién al presentar.** No está escondido con `hidden` detrás
 *      de la pantalla de armado. El `AudioContext`, el pedido de pantalla
 *      completa y el bloqueo de suspensión se piden en el momento en que hay un
 *      gesto del usuario —el click de "Presentar"— porque es el único momento
 *      en que el navegador los concede.
 *
 *  2 · **El teclado manda.** En una gala nadie presenta con el mouse: se
 *      presenta con el clicker, que manda `PageDown` / `PageUp` o las flechas.
 *      Los botones en pantalla existen para el que no tiene clicker, y por eso
 *      se esconden solos.
 *
 *  3 · **`Escape` no cierra.** Cuando el navegador está en pantalla completa,
 *      `Escape` es suyo: sale de la pantalla completa y no llega acá. Recién el
 *      segundo `Escape`, ya fuera de pantalla completa, cierra el presentador.
 *      Si cerrara con el primero, un `Escape` accidental a mitad de la gala
 *      devolvería el salón al panel de administración.
 *
 *  4 · **Avanzar no revela solo.** El redoble del suspenso dura lo que el
 *      presentador quiera; el ganador aparece cuando aprieta. Un avance
 *      automático por tiempo obliga a la persona a hablar contra un reloj que
 *      no controla.
 *
 *  5 · **La pantalla no se apaga.** `wakeLock` mientras dura la presentación:
 *      un standby de veinte minutos mientras se llena el salón termina, sin
 *      esto, con el proyector mostrando el bloqueo de sesión.
 *
 *  6 · **La voz y la música son un solo botón.** `M` calla las dos. Separarlas
 *      daría un control más para equivocarse en vivo, y no hay gala donde
 *      tenga sentido la fanfarria sin el locutor o al revés.
 */

/** Cuánto se queda quieto el mouse antes de que se escondan los controles. */
const OCULTAR_MS = 2600;

/** Las viñetas que van con confeti: las dos placas de marco donde el salón
 *  aplaude y la revelación de un ganador que existe. Una categoría sin votos
 *  no lo lleva — el confeti sobre "Sin votos todavía" festeja la nada. */
const celebra = (d: Diapositiva | undefined): boolean => {
  if (!d) return false;
  if (d.tipo === "apertura" || d.tipo === "cierre") return true;
  return d.tipo === "ganador" && d.ganadores.length > 0;
};

/* ── el componente ───────────────────────────────────────────────────────── */

export function Presentador({
  guion,
  onSalir,
}: {
  guion: Diapositiva[];
  onSalir: () => void;
}) {
  const reducido = usePrefersReducedMotion();
  const contenedor = useRef<HTMLDivElement>(null);
  const pantalla = usePantallaCompleta(contenedor);
  useMantenerPantallaEncendida();

  const [indice, setIndice] = useState(0);
  const [silencio, setSilencio] = useState(false);
  const [controles, setControles] = useState(true);
  const [indiceAbierto, setIndiceAbierto] = useState(false);
  const [confeti, setConfeti] = useState(0);
  const [sinVoz, setSinVoz] = useState(false);

  const actual = guion[indice];

  /** El motor vive en un ref y no en el estado: cambiarlo no redibuja nada y
   *  tiene que ser el mismo objeto durante toda la presentación para poder
   *  cortar el redoble que arrancó tres renders atrás. */
  const sonido = useRef<MotorSonido | null>(null);

  /** El locutor, por lo mismo: tiene que poder cancelar la locución que empezó
   *  antes de que el presentador avanzara. */
  const voz = useRef<Locutor | null>(null);

  /* ── arranque y cierre ─────────────────────────────────────────────────── */

  useEffect(() => {
    // El motor se crea en el efecto de montaje y no en el cuerpo del render:
    // un render puede repetirse (StrictMode lo hace siempre) y cada repetición
    // dejaría un `AudioContext` huérfano abierto.
    //
    // El efecto corre a milisegundos del click de "Presentar", así que el
    // navegador todavía cuenta el gesto como activo: es la ventana en la que
    // el audio se desbloquea y la pantalla completa se concede.
    const motor = crearMotorSonido();
    sonido.current = motor;
    motor.desbloquear();

    // El locutor le baja el volumen a la música mientras habla. La atenuación
    // la maneja él y no cada llamada del presentador porque el que sabe cuándo
    // empieza y termina una locución es el motor de voz: la duración de una
    // frase depende de la voz que haya instalada, no del texto.
    const locutor = crearLocutor((hablando) => motor.atenuar(hablando));
    voz.current = locutor;
    locutor.desbloquear();

    void pantalla.entrar();

    // Las voces del sistema llegan asíncronas: preguntar en este tick daría
    // "no hay voz" siempre. Se pregunta una vez, con la placa de standby en
    // pantalla, que es cuando el que presenta todavía puede hacer algo al
    // respecto.
    const revision = window.setTimeout(() => setSinVoz(!locutor.hayVoz()), 1500);

    return () => {
      window.clearTimeout(revision);
      // Primero el locutor: al cerrarse suelta la atenuación, y el motor tiene
      // que seguir vivo para recibirla.
      locutor.cerrar();
      voz.current = null;
      motor.cerrar();
      sonido.current = null;
    };
    // Sólo al montar: `pantalla.entrar` es estable y volver a pedir pantalla
    // completa en cada render la pediría en cada tecla.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const cerrar = useCallback(() => {
    void pantalla.salir();
    onSalir();
  }, [pantalla, onSalir]);

  /* ── el sonido de cada viñeta ──────────────────────────────────────────── */

  useEffect(() => {
    if (!actual) return;
    sonido.current?.reproducir(actual.efecto);

    // La rama vacía no sobra: es la que corta la voz de la viñeta anterior
    // cuando el presentador avanza a una placa que no habla. Sin ella, el
    // nombre del ganador seguiría sonando sobre la tabla de resultados.
    if (actual.locucion) {
      voz.current?.anunciar(actual.locucion.frases, actual.locucion.demora);
    } else {
      voz.current?.callar();
    }
  }, [actual]);

  useEffect(() => {
    sonido.current?.silenciar(silencio);
    voz.current?.silenciar(silencio);
  }, [silencio]);

  /* ── navegación ────────────────────────────────────────────────────────── */

  const ir = useCallback(
    (destino: number) => {
      const proximo = Math.min(Math.max(destino, 0), guion.length - 1);
      setIndice(proximo);
      setIndiceAbierto(false);

      // El confeti se dispara acá y no en un efecto sobre la viñeta: es un
      // evento —"llegamos a esta placa"—, no un estado que haya que
      // sincronizar. Toda la navegación pasa por `ir`, así que no hay camino
      // que se lo saltee.
      if (celebra(guion[proximo])) setConfeti((n) => n + 1);
    },
    [guion],
  );

  const avanzar = useCallback(() => ir(indice + 1), [ir, indice]);
  const retroceder = useCallback(() => ir(indice - 1), [ir, indice]);

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
          ir(guion.length - 1);
          break;
        case "f":
        case "F":
          void (pantalla.activa ? pantalla.salir() : pantalla.entrar());
          break;
        case "m":
        case "M":
          setSilencio((s) => !s);
          break;
        case "s":
        case "S":
          setIndiceAbierto((v) => !v);
          break;
        case "Escape":
          // En pantalla completa este `Escape` es el que la cierra: el
          // navegador ya lo procesó y `fullscreenElement` todavía no es null.
          // Cerrar acá también sacaría al salón de la presentación de un saque.
          if (indiceAbierto) setIndiceAbierto(false);
          else if (!document.fullscreenElement) cerrar();
          break;
      }
    };

    window.addEventListener("keydown", alTeclear);
    return () => window.removeEventListener("keydown", alTeclear);
  }, [avanzar, retroceder, ir, guion.length, pantalla, cerrar, indiceAbierto]);

  /* ── los controles se esconden solos ───────────────────────────────────── */

  useEffect(() => {
    let temporizador: number;

    const despertar = () => {
      setControles(true);
      window.clearTimeout(temporizador);
      // Con el índice abierto los controles no se esconden: la lista quedaría
      // flotando sobre la nada.
      if (!indiceAbierto) {
        temporizador = window.setTimeout(() => setControles(false), OCULTAR_MS);
      }
    };

    despertar();
    window.addEventListener("mousemove", despertar);
    window.addEventListener("keydown", despertar);
    return () => {
      window.clearTimeout(temporizador);
      window.removeEventListener("mousemove", despertar);
      window.removeEventListener("keydown", despertar);
    };
  }, [indiceAbierto]);

  /* ── render ────────────────────────────────────────────────────────────── */

  const primera = indice === 0;
  const ultima = indice === guion.length - 1;
  const progreso = guion.length > 1 ? (indice / (guion.length - 1)) * 100 : 100;

  return (
    <div
      ref={contenedor}
      // `fixed inset-0` y no sólo `requestFullscreen`: si el navegador rechaza
      // la pantalla completa, esto igual tapa el panel entero. Un presentador
      // que se ve con el sidebar de administración al costado no sirve.
      className="fixed inset-0 z-50 select-none overflow-hidden bg-[#07030d] text-white"
      style={{ cursor: controles ? "default" : "none" }}
      role="region"
      aria-label="Presentación de la gala"
    >
      <Fondo />

      <Confetti
        fire={confeti}
        mode="center"
        count={140}
        colors={["#e8c46a", "#ffffff", "#b986ea", "#752eb8"]}
        respectReducedMotion
        className="z-20"
      />

      {/* La placa. `mode="wait"` para que la que sale termine antes de que
          entre la siguiente: cruzadas, en una proyección grande se ven dos
          títulos superpuestos. */}
      <div className="absolute inset-0 z-10">
        <AnimatePresence mode="wait">
          <motion.div
            key={actual?.id ?? indice}
            className="h-full w-full"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: reducido ? 0 : 0.25 }}
          >
            {actual && <Placa diapositiva={actual} reducido={reducido} />}
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Zonas de click: media pantalla para atrás, media para adelante. Es lo
          que espera cualquiera que haya usado un lector de PDF proyectado, y
          hace que la presentación se maneje desde una tablet sin apuntarle a un
          botón de 40px. */}
      <button
        type="button"
        className="absolute inset-y-0 left-0 z-30 w-[35%] cursor-w-resize focus:outline-none"
        onClick={retroceder}
        aria-label="Viñeta anterior"
        tabIndex={-1}
      />
      <button
        type="button"
        className="absolute inset-y-0 right-0 z-30 w-[65%] cursor-e-resize focus:outline-none"
        onClick={avanzar}
        aria-label="Viñeta siguiente"
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
            {/* flechas grandes a los costados */}
            <FlechaLateral lado="izq" onClick={retroceder} deshabilitada={primera} />
            <FlechaLateral lado="der" onClick={avanzar} deshabilitada={ultima} />

            {/* barra inferior */}
            <div className="pointer-events-auto absolute inset-x-0 bottom-0 flex flex-col gap-2 bg-gradient-to-t from-black/70 to-transparent px-4 pb-3 pt-10">
              <div className="h-[3px] w-full overflow-hidden rounded-full bg-white/15">
                <motion.div
                  className="h-full rounded-full bg-[#e8c46a]"
                  animate={{ width: `${progreso}%` }}
                  transition={{ duration: reducido ? 0 : 0.35, ease: "easeOut" }}
                />
              </div>

              <div className="flex items-center gap-2 text-xs text-white/70">
                <BotonControl onClick={retroceder} disabled={primera} label="Anterior">
                  <BackIcon width={18} height={18} />
                </BotonControl>
                <BotonControl onClick={avanzar} disabled={ultima} label="Siguiente">
                  <ChevronIcon width={18} height={18} />
                </BotonControl>

                <button
                  type="button"
                  onClick={() => setIndiceAbierto((v) => !v)}
                  className="min-w-0 flex-1 truncate rounded-lg px-2 py-1.5 text-left hover:bg-white/10"
                  aria-expanded={indiceAbierto}
                >
                  <span className="tabular-nums text-white/40">
                    {indice + 1}/{guion.length}
                  </span>
                  <span className="ml-2 text-white/85">{actual?.rotulo}</span>
                </button>

                <BotonControl
                  onClick={() => setSilencio((s) => !s)}
                  label={silencio ? "Activar el sonido" : "Silenciar"}
                  activo={silencio}
                >
                  {silencio ? (
                    <SoundOffIcon width={18} height={18} />
                  ) : (
                    <SoundOnIcon width={18} height={18} />
                  )}
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
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── índice: saltar a cualquier viñeta ─────────────────────────────── */}
      <AnimatePresence>
        {indiceAbierto && (
          <motion.nav
            className="absolute inset-x-0 bottom-[4.5rem] z-40 mx-auto max-h-[55vh] w-[min(34rem,90vw)] overflow-y-auto rounded-xl border border-white/15 bg-black/85 p-2 backdrop-blur"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 12 }}
            transition={{ duration: reducido ? 0 : 0.18 }}
            aria-label="Índice de viñetas"
          >
            <ul className="flex flex-col">
              {guion.map((d, i) => (
                <li key={d.id}>
                  <button
                    type="button"
                    onClick={() => ir(i)}
                    className={`flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm ${
                      i === indice ? "bg-white/15 text-[#e8c46a]" : "text-white/75 hover:bg-white/10"
                    }`}
                    aria-current={i === indice ? "true" : undefined}
                  >
                    <span className="w-[2.5ch] shrink-0 text-right tabular-nums text-white/35">
                      {i + 1}
                    </span>
                    <span className="min-w-0 truncate">{d.rotulo}</span>
                  </button>
                </li>
              ))}
            </ul>
          </motion.nav>
        )}
      </AnimatePresence>

      {/* Ayuda de teclado: se muestra con los controles y sólo en la primera
          viñeta, que es cuando el que presenta todavía está probando. */}
      {controles && primera && (
        <div className="absolute right-4 top-4 z-40 hidden text-right text-xs leading-relaxed md:block">
          <p className="text-white/35">
            → / espacio avanza · ← retrocede
            <br />
            F pantalla completa · M sonido · S índice
          </p>

          {/* Sin voz en español la gala se proyecta igual, pero muda: nadie se
              enteraría hasta la primera categoría. Se avisa acá, en el standby,
              que es el único momento en que todavía se puede instalar una voz
              en el equipo o cambiar de máquina. */}
          {sinVoz && (
            <p className="ml-auto mt-3 max-w-[26ch] text-white/45">
              Este equipo no tiene voces en español instaladas: el locutor no va
              a anunciar los premios.
            </p>
          )}
        </div>
      )}
    </div>
  );
}

/* ── controles ───────────────────────────────────────────────────────────── */

function BotonControl({
  onClick,
  children,
  label,
  disabled,
  activo,
}: {
  onClick: () => void;
  children: React.ReactNode;
  label: string;
  disabled?: boolean;
  activo?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={label}
      aria-label={label}
      className={`grid h-9 w-9 shrink-0 place-items-center rounded-lg transition-colors disabled:opacity-25 ${
        activo ? "bg-white/20 text-white" : "text-white/80 hover:bg-white/10"
      }`}
    >
      {children}
    </button>
  );
}

/** La flecha grande del costado. Sólo se ve cuando el mouse se mueve; el resto
 *  del tiempo la pantalla está limpia para el salón. */
function FlechaLateral({
  lado,
  onClick,
  deshabilitada,
}: {
  lado: "izq" | "der";
  onClick: () => void;
  deshabilitada: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={deshabilitada}
      aria-label={lado === "izq" ? "Viñeta anterior" : "Viñeta siguiente"}
      className={`pointer-events-auto absolute top-1/2 grid h-14 w-14 -translate-y-1/2 place-items-center rounded-full border border-white/15 bg-black/35 text-white/80 backdrop-blur transition hover:bg-black/60 disabled:pointer-events-none disabled:opacity-0 ${
        lado === "izq" ? "left-4" : "right-4"
      }`}
    >
      {lado === "izq" ? (
        <BackIcon width={24} height={24} />
      ) : (
        <ChevronIcon width={24} height={24} />
      )}
    </button>
  );
}
