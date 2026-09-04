/** Los tipos de la historia del club, sin datos ni acceso a base.
 *
 *  Viven separados de `seed.ts` (los datos de arranque) y de `queries.ts`
 *  (Firestore) por una razón concreta: los importan tanto las pantallas
 *  públicas —que son cliente— como el panel y las Server Actions. Un archivo
 *  de tipos puros se borra entero en compilación, así que `import type` desde
 *  un componente cliente no arrastra ni las mil líneas de datos semilla ni el
 *  Admin SDK al bundle del navegador.
 *
 *  Cinco colecciones, cada una con su pantalla:
 *
 *    CLUB      identidad — escudo, fundación, colores, palmarés
 *    ERAS      la línea de tiempo grande: 2020 → hoy, por etapa
 *    SEASONS   una temporada en detalle → `/historia/:año`
 *    PLAYERS   trayectoria individual: skills, fotos, clips, frase
 *    QUOTES    frases célebres, sueltas de cualquier año
 *
 *  Todas se editan desde `/admin/historia`.
 */

/*  La ficha que edita la persona en `/perfil` vive en el módulo social —es un
 *  dato de la cuenta, no del club— y la historia sólo la muestra. La flecha va
 *  en una sola dirección a propósito: `lib/social/types.ts` no importa nada de
 *  acá. */
import type { PlayerFicha } from "@/lib/social/types";

/* ── identidad ───────────────────────────────────────────────────────────── */

export interface ClubIdentity {
  name: string;
  /** cómo le dice la gente; sale en el hero y en los subtítulos */
  nickname: string;
  founded: number;
  /** dónde juega hoy; sale junto al apodo en el hero */
  stadium: string;
  colors: string;
  motto: string;
  /** jugadores que pasaron por el plantel a lo largo de la historia — el hero
   *  lo cuenta con `CountUp` */
  members: number;
  /** ruta del escudo en `public/` */
  crest: string;
  /** el párrafo de apertura de la pantalla */
  intro: string;
}

export interface Trophy {
  id: string;
  name: string;
  /** cuántas veces, ya formateado ("×3") o vacío si es una sola */
  times: number;
  years: string;
  /** la foto de la copa, recortada con fondo transparente.
   *
   *  Opcional: los documentos que ya estaban en Firestore antes del carrusel
   *  no la tienen, y una copa sin foto no es una fila rota — `PalmaresRail`
   *  cae en el trofeo generado por `trophyUrl` y se ve igual de armada. */
  photo?: string;
}

/** El balance de finales, tal como lo cierra `data.txt`.
 *
 *  No sale del palmarés ni se calcula: las finales perdidas —la de la Liga
 *  Núñez en diciembre de 2024 y la otra— no dejan trofeo, así que contarlas
 *  desde los trofeos daría 3 de 3 y borraría justo la mitad de la historia que
 *  explica por qué la tercera importa. Por eso se carga a mano en el panel. */
export interface Balance {
  finales: number;
  ganadas: number;
  perdidas: number;
  estrellas: number;
}

/* ── la línea de tiempo grande ───────────────────────────────────────────── */

/** El tipo de hito define su color y su ícono en el timeline.
 *
 *  `derrota` y `homenaje` son los dos en tono serio: una historia de club sin
 *  la parte difícil no es una historia, y no todo lo difícil es una derrota
 *  deportiva — `homenaje` existe puntualmente para la pérdida de Yannick
 *  Castelo en 2023, sin la connotación de "resultado adverso" que tendría
 *  reusar `derrota` para eso. */
export type MilestoneKind =
  | "titulo"
  | "ascenso"
  | "derrota"
  | "debut"
  | "obra"
  | "partido"
  | "homenaje"
  | "evento";

export interface Milestone {
  id: string;
  /** cuándo, tal como se muestra: "Mayo 2016", "12/11/2011" */
  date: string;
  title: string;
  description: string;
  kind: MilestoneKind;
}

export interface Era {
  id: string;
  /** el rango de años, que hace de "número" del capítulo */
  period: string;
  title: string;
  tagline: string;
  description: string;
  photo: string;
  /** la etapa que todavía se está jugando marca el timeline como "en curso" */
  current?: boolean;
  stats: { label: string; value: string }[];
  milestones: Milestone[];
}

/* ── frases célebres ─────────────────────────────────────────────────────── */

export interface Quote {
  id: string;
  text: string;
  author: string;
  /** quién era esa persona cuando lo dijo */
  role: string;
  year: number;
  avatar: string;
}

/* ── fotos y clips ───────────────────────────────────────────────────────── */

export interface Photo {
  id: string;
  src: string;
  alt: string;
  caption: string;
  year: number;
}

/** Un clip del archivo.
 *
 *  `poster` y `motion` son el mismo SVG generado con y sin animación: la card
 *  muestra el primero y pasa al segundo mientras "reproduce". `src` es el
 *  hueco del `.mp4` real — cuando exista, `ClipCard` monta el `VideoPlayer` de
 *  la librería y los dos SVG quedan sólo como póster.
 */
export interface Clip {
  id: string;
  title: string;
  description: string;
  year: number;
  /** duración ya formateada, tal como se muestra en el badge */
  duration: string;
  poster: string;
  motion: string;
  src?: string;
}

/* ── jugadores ───────────────────────────────────────────────────────────── */

export type PlayerStatus = "plantel" | "leyenda";

export interface PlayerSkill {
  label: string;
  /** 0 a 100 — es la escala de `ProgressBar`, no una nota sobre 10 */
  value: number;
}

export interface CareerStep {
  id: string;
  season: string;
  title: string;
  description: string;
  status: "done" | "current";
}

export interface Player {
  id: string;
  name: string;
  nickname: string;
  number: number;
  position: string;
  /** "2022 — 2021" o "2019 — hoy" */
  years: string;
  status: PlayerStatus;
  foot: string;
  height: string;
  birthplace: string;
  photo: string;
  avatar: string;
  bio: string;
  stats: { label: string; value: string }[];
  /** vacío en las fichas en memoria: ver el comentario de Yannick Castelo,
   *  más abajo, y el guard en `PlayerSpotlight`. */
  skills: PlayerSkill[];
  career: CareerStep[];
  gallery: Photo[];
  clips: Clip[];
  /** ausente en las fichas en memoria: no hay transcripción real de lo que
   *  dijo, e inventar una cita a nombre de una persona real que ya no está
   *  no es el tipo de "relleno" que corresponde acá. */
  quote?: Quote;

  /* ── lo que cargó la persona ───────────────────────────────────────────── */

  /** La ficha que el propio jugador editó en `/perfil`, si tiene cuenta.
   *
   *  **No sale de esta colección**: la trae `getPlayers()` cruzando el id de
   *  esta ficha con el `playerId` de `trapnexport-user`. Es un dato de la
   *  cuenta, no del club, y por eso vive en la cuenta — el panel lo edita
   *  desde la solapa "Fichas", que escribe el mismo documento que escribiría la
   *  persona.
   *
   *  Ausente cuando nadie reclamó a ese jugador. Presente pero vacía (`{}`)
   *  cuando la cuenta existe y todavía no completó nada: son dos casos
   *  distintos y el panel los muestra distinto.
   *
   *  Gana sobre los campos de arriba en `PlayerSpotlight`, campo por campo: lo
   *  que la persona dice de sí misma está más al día que la ficha
   *  institucional, y lo que no cargó cae a la del club. */
  ficha?: PlayerFicha;
  /** handle de esa cuenta, para poder linkear a `/u/:handle` desde la ficha */
  handle?: string;
}

/* ── temporadas ──────────────────────────────────────────────────────────── */

export interface SeasonHighlight {
  id: string;
  month: string;
  title: string;
  description: string;
  kind: MilestoneKind;
}

export interface Season {
  year: number;
  /** cómo se recuerda esa temporada, en pocas palabras */
  title: string;
  tagline: string;
  cover: string;
  competition: string;
  /** dónde terminó — cuando no hay una posición numérica real, una frase que
   *  resume el resultado ("Finalista", "Sin registro") */
  position: string;
  /** "Sin registro" cuando `data.txt` no dice quién era */
  captain: string;
  topScorer: string;
  stats: { label: string; value: string }[];
  highlights: SeasonHighlight[];
  /** ids de `PLAYERS` que marcaron la temporada, con el motivo */
  hallOfFame: { playerId: string; reason: string }[];
  gallery: Photo[];
  clips: Clip[];
  quote?: Quote;
}

/* ── la pantalla entera ──────────────────────────────────────────────────── */

/** Todo lo que consume `/historia`, en un solo objeto. Lo arma
 *  `queries.getHistoria()` y lo recibe `HistoriaClient` como prop. */
export interface Historia {
  club: ClubIdentity;
  balance: Balance;
  trophies: Trophy[];
  eras: Era[];
  seasons: Season[];
  players: Player[];
  quotes: Quote[];
  gallery: Photo[];
  clips: Clip[];
}
