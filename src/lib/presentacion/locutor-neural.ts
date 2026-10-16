import type { Locutor } from "./voz";

/** El locutor con voz de ElevenLabs, y la del navegador como respaldo.
 *
 *  Las frases del guion se conocen apenas se abre la presentación —el nombre
 *  de cada premio y de cada ganador, con el conteo de ese momento—, así que se
 *  generan **todas antes de empezar**, mientras está puesta la placa de espera.
 *  En el momento del anuncio ya no hay nada que bajar: el nombre del ganador no
 *  depende del wifi del salón.
 *
 *  A diferencia de `speechSynthesis`, estos audios sí pasan por un
 *  `AudioContext`, y por eso llevan lo que a la voz del navegador no se le
 *  puede poner: un poco de cuerpo en los graves, compresión para que no se
 *  pierda en los parlantes y una cola de sala corta.
 *
 *  Si una frase no llegó a cargarse —la API falló, el cupo se acabó, la
 *  presentación avanzó antes de que terminara de bajar— esa locución la dice
 *  el locutor del navegador. Es peor, pero es mejor que una gala muda.
 */

export interface EstadoVoz {
  listas: number;
  total: number;
  /** el motivo por el que se dejó de cargar, tal como lo devolvió el servidor */
  error?: string;
}

export interface LocutorNeural extends Locutor {
  /** Genera y decodifica las frases. Llamalo una vez, al abrir. */
  precargar: (frases: string[], alAvanzar: (estado: EstadoVoz) => void) => void;
}

/** Silencio entre dos nombres del once ideal, en segundos. */
const SEPARACION = 0.45;

/** Pedidos en paralelo. El plan gratuito de ElevenLabs acepta pocos a la vez;
 *  dos alcanza para que veinte frases estén listas en lo que tarda en llenarse
 *  el salón. */
const CONCURRENCIA = 2;

/** Una respuesta de sala sintética: ruido estéreo que cae. Suficiente para que
 *  la voz no suene "pegada al micrófono" sin llegar al eco de catedral. */
function impulso(c: AudioContext, dura: number, caida: number): AudioBuffer {
  const largo = Math.floor(c.sampleRate * dura);
  const buf = c.createBuffer(2, largo, c.sampleRate);
  for (let canal = 0; canal < 2; canal++) {
    const datos = buf.getChannelData(canal);
    for (let i = 0; i < largo; i++) {
      datos[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / largo, caida);
    }
  }
  return buf;
}

/** Cuánto se sube la voz después de comprimirla. Va bien arriba de 1 a
 *  propósito: el nombre del ganador tiene que pasar por encima de un salón
 *  aplaudiendo. El limitador del final es el que evita que eso sature. */
const VOLUMEN_VOZ = 2.2;

/** cuerpo → compresor → (seco + sala) → volumen → limitador. Devuelve la
 *  entrada. */
function cadena(c: AudioContext): AudioNode {
  const cuerpo = c.createBiquadFilter();
  cuerpo.type = "lowshelf";
  cuerpo.frequency.value = 140;
  cuerpo.gain.value = 4;

  const compresor = c.createDynamicsCompressor();
  compresor.threshold.value = -22;
  compresor.knee.value = 8;
  compresor.ratio.value = 4;
  compresor.attack.value = 0.004;
  compresor.release.value = 0.2;

  const seco = c.createGain();
  seco.gain.value = 1;

  const sala = c.createConvolver();
  sala.buffer = impulso(c, 1.6, 3);
  const humedo = c.createGain();
  humedo.gain.value = 0.16;

  const salida = c.createGain();
  salida.gain.value = VOLUMEN_VOZ;

  // Limitador: un compresor con ratio máximo y ataque instantáneo, justo por
  // debajo de 0 dB. Deja la voz fuerte sin el chasquido de la saturación.
  const limitador = c.createDynamicsCompressor();
  limitador.threshold.value = -1.5;
  limitador.knee.value = 0;
  limitador.ratio.value = 20;
  limitador.attack.value = 0.001;
  limitador.release.value = 0.1;

  cuerpo.connect(compresor);
  compresor.connect(seco);
  compresor.connect(sala);
  sala.connect(humedo);
  seco.connect(salida);
  humedo.connect(salida);
  salida.connect(limitador);
  limitador.connect(c.destination);

  return cuerpo;
}

/** El mp3 de una frase, o el mensaje de por qué no. */
async function pedir(
  texto: string,
  signal: AbortSignal,
): Promise<{ datos: ArrayBuffer } | { error: string; definitivo: boolean }> {
  try {
    const r = await fetch("/api/admin/locutor", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ texto }),
      signal,
    });
    if (r.ok) return { datos: await r.arrayBuffer() };
    const cuerpo = (await r.json().catch(() => null)) as { error?: string } | null;
    return {
      error: cuerpo?.error || `El servidor respondió ${r.status}.`,
      // Sin sesión o sin clave no tiene sentido reintentar ni seguir pidiendo.
      definitivo: r.status === 401 || r.status === 503,
    };
  } catch {
    return { error: "No hay conexión con el servidor.", definitivo: false };
  }
}

export function crearLocutorNeural(
  respaldo: Locutor,
  alHablar?: (hablando: boolean) => void,
): LocutorNeural {
  const Ctor =
    typeof window === "undefined"
      ? undefined
      : (window.AudioContext ??
        (window as unknown as { webkitAudioContext?: typeof AudioContext })
          .webkitAudioContext);

  if (!Ctor) return { ...respaldo, precargar: () => {} };

  let ctx: AudioContext | null = null;
  let entrada: AudioNode | null = null;
  const buffers = new Map<string, AudioBuffer>();
  let fuentes: AudioBufferSourceNode[] = [];
  let demoraId = 0;
  let silencio = false;
  let cerrado = false;
  const cancelar = new AbortController();

  /** Mismo criterio que el locutor del navegador: el `onended` de una locución
   *  cortada no puede soltar la atenuación de la que vino después. */
  let turno = 0;

  const contexto = (): AudioContext => {
    if (!ctx) {
      ctx = new Ctor();
      entrada = cadena(ctx);
    }
    return ctx;
  };

  const callar = () => {
    window.clearTimeout(demoraId);
    turno++;
    for (const f of fuentes) {
      try {
        f.stop();
      } catch {
        /* ya había terminado */
      }
    }
    fuentes = [];
    respaldo.callar();
    alHablar?.(false);
  };

  const tocar = (lista: AudioBuffer[]) => {
    const c = contexto();
    if (c.state === "suspended") void c.resume();
    const mio = ++turno;
    alHablar?.(true);

    let t = c.currentTime + 0.05;
    fuentes = lista.map((buffer, i) => {
      const src = c.createBufferSource();
      src.buffer = buffer;
      src.connect(entrada!);
      src.start(t);
      t += buffer.duration + SEPARACION;
      if (i === lista.length - 1) {
        src.onended = () => {
          if (mio !== turno) return;
          fuentes = [];
          alHablar?.(false);
        };
      }
      return src;
    });
  };

  return {
    desbloquear: () => {
      void contexto().resume();
      respaldo.desbloquear();
    },

    precargar: (frases, alAvanzar) => {
      const pendientes = [...new Set(frases.map((f) => f.trim()).filter(Boolean))];
      const estado: EstadoVoz = { listas: 0, total: pendientes.length };
      alAvanzar({ ...estado });
      if (pendientes.length === 0) return;

      const c = contexto();
      let corte = false;

      const trabajador = async () => {
        while (!corte && !cerrado) {
          const texto = pendientes.shift();
          if (texto === undefined) return;

          // Un reintento por frase: un corte de red de un segundo no puede
          // dejar al ganador con la voz del navegador.
          let r = await pedir(texto, cancelar.signal);
          if ("error" in r && !r.definitivo && !cerrado) r = await pedir(texto, cancelar.signal);
          if (cerrado) return;

          if ("error" in r) {
            // Lo que falla dos veces es casi siempre de la cuenta (cupo, voz
            // no habilitada en el plan): seguir pidiendo sólo junta errores.
            corte = true;
            estado.error = r.error;
            alAvanzar({ ...estado });
            return;
          }

          try {
            buffers.set(texto, await c.decodeAudioData(r.datos));
            estado.listas++;
          } catch {
            estado.error = "Un audio llegó dañado y no se pudo reproducir.";
          }
          alAvanzar({ ...estado });
        }
      };

      for (let i = 0; i < CONCURRENCIA; i++) void trabajador();
    },

    anunciar: (frases, demora) => {
      callar();
      if (cerrado || silencio) return;

      const limpias = frases.map((f) => f.trim()).filter(Boolean);
      if (limpias.length === 0) return;

      // Todas o ninguna: mezclar la voz de ElevenLabs con la del navegador en
      // los nombres del once ideal suena a dos locutores peleándose.
      const lista = limpias.map((f) => buffers.get(f));
      if (lista.every((b): b is AudioBuffer => Boolean(b))) {
        demoraId = window.setTimeout(() => tocar(lista), demora);
      } else {
        respaldo.anunciar(limpias, demora);
      }
    },

    callar,

    silenciar: (valor) => {
      silencio = valor;
      respaldo.silenciar(valor);
      if (valor) callar();
    },

    cerrar: () => {
      cerrado = true;
      cancelar.abort();
      callar();
      respaldo.cerrar();
      const c = ctx;
      ctx = null;
      if (c) window.setTimeout(() => void c.close().catch(() => {}), 400);
    },

    hayVoz: () => buffers.size > 0 || respaldo.hayVoz(),
  };
}
