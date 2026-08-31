import { mediaUrl } from "@/lib/media";
import type { Encuesta, Evento, Invitacion, Noticia } from "@/lib/contenido/types";
import { esPremioDeVideo, opcionesDe, PREMIOS } from "@/lib/trap-awards";

/** Base en memoria del contenido del club — el único lugar que hay que
 *  reemplazar por Firestore.
 *
 *  Mismo patrón que `social/store.ts`, incluido el `globalThis`: en `next dev`
 *  cada recompilación descarta los módulos, y sin eso una noticia recién
 *  cargada desaparecía al guardar un archivo. Es un objeto distinto del social
 *  (`__contenidoDb` vs. `__socialDb`) porque son dos colecciones con dos ciclos
 *  de vida: una la escriben los usuarios, esta sólo el panel.
 */
export interface ContenidoDb {
  noticias: Noticia[];
  encuestas: Encuesta[];
  invitaciones: Invitacion[];
  /** "YYYY-MM-DD" — el día en que ocurre **todo** el cronograma.
   *
   *  Un solo campo para toda la colección: los eventos no guardan fecha, sólo
   *  hora (ver `Evento` en `types.ts`). Cambiarlo mueve el cronograma entero y
   *  no puede dejar la mitad de los eventos en el día viejo. */
  fechaEvento: string;
  eventos: Evento[];
}

const DAY = 86_400_000;

/** "2026-09-12" desde un offset en días respecto de hoy.
 *
 *  La semilla no puede tener fechas fijas: un cronograma sembrado en 2026 se
 *  ve entero en el pasado el año que viene, y el calendario del panel abre en
 *  un mes vacío. Todo lo de abajo es relativo al día en que corre. */
const isoFromToday = (days: number): string => {
  const d = new Date(Date.now() + days * DAY);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
};

function seed(): ContenidoDb {
  const now = Date.now();

  const noticias: Noticia[] = [
    {
      id: "n1",
      titulo: "Ferreiro renovó hasta 2030",
      copete:
        "El extremo pidió bajar su propia cláusula para que el club pueda " +
        "decidir la venta. Firma cuatro años más.",
      cuerpo:
        "Josue Ferreiro firmó la extensión más larga que dio el club a un " +
        "jugador de la cantera. La negociación duró tres semanas y el punto " +
        "más discutido no fue el sueldo: fue la cláusula de salida, que el " +
        "propio jugador pidió bajar para que la decisión de una venta quede " +
        "del lado del club.\n\n" +
        "«Yo entré acá a los nueve años. Si algún día me voy, quiero que sea " +
        "porque al club le sirve», dijo en la conferencia.",
      cover: mediaUrl("Renovación", "n1"),
      estado: "publicada",
      autor: "Prensa TNE",
      createdAt: now - 2 * DAY,
      destacada: true,
    },
    {
      id: "n2",
      titulo: "Se agotaron las entradas para la fecha 18",
      copete: "En cuatro horas. Quedan lugares en la platea visitante.",
      cuerpo:
        "La venta abrió a las 10 y a las 14 no quedaba una popular. Es la " +
        "cuarta vez en la temporada que La Cantera agota antes del día del " +
        "partido.",
      cover: mediaUrl("Entradas", "n2"),
      estado: "publicada",
      autor: "Prensa TNE",
      createdAt: now - 5 * DAY,
    },
    {
      id: "n3",
      titulo: "Obras en la tribuna norte: el cronograma",
      copete: "Empiezan en enero y son cuatro meses. La tribuna no se cierra.",
      cuerpo:
        "Borrador pendiente de los números finales de la licitación. No " +
        "publicar hasta que confirme la comisión directiva.",
      cover: mediaUrl("Obras", "n3"),
      estado: "borrador",
      autor: "Prensa TNE",
      createdAt: now - 1 * DAY,
    },
  ];

  /** Las diecisiete categorías de los Trap Awards, derivadas de `PREMIOS`.
   *
   *  No están escritas acá: los premios y el plantel son datos reales y viven
   *  juntos en `lib/trap-awards.ts`, que es lo que se va a reemplazar por la
   *  base. Este `map` es sólo la traducción premio → encuesta, y es la misma
   *  que va a hacer la query cuando los datos vengan de Firestore.
   *
   *  Tres decisiones que no son obvias:
   *
   *  - **Todo arranca en cero votos.** La votación no empezó; sembrar números
   *    inventados haría que el primer voto real se sume a una base falsa.
   *  - **Los premios de video nacen en borrador.** Sus opciones son de relleno
   *    hasta que se carguen los clips: abrirlos sería pedir que se vote un
   *    video que todavía no existe.
   *  - **Sin fecha de cierre.** La fecha de la gala se carga desde el panel; no
   *    hay ninguna acá que no sea inventada.
   */
  const encuestas: Encuesta[] = PREMIOS.map((premio, i) => ({
    id: premio.id,
    pregunta: premio.pregunta,
    descripcion: premio.descripcion,
    opciones: opcionesDe(premio).map((texto, j) => ({
      id: `${premio.id}-${j + 1}`,
      texto,
      votos: 0,
    })),
    multiple: premio.multiple ?? false,
    // Los Trap Awards se revelan en la gala: la votación del feed nunca muestra
    // porcentajes.
    resultadosVisibles: false,
    estado: esPremioDeVideo(premio) ? "borrador" : "abierta",
    // `getEncuestas` ordena por `createdAt` descendente: un minuto de
    // diferencia por premio deja la tabla del panel en el mismo orden en que
    // se anuncian los premios, sin que el orden dependa del sort.
    createdAt: now - i * 60_000,
  }));

  const invitaciones: Invitacion[] = [
    {
      id: "i1",
      code: "cena-aniversario-mv",
      invitado: "Marta Sosa",
      titulo: "Cena de los 28 años",
      mensaje:
        "Nos gustaría que estés en la mesa principal. Vas a estar sentada " +
        "con los once que firmaron el acta en 1998.",
      fecha: isoFromToday(21),
      hora: "21:00",
      lugar: "Salón de La Cantera",
      plantilla: "gala",
      // El sobre lacrado que antes era un `efecto` ahora es una `revelacion`, y
      // el movimiento sobrio que la acompañaba es `flote`: la misma invitación
      // de siempre, contada con las dos dimensiones separadas.
      efecto: "flote",
      revelacion: "lacre",
      estado: "activa",
      createdAt: now - 6 * DAY,
    },
    {
      id: "i2",
      code: "palco-fecha18-rv",
      invitado: "Mariano Cisterna",
      titulo: "Palco para la fecha 18",
      mensaje: "El palco de siempre, con lugar para cuatro. Te esperamos.",
      fecha: isoFromToday(9),
      hora: "17:30",
      lugar: "Estadio La Cantera · Palco 4",
      plantilla: "cancha",
      efecto: "holo",
      revelacion: "raspar",
      estado: "activa",
      createdAt: now - 2 * DAY,
    },
  ];

  // Un solo día para todo: el aniversario del club. Las horas están puestas a
  // mano para que la línea de tiempo del panel muestre algo real, incluido un
  // cruce a propósito (acreditación 16:30–18:00 contra el partido de 17:30):
  // detectar lo que se pisa es para lo que sirve la vista de día.
  const fechaEvento = isoFromToday(21);

  const eventos: Evento[] = [
    {
      id: "ev1",
      nombre: "Entrenamiento a puertas cerradas",
      descripcion: "Sin prensa. Charla técnica y trabajo de pelota parada.",
      hora: "09:30",
      duracion: 90,
      lugar: "Predio Talleres",
      tipo: "entrenamiento",
      createdAt: now - 14 * DAY,
    },
    {
      id: "ev2",
      nombre: "Entrenamiento abierto",
      descripcion: "Puertas abiertas para socios. Se firma después, en el túnel.",
      hora: "11:00",
      duracion: 90,
      lugar: "Predio Talleres",
      tipo: "entrenamiento",
      createdAt: now - 7 * DAY,
    },
    {
      id: "ev3",
      nombre: "Asamblea ordinaria de socios",
      descripcion: "Balance del ejercicio y presupuesto de obras de la tribuna norte.",
      hora: "14:00",
      duracion: 120,
      lugar: "Salón de La Cantera",
      tipo: "institucional",
      createdAt: now - 12 * DAY,
    },
    {
      id: "ev4",
      nombre: "Apertura de puertas y acreditación de prensa",
      descripcion: "Populares por Rivadavia; prensa por el portón 3.",
      hora: "16:30",
      duracion: 90,
      lugar: "Estadio La Cantera",
      tipo: "institucional",
      createdAt: now - 10 * DAY,
    },
    {
      id: "ev5",
      nombre: "Fecha 18 · TNE vs. Deportivo Norte",
      descripcion: "Local. Entradas agotadas en populares.",
      hora: "17:30",
      duracion: 120,
      lugar: "Estadio La Cantera",
      tipo: "partido",
      createdAt: now - 10 * DAY,
    },
    {
      id: "ev6",
      nombre: "Cena de los 28 años",
      descripcion: "Aniversario del club. Cupos limitados, con invitación.",
      hora: "21:00",
      duracion: 240,
      lugar: "Salón de La Cantera",
      tipo: "social",
      createdAt: now - 6 * DAY,
    },
  ];

  return { noticias, encuestas, invitaciones, fechaEvento, eventos };
}

/** La contracara de guardar la base en `globalThis`: al recompilar sobrevive el
 *  contenido cargado, pero también sobrevive la **forma** vieja. Cuando cambia
 *  la interfaz —como al pasar el cronograma a un solo día, que sacó `fecha` de
 *  cada evento y agregó `fechaEvento`— la instancia cacheada deja de cumplir el
 *  tipo y el panel se cae con un error que no está en el código que se ve.
 *
 *  Subir el sufijo descarta la instancia vieja y vuelve a sembrar, sin reiniciar
 *  el dev server. Es la versión del esquema: se sube cuando cambia
 *  `ContenidoDb` o alguna entidad, no en cada edición. */
const globalForDb = globalThis as unknown as { __contenidoDb_v5?: ContenidoDb };

export const contenidoDb: ContenidoDb = (globalForDb.__contenidoDb_v5 ??= seed());

/** id corto y único dentro del proceso; el backend real lo reemplaza por el
 *  suyo. Es el mismo generador que `social/store.ts` y está duplicado a
 *  propósito: los dos módulos tienen que poder migrar por separado. */
export const newId = (prefix: string) =>
  `${prefix}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;

/** Los diacríticos que `normalize("NFD")` deja sueltos, U+0300–U+036F.
 *
 *  Se arma con `RegExp` y una cadena escapada en vez de un literal `/[..]/`:
 *  el rango escrito con las marcas combinantes de verdad es invisible en el
 *  editor y cualquier reformateo o copy-paste se lo lleva sin que se note. */
const DIACRITICS = new RegExp("[\u0300-\u036f]", "g");

/** "Cena de los 28 anos" -> "cena-de-los-28-anos". */
const slug = (s: string) =>
  s
    .normalize("NFD")
    .replace(DIACRITICS, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 24);

/** Slug para la URL pública de una invitación: `/invitacion/:code`.
 *
 *  Sale del título y del nombre del invitado, más cuatro caracteres al azar.
 *  El slug legible es para que el link se entienda cuando se manda por
 *  WhatsApp; el sufijo es para que no se pueda adivinar el de otra persona
 *  cambiando el nombre en la barra de direcciones. */
export function invitacionCode(invitado: string, titulo: string): string {
  const base = [slug(titulo), slug(invitado)].filter(Boolean).join("-") || "invitacion";
  return `${base}-${Math.random().toString(36).slice(2, 6)}`;
}
