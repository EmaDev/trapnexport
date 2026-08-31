/** TRAP AWARDS · SEGUNDA EDICIÓN — los datos reales del evento.
 *
 *  ⚠️ TEMPORAL. Todo lo real vive junto acá a propósito: el plantel y los
 *  premios son lo único de la app que hoy son datos de verdad y mañana salen de
 *  la base. Cuando exista Firestore, este archivo se borra entero y en su lugar
 *  quedan dos colecciones (`jugadores`, `premios`); lo que hay que conservar son
 *  las **formas** de abajo (`Jugador`, `Premio`) y las funciones que las
 *  traducen a lo que consume cada pantalla:
 *
 *    JUGADORES    → las cuentas del feed y los perfiles de /historia
 *    PREMIOS      → las encuestas del panel (`lib/contenido/store.ts`) y las
 *                   tarjetas de votación del feed (`components/organisms/FeedTabs`)
 *    opcionesDe() → los textos de las opciones de un premio, en los dos lados
 *
 *  No importa nada de `store.ts` ni de `next/*`: lo leen tanto el servidor como
 *  componentes cliente (`FeedTabs`), así que tiene que poder entrar al bundle
 *  del navegador sin arrastrar la base en memoria.
 */

export const EDICION = {
  numero: 2,
  titulo: "Trap Awards",
  subtitulo: "Segunda edición",
} as const;

/* ── plantel ─────────────────────────────────────────────────────────────── */

export interface Jugador {
  /** slug estable: es el id de la cuenta en el feed y el `?jugador=` de /historia */
  id: string;
  nombre: string;
  /** cómo se lo nombra en la cancha; es lo que se lee donde no entra el nombre */
  apodo: string;
  handle: string;
  /** llegó al plantel en esta edición — son los nominados de "Mejor incorporación" */
  incorporacion?: boolean;
}

/** El plantel de la segunda edición, en el orden en que se pasó la lista.
 *
 *  El orden importa y por eso no está alfabético: las opciones de cada premio
 *  salen de acá tal cual, y una lista por apellido le daría la primera posición
 *  a la misma persona en las catorce votaciones. */
export const JUGADORES: Jugador[] = [
  { id: "naza-sochan", nombre: "Naza Sochan", apodo: "Naza", handle: "nazasochan", incorporacion: true },
  { id: "lucas-hassan", nombre: "Lucas Hassan", apodo: "Lucho", handle: "lucashassan" },
  { id: "gonzalo-carranza", nombre: "Gonzalo Carranza", apodo: "Gonza", handle: "gonzacarranza", incorporacion: true },
  { id: "nicolas-marenzi", nombre: "Nicolas Marenzi", apodo: "Nico", handle: "nicomarenzi" },
  { id: "adrian-ledesma", nombre: "Adrian Ledesma", apodo: "Adri", handle: "adriledesma" },
  { id: "santiago-del-valle", nombre: "Santiago Del Valle", apodo: "Santi DV", handle: "santidv", incorporacion: true },
  { id: "leandro-atondo", nombre: "Leandro Atondo", apodo: "Lea", handle: "leaatondo" },
  { id: "javier-alberio", nombre: "Javier Alberio", apodo: "Javi", handle: "javialberio", incorporacion: true },
  { id: "mariano-cisterna", nombre: "Mariano Cisterna", apodo: "Mariano", handle: "marianocisterna" },
  { id: "josue-ferreiro", nombre: "Josue Ferreiro", apodo: "Josu", handle: "josuferreiro" },
  { id: "agustin-carranza", nombre: "Agustin Carranza", apodo: "Agus", handle: "aguscarranza" },
  { id: "danilo-bonino", nombre: "Danilo Bonino", apodo: "Dani", handle: "danibonino" },
  { id: "federico-rodriguez", nombre: "Federico Rodriguez", apodo: "Fede", handle: "federodriguez" },
  { id: "yago-taboada", nombre: "Yago Taboada", apodo: "Yago", handle: "yagotaboada" },
  { id: "martin-motta", nombre: "Martin Motta", apodo: "Motta", handle: "martinmotta" },
  { id: "nazareno-maciel", nombre: "Nazareno Maciel", apodo: "Maciel", handle: "nazamaciel" },
  { id: "marcos-corona", nombre: "Marcos Corona", apodo: "Corona", handle: "marcoscorona" },
  { id: "emanuel-cisterna", nombre: "Emanuel Cisterna", apodo: "Ema", handle: "emadev" },
];

export const jugadorPorId = (id: string): Jugador | undefined =>
  JUGADORES.find((j) => j.id === id);

/* ── premios ─────────────────────────────────────────────────────────────── */

/** De dónde salen las opciones de un premio.
 *
 *    plantel     se vota entre los dieciocho — la mayoría de las categorías
 *    nominados   lista corta y cerrada (hoy sólo "Mejor incorporación")
 *    clips       se vota un video, no una persona: gol, caño y asistencia
 *
 *  La distinción no es cosmética: `clips` es lo único que todavía no tiene
 *  datos —los videos no están cargados—, así que esos tres premios nacen en
 *  borrador con opciones de relleno y son los únicos que hay que tocar cuando
 *  el material exista. */
export type FuenteOpciones = "plantel" | "nominados" | "clips";

export interface Premio {
  id: string;
  /** el nombre del premio, tal como se anuncia */
  nombre: string;
  /** la pregunta que se le hace al que vota */
  pregunta: string;
  descripcion?: string;
  fuente: FuenteOpciones;
  /** permite elegir más de uno (el once ideal son once) */
  multiple?: boolean;
  /** tope de opciones cuando es `multiple` */
  maxOpciones?: number;
  /** ids de `JUGADORES`; sólo con `fuente: "nominados"` */
  nominados?: string[];
  /** cómo se llama cada video en las opciones de relleno: "Gol", "Caño"… */
  etiquetaClip?: string;
}

/** Cuántas opciones de relleno lleva un premio de video mientras no haya
 *  material cargado. */
const CLIPS_PENDIENTES = 3;

export const PREMIOS: Premio[] = [
  {
    id: "once-ideal",
    nombre: "Once ideal",
    pregunta: "¿Quiénes entran en el once ideal de la temporada?",
    descripcion: "Elegí once. El equipo se arma con los más votados.",
    fuente: "plantel",
    multiple: true,
    maxOpciones: 11,
  },
  {
    id: "revelacion",
    nombre: "Revelación",
    pregunta: "¿Quién fue la revelación del año?",
    fuente: "plantel",
  },
  {
    id: "mejor-gol",
    nombre: "Mejor gol",
    pregunta: "¿Cuál fue el mejor gol del año?",
    descripcion: "Se vota sobre los goles grabados.",
    fuente: "clips",
    etiquetaClip: "Gol",
  },
  {
    id: "mejor-incorporacion",
    nombre: "Mejor incorporación",
    pregunta: "¿Cuál fue la mejor incorporación?",
    descripcion: "Los cuatro que se sumaron en esta edición.",
    fuente: "nominados",
    nominados: ["javier-alberio", "santiago-del-valle", "naza-sochan", "gonzalo-carranza"],
  },
  {
    id: "fachero",
    nombre: "Fachero",
    pregunta: "¿Quién es el fachero del año?",
    fuente: "plantel",
  },
  {
    id: "pollera",
    nombre: "Pollera",
    pregunta: "¿Quién se lleva la pollera?",
    fuente: "plantel",
  },
  {
    id: "mejor-cano",
    nombre: "Mejor caño",
    pregunta: "¿Cuál fue el mejor caño del año?",
    descripcion: "Se vota sobre los caños grabados.",
    fuente: "clips",
    etiquetaClip: "Caño",
  },
  {
    id: "mejor-arquero",
    nombre: "Mejor arquero",
    pregunta: "¿Quién fue el mejor arquero del año?",
    fuente: "plantel",
  },
  {
    id: "mejor-asistencia",
    nombre: "Mejor asistencia",
    pregunta: "¿Cuál fue la mejor asistencia del año?",
    descripcion: "Se vota sobre las asistencias grabadas.",
    fuente: "clips",
    etiquetaClip: "Asistencia",
  },
  {
    id: "polifuncional",
    nombre: "Jugador polifuncional",
    pregunta: "¿Quién anduvo bien en más posiciones?",
    descripcion: "El que jugó en varias posiciones sin que se note el cambio.",
    fuente: "plantel",
  },
  {
    id: "tipazo",
    nombre: "Tipazo del año",
    pregunta: "¿Quién es el tipazo del año?",
    fuente: "plantel",
  },
  {
    id: "fail",
    nombre: "Fail del año",
    pregunta: "¿Quién se lleva el fail del año?",
    fuente: "plantel",
  },
  {
    id: "aura",
    nombre: "Jugador Aura",
    pregunta: "¿Quién tiene el aura?",
    fuente: "plantel",
  },
  {
    id: "gol-agonico",
    nombre: "Gol agónico",
    pregunta: "¿Quién metió el gol agónico del año?",
    fuente: "plantel",
  },
  {
    id: "mejor-prime",
    nombre: "Mejor prime",
    pregunta: "¿Quién está en su mejor prime?",
    fuente: "plantel",
  },
  {
    id: "mejor-jugador",
    nombre: "Mejor jugador",
    pregunta: "¿Quién fue el mejor jugador del año?",
    fuente: "plantel",
  },
  {
    id: "historico",
    nombre: "Jugador Histórico",
    pregunta: "¿Quién es el jugador histórico?",
    fuente: "plantel",
  },
];

/** Los premios que se votan sobre video: mejor gol, mejor caño y mejor
 *  asistencia. Son los únicos sin datos reales todavía —las opciones que
 *  devuelve `opcionesDe` son de relleno— y por eso nacen en borrador en el
 *  panel y se muestran cerrados en el feed. */
export const esPremioDeVideo = (premio: Premio): boolean => premio.fuente === "clips";

/** Los textos de las opciones de un premio, en orden y listos para mostrar.
 *
 *  Devuelve strings y no ids porque es lo que espera `OpcionEncuesta.texto`:
 *  una opción de encuesta es una oración, no una referencia. El día que los
 *  premios salgan de la base, esto pasa a ser el `map` de la relación
 *  premio → nominados y las pantallas no se enteran. */
export function opcionesDe(premio: Premio): string[] {
  if (premio.fuente === "clips") {
    const etiqueta = premio.etiquetaClip ?? "Clip";
    return Array.from(
      { length: CLIPS_PENDIENTES },
      (_, i) => `${etiqueta} ${i + 1} · video pendiente`,
    );
  }

  const lista =
    premio.fuente === "nominados"
      ? (premio.nominados ?? [])
          .map(jugadorPorId)
          .filter((j): j is Jugador => Boolean(j))
      : JUGADORES;

  return lista.map((j) => j.nombre);
}
