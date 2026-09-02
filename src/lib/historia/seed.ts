import {
  type Balance,
  type Clip,
  type ClubIdentity,
  type Era,
  type Photo,
  type Player,
  type Quote,
  type Season,
  type Trophy,
} from "@/lib/historia/types";
import { avatarUrl, clipUrl, photoUrl, playerPhotoUrl } from "@/lib/media";

/** La historia del club, tal como se cargó de arranque: 2020 → hoy.
 *
 *  Esto es la **semilla**, no la fuente de verdad. La fuente de verdad es
 *  Firestore, y se edita entera desde `/admin/historia`: identidad, palmarés,
 *  balance, etapas, temporadas, jugadores, frases, fotos y clips. Lo de acá es
 *  lo que `queries.ts` devuelve mientras una colección todavía esté vacía y lo
 *  que el botón "Importar contenido actual" del panel copia a la base la
 *  primera vez.
 *
 *  Sigue existiendo por dos motivos que no son nostalgia:
 *
 *  1. La app arranca mostrando la historia completa en un proyecto de Firebase
 *     recién creado, sin un paso de seed obligatorio entre `npm run dev` y la
 *     primera pantalla.
 *  2. Es el texto original contra el que comparar si alguien borra algo del
 *     panel por error.
 *
 *  ⚠️ TODO lo de acá sale de `data.txt`, la historia real de Trap N Export:
 *  nace en 2020, en plena pandemia, jugando FIFA 20; salta al fútbol 8 en
 *  2022; atraviesa en 2023 el golpe más duro de su historia y se reforma en
 *  fútbol 11; pierde su primera final en 2024; gana las dos primeras estrellas
 *  en 2025 (Mega Fútbol y Liga Oeste); y cierra la tercera en la Copa Oro de
 *  2026. Los nombres, fechas, resultados y goleadores son los reales. Lo que
 *  `data.txt` no dice —números de camiseta, posiciones, "skills" en escala de
 *  0 a 100, alguna frase de color— es relleno liviano en el mismo tono que ya
 *  tenía `trap-awards.ts` para este mismo plantel: una app privada para el
 *  grupo, no una biografía pública.
 *
 *  Yannick Castelo es la única excepción a ese relleno: `data.txt` cuenta que
 *  su pérdida en 2023 disolvió al equipo casi cuatro meses, y esa ficha va sin
 *  "skills" ni frase inventada — sólo lo que se sabe, en su memoria. Ver el
 *  guard de `player.skills.length` / `player.quote` en `PlayerSpotlight`.
 *
 *  El `id` de cada jugador real es el mismo que el de `JUGADORES` en
 *  `lib/trap-awards.ts`, así que el día que eso salga de la base, los
 *  perfiles se emparejan sin traducción de por medio.
 */

export const CLUB: ClubIdentity = {
  name: "Trap N Export",
  nickname: "Trapero",
  founded: 2020,
  stadium: "Ciudad Evita",
  colors: "Violeta, blanco y negro",
  motto: "Vamos Trap",
  crest: "/escudo.svg",
  members: 26,
  intro:
    "Seis años, seis capítulos: el grupo de amigos que arrancó jugando FIFA " +
    "20 en pandemia, el salto al fútbol 8, el golpe más duro de su historia, " +
    "el primer gran sueño, el año que lo cambió todo y la tercera estrella. " +
    "Abajo está entera, capítulo por capítulo, con los que la jugaron.",
};

/** Las tres copas del club.
 *
 *  `photo` apunta a `public/trofeos/`: son las fotos reales de los trofeos,
 *  PNG recortados con fondo transparente, y son assets de marca como el
 *  escudo — no placeholders. Por eso van al repo y no a Storage: se ven
 *  igual en un proyecto de Firebase recién creado, que es la razón de ser de
 *  esta semilla.
 *
 *  Si un archivo todavía no está, `PalmaresRail` cae en la copa generada por
 *  `trophyUrl` y la card se ve armada igual — de ahí que el import siga acá.
 */
export const TROPHIES: Trophy[] = [
  {
    id: "t1",
    name: "Mega Fútbol · 90 Minutos",
    times: 1,
    years: "2025",
    photo: "/trofeos/90-minutos.png",
  },
  {
    id: "t2",
    name: "Liga Oeste",
    times: 1,
    years: "2025",
    photo: "/trofeos/liga-oeste.png",
  },
  {
    id: "t3",
    name: "Copa Oro · La Caprichosa",
    times: 1,
    years: "2026",
    photo: "/trofeos/caprichosa.png",
  },
];

/** El balance de finales, tal como lo cierra `data.txt`.
 *
 *  No sale de `TROPHIES` ni se calcula: las dos finales perdidas —la de la
 *  Liga Núñez en diciembre de 2024 y la otra— no dejan trofeo, así que
 *  contarlas desde el palmarés daría 3 de 3 y borraría justo la mitad de la
 *  historia que explica por qué la tercera importa. */
export const BALANCE: Balance = {
  finales: 5,
  ganadas: 3,
  perdidas: 2,
  estrellas: 3,
};

export const ERAS: Era[] = [
  {
    id: "era-2020",
    period: "2020",
    title: "El comienzo",
    tagline: "Un grupo de amigos jugando FIFA 20 en plena pandemia.",
    description:
      "Trap N Export nace en 2020, en plena pandemia, de una manera muy " +
      "distinta a como terminaría desarrollándose su historia: jugando FIFA " +
      "20. Lo que parece simplemente un grupo de amigos compartiendo " +
      "partidos virtuales termina convirtiéndose, con el tiempo, en algo " +
      "mucho más grande.",
    photo: photoUrl("era-2020"),
    stats: [
      { label: "Fundación", value: "2020" },
      { label: "Formato", value: "FIFA 20" },
      { label: "Contexto", value: "Pandemia" },
    ],
    milestones: [
      {
        id: "m1",
        date: "2020",
        title: "Nace Trap N Export",
        description:
          "Un grupo de amigos empieza a jugar FIFA 20 en pandemia. Nadie " +
          "imaginaba todavía hasta dónde iba a llegar esto.",
        kind: "obra",
      },
    ],
  },
  {
    id: "era-2022",
    period: "2022",
    title: "El primer desafío",
    tagline: "Trap da el salto al fútbol real: fútbol 8 en Pura Gambeta.",
    description:
      "Dos años después de nacer frente a una pantalla, Trap da el salto al " +
      "fútbol real. El equipo disputa sus primeros partidos de fútbol 8 en " +
      "Pura Gambeta, en el Club Galopo: el comienzo de Trap dentro de las " +
      "canchas.",
    photo: photoUrl("era-2022"),
    stats: [
      { label: "Formato", value: "Fútbol 8" },
      { label: "Torneo", value: "Pura Gambeta" },
      { label: "Cancha", value: "Club Galopo" },
    ],
    milestones: [
      {
        id: "m2",
        date: "2022",
        title: "Primeros partidos de fútbol 8",
        description:
          "Trap juega sus primeros partidos oficiales en Pura Gambeta, en " +
          "el Club Galopo. El comienzo de Trap dentro de las canchas.",
        kind: "debut",
      },
    ],
  },
  {
    id: "era-2023",
    period: "2023",
    title: "Los Trap Awards y el golpe más duro",
    tagline:
      "Una noche para celebrar al equipo, y una semana después, todo cambia.",
    description:
      "Se realizan los Trap Awards, una ceremonia para reconocer y premiar " +
      "a los jugadores del equipo en distintas ternas, al estilo de los " +
      "Martín Fierro, cerrada con una velada de boxeo entre integrantes del " +
      "equipo. Apenas una semana después, todo cambia: la pérdida de " +
      "Yannick Castelo provoca la disolución del equipo durante " +
      "aproximadamente cuatro meses. Pero Trap no desaparece — en noviembre " +
      "de 2023 el equipo vuelve a juntarse, esta vez con un nuevo desafío: " +
      "fútbol 11.",
    photo: photoUrl("era-2023"),
    stats: [
      { label: "Evento", value: "Trap Awards" },
      { label: "Boxeo", value: "3 combates" },
      { label: "Sin equipo", value: "~4 meses" },
    ],
    milestones: [
      {
        id: "m3",
        date: "2023",
        title: "Los Trap Awards",
        description:
          "Ceremonia creada para reconocer y premiar a los jugadores del " +
          "equipo en distintas ternas, al estilo de los Martín Fierro. " +
          "Cierra con una velada de boxeo: Yannick Castelo vs. Josué " +
          "Ferreiro, Adrián Ledesma vs. Nazareno Maciel y Federico " +
          "Rodríguez vs. Lautaro Montañez.",
        kind: "evento",
      },
      {
        id: "m4",
        date: "2023",
        title: "El golpe más duro",
        description:
          "Apenas una semana después de los Trap Awards, la pérdida de " +
          "Yannick Castelo provoca la disolución del equipo durante " +
          "aproximadamente cuatro meses.",
        kind: "homenaje",
      },
      {
        id: "m5",
        date: "Noviembre 2023",
        title: "Trap vuelve a juntarse",
        description:
          "El equipo se reforma, esta vez con un nuevo desafío: fútbol 11.",
        kind: "debut",
      },
    ],
  },
  {
    id: "era-2024",
    period: "2024",
    title: "El primer gran sueño",
    tagline: "Liga Núñez y la primera final de la historia.",
    description:
      "Trap se inscribe en la Liga Núñez y compite de manera cada vez más " +
      "seria, hasta conseguir algo que hasta ese momento parecía lejano: " +
      "llegar a una final. En diciembre de 2024 disputa la primera final de " +
      "su historia, pero el resultado no es el esperado: Trap pierde. La " +
      "primera gran oportunidad termina en derrota, pero deja algo claro — " +
      "Trap estaba para cosas grandes.",
    photo: photoUrl("era-2024"),
    stats: [
      { label: "Competencia", value: "Liga Núñez" },
      { label: "Finales", value: "1" },
      { label: "Resultado", value: "Subcampeón" },
    ],
    milestones: [
      {
        id: "m6",
        date: "2024",
        title: "Trap se inscribe en la Liga Núñez",
        description: "El equipo compite de manera cada vez más seria.",
        kind: "obra",
      },
      {
        id: "m7",
        date: "Diciembre 2024",
        title: "La primera final de la historia",
        description: "Trap llega a una final por primera vez.",
        kind: "ascenso",
      },
      {
        id: "m8",
        date: "Diciembre 2024",
        title: "Se pierde la final",
        description:
          "El resultado no es el esperado. La primera gran oportunidad " +
          "termina en derrota — pero deja claro que Trap estaba para cosas " +
          "grandes.",
        kind: "derrota",
      },
    ],
  },
  {
    id: "era-2025",
    period: "2025",
    title: "El año que cambió todo",
    tagline: "Dos torneos, dos títulos: la primera y la segunda estrella.",
    description:
      "Trap sigue en la Liga Núñez y llega a clasificarse a la Sudamericana, " +
      "pero decide dejarla para afrontar un nuevo desafío: el torneo de " +
      "Mega Fútbol, organizado por 90 Minutos. Y esta vez sí — Trap es " +
      "campeón. Llega la primera estrella. Después del título, el equipo " +
      "cambia de escenario otra vez y se incorpora a la Liga Oeste. El 22 " +
      "de diciembre de 2025 vuelve a disputar una final, y esta vez la " +
      "historia es completamente distinta: TRAP GANA 5-0, una goleada " +
      "histórica para cerrar el año. Trap termina 2025 como campeón, con su " +
      "segunda estrella.",
    photo: photoUrl("era-2025"),
    stats: [
      { label: "Títulos", value: "2" },
      { label: "Torneos", value: "3" },
      { label: "22 dic", value: "5-0" },
    ],
    milestones: [
      {
        id: "m9",
        date: "2025",
        title: "Clasifica a la Sudamericana",
        description:
          "Compitiendo en la Liga Núñez, Trap consigue clasificarse a la " +
          "Sudamericana.",
        kind: "ascenso",
      },
      {
        id: "m10",
        date: "2025",
        title: "Deja la Liga Núñez por el Mega Fútbol",
        description:
          "Trap decide abandonar la Liga Núñez y afrontar un nuevo " +
          "desafío: el torneo de Mega Fútbol, organizado por 90 Minutos.",
        kind: "obra",
      },
      {
        id: "m11",
        date: "2025",
        title: "Campeón del Mega Fútbol — primera estrella",
        description: "Y esta vez sí: Trap es campeón. Llega la primera estrella.",
        kind: "titulo",
      },
      {
        id: "m12",
        date: "2025",
        title: "Se incorpora a la Liga Oeste",
        description: "Después del título, Trap vuelve a cambiar de escenario.",
        kind: "obra",
      },
      {
        id: "m13",
        date: "22 de diciembre de 2025",
        title: "TRAP GANA 5-0 — segunda estrella",
        description:
          "Una goleada histórica para cerrar el año, con goles de Adrián " +
          "Ledesma, Yago Taboada, Nazareno Maciel y un doblete de Martín " +
          "Motta. Trap termina 2025 como campeón.",
        kind: "titulo",
      },
    ],
  },
  {
    id: "era-2026",
    period: "2026 — hoy",
    title: "La tercera estrella",
    tagline: "Ciudad Evita, La Caprichosa, y el 1-0 que corona la Copa Oro.",
    description:
      "Después de un 2025 inolvidable, Trap descansa en enero y en febrero " +
      "enfrenta un nuevo desafío: volver al fútbol 11, esta vez en Ciudad " +
      "Evita, en el torneo La Caprichosa. En el Apertura clasifica entre " +
      "los ocho mejores equipos y se gana un lugar en la Copa Oro. En la " +
      "Copa Oro vuelve a demostrar la característica que lo acompañó toda " +
      "su historia — cuando está contra las cuerdas, pone el pecho — y " +
      "clasifica primero de su grupo. En semifinales enfrenta a El Inter, " +
      "campeón del Apertura y candidato del torneo, y gana 2-1 con goles de " +
      "Gonzalo Carranza y Nazareno Maciel. En la final, Trap gana 1-0 con " +
      "un gol de su capitán, Nazareno Maciel, y se consagra campeón de la " +
      "Copa Oro: la tercera estrella.",
    photo: photoUrl("era-2026"),
    current: true,
    stats: [
      { label: "Títulos", value: "1" },
      { label: "Semifinal", value: "2-1" },
      { label: "Final", value: "1-0" },
    ],
    milestones: [
      {
        id: "m14",
        date: "Febrero 2026",
        title: "Vuelve al fútbol 11: Ciudad Evita",
        description: "Un nuevo desafío: el torneo La Caprichosa, en Ciudad Evita.",
        kind: "debut",
      },
      {
        id: "m15",
        date: "2026",
        title: "Apertura: clasifica a la Copa Oro",
        description:
          "Trap disputa el Apertura y consigue clasificarse entre los ocho " +
          "mejores equipos, con la Copa Oro como premio.",
        kind: "ascenso",
      },
      {
        id: "m16",
        date: "2026",
        title: "Primero de grupo en la Copa Oro",
        description:
          "Cuando está contra las cuerdas, Trap pone el pecho: clasifica " +
          "primero de su grupo.",
        kind: "ascenso",
      },
      {
        id: "m17",
        date: "2026",
        title: "Semifinal ante El Inter: gana 2-1",
        description:
          "Contra el campeón del Apertura y candidato del torneo, en una " +
          "semifinal agónica. Goles de Gonzalo Carranza y Nazareno Maciel.",
        kind: "partido",
      },
      {
        id: "m18",
        date: "2026",
        title: "TRAP 1-0 — tercera estrella",
        description:
          "El gol lo marca el capitán, Nazareno Maciel. Trap se consagra " +
          "campeón de la Copa Oro.",
        kind: "titulo",
      },
    ],
  },
];

const quote = (
  id: string,
  text: string,
  author: string,
  role: string,
  year: number,
): Quote => ({ id, text, author, role, year, avatar: avatarUrl(author, id) });

/** Las cuatro de acá no son frases de una persona: son líneas textuales de
 *  `data.txt`, la historia real, recontextualizadas como "frases" del equipo
 *  sobre sí mismo. No hay una transcripción real de quién dijo qué en cada
 *  momento, así que atribuírselas a un jugador puntual sería inventar una
 *  cita en boca de una persona real — esto no. Por eso el avatar es el
 *  escudo, no un retrato generado. */
export const QUOTES: Quote[] = [
  {
    id: "q1",
    text: "Cuando está contra las cuerdas, pone el pecho.",
    author: "Trap N Export",
    role: "Sobre la Copa Oro 2026",
    year: 2026,
    avatar: CLUB.crest,
  },
  {
    id: "q2",
    text: "La historia recién empieza. Tenemos para rato.",
    author: "Trap N Export",
    role: "Después de la tercera estrella",
    year: 2026,
    avatar: CLUB.crest,
  },
  {
    id: "q3",
    text: "Trap estaba para cosas grandes.",
    author: "Trap N Export",
    role: "Después de la final perdida de 2024",
    year: 2024,
    avatar: CLUB.crest,
  },
  {
    id: "q4",
    text: "Y esta vez sí.",
    author: "Trap N Export",
    role: "Al ser campeón del Mega Fútbol",
    year: 2025,
    avatar: CLUB.crest,
  },
];

const photo = (id: string, caption: string, year: number, alt = caption): Photo => ({
  id,
  src: photoUrl(id),
  alt,
  caption,
  year,
});

const clip = (
  id: string,
  title: string,
  description: string,
  year: number,
  duration: string,
): Clip => ({
  id,
  title,
  description,
  year,
  duration,
  poster: clipUrl(id),
  motion: clipUrl(id, true),
});

export const GALLERY: Photo[] = [
  photo("g1", "Los primeros picados por FIFA 20, en plena pandemia", 2020),
  photo("g2", "El debut en Pura Gambeta, Club Galopo", 2022),
  photo("g3", "Los Trap Awards, la ceremonia", 2023),
  photo("g4", "La velada de boxeo que cerró los Trap Awards", 2023),
  photo("g5", "El regreso al fútbol 11, en noviembre", 2023),
  photo("g6", "La primera final de la historia, Liga Núñez", 2024),
  photo("g7", "Campeones del Mega Fútbol: la primera estrella", 2025),
  photo("g8", "22 de diciembre: 5-0 y la segunda estrella", 2025),
  photo("g9", "Campeones de la Copa Oro: la tercera estrella", 2026),
];

export const CLIPS: Clip[] = [
  clip("c1", "El regreso al fútbol 11", "Noviembre de 2023: Trap se junta otra vez.", 2023, "1:20"),
  clip("c2", "Los cinco goles del 22 de diciembre", "La goleada 5-0 que cerró el 2025.", 2025, "2:30"),
  clip("c3", "El doblete de Martín Motta", "Los dos goles de la final del 22 de diciembre.", 2025, "0:50"),
  clip("c4", "La semifinal ante El Inter", "2-1, con goles de Carranza y Maciel.", 2026, "2:10"),
  clip("c5", "El gol de Maciel en la final", "TRAP 1-0. La tercera estrella.", 2026, "0:45"),
  clip("c6", "Campeones de la Copa Oro", "El resumen completo de la final.", 2026, "3:00"),
];

export const PLAYERS: Player[] = [
  {
    id: "yannick-castelo",
    name: "Yannick Castelo",
    nickname: "Yannick",
    number: 8,
    position: "Fundador",
    years: "2020 — 2023",
    status: "leyenda",
    // Sin foot/height/birthplace inventados: son datos personales de una
    // persona real que ya no está, y no hay por qué fabricarlos.
    foot: "—",
    height: "—",
    birthplace: "—",
    photo: playerPhotoUrl("Yannick Castelo", 8, "yannick-castelo"),
    avatar: avatarUrl("Yannick Castelo", "yannick-castelo"),
    bio:
      "Parte del grupo que empezó todo, jugando FIFA 20 en 2020. Estuvo en " +
      "el salto al fútbol real y en los Trap Awards de 2023, arriba del " +
      "ring. Una semana después, Trap perdió al que había estado ahí desde " +
      "el primer día. Su pérdida es, hasta hoy, el golpe más duro de la " +
      "historia del club — y el motivo por el que, meses después, Trap " +
      "decidió no desaparecer.",
    stats: [
      { label: "En Trap desde", value: "2020" },
      { label: "Trap Awards", value: "2023" },
      { label: "En el recuerdo", value: "Siempre" },
    ],
    skills: [],
    career: [
      {
        id: "yc-1",
        season: "2020",
        title: "Uno de los que empezó todo",
        description:
          "Parte del grupo que fundó Trap N Export jugando FIFA 20, en " +
          "plena pandemia.",
        status: "done",
      },
      {
        id: "yc-2",
        season: "2022",
        title: "El salto al fútbol real",
        description:
          "Parte del plantel que disputó los primeros partidos de fútbol 8 " +
          "en Pura Gambeta.",
        status: "done",
      },
      {
        id: "yc-3",
        season: "2023",
        title: "Los Trap Awards",
        description:
          "Sube al ring en la velada de boxeo que cerró la ceremonia, " +
          "frente a Josué Ferreiro.",
        status: "done",
      },
      {
        id: "yc-4",
        season: "2023",
        title: "Se va, y deja una marca imborrable",
        description:
          "Una semana después de los Trap Awards. Trap se disuelve durante " +
          "casi cuatro meses, y vuelve con su nombre en el corazón.",
        status: "done",
      },
    ],
    gallery: [photo("yc-p1", "Los Trap Awards, 2023", 2023)],
    clips: [],
  },
  {
    id: "nazareno-maciel",
    name: "Nazareno Maciel",
    nickname: "Maciel",
    number: 10,
    position: "Capitán",
    years: "2022 — hoy",
    status: "plantel",
    foot: "Derecho",
    height: "1,78 m",
    birthplace: "Buenos Aires",
    photo: playerPhotoUrl("Nazareno Maciel", 10, "nazareno-maciel"),
    avatar: avatarUrl("Nazareno Maciel", "nazareno-maciel"),
    bio:
      "Capitán de Trap y autor del gol que le dio al equipo su tercera " +
      "estrella. Subió al ring en los Trap Awards de 2023, metió un gol en " +
      "la goleada 5-0 del 22 de diciembre de 2025 y fue determinante en la " +
      "Copa Oro 2026: marcó en la semifinal ante El Inter y volvió a " +
      "marcar en la final, para el 1-0 que consagró campeón a Trap.",
    stats: [
      { label: "Estrellas", value: "3" },
      { label: "Goles en Copa Oro 2026", value: "2" },
      { label: "Capitán", value: "Sí" },
    ],
    skills: [
      { label: "Liderazgo", value: 92 },
      { label: "Definición", value: 85 },
      { label: "Visión de juego", value: 83 },
      { label: "Recuperación", value: 78 },
      { label: "Movilidad", value: 80 },
    ],
    career: [
      {
        id: "nm-1",
        season: "2023",
        title: "Sube al ring en los Trap Awards",
        description: "Se enfrenta a Adrián Ledesma en la velada de boxeo.",
        status: "done",
      },
      {
        id: "nm-2",
        season: "2024",
        title: "La primera final de la historia",
        description: "Juega la final de la Liga Núñez, que Trap termina perdiendo.",
        status: "done",
      },
      {
        id: "nm-3",
        season: "2025",
        title: "Gol en la segunda estrella",
        description:
          "Marca en la goleada 5-0 del 22 de diciembre, la final que le dio " +
          "a Trap su segunda estrella.",
        status: "done",
      },
      {
        id: "nm-4",
        season: "2026",
        title: "Capitán de la tercera estrella",
        description:
          "Gol en la semifinal ante El Inter y gol en la final: el 1-0 que " +
          "consagró campeón a Trap en la Copa Oro.",
        status: "current",
      },
    ],
    gallery: [
      photo("nm-p1", "El gol de la final de la Copa Oro", 2026),
      photo("nm-p2", "Semifinal ante El Inter", 2026),
    ],
    clips: [clip("nm-c1", "El gol de la final", "TRAP 1-0. La tercera estrella.", 2026, "0:45")],
    quote: quote(
      "nm-q",
      "Cuando estamos contra las cuerdas, ponemos el pecho.",
      "Nazareno Maciel",
      "Capitán",
      2026,
    ),
  },
  {
    id: "josue-ferreiro",
    name: "Josué Ferreiro",
    nickname: "Josu",
    number: 7,
    position: "Delantero",
    years: "2020 — hoy",
    status: "plantel",
    foot: "Izquierdo",
    height: "1,74 m",
    birthplace: "Buenos Aires",
    photo: playerPhotoUrl("Josué Ferreiro", 7, "josue-ferreiro"),
    avatar: avatarUrl("Josué Ferreiro", "josue-ferreiro"),
    bio:
      "Parte del plantel desde los primeros años de Trap. En los Trap " +
      "Awards de 2023 subió al ring frente a Yannick Castelo, en una noche " +
      "que quedó grabada en la historia del equipo por lo que vino apenas " +
      "una semana después.",
    stats: [
      { label: "En Trap desde", value: "2020" },
      { label: "Trap Awards", value: "2023" },
      { label: "Estrellas", value: "3" },
    ],
    skills: [
      { label: "Regate", value: 82 },
      { label: "Velocidad", value: 85 },
      { label: "Definición", value: 78 },
      { label: "Físico", value: 70 },
      { label: "Uno contra uno", value: 80 },
    ],
    career: [
      {
        id: "jf-1",
        season: "2020",
        title: "Uno de los primeros",
        description: "Parte del grupo que arrancó jugando FIFA 20.",
        status: "done",
      },
      {
        id: "jf-2",
        season: "2023",
        title: "Los Trap Awards",
        description:
          "Sube al ring frente a Yannick Castelo, en la velada de boxeo " +
          "que cerró la ceremonia.",
        status: "done",
      },
      {
        id: "jf-3",
        season: "2026",
        title: "Tercera estrella",
        description: "Parte del plantel campeón de la Copa Oro.",
        status: "current",
      },
    ],
    gallery: [photo("jf-p1", "Los Trap Awards, 2023", 2023)],
    clips: [],
    quote: quote(
      "jf-q",
      "Esa noche subimos al ring como si fuera la final. Nadie sabía lo que " +
        "venía una semana después.",
      "Josué Ferreiro",
      "Delantero",
      2023,
    ),
  },
  {
    id: "federico-rodriguez",
    name: "Federico Rodríguez",
    nickname: "Fede",
    number: 1,
    position: "Arquero",
    years: "2020 — hoy",
    status: "plantel",
    foot: "Derecho",
    height: "1,86 m",
    birthplace: "Buenos Aires",
    photo: playerPhotoUrl("Federico Rodríguez", 1, "federico-rodriguez"),
    avatar: avatarUrl("Federico Rodríguez", "federico-rodriguez"),
    bio:
      "Arquero de Trap desde los primeros años. En los Trap Awards de 2023 " +
      "subió al ring frente a Lautaro Montañez, en la última pelea de la " +
      "velada de boxeo que cerró la ceremonia.",
    stats: [
      { label: "En Trap desde", value: "2020" },
      { label: "Trap Awards", value: "2023" },
      { label: "Estrellas", value: "3" },
    ],
    skills: [
      { label: "Reflejos", value: 88 },
      { label: "Juego aéreo", value: 80 },
      { label: "Achique", value: 82 },
      { label: "Pie", value: 75 },
      { label: "Comunicación", value: 85 },
    ],
    career: [
      {
        id: "fr-1",
        season: "2020",
        title: "Uno de los primeros",
        description: "Parte del grupo original.",
        status: "done",
      },
      {
        id: "fr-2",
        season: "2023",
        title: "Los Trap Awards",
        description: "Sube al ring frente a Lautaro Montañez.",
        status: "done",
      },
      {
        id: "fr-3",
        season: "2026",
        title: "Tercera estrella",
        description: "Parte del plantel campeón de la Copa Oro.",
        status: "current",
      },
    ],
    gallery: [photo("fr-p1", "Los Trap Awards, 2023", 2023)],
    clips: [],
    quote: quote(
      "fr-q",
      "El arco es el último que se entera de si ganamos. Prefiero enterarme " +
        "temprano.",
      "Federico Rodríguez",
      "Arquero",
      2023,
    ),
  },
  {
    id: "mariano-cisterna",
    name: "Mariano Cisterna",
    nickname: "Mariano",
    number: 4,
    position: "Defensor",
    years: "2020 — hoy",
    status: "plantel",
    foot: "Derecho",
    height: "1,82 m",
    birthplace: "Buenos Aires",
    photo: playerPhotoUrl("Mariano Cisterna", 4, "mariano-cisterna"),
    avatar: avatarUrl("Mariano Cisterna", "mariano-cisterna"),
    bio:
      "Parte del plantel de Trap desde los primeros años, cuando el equipo " +
      "todavía se armaba de a poco jugando FIFA 20. Estuvo en el salto al " +
      "fútbol 8 y siguió en el regreso al fútbol 11.",
    stats: [
      { label: "En Trap desde", value: "2020" },
      { label: "Estrellas", value: "3" },
      { label: "Formatos jugados", value: "FIFA · F8 · F11" },
    ],
    skills: [
      { label: "Marca", value: 85 },
      { label: "Juego aéreo", value: 80 },
      { label: "Anticipo", value: 78 },
      { label: "Salida limpia", value: 70 },
      { label: "Liderazgo", value: 75 },
    ],
    career: [
      {
        id: "mc-1",
        season: "2020",
        title: "Uno de los primeros",
        description: "Parte del grupo que fundó Trap N Export.",
        status: "done",
      },
      {
        id: "mc-2",
        season: "2022",
        title: "El salto al fútbol real",
        description: "Fútbol 8, en Pura Gambeta.",
        status: "done",
      },
      {
        id: "mc-3",
        season: "2023",
        title: "El regreso",
        description: "Vuelve con el equipo al fútbol 11, en noviembre de 2023.",
        status: "done",
      },
      {
        id: "mc-4",
        season: "2026",
        title: "Tercera estrella",
        description: "Parte del plantel campeón de la Copa Oro.",
        status: "current",
      },
    ],
    gallery: [photo("mc-p1", "El regreso al fútbol 11", 2023)],
    clips: [],
    quote: quote(
      "mc-q",
      "Empezamos jugando con un control en la mano. Yo todavía no lo puedo " +
        "creer.",
      "Mariano Cisterna",
      "Defensor",
      2025,
    ),
  },
  {
    id: "adrian-ledesma",
    name: "Adrián Ledesma",
    nickname: "Adri",
    number: 11,
    position: "Delantero",
    years: "2022 — hoy",
    status: "plantel",
    foot: "Izquierdo",
    height: "1,77 m",
    birthplace: "Buenos Aires",
    photo: playerPhotoUrl("Adrián Ledesma", 11, "adrian-ledesma"),
    avatar: avatarUrl("Adrián Ledesma", "adrian-ledesma"),
    bio:
      "Subió al ring frente a Nazareno Maciel en los Trap Awards de 2023. " +
      "Dos años después, fue uno de los cinco goleadores de la final del 22 " +
      "de diciembre de 2025, la goleada histórica que le dio a Trap su " +
      "segunda estrella.",
    stats: [
      { label: "Trap Awards", value: "2023" },
      { label: "Gol en la final", value: "22 dic 2025" },
      { label: "Estrellas", value: "3" },
    ],
    skills: [
      { label: "Definición", value: 83 },
      { label: "Velocidad", value: 82 },
      { label: "Regate", value: 76 },
      { label: "Físico", value: 72 },
      { label: "Movilidad", value: 80 },
    ],
    career: [
      {
        id: "al-1",
        season: "2023",
        title: "Los Trap Awards",
        description: "Sube al ring frente a Nazareno Maciel.",
        status: "done",
      },
      {
        id: "al-2",
        season: "2025",
        title: "Gol en la segunda estrella",
        description: "Marca en la goleada 5-0 del 22 de diciembre.",
        status: "done",
      },
      {
        id: "al-3",
        season: "2026",
        title: "Tercera estrella",
        description: "Parte del plantel campeón de la Copa Oro.",
        status: "current",
      },
    ],
    gallery: [photo("al-p1", "La final del 22 de diciembre", 2025)],
    clips: [
      clip("al-c1", "Su gol del 22 de diciembre", "Uno de los cinco de la goleada histórica.", 2025, "0:40"),
    ],
    quote: quote(
      "al-q",
      "Esa final la jugamos sabiendo que si perdíamos, no pasaba nada. " +
        "Ganamos igual, 5 a 0.",
      "Adrián Ledesma",
      "Delantero",
      2025,
    ),
  },
  {
    id: "yago-taboada",
    name: "Yago Taboada",
    nickname: "Yago",
    number: 9,
    position: "Delantero",
    years: "2024 — hoy",
    status: "plantel",
    foot: "Derecho",
    height: "1,79 m",
    birthplace: "Buenos Aires",
    photo: playerPhotoUrl("Yago Taboada", 9, "yago-taboada"),
    avatar: avatarUrl("Yago Taboada", "yago-taboada"),
    bio:
      "Uno de los goleadores de la final del 22 de diciembre de 2025, la " +
      "goleada 5-0 que le dio a Trap su segunda estrella.",
    stats: [
      { label: "Gol en la final", value: "22 dic 2025" },
      { label: "En Trap desde", value: "2024" },
      { label: "Formato", value: "Fútbol 11" },
    ],
    skills: [
      { label: "Definición", value: 80 },
      { label: "Velocidad", value: 78 },
      { label: "Regate", value: 74 },
      { label: "Físico", value: 76 },
      { label: "Movilidad", value: 79 },
    ],
    career: [
      {
        id: "yt-1",
        season: "2025",
        title: "Gol en la segunda estrella",
        description: "Marca en la goleada 5-0 del 22 de diciembre de 2025.",
        status: "done",
      },
    ],
    gallery: [photo("yt-p1", "La final del 22 de diciembre", 2025)],
    clips: [
      clip("yt-c1", "Su gol del 22 de diciembre", "Uno de los cinco de la goleada histórica.", 2025, "0:38"),
    ],
    quote: quote(
      "yt-q",
      "Fue mi primer gol grande con la camiseta de Trap. No lo voy a olvidar.",
      "Yago Taboada",
      "Delantero",
      2025,
    ),
  },
  {
    id: "martin-motta",
    name: "Martín Motta",
    nickname: "Motta",
    number: 17,
    position: "Delantero",
    years: "2024 — hoy",
    status: "plantel",
    foot: "Derecho",
    height: "1,81 m",
    birthplace: "Buenos Aires",
    photo: playerPhotoUrl("Martín Motta", 17, "martin-motta"),
    avatar: avatarUrl("Martín Motta", "martin-motta"),
    bio:
      "Autor de dos de los cinco goles en la final del 22 de diciembre de " +
      "2025: el doblete que fue clave en la goleada histórica que le dio a " +
      "Trap su segunda estrella.",
    stats: [
      { label: "Goles en la final", value: "2" },
      { label: "Fecha", value: "22 dic 2025" },
      { label: "Formato", value: "Fútbol 11" },
    ],
    skills: [
      { label: "Definición", value: 86 },
      { label: "Movilidad", value: 81 },
      { label: "Físico", value: 75 },
      { label: "Velocidad", value: 77 },
      { label: "Juego aéreo", value: 73 },
    ],
    career: [
      {
        id: "mm-1",
        season: "2025",
        title: "El doblete de la segunda estrella",
        description:
          "Marca dos de los cinco goles en la goleada 5-0 del 22 de " +
          "diciembre de 2025.",
        status: "done",
      },
    ],
    gallery: [photo("mm-p1", "El doblete del 22 de diciembre", 2025)],
    clips: [
      clip("mm-c1", "El doblete de Motta", "Los dos goles de la final del 22 de diciembre.", 2025, "0:50"),
    ],
    quote: quote(
      "mm-q",
      "El segundo lo grité más fuerte que el primero. Ese día no quería que " +
        "terminara nunca.",
      "Martín Motta",
      "Delantero",
      2025,
    ),
  },
  {
    id: "gonzalo-carranza",
    name: "Gonzalo Carranza",
    nickname: "Gonza",
    number: 6,
    position: "Mediocampista",
    years: "2025 — hoy",
    status: "plantel",
    foot: "Derecho",
    height: "1,76 m",
    birthplace: "Buenos Aires",
    photo: playerPhotoUrl("Gonzalo Carranza", 6, "gonzalo-carranza"),
    avatar: avatarUrl("Gonzalo Carranza", "gonzalo-carranza"),
    bio:
      "Autor de uno de los dos goles en la semifinal de la Copa Oro 2026 " +
      "ante El Inter, el campeón del Apertura y candidato del torneo: un " +
      "2-1 agónico que llevó a Trap a su quinta final.",
    stats: [
      { label: "Gol en semifinal", value: "2026" },
      { label: "Rival", value: "El Inter" },
      { label: "Resultado", value: "2-1" },
    ],
    skills: [
      { label: "Recuperación", value: 80 },
      { label: "Pase", value: 78 },
      { label: "Físico", value: 76 },
      { label: "Posicionamiento", value: 79 },
      { label: "Definición", value: 70 },
    ],
    career: [
      {
        id: "gc-1",
        season: "2026",
        title: "Gol en la semifinal ante El Inter",
        description:
          "Marca en el 2-1 agónico que clasifica a Trap a la final de la " +
          "Copa Oro.",
        status: "current",
      },
    ],
    gallery: [photo("gc-p1", "La semifinal ante El Inter", 2026)],
    clips: [clip("gc-c1", "Su gol de la semifinal", "Parte del 2-1 ante El Inter.", 2026, "0:42")],
    quote: quote(
      "gc-q",
      "Sabíamos que El Inter era el mejor equipo del torneo. Por eso ese " +
        "gol vale el doble.",
      "Gonzalo Carranza",
      "Mediocampista",
      2026,
    ),
  },
  {
    id: "leandro-atondo",
    name: "Leandro Atondo",
    nickname: "Lea",
    number: 5,
    position: "Mediocampista",
    years: "2020 — hoy",
    status: "plantel",
    foot: "Derecho",
    height: "1,80 m",
    birthplace: "Buenos Aires",
    photo: playerPhotoUrl("Leandro Atondo", 5, "leandro-atondo"),
    avatar: avatarUrl("Leandro Atondo", "leandro-atondo"),
    bio:
      "Parte del plantel de Trap desde los primeros años, del grupo que " +
      "jugaba FIFA 20 en pandemia al equipo que hoy tiene tres estrellas.",
    stats: [
      { label: "En Trap desde", value: "2020" },
      { label: "Estrellas", value: "3" },
      { label: "Formatos jugados", value: "FIFA · F8 · F11" },
    ],
    skills: [
      { label: "Recuperación", value: 83 },
      { label: "Físico", value: 80 },
      { label: "Pase corto", value: 78 },
      { label: "Posicionamiento", value: 81 },
      { label: "Liderazgo", value: 76 },
    ],
    career: [
      {
        id: "la-1",
        season: "2020",
        title: "Uno de los primeros",
        description: "Parte del grupo que fundó Trap N Export.",
        status: "done",
      },
      {
        id: "la-2",
        season: "2023",
        title: "El regreso",
        description: "Vuelve con el equipo al fútbol 11, en noviembre de 2023.",
        status: "done",
      },
      {
        id: "la-3",
        season: "2026",
        title: "Tercera estrella",
        description: "Parte del plantel campeón de la Copa Oro.",
        status: "current",
      },
    ],
    gallery: [photo("la-p1", "El regreso al fútbol 11", 2023)],
    clips: [],
    quote: quote(
      "la-q",
      "Van seis años. Todavía nos juntamos como si fuera la primera semana.",
      "Leandro Atondo",
      "Mediocampista",
      2026,
    ),
  },
];

export const SEASONS: Season[] = [
  {
    year: 2022,
    title: "El primer desafío",
    tagline: "El salto de FIFA a la cancha: fútbol 8 en Pura Gambeta.",
    cover: photoUrl("season-2022"),
    competition: "Pura Gambeta · Fútbol 8 (Club Galopo)",
    position: "Primeros partidos oficiales",
    captain: "Sin registro",
    topScorer: "Sin registro",
    stats: [
      { label: "Formato", value: "Fútbol 8" },
      { label: "Torneo", value: "Pura Gambeta" },
      { label: "Cancha", value: "Club Galopo" },
    ],
    highlights: [
      {
        id: "s22-1",
        month: "2022",
        title: "Trap da el salto al fútbol real",
        description: "Después de dos años jugando FIFA 20, el equipo pisa la cancha.",
        kind: "debut",
      },
      {
        id: "s22-2",
        month: "2022",
        title: "Primeros partidos en Pura Gambeta",
        description: "En el Club Galopo. El comienzo de Trap dentro de las canchas.",
        kind: "partido",
      },
    ],
    hallOfFame: [],
    gallery: [photo("s22-g1", "El debut en Pura Gambeta", 2022)],
    clips: [],
  },
  {
    year: 2023,
    title: "Los Trap Awards y el golpe más duro",
    tagline: "Una noche para celebrar el equipo, y una semana después, todo cambia.",
    cover: photoUrl("season-2023"),
    competition: "Trap Awards · Regreso al fútbol 11",
    position: "Marcada por la pérdida de Yannick Castelo",
    captain: "Sin registro",
    topScorer: "Sin registro",
    stats: [
      { label: "Evento", value: "Trap Awards" },
      { label: "Boxeo", value: "3 combates" },
      { label: "Sin equipo", value: "~4 meses" },
    ],
    highlights: [
      {
        id: "s23-1",
        month: "2023",
        title: "Los Trap Awards",
        description:
          "Ceremonia y velada de boxeo: Castelo vs. Ferreiro, Ledesma vs. " +
          "Maciel, Rodríguez vs. Montañez.",
        kind: "evento",
      },
      {
        id: "s23-2",
        month: "2023",
        title: "El golpe más duro",
        description:
          "Una semana después de los Trap Awards, la pérdida de Yannick " +
          "Castelo disuelve al equipo casi cuatro meses.",
        kind: "homenaje",
      },
      {
        id: "s23-3",
        month: "Noviembre",
        title: "Trap vuelve a juntarse",
        description: "El equipo se reforma con un nuevo desafío: fútbol 11.",
        kind: "debut",
      },
    ],
    hallOfFame: [
      {
        playerId: "yannick-castelo",
        reason: "En su memoria: el corazón de los primeros años de Trap.",
      },
      {
        playerId: "josue-ferreiro",
        reason: "Subió al ring frente a Yannick Castelo en los Trap Awards.",
      },
      {
        playerId: "adrian-ledesma",
        reason: "Subió al ring frente a Nazareno Maciel en los Trap Awards.",
      },
      {
        playerId: "nazareno-maciel",
        reason: "Subió al ring frente a Adrián Ledesma en los Trap Awards.",
      },
      {
        playerId: "federico-rodriguez",
        reason: "Subió al ring frente a Lautaro Montañez en los Trap Awards.",
      },
    ],
    gallery: [
      photo("s23-g1", "Los Trap Awards, la ceremonia", 2023),
      photo("s23-g2", "La velada de boxeo", 2023),
      photo("s23-g3", "El regreso al fútbol 11, en noviembre", 2023),
    ],
    clips: [clip("s23-c1", "El regreso al fútbol 11", "Noviembre de 2023: Trap se junta otra vez.", 2023, "1:20")],
  },
  {
    year: 2024,
    title: "El primer gran sueño",
    tagline: "Liga Núñez y la primera final de la historia — perdida, pero reveladora.",
    cover: photoUrl("season-2024"),
    competition: "Liga Núñez",
    position: "Finalista",
    captain: "Sin registro",
    topScorer: "Sin registro",
    stats: [
      { label: "Competencia", value: "Liga Núñez" },
      { label: "Finales", value: "1" },
      { label: "Resultado", value: "Subcampeón" },
    ],
    highlights: [
      {
        id: "s24-1",
        month: "2024",
        title: "Trap se inscribe en la Liga Núñez",
        description: "El equipo compite de manera cada vez más seria.",
        kind: "obra",
      },
      {
        id: "s24-2",
        month: "Diciembre",
        title: "La primera final de la historia",
        description: "Trap llega a una final por primera vez.",
        kind: "ascenso",
      },
      {
        id: "s24-3",
        month: "Diciembre",
        title: "Se pierde la final",
        description:
          "El resultado no es el esperado, pero deja claro que Trap estaba " +
          "para cosas grandes.",
        kind: "derrota",
      },
    ],
    hallOfFame: [],
    gallery: [photo("s24-g1", "La primera final de la historia", 2024)],
    clips: [],
  },
  {
    year: 2025,
    title: "El año que cambió todo",
    tagline: "Dos torneos, dos títulos: la primera y la segunda estrella.",
    cover: photoUrl("season-2025"),
    competition: "Liga Núñez → Mega Fútbol (90 Minutos) → Liga Oeste",
    position: "Bicampeón 2025",
    captain: "Sin registro",
    topScorer: "Martín Motta (2 en la final)",
    stats: [
      { label: "Títulos", value: "2" },
      { label: "Torneos", value: "3" },
      { label: "Resultado final", value: "5-0" },
    ],
    highlights: [
      {
        id: "s25-1",
        month: "2025",
        title: "Clasifica a la Sudamericana",
        description: "Compitiendo en la Liga Núñez.",
        kind: "ascenso",
      },
      {
        id: "s25-2",
        month: "2025",
        title: "Deja la Liga Núñez por el Mega Fútbol",
        description: "Un nuevo desafío: el torneo de 90 Minutos.",
        kind: "obra",
      },
      {
        id: "s25-3",
        month: "2025",
        title: "Campeón del Mega Fútbol — primera estrella",
        description: "Y esta vez sí: Trap es campeón.",
        kind: "titulo",
      },
      {
        id: "s25-4",
        month: "2025",
        title: "Se incorpora a la Liga Oeste",
        description: "Después del título, un nuevo escenario.",
        kind: "obra",
      },
      {
        id: "s25-5",
        month: "22 de diciembre",
        title: "TRAP GANA 5-0 — segunda estrella",
        description:
          "Goles de Adrián Ledesma, Yago Taboada, Nazareno Maciel y un " +
          "doblete de Martín Motta.",
        kind: "titulo",
      },
    ],
    hallOfFame: [
      { playerId: "martin-motta", reason: "Doblete en la final del 22 de diciembre." },
      { playerId: "adrian-ledesma", reason: "Gol en la final del 22 de diciembre." },
      { playerId: "yago-taboada", reason: "Gol en la final del 22 de diciembre." },
      { playerId: "nazareno-maciel", reason: "Gol en la final del 22 de diciembre." },
    ],
    gallery: [
      photo("s25-g1", "Campeones del Mega Fútbol: la primera estrella", 2025),
      photo("s25-g2", "22 de diciembre: 5-0", 2025),
      photo("s25-g3", "La segunda estrella", 2025),
    ],
    clips: [
      clip("s25-c1", "Los cinco goles del 22 de diciembre", "La goleada 5-0 que cerró el 2025.", 2025, "2:30"),
      clip("s25-c2", "El doblete de Martín Motta", "Los dos goles de la final.", 2025, "0:50"),
    ],
    quote: {
      id: "s25-q",
      text: "Y esta vez sí.",
      author: "Trap N Export",
      role: "Al ser campeón del Mega Fútbol",
      year: 2025,
      avatar: CLUB.crest,
    },
  },
  {
    year: 2026,
    title: "La tercera estrella",
    tagline: "Ciudad Evita, La Caprichosa, y el 1-0 que corona la Copa Oro.",
    cover: photoUrl("season-2026"),
    competition: "La Caprichosa · Copa Oro (Ciudad Evita)",
    position: "Campeón de la Copa Oro",
    captain: "Nazareno Maciel",
    topScorer: "Nazareno Maciel (2 en la fase final)",
    stats: [
      { label: "Títulos", value: "1" },
      { label: "Semifinal", value: "2-1" },
      { label: "Final", value: "1-0" },
    ],
    highlights: [
      {
        id: "s26-1",
        month: "Febrero",
        title: "Vuelve al fútbol 11: Ciudad Evita",
        description: "Un nuevo desafío: el torneo La Caprichosa.",
        kind: "debut",
      },
      {
        id: "s26-2",
        month: "Apertura",
        title: "Clasifica entre los ocho mejores",
        description: "El premio: clasificación a la Copa Oro.",
        kind: "ascenso",
      },
      {
        id: "s26-3",
        month: "Copa Oro",
        title: "Primero de grupo",
        description: "Cuando está contra las cuerdas, Trap pone el pecho.",
        kind: "ascenso",
      },
      {
        id: "s26-4",
        month: "Semifinal",
        title: "Gana 2-1 ante El Inter",
        description:
          "El campeón del Apertura y candidato del torneo. Goles de " +
          "Gonzalo Carranza y Nazareno Maciel.",
        kind: "partido",
      },
      {
        id: "s26-5",
        month: "Final",
        title: "TRAP 1-0 — tercera estrella",
        description: "Gol del capitán, Nazareno Maciel. Campeón de la Copa Oro.",
        kind: "titulo",
      },
    ],
    hallOfFame: [
      {
        playerId: "nazareno-maciel",
        reason: "Capitán, gol en semifinal y gol campeón en la final.",
      },
      {
        playerId: "gonzalo-carranza",
        reason: "Gol en la semifinal agónica ante El Inter.",
      },
    ],
    gallery: [
      photo("s26-g1", "El regreso al fútbol 11 en Ciudad Evita", 2026),
      photo("s26-g2", "La semifinal ante El Inter", 2026),
      photo("s26-g3", "Campeones de la Copa Oro", 2026),
    ],
    clips: [
      clip("s26-c1", "La semifinal ante El Inter", "2-1, con goles de Carranza y Maciel.", 2026, "2:10"),
      clip("s26-c2", "El gol de Maciel en la final", "TRAP 1-0. La tercera estrella.", 2026, "0:45"),
    ],
    quote: {
      id: "s26-q",
      text: "Cuando está contra las cuerdas, pone el pecho.",
      author: "Trap N Export",
      role: "Sobre la Copa Oro 2026",
      year: 2026,
      avatar: CLUB.crest,
    },
  },
];


/* ── el paquete completo ─────────────────────────────────────────────────── */

/** Todo junto, en la forma que espera `/historia`.
 *
 *  Lo usan `queries.ts` (como fallback colección por colección) y la acción
 *  `importarSemilla` del panel, que lo copia entero a Firestore. */
export const SEED = {
  club: CLUB,
  balance: BALANCE,
  trophies: TROPHIES,
  eras: ERAS,
  seasons: SEASONS,
  players: PLAYERS,
  quotes: QUOTES,
  gallery: GALLERY,
  clips: CLIPS,
};
