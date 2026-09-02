/** El locutor de la gala: la voz grave que dice el premio y el ganador.
 *
 *  Usa `speechSynthesis`, la síntesis de voz que ya trae el navegador, por las
 *  mismas tres razones por las que `sonido.ts` no tiene ni un `.mp3`: no
 *  descarga nada en el wifi del salón, no mete en el repo un audio con dueño, y
 *  —la que acá pesa más— el ganador se sabe recién en el momento. Un archivo
 *  pregenerado obligaría a sintetizar de antemano el nombre de **cada** opción
 *  de cada encuesta por si sale ganadora, o a pedirle un mp3 a una API con el
 *  salón mirando la pantalla.
 *
 *  Lo que se paga a cambio, y hay que saberlo antes de la gala:
 *
 *  1 · **Las voces las pone el sistema operativo, no la app.** En Windows suele
 *      estar "Microsoft Pablo"; en un equipo sin ninguna voz en español el
 *      navegador leería el castellano con fonética inglesa, que es peor que el
 *      silencio. Por eso `hayVoz()` existe y por eso, si no hay ninguna voz en
 *      español, el locutor se calla en vez de improvisar.
 *  2 · **Lo grave sale de `pitch`, no de un filtro.** El navegador no deja
 *      rutear la salida de la síntesis por el `AudioContext`, así que no hay
 *      reverb ni compresión posible sobre la voz: la profundidad llega hasta
 *      donde llegue bajar el tono. Y algunas voces de red directamente ignoran
 *      `pitch` y `rate`.
 *  3 · **Se prefiere la voz instalada a la de red.** Una voz "de Google" suena
 *      mejor pero viaja por internet: si el salón tiene mal el wifi, el nombre
 *      del ganador llega tarde o no llega. La local es peor y siempre está.
 */

/* ── el timbre ───────────────────────────────────────────────────────────── */

/** Rango 0–2, con 1 como voz natural. En 0.4 la voz baja lo suficiente para
 *  sonar a locutor de premiación sin entrar en el gruñido robótico que aparece
 *  cuando el motor estira demasiado el formante. */
const TONO = 0.4;

/** Rango 0.1–10. Un poco más lento que natural: proyectado en un salón con eco,
 *  un nombre dicho a velocidad normal se entiende a medias. */
const VELOCIDAD = 0.86;

/** El silencio entre un nombre y el siguiente cuando el premio tiene varios
 *  ganadores —el once ideal son once—. Se consigue encolando cada nombre como
 *  una locución aparte y no con comas en una sola: además de la pausa, esquiva
 *  el corte a los ~15 segundos que tienen las locuciones largas en Chrome. */
const PAUSA = " . ";

/* ── elección de voz ─────────────────────────────────────────────────────── */

/** Nombres de voz masculina conocidos entre Windows, macOS/iOS y Android. La
 *  API no expone el género —no hay campo—, así que el nombre es lo único que
 *  hay para pedir "voz grave" y no terminar con una voz femenina a la que
 *  además le bajamos el tono. */
const MASCULINAS = [
  "pablo", "raul", "raúl", "jorge", "diego", "juan", "carlos", "miguel",
  "enrique", "javier", "alvaro", "álvaro", "gonzalo", "andres", "andrés",
  "lucas", "male",
];

/** Las femeninas conocidas, para descartarlas explícitamente: sin esta lista,
 *  una voz que no está en ninguna de las dos empata con "Microsoft Sabina" y
 *  gana la que el navegador haya puesto primero. */
const FEMENINAS = [
  "helena", "sabina", "laura", "monica", "mónica", "paulina", "marisol",
  "esperanza", "isabela", "elvira", "penelope", "penélope", "catalina",
  "camila", "ximena", "dalia", "sofia", "sofía", "angelica", "angélica",
  "female",
];

const incluye = (lista: string[], nombre: string) =>
  lista.some((n) => nombre.includes(n));

/** Puntaje de una voz para anunciar la gala de un club argentino.
 *
 *  Devuelve `null` para todo lo que no sea español: es preferible que la gala
 *  vaya muda a que una voz inglesa lea los apodos del plantel.
 */
function puntuar(voz: SpeechSynthesisVoice): number | null {
  const idioma = voz.lang.toLowerCase().replace("_", "-");
  if (!idioma.startsWith("es")) return null;

  const nombre = voz.name.toLowerCase();
  let puntos = 0;

  if (incluye(MASCULINAS, nombre)) puntos += 6;
  else if (incluye(FEMENINAS, nombre)) puntos -= 6;

  // El acento importa menos que el género pero se nota: un apodo rioplatense
  // leído en castellano peninsular suena a doblaje.
  if (idioma.startsWith("es-ar")) puntos += 5;
  else if (/^es-(419|mx|us|uy|cl|co|pe|py|bo)/.test(idioma)) puntos += 3;
  else if (idioma.startsWith("es-es")) puntos += 2;
  else puntos += 1;

  // La instalada le gana a la de red: ver el punto 3 del encabezado.
  if (voz.localService) puntos += 2;

  return puntos;
}

function mejorVoz(voces: SpeechSynthesisVoice[]): SpeechSynthesisVoice | null {
  let elegida: SpeechSynthesisVoice | null = null;
  let mejor = -Infinity;

  for (const voz of voces) {
    const puntos = puntuar(voz);
    if (puntos !== null && puntos > mejor) {
      mejor = puntos;
      elegida = voz;
    }
  }

  return elegida;
}

/* ── el locutor ──────────────────────────────────────────────────────────── */

export interface Locutor {
  /** Prepara la síntesis dentro del gesto del usuario; igual que el audio, hay
   *  navegadores que no hablan hasta que se los pidió una vez desde un click. */
  desbloquear: () => void;
  /** Dice las frases, una por una, `demora` ms después de llamarlo. Cancela lo
   *  que estuviera diciendo. */
  anunciar: (frases: string[], demora: number) => void;
  callar: () => void;
  silenciar: (valor: boolean) => void;
  cerrar: () => void;
  /** `false` si el equipo no tiene ninguna voz en español instalada. Puede
   *  pasar de `false` a `true` en los primeros segundos: varios navegadores
   *  cargan la lista de voces de forma asíncrona. */
  hayVoz: () => boolean;
}

/** Un locutor que no habla, para SSR y para los navegadores sin la API. Igual
 *  que `MUDO` en `sonido.ts`: devolverlo evita que el presentador tenga que
 *  preguntar si hay voz antes de cada llamada. */
const CALLADO: Locutor = {
  desbloquear: () => {},
  anunciar: () => {},
  callar: () => {},
  silenciar: () => {},
  cerrar: () => {},
  hayVoz: () => false,
};

/** @param alHablar se llama con `true` cuando arranca una locución y con
 *  `false` cuando termina. Lo usa el presentador para bajarle el volumen a la
 *  música mientras habla: sin eso, los aplausos sintetizados se comen el
 *  nombre del ganador, que es justo la palabra que la gala vino a escuchar. */
export function crearLocutor(alHablar?: (hablando: boolean) => void): Locutor {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) {
    return CALLADO;
  }

  const sintesis = window.speechSynthesis;

  let voz: SpeechSynthesisVoice | null = null;
  let silencio = false;
  let cerrado = false;
  let demoraId = 0;
  let guardaId = 0;

  /** Cada locución se lleva un número. El `onend` de una vieja —que en Chrome
   *  llega tarde y a veces llega igual después de `cancel()`— compara contra
   *  este contador antes de avisar que se dejó de hablar; si no, apagaría la
   *  atenuación de la locución que acaba de empezar. */
  let turno = 0;

  /** Chrome recolecta la `utterance` a mitad de la frase si nadie la referencia
   *  desde JS: la voz se corta sola y no hay error. Basta con sostenerlas. */
  let enVuelo: SpeechSynthesisUtterance[] = [];

  const revisarVoces = () => {
    if (cerrado) return;
    voz = mejorVoz(sintesis.getVoices());
  };

  revisarVoces();
  // La lista llega vacía en el primer llamado en Chrome y en Edge; el evento es
  // la única forma de enterarse de que ya está.
  sintesis.addEventListener("voiceschanged", revisarVoces);

  const terminar = (mio: number) => {
    if (mio !== turno) return;
    enVuelo = [];
    window.clearTimeout(guardaId);
    alHablar?.(false);
  };

  const callar = () => {
    window.clearTimeout(demoraId);
    window.clearTimeout(guardaId);
    turno++;
    enVuelo = [];
    if (sintesis.speaking || sintesis.pending) sintesis.cancel();
    alHablar?.(false);
  };

  const decir = (frases: string[]) => {
    const mio = ++turno;
    alHablar?.(true);

    // Una locución que arrancó mientras la pestaña estaba oculta queda pausada
    // y no la despierta nada: `resume()` antes de encolar es barato y evita que
    // la gala siga muda el resto de la noche después de un alt-tab.
    sintesis.resume();

    frases.forEach((frase, i) => {
      const u = new SpeechSynthesisUtterance(frase + PAUSA);
      if (voz) {
        u.voice = voz;
        u.lang = voz.lang;
      } else {
        u.lang = "es-AR";
      }
      u.pitch = TONO;
      u.rate = VELOCIDAD;
      u.volume = 1;

      // Sólo la última avisa que se terminó de hablar: las del medio dejarían
      // subir la música entre dos nombres del once ideal.
      if (i === frases.length - 1) {
        u.onend = () => terminar(mio);
        u.onerror = () => terminar(mio);
      }

      enVuelo.push(u);
      sintesis.speak(u);
    });

    // Red de contención. Si la síntesis se cuelga —pasa: una voz de red que no
    // responde, la pestaña que se esconde justo— el `onend` no llega nunca y la
    // música se quedaría atenuada para el resto de la gala. El techo es generoso
    // porque cortar la atenuación antes de tiempo sólo tapa el final de un
    // nombre, y quedarse atenuado arruina todo lo que sigue.
    const largo = frases.reduce((n, f) => n + f.length, 0);
    guardaId = window.setTimeout(() => terminar(mio), 2500 + largo * 160);
  };

  return {
    desbloquear: () => {
      // Una locución muda para gastar el gesto del click de "Presentar": hay
      // navegadores que ignoran el primer `speak()` que no viene de uno.
      const u = new SpeechSynthesisUtterance(" ");
      u.volume = 0;
      sintesis.speak(u);
      revisarVoces();
    },

    anunciar: (frases, demora) => {
      callar();
      if (cerrado || silencio) return;

      const limpias = frases.map((f) => f.trim()).filter(Boolean);
      if (limpias.length === 0) return;

      // Sin voz en español no se dice nada: ver el punto 1 del encabezado.
      if (!voz) return;

      demoraId = window.setTimeout(() => decir(limpias), demora);
    },

    callar,

    silenciar: (valor) => {
      silencio = valor;
      if (valor) callar();
    },

    cerrar: () => {
      cerrado = true;
      callar();
      sintesis.removeEventListener("voiceschanged", revisarVoces);
    },

    hayVoz: () => voz !== null,
  };
}
