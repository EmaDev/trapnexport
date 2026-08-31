import type { PlayerSkill } from "@/lib/historia";
import { POSICION_LABEL, type PlayerFicha, type Posicion } from "@/lib/social/types";

/** La carta de jugador: modelo, paletas y de dónde salen los números.
 *
 *  Módulo puro e isomorfo — sin `next/*`, sin `db`, sin `document`. Lo usan
 *  tres consumidores que tienen que ver exactamente lo mismo:
 *
 *    `PlayerCard`        la carta en el DOM, animada
 *    `lib/carta/render`  la misma carta dibujada en un canvas, para compartir
 *    `perfil/page.tsx`   que la arma en el servidor y la baja por props
 *
 *  Si la vista previa y la imagen compartida salieran de dos lugares, la
 *  persona compartiría una carta distinta de la que está mirando. Por eso los
 *  colores y los atributos viven acá y no en cada componente.
 */

/* ── estilos ──────────────────────────────────────────────────────────── */

/** Los tres estilos son **tres maquetados distintos**, no la misma carta en
 *  tres colores. El id nombra el diseño, no el color, justamente para que eso
 *  quede claro en el código:
 *
 *    clasica  · la del videojuego: general y puesto arriba a la izquierda,
 *               retrato redondo a la derecha, nombre cruzando y los seis
 *               atributos en dos columnas de tres.
 *    retrato  · la foto a sangre ocupando la carta entera, con un velo abajo;
 *               el general flota sobre la imagen y los seis atributos van en
 *               una sola fila al pie.
 *    ficha    · la sobria: sin número gigante, retrato chico en el encabezado
 *               y los seis atributos como barras con su nivel.
 *
 *  Cada uno trae su paleta adentro. Lo que se comparte entre los tres es de
 *  dónde salen los datos (`construirCarta`), no cómo se dibujan: eso vive dos
 *  veces —en `PlayerCard` para el DOM y en `lib/carta/render` para el canvas—
 *  y las dos leen esta misma tabla.
 */
export type EstiloCarta = "clasica" | "retrato" | "ficha";

export const ESTILOS: EstiloCarta[] = ["clasica", "retrato", "ficha"];

export interface PaletaCarta {
  nombre: string;
  /** una línea sobre qué cambia; va debajo del selector */
  descripcion: string;
  /** el degradé del cuerpo, de arriba abajo */
  fondo: [string, string, string];
  /** el filete metálico del borde y de la retícula */
  filete: string;
  texto: string;
  /** rótulos y datos secundarios */
  suave: string;
  /** las líneas divisorias y el fondo de las barras */
  regla: string;
  /** el halo detrás de la carta */
  halo: string;
  /** cuánto tornasol admite el fondo: sobre el dorado el `color-dodge` se
   *  desborda y la carta se vuelve una calcomanía, así que ahí va más bajo */
  tornasol: number;
}

/** Los colores están escritos acá y no leídos de las variables CSS del tema, y
 *  es la misma razón que en `lib/invitacion/story.ts`: la carta se comparte y
 *  se mira sobre el fondo de Instagram o de WhatsApp, no sobre el de la app.
 *  Si salieran del tema, la misma carta se vería distinta según quién la
 *  compartió tuviera el teléfono en claro o en oscuro.
 *
 *  `clasica` es la de marca y el default. `retrato` es dorada y es la única que
 *  se sale de la paleta a propósito: una carta dorada es una cita al
 *  videojuego, y sin ella las tres serían la misma carta en tres oscuridades.
 */
export const PALETAS: Record<EstiloCarta, PaletaCarta> = {
  clasica: {
    nombre: "Clásica",
    descripcion: "General grande, retrato redondo y los seis atributos en dos columnas.",
    fondo: ["#3a0b69", "#50108b", "#12031f"],
    filete: "#c8a2eb",
    texto: "#ffffff",
    suave: "rgba(255,255,255,0.72)",
    regla: "rgba(255,255,255,0.22)",
    halo: "rgba(117,46,184,0.55)",
    tornasol: 0.32,
  },
  retrato: {
    nombre: "Retrato",
    descripcion: "Tu foto a sangre, el general encima y los atributos en una fila al pie.",
    // El degradé de esta carta casi no se ve —la foto la tapa—: actúa de
    // respaldo mientras el avatar carga y de base del velo de abajo.
    fondo: ["#c9a227", "#7a5f10", "#0a0a0a"],
    filete: "#fff3c4",
    texto: "#ffffff",
    suave: "rgba(255,255,255,0.8)",
    regla: "rgba(255,255,255,0.3)",
    halo: "rgba(201,162,39,0.5)",
    tornasol: 0.16,
  },
  ficha: {
    nombre: "Ficha",
    descripcion: "Sobria: encabezado con tus datos y los atributos como barras.",
    fondo: ["#2b2b2b", "#121212", "#000000"],
    filete: "#d9d9d9",
    texto: "#ffffff",
    suave: "rgba(255,255,255,0.7)",
    regla: "rgba(255,255,255,0.16)",
    halo: "rgba(255,255,255,0.22)",
    // El más bajo de los tres: `color-dodge` sobre un fondo casi negro se
    // dispara, y con el valor de las otras dos esta carta —que existe para ser
    // la sobria— salía con una banda verde cruzándola.
    tornasol: 0.1,
  },
};

/* ── atributos ───────────────────────────────────────────────────────────── */

export interface AtributoCarta {
  /** tres letras, como en la carta del videojuego */
  sigla: string;
  /** el nombre completo, para el `aria-label` y el tooltip */
  label: string;
  valor: number;
}

/** Los seis del jugador de campo y los seis del arquero. Son dos juegos
 *  distintos porque medir a un arquero con REG y DEF no dice nada de él: en el
 *  videojuego tampoco comparten escala. Los índices se corresponden uno a uno
 *  con `sesgo` y `peso` de `PERFILES`, así que el orden importa. */
const ATRIBUTOS_CAMPO = [
  ["RIT", "Ritmo"],
  ["TIR", "Tiro"],
  ["PAS", "Pase"],
  ["REG", "Regate"],
  ["DEF", "Defensa"],
  ["FÍS", "Físico"],
] as const;

const ATRIBUTOS_ARQUERO = [
  ["EST", "Estirada"],
  ["MAN", "Manos"],
  ["SAQ", "Saque"],
  ["REF", "Reflejos"],
  ["VEL", "Velocidad"],
  ["COL", "Colocación"],
] as const;

/** Qué hace a cada puesto.
 *
 *  `sesgo` se suma al nivel base del jugador, atributo por atributo: es lo que
 *  hace que un defensor tenga DEF alto y TIR bajo sin necesidad de cargar seis
 *  números a mano por persona. `peso` es cómo se promedian esos seis para
 *  sacar el general — el mismo criterio del videojuego: al delantero lo define
 *  el tiro, al defensor la marca, y al arquero los reflejos.
 *
 *  Cada `peso` suma 1. Si tocás uno, revisá que siga sumando: el general se
 *  redondea del producto y un peso que suma 0.9 baja a todos los de ese puesto.
 */
const PERFILES: Record<Posicion, { sesgo: number[]; peso: number[] }> = {
  arquero: {
    sesgo: [6, 8, -2, 12, -10, 4],
    peso: [0.21, 0.21, 0.1, 0.34, 0.04, 0.1],
  },
  defensor: {
    sesgo: [-4, -14, -2, -8, 14, 10],
    peso: [0.05, 0.02, 0.1, 0.08, 0.45, 0.3],
  },
  mediocampista: {
    sesgo: [0, -2, 12, 6, 0, -4],
    peso: [0.1, 0.14, 0.32, 0.26, 0.12, 0.06],
  },
  delantero: {
    sesgo: [10, 14, -6, 8, -16, 2],
    peso: [0.12, 0.42, 0.05, 0.26, 0.0, 0.15],
  },
  polifuncional: {
    sesgo: [2, 0, 4, 2, 2, 2],
    peso: [0.17, 0.17, 0.17, 0.17, 0.16, 0.16],
  },
};

/** Sigla del puesto para el frente de la carta. */
export const PUESTO_SIGLA: Record<Posicion, string> = {
  arquero: "ARQ",
  defensor: "DEF",
  mediocampista: "MED",
  delantero: "DEL",
  polifuncional: "POL",
};

/* ── el modelo ───────────────────────────────────────────────────────────── */

export interface CartaVM {
  nombre: string;
  /** como se lo nombra en la cancha; va chico arriba del nombre */
  apodo: string;
  handle: string;
  avatar: string;
  dorsal: number;
  puesto: string;
  puestoLargo: string;
  general: number;
  atributos: AtributoCarta[];
  /** El pie de la carta: pierna, edad, altura, peso y ciudad, sólo lo cargado.
   *
   *  `valor` se explica solo ("Pierna derecha", "27 años") porque es lo único
   *  que se dibuja: la carta tiene una línea de ancho fijo para esto, y
   *  repetir el rótulo delante de cada dato la desbordaba. `label` queda para
   *  el lector de pantalla, que sí necesita saber qué es cada cosa. */
  pieDatos: { label: string; valor: string }[];
  club: string;
  crest: string;
  /** true cuando los atributos salieron de la ficha de `/historia` y no del
   *  relleno determinista. Lo usa la pantalla para no presentar como dato lo
   *  que es una estimación. */
  conTrayectoria: boolean;
}

/* ── derivación ──────────────────────────────────────────────────────────── */

/** FNV-1a. El mismo PRNG determinista que usan `lib/media.ts` y las partículas
 *  de `InvitationEfectos`: los números de la carta tienen que salir iguales en
 *  el servidor y en el cliente o React tira el árbol por hidratación, y tienen
 *  que salir iguales entre visitas o la carta de alguien cambiaría sola. */
const hash = (seed: string) => {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h);
};

const acotar = (v: number, min: number, max: number) => (v < min ? min : v > max ? max : v);


export interface EntradaCarta {
  nombre: string;
  apodo?: string;
  handle: string;
  avatar: string;
  ficha: PlayerFicha;
  /** las "skills" de `/historia`, si esta cuenta tiene ficha de trayectoria */
  skills?: PlayerSkill[];
  /** dorsal de `/historia`, que manda sobre el de la ficha si la ficha no lo
   *  cargó: es el número con el que el jugador ya figura en el club */
  dorsalHistoria?: number;
  club: string;
  crest: string;
}

/** Arma la carta a partir del perfil.
 *
 *  Los seis atributos **no son un dato cargado**: se derivan. Hay dos fuentes,
 *  y cuál se usa cambia lo que la pantalla dice de ellos:
 *
 *  1. Si la cuenta tiene ficha en `/historia`, el nivel base es el promedio de
 *     sus `skills` — números que ya existen en el club y que la pantalla de
 *     historia viene mostrando. La carta no inventa el nivel, lo traduce.
 *  2. Si no, el nivel base sale del hash del handle, en 62–75. Es relleno, del
 *     mismo tipo que los avatares y las fotos de `lib/media.ts`, y la pantalla
 *     lo rotula como estimado (`conTrayectoria: false`).
 *
 *  En los dos casos el puesto reparte ese nivel entre los seis atributos
 *  (`PERFILES.sesgo`) y una variación chica por handle evita que dos
 *  mediocampistas del mismo nivel tengan la carta idéntica.
 */
export function construirCarta(e: EntradaCarta): CartaVM {
  const posicion: Posicion = e.ficha.posicion ?? "polifuncional";
  const perfil = PERFILES[posicion];
  const etiquetas = posicion === "arquero" ? ATRIBUTOS_ARQUERO : ATRIBUTOS_CAMPO;

  const conTrayectoria = Boolean(e.skills?.length);
  const base = conTrayectoria
    ? Math.round(e.skills!.reduce((t, s) => t + s.value, 0) / e.skills!.length)
    : 62 + (hash(e.handle) % 14);

  // La edad mueve el ritmo y nada más, y poco: es el único dato de la ficha
  // que en el videojuego se ve en la carta. Sin ficha de edad no mueve nada.
  const ajusteEdad = e.ficha.edad ? acotar(Math.round((28 - e.ficha.edad) / 2), -6, 6) : 0;

  const atributos: AtributoCarta[] = etiquetas.map(([sigla, label], i) => {
    // −5..+5 por atributo, estable por handle: dos jugadores del mismo puesto y
    // del mismo nivel no pueden tener exactamente la misma carta.
    const variacion = (hash(`${e.handle}:${i}`) % 11) - 5;
    const ritmo = i === 0 ? ajusteEdad : 0;
    return { sigla, label, valor: acotar(base + perfil.sesgo[i] + variacion + ritmo, 40, 99) };
  });

  const general = acotar(
    Math.round(atributos.reduce((t, a, i) => t + a.valor * perfil.peso[i], 0)),
    40,
    99,
  );

  // Sólo lo que la persona cargó: una carta con "— kg" y "— cm" se ve rota, y
  // la ficha es opcional entera.
  const pieDatos = [
    e.ficha.piernaHabil && { label: "Pierna hábil", valor: `Pierna ${e.ficha.piernaHabil}` },
    e.ficha.edad && { label: "Edad", valor: `${e.ficha.edad} años` },
    e.ficha.altura && { label: "Altura", valor: `${e.ficha.altura} cm` },
    e.ficha.peso && { label: "Peso", valor: `${e.ficha.peso} kg` },
    e.ficha.ciudad && { label: "Ciudad", valor: e.ficha.ciudad },
  ].filter(Boolean) as { label: string; valor: string }[];

  return {
    nombre: e.nombre,
    apodo: e.apodo ?? e.nombre.split(/\s+/)[0],
    handle: e.handle,
    avatar: e.avatar,
    // El 0 no es un dorsal válido y por eso el `||` y no el `??`: `updateFicha`
    // nunca guarda 0, pero el dorsal de historia sí podría faltar.
    dorsal: e.ficha.dorsal || e.dorsalHistoria || 0,
    puesto: PUESTO_SIGLA[posicion],
    puestoLargo: POSICION_LABEL[posicion],
    general,
    atributos,
    pieDatos,
    club: e.club,
    crest: e.crest,
    conTrayectoria,
  };
}

