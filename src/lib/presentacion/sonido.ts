/** Los efectos de la gala, **sintetizados** con Web Audio.
 *
 *  Ni un `.mp3` en `public/`. Tres razones, en orden de peso:
 *
 *  1 · Una fanfarria de librería son cientos de kB que hay que descargar antes
 *      de que sirvan, y la presentación se abre en el salón, con el wifi del
 *      lugar. Un `<audio>` que todavía está cargando cuando el presentador
 *      aprieta "siguiente" revela al ganador en silencio, que es exactamente
 *      el momento que el efecto existe para no arruinar.
 *  2 · Los efectos de gala tienen dueño. Un archivo bajado de internet entra al
 *      repo con una licencia que nadie miró y que se proyecta en público.
 *  3 · El redoble tiene que sostenerse **lo que dure el suspenso**, que lo
 *      decide el presentador en vivo. Un archivo de duración fija obliga a
 *      loopearlo con un salto audible; acá el ruido es continuo y lo que rueda
 *      es un LFO, así que dura lo que haga falta y crece mientras dura.
 *
 *  El `AudioContext` nace **suspendido** en todos los navegadores hasta que hay
 *  un gesto del usuario. Por eso `desbloquear()` es una función aparte y la
 *  llama el click de "Presentar": si el contexto se creara al montar, el primer
 *  efecto de la noche no sonaría y no habría forma de darse cuenta hasta que
 *  pasara.
 */

export type Efecto =
  | "ninguno"
  | "apertura"
  | "categoria"
  | "nominados"
  | "redoble"
  | "fanfarria"
  | "aplausos"
  | "cierre";

/* ── notas ───────────────────────────────────────────────────────────────── */

/** Las frecuencias que usan las secuencias de abajo, en Hz. */
const NOTA = {
  sol3: 196.0,
  do4: 261.63,
  mi4: 329.63,
  sol4: 392.0,
  la4: 440.0,
  si4: 493.88,
  do5: 523.25,
  re5: 587.33,
  mi5: 659.25,
  fa5: 698.46,
  sol5: 783.99,
  la5: 880.0,
  do6: 1046.5,
  mi6: 1318.51,
  sol6: 1567.98,
} as const;

type Nombre = keyof typeof NOTA;

/** Una nota de la secuencia: qué, cuándo (offset en segundos) y cuánto. */
interface Paso {
  nota: Nombre;
  en: number;
  dura: number;
  vol?: number;
}

/** Fanfarria de premiación: el arpegio que sube y el acorde que queda sonando.
 *  Do mayor, que es donde el metal sintetizado suena menos a sintetizador. */
const FANFARRIA: Paso[] = [
  { nota: "sol4", en: 0, dura: 0.16 },
  { nota: "do5", en: 0.14, dura: 0.16 },
  { nota: "mi5", en: 0.28, dura: 0.16 },
  { nota: "sol5", en: 0.42, dura: 0.34 },
  { nota: "mi5", en: 0.74, dura: 0.14 },
  { nota: "sol5", en: 0.86, dura: 0.14 },
  // el acorde final: cuatro voces sostenidas, que es lo que da el "cierre"
  { nota: "do5", en: 1.0, dura: 1.9, vol: 0.9 },
  { nota: "mi5", en: 1.0, dura: 1.9, vol: 0.8 },
  { nota: "sol5", en: 1.0, dura: 1.9, vol: 0.8 },
  { nota: "do6", en: 1.0, dura: 1.9, vol: 0.7 },
];

/** Apertura: más corta y más alta que la fanfarria de premiación. Anuncia que
 *  empieza, no que alguien ganó. */
const APERTURA: Paso[] = [
  { nota: "do5", en: 0, dura: 0.12 },
  { nota: "mi5", en: 0.1, dura: 0.12 },
  { nota: "sol5", en: 0.2, dura: 0.12 },
  { nota: "do6", en: 0.3, dura: 0.5 },
  { nota: "sol5", en: 0.78, dura: 1.4, vol: 0.7 },
  { nota: "do6", en: 0.78, dura: 1.4, vol: 0.8 },
  { nota: "mi6", en: 0.78, dura: 1.4, vol: 0.55 },
];

/** Cierre: la misma cadencia bajando. Termina, no premia. */
const CIERRE: Paso[] = [
  { nota: "do6", en: 0, dura: 0.2 },
  { nota: "sol5", en: 0.18, dura: 0.2 },
  { nota: "mi5", en: 0.36, dura: 0.2 },
  { nota: "do5", en: 0.54, dura: 2.2, vol: 0.9 },
  { nota: "sol4", en: 0.54, dura: 2.2, vol: 0.7 },
  { nota: "do4", en: 0.54, dura: 2.2, vol: 0.6 },
];

/** Los nominados: cuatro notas que suben, sin peso. Es un "atención", no un
 *  anuncio. */
const NOMINADOS: Paso[] = [
  { nota: "do5", en: 0, dura: 0.5, vol: 0.5 },
  { nota: "sol5", en: 0.08, dura: 0.5, vol: 0.4 },
  { nota: "do6", en: 0.16, dura: 0.6, vol: 0.35 },
  { nota: "mi6", en: 0.24, dura: 0.7, vol: 0.25 },
];

/* ── el motor ────────────────────────────────────────────────────────────── */

/** El volumen de la música cuando nadie habla encima. */
const VOLUMEN = 0.9;

/** Cuánto queda de la música mientras habla el locutor. Un cuarto y no cero:
 *  los aplausos de fondo son parte del anuncio; lo que no puede pasar es que le
 *  ganen al nombre. */
const VOLUMEN_ATENUADO = 0.22;

export interface MotorSonido {
  /** crea y despierta el contexto; llamalo desde un handler de click */
  desbloquear: () => void;
  reproducir: (efecto: Efecto) => void;
  /** corta lo que esté sostenido (el redoble) con un fundido corto */
  detener: () => void;
  silenciar: (valor: boolean) => void;
  /** baja la música mientras habla el locutor y la devuelve al soltarla */
  atenuar: (valor: boolean) => void;
  cerrar: () => void;
}

/** Un motor que no hace nada, para SSR y para cuando el navegador no trae Web
 *  Audio. Devolverlo en vez de `null` evita que cada llamada del presentador
 *  tenga que preguntar si hay sonido. */
const MUDO: MotorSonido = {
  desbloquear: () => {},
  reproducir: () => {},
  detener: () => {},
  silenciar: () => {},
  atenuar: () => {},
  cerrar: () => {},
};

export function crearMotorSonido(): MotorSonido {
  if (typeof window === "undefined") return MUDO;

  const Ctor =
    window.AudioContext ??
    (window as unknown as { webkitAudioContext?: typeof AudioContext })
      .webkitAudioContext;

  if (!Ctor) return MUDO;

  let ctx: AudioContext | null = null;
  let master: GainNode | null = null;
  let ruido: AudioBuffer | null = null;
  let silencio = false;
  let atenuado = false;

  /** Lo que está sonando en loop (hoy: el redoble). Se guarda para poder
   *  cortarlo desde afuera cuando el presentador avanza. */
  let sostenido: { nodos: AudioScheduledSourceNode[]; salida: GainNode } | null = null;

  /** Ruido blanco de dos segundos, reusado por todos los efectos percusivos.
   *  Uno solo y en loop: generar un buffer nuevo por platillo llena la memoria
   *  de una presentación de una hora con noventa buffers idénticos. */
  const bufferRuido = (c: AudioContext): AudioBuffer => {
    if (ruido) return ruido;
    const largo = c.sampleRate * 2;
    const buf = c.createBuffer(1, largo, c.sampleRate);
    const datos = buf.getChannelData(0);
    for (let i = 0; i < largo; i++) datos[i] = Math.random() * 2 - 1;
    ruido = buf;
    return buf;
  };

  /** Lleva el volumen general a donde corresponda según el silencio y la
   *  atenuación.
   *
   *  Las dos cosas empujan el mismo `master.gain`, así que tienen que resolverse
   *  en un solo lugar: con un `setValueAtTime` por cada una, silenciar mientras
   *  el locutor habla y que el locutor termine después dejaría la música al 90%
   *  con el botón de silencio activado.
   */
  const aplicarVolumen = (rampa: number) => {
    if (!master || !ctx) return;
    const t = ctx.currentTime;
    const destino = silencio ? 0 : atenuado ? VOLUMEN_ATENUADO : VOLUMEN;
    master.gain.cancelScheduledValues(t);
    master.gain.setValueAtTime(master.gain.value, t);
    master.gain.linearRampToValueAtTime(destino, t + rampa);
  };

  const desbloquear = () => {
    if (!ctx) {
      ctx = new Ctor();
      master = ctx.createGain();
      master.gain.value = silencio ? 0 : VOLUMEN;
      master.connect(ctx.destination);
    }
    // `resume()` sólo tiene efecto dentro del gesto que lo llama; el `void` es
    // porque devuelve una promesa que no nos dice nada útil.
    void ctx.resume();
  };

  /** Contexto listo o `null`. Todo efecto pasa por acá antes de sonar. */
  const activo = (): AudioContext | null => {
    if (silencio) return null;
    if (!ctx || !master) return null;
    if (ctx.state === "suspended") void ctx.resume();
    return ctx;
  };

  /* ── ladrillos ─────────────────────────────────────────────────────────── */

  /** Una nota de metal: dos dientes de sierra desafinados entre sí a través de
   *  un pasabajos que se cierra. El desafine es lo que la saca de "beep": una
   *  sola onda suena a sintetizador de reloj despertador. */
  const metal = (c: AudioContext, freq: number, en: number, dura: number, vol: number) => {
    const t = c.currentTime + en;
    const filtro = c.createBiquadFilter();
    filtro.type = "lowpass";
    filtro.frequency.setValueAtTime(freq * 6, t);
    filtro.frequency.exponentialRampToValueAtTime(Math.max(freq * 1.6, 220), t + dura);
    filtro.Q.value = 1.2;

    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.02);
    g.gain.setValueAtTime(vol, t + Math.max(dura - 0.18, 0.03));
    g.gain.exponentialRampToValueAtTime(0.0001, t + dura);

    for (const desafine of [-6, 6]) {
      const osc = c.createOscillator();
      osc.type = "sawtooth";
      osc.frequency.value = freq;
      osc.detune.value = desafine;
      osc.connect(filtro);
      osc.start(t);
      osc.stop(t + dura + 0.05);
    }

    filtro.connect(g);
    g.connect(master!);
  };

  const secuencia = (c: AudioContext, pasos: Paso[], vol = 0.16) => {
    for (const p of pasos) metal(c, NOTA[p.nota], p.en, p.dura, vol * (p.vol ?? 1));
  };

  /** Platillo: ruido por un pasaaltos con caída larga. */
  const platillo = (c: AudioContext, en: number, dura: number, vol: number) => {
    const t = c.currentTime + en;
    const src = c.createBufferSource();
    src.buffer = bufferRuido(c);

    const hp = c.createBiquadFilter();
    hp.type = "highpass";
    hp.frequency.value = 5000;

    const g = c.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dura);

    src.connect(hp);
    hp.connect(g);
    g.connect(master!);
    src.start(t);
    src.stop(t + dura);
  };

  /** Golpe grave: el "boom" de la placa de categoría. Seno que cae de 160 a 40
   *  Hz, que es un bombo sin muestra. */
  const golpe = (c: AudioContext, en: number, vol: number) => {
    const t = c.currentTime + en;
    const osc = c.createOscillator();
    osc.type = "sine";
    osc.frequency.setValueAtTime(160, t);
    osc.frequency.exponentialRampToValueAtTime(40, t + 0.45);

    const g = c.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.6);

    osc.connect(g);
    g.connect(master!);
    osc.start(t);
    osc.stop(t + 0.62);
  };

  /** El barrido de aire de una transición. */
  const barrido = (c: AudioContext, en: number, dura: number, vol: number) => {
    const t = c.currentTime + en;
    const src = c.createBufferSource();
    src.buffer = bufferRuido(c);

    const bp = c.createBiquadFilter();
    bp.type = "bandpass";
    bp.Q.value = 0.8;
    bp.frequency.setValueAtTime(300, t);
    bp.frequency.exponentialRampToValueAtTime(3200, t + dura * 0.7);
    bp.frequency.exponentialRampToValueAtTime(500, t + dura);

    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(vol, t + dura * 0.6);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dura);

    src.connect(bp);
    bp.connect(g);
    g.connect(master!);
    src.start(t);
    src.stop(t + dura);
  };

  /* ── efectos compuestos ────────────────────────────────────────────────── */

  /** Redoble sostenido, con crescendo.
   *
   *  No son golpes agendados uno por uno: es **una** fuente de ruido grave
   *  continua cuya ganancia modula un LFO que acelera de 22 a 46 Hz. Suena a
   *  redoble por la misma razón por la que un redoble real lo hace —golpes cada
   *  vez más juntos— y encima no tiene fin: dura lo que el presentador tarde en
   *  apretar "siguiente", que es lo que un archivo no puede hacer.
   */
  const redoble = (c: AudioContext) => {
    const t = c.currentTime;

    const src = c.createBufferSource();
    src.buffer = bufferRuido(c);
    src.loop = true;

    const lp = c.createBiquadFilter();
    lp.type = "lowpass";
    lp.frequency.value = 900;

    // `tremolo.gain` es el parámetro que el LFO empuja: la base queda en 0.55 y
    // el LFO le suma ±0.45, así que el ruido llega casi a cortarse entre golpe
    // y golpe.
    const tremolo = c.createGain();
    tremolo.gain.setValueAtTime(0.55, t);

    const lfo = c.createOscillator();
    lfo.type = "sine";
    lfo.frequency.setValueAtTime(22, t);
    lfo.frequency.linearRampToValueAtTime(46, t + 9);

    const lfoGain = c.createGain();
    lfoGain.gain.value = 0.45;
    lfo.connect(lfoGain);
    lfoGain.connect(tremolo.gain);

    const salida = c.createGain();
    salida.gain.setValueAtTime(0.0001, t);
    salida.gain.linearRampToValueAtTime(0.1, t + 0.4);
    salida.gain.linearRampToValueAtTime(0.34, t + 9);

    src.connect(lp);
    lp.connect(tremolo);
    tremolo.connect(salida);
    salida.connect(master!);

    src.start(t);
    lfo.start(t);

    sostenido = { nodos: [src, lfo], salida };
  };

  /** Aplausos: ruido de banda media con una envolvente irregular.
   *
   *  Lo irregular sale de modular la ganancia con **otro** ruido pasado por un
   *  pasabajos muy bajo: el resultado es un temblor aleatorio, que es lo que
   *  distingue una sala aplaudiendo de un `shhh` de radio mal sintonizada.
   */
  const aplausos = (c: AudioContext) => {
    const t = c.currentTime;
    const dura = 3.4;

    const src = c.createBufferSource();
    src.buffer = bufferRuido(c);
    src.loop = true;

    const bp = c.createBiquadFilter();
    bp.type = "bandpass";
    bp.frequency.value = 1900;
    bp.Q.value = 0.6;

    const temblor = c.createGain();
    temblor.gain.value = 0.6;

    const mod = c.createBufferSource();
    mod.buffer = bufferRuido(c);
    mod.loop = true;

    const modLp = c.createBiquadFilter();
    modLp.type = "lowpass";
    modLp.frequency.value = 22;

    const modGain = c.createGain();
    modGain.gain.value = 2.2;
    mod.connect(modLp);
    modLp.connect(modGain);
    modGain.connect(temblor.gain);

    const salida = c.createGain();
    salida.gain.setValueAtTime(0.0001, t);
    salida.gain.linearRampToValueAtTime(0.2, t + 0.35);
    salida.gain.setValueAtTime(0.2, t + dura - 1.2);
    salida.gain.exponentialRampToValueAtTime(0.0001, t + dura);

    src.connect(bp);
    bp.connect(temblor);
    temblor.connect(salida);
    salida.connect(master!);

    src.start(t);
    mod.start(t);
    src.stop(t + dura);
    mod.stop(t + dura);
  };

  /* ── API ───────────────────────────────────────────────────────────────── */

  const detener = () => {
    if (!sostenido || !ctx) return;
    const { nodos, salida } = sostenido;
    sostenido = null;

    const t = ctx.currentTime;
    // Fundido de 250 ms y recién ahí `stop`: cortar un ruido a mitad de ciclo
    // hace un "clack" que en unos parlantes de salón se escucha más que el
    // redoble.
    salida.gain.cancelScheduledValues(t);
    salida.gain.setValueAtTime(Math.max(salida.gain.value, 0.0001), t);
    salida.gain.exponentialRampToValueAtTime(0.0001, t + 0.25);
    for (const n of nodos) n.stop(t + 0.3);
  };

  const reproducir = (efecto: Efecto) => {
    if (efecto === "ninguno") {
      detener();
      return;
    }

    // El sostenido de la viñeta anterior se corta **siempre**, aunque el
    // sonido esté silenciado: si no, silenciar durante un redoble lo dejaría
    // sonando para siempre en el nodo que ya no se toca.
    detener();

    const c = activo();
    if (!c) return;

    switch (efecto) {
      case "apertura":
        barrido(c, 0, 0.9, 0.16);
        platillo(c, 0.28, 1.6, 0.3);
        secuencia(c, APERTURA, 0.17);
        break;

      case "categoria":
        barrido(c, 0, 0.5, 0.13);
        golpe(c, 0.24, 0.5);
        break;

      case "nominados":
        secuencia(c, NOMINADOS, 0.1);
        break;

      case "redoble":
        redoble(c);
        break;

      case "fanfarria":
        platillo(c, 0, 1.8, 0.34);
        golpe(c, 0, 0.55);
        secuencia(c, FANFARRIA, 0.18);
        // Los aplausos entran cuando el acorde ya se instaló, no encima del
        // ataque: pisados, el metal se vuelve barro.
        window.setTimeout(() => {
          if (activo()) aplausos(c);
        }, 1100);
        break;

      case "aplausos":
        aplausos(c);
        break;

      case "cierre":
        platillo(c, 0, 2.2, 0.3);
        secuencia(c, CIERRE, 0.16);
        break;
    }
  };

  const silenciar = (valor: boolean) => {
    silencio = valor;
    if (valor) detener();
    aplicarVolumen(0.15);
  };

  /** Baja rápido y sube lento, que es como duckea cualquier consola: la bajada
   *  tiene que llegar antes que la primera sílaba, y la subida no puede saltar
   *  encima de la última. */
  const atenuar = (valor: boolean) => {
    atenuado = valor;
    aplicarVolumen(valor ? 0.12 : 0.6);
  };

  const cerrar = () => {
    detener();
    const c = ctx;
    ctx = null;
    master = null;
    ruido = null;
    // Con delay: cerrar en el mismo tick mata el fundido de `detener()` y la
    // presentación termina con el clack que el fundido existe para evitar.
    if (c) window.setTimeout(() => void c.close().catch(() => {}), 400);
  };

  return { desbloquear, reproducir, detener, silenciar, atenuar, cerrar };
}
