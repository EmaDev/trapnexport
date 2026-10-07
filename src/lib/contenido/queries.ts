import { getCurrentUid } from "@/lib/auth/sesion";
import { adminDb } from "@/lib/firebase/admin";
import { COL, CONFIG_CRONOGRAMA, CONFIG_PORTADA, SUB_VOTO } from "@/lib/firebase/collections";
import type {
  CronogramaConfigDoc,
  EncuestaDoc,
  EventoDoc,
  InvitacionDoc,
  NoticiaDoc,
  PortadaConfigDoc,
  VotoDoc,
} from "@/lib/firebase/schema";
import {
  PORTADA_VACIA,
  type Encuesta,
  type Evento,
  type Invitacion,
  type Noticia,
  type PortadaInput,
  type SlidePortada,
} from "@/lib/contenido/types";
import { absoluteUrl } from "@/lib/site";
import { ordenDePremio, premioPorId } from "@/lib/trap-awards";
import { dateTime, fromISODate, horaMas, isoShort, longDate, shortDate } from "@/lib/time";

/** Lecturas del contenido del club, ya mapeadas a lo que esperan las pantallas.
 *
 *  Mitad "read" del par con `actions.ts`. Va con el Admin SDK —que se saltea
 *  `firestore.rules`— porque todo lo que la llama corre en el servidor: las
 *  páginas de `/admin`, el feed (`getCronograma`) y la ruta pública de una
 *  invitación (`getInvitacionByCode`).
 *
 *  Cada fila **extiende la entidad de dominio** en vez de proyectar un
 *  subconjunto: la tabla del panel muestra la versión formateada (`creada`,
 *  `cuando`) y el formulario de edición se prellena con los campos crudos de la
 *  misma fila. Los `XDoc` de `firebase/schema.ts` describen el documento
 *  guardado; el mapper de acá los baja a las entidades de `types.ts`, cuya
 *  única diferencia es que `createdAt` es `number` y no `Timestamp`.
 */

/** Un `Timestamp` de Firestore a milisegundos. `?? Date.now()` cubre la ventana
 *  en la que `serverTimestamp()` todavía no fue confirmado por el servidor y el
 *  campo llega `null`. Mismo helper que en `admin/cuentas.ts`. */
const millis = (ts: { toMillis(): number } | null | undefined) =>
  ts?.toMillis() ?? Date.now();

/* ── noticias ────────────────────────────────────────────────────────────── */

export interface NoticiaRow extends Noticia {
  /** `updatedAt` (o `createdAt`) formateado, que es lo que se muestra en la tabla */
  creada: string;
}

const aNoticia = (id: string, d: NoticiaDoc): Noticia => ({
  id,
  titulo: d.titulo,
  copete: d.copete,
  cuerpo: d.cuerpo,
  cover: d.cover,
  estado: d.estado,
  autor: d.autor,
  createdAt: millis(d.createdAt),
  updatedAt: d.updatedAt ? millis(d.updatedAt) : undefined,
  destacada: d.destacada || undefined,
});

export async function getNoticias(): Promise<NoticiaRow[]> {
  const snap = await adminDb().collection(COL.noticia).orderBy("createdAt", "desc").get();

  return snap.docs
    .map((doc) => aNoticia(doc.id, doc.data() as NoticiaDoc))
    .map((n) => ({ ...n, creada: dateTime(n.updatedAt ?? n.createdAt) }));
}

/* ── encuestas ───────────────────────────────────────────────────────────── */

export interface EncuestaRow extends Encuesta {
  totalVotos: number;
  creada: string;
  /** "Cierra el sáb 12 sep" o "Sin fecha de cierre" */
  cierre: string;
  /** el puesto en el orden del feed, empezando en 1. Es una posición calculada
   *  —el lugar que ocupa la fila en la lista ya ordenada— y no el campo
   *  `orden` del documento: ése puede estar vacío, repetido o con huecos, y lo
   *  que hay que mostrar en el panel es el puesto en el que el socio la ve. */
  posicion: number;
}

const aEncuesta = (id: string, d: EncuestaDoc): Encuesta => {
  /*  El fallback para lo sembrado antes de que `nombre` y `maxOpciones` fueran
   *  campos del panel. Sin él, las categorías viejas perderían su nombre de
   *  golpe.
   *
   *  Pero vale **sólo mientras la encuesta siga siendo ese premio**: si la
   *  pregunta se cambió desde el panel, la categoría fue reutilizada para otra
   *  cosa —"¿Quién el mejor jugador de 2024?" sobre el documento del fail— y el
   *  nombre sembrado es justo el que no hay que mostrar. En ese caso no hay
   *  nombre y el título cae a la pregunta, hasta que se le cargue uno. */
  const premio = premioPorId(id);
  const sembrado = premio && premio.pregunta === d.pregunta ? premio : undefined;

  return {
    id,
    nombre: d.nombre || sembrado?.nombre,
    pregunta: d.pregunta,
    descripcion: d.descripcion,
    video: d.video,
    opciones: (d.opciones ?? []).map((o) => ({
      id: o.id,
      texto: o.texto,
      votos: o.votos ?? 0,
      media: o.media,
    })),
    multiple: d.multiple,
    maxOpciones: d.maxOpciones || sembrado?.maxOpciones,
    orden: d.orden,
    resultadosVisibles: d.resultadosVisibles,
    estado: d.estado,
    cierra: d.cierra,
    createdAt: millis(d.createdAt),
  };
};

/** Lo mínimo con lo que se puede ordenar una encuesta. `Encuesta` lo cumple;
 *  `moverEncuesta` arma objetos así leyendo **sólo** `orden` y `createdAt`, sin
 *  bajarse las opciones de cada documento para reacomodar una lista. */
export interface EncuestaOrdenable {
  id: string;
  orden?: number;
  createdAt: number;
}

/** Cómo se ordenan las categorías en el feed y en la gala: el `orden` del
 *  documento, que es el que fijan las flechas del panel; si no lo tiene, la
 *  posición del premio sembrado; y a igualdad, la fecha de alta.
 *
 *  Es el **único** criterio de orden de las encuestas: lo usan el feed
 *  (`getEncuestasFeed`), la tabla del panel (`getEncuestas`), la gala
 *  (`/admin/presentacion`) y `moverEncuesta` para saber cuál es la vecina con
 *  la que intercambiar. Que la tabla del panel ordene igual que el feed no es
 *  cosmético: es lo que hace que subir y bajar una fila signifique algo. */
export const porOrden = (a: EncuestaOrdenable, b: EncuestaOrdenable): number =>
  (a.orden ?? ordenDePremio(a.id)) - (b.orden ?? ordenDePremio(b.id)) || a.createdAt - b.createdAt;

const cierreLabel = (e: Encuesta): string => {
  if (e.estado === "cerrada") return "Cerrada";
  if (!e.cierra) return "Sin fecha de cierre";
  return `Cierra el ${isoShort(e.cierra)}`;
};

export async function getEncuestas(): Promise<EncuestaRow[]> {
  // Sin `orderBy` y ordenando en memoria: `orderBy("createdAt")` descarta los
  // documentos que no tengan el campo, y una encuesta invisible en el panel no
  // se puede ni arreglar ni borrar. Son pocas, el costo es el mismo.
  const snap = await adminDb().collection(COL.encuesta).get();

  // Por `porOrden` y no por fecha: la tabla del panel es la que se reordena con
  // las flechas, así que tiene que mostrar exactamente la fila en el puesto en
  // el que el socio la va a ver. Ordenada por fecha, "subir" movía una fila a
  // un lugar que no se correspondía con nada de lo que se veía en el feed.
  return snap.docs
    .map((doc) => aEncuesta(doc.id, doc.data() as EncuestaDoc))
    .sort(porOrden)
    .map((e, i) => ({
      ...e,
      totalVotos: e.opciones.reduce((n, o) => n + o.votos, 0),
      creada: dateTime(e.createdAt),
      cierre: cierreLabel(e),
      posicion: i + 1,
    }));
}

/* ── invitaciones ────────────────────────────────────────────────────────── */

export interface InvitacionRow extends Invitacion {
  /** el link para copiar y mandar, absoluto y listo */
  url: string;
  cuando: string;
  creada: string;
}

const aInvitacion = (id: string, d: InvitacionDoc): Invitacion => ({
  id,
  code: d.code,
  invitado: d.invitado,
  titulo: d.titulo,
  mensaje: d.mensaje,
  fecha: d.fecha,
  hora: d.hora,
  lugar: d.lugar,
  plantilla: d.plantilla,
  efecto: d.efecto,
  revelacion: d.revelacion,
  estado: d.estado,
  createdAt: millis(d.createdAt),
});

/** El link es absoluto y sale de `absoluteUrl`, el mismo helper que el
 *  `canonical` de cada ruta: si el panel copiara un link relativo o armado a
 *  mano, el preview de WhatsApp se resolvería contra otro host que el que abre
 *  el invitado. */
const invitacionUrl = (code: string) => absoluteUrl(`/invitacion/${code}`);

const cuandoLabel = (fecha: string, hora: string) => `${isoShort(fecha)} · ${hora}`;

export async function getInvitaciones(): Promise<InvitacionRow[]> {
  const snap = await adminDb()
    .collection(COL.invitacion)
    .orderBy("createdAt", "desc")
    .get();

  return snap.docs
    .map((doc) => aInvitacion(doc.id, doc.data() as InvitacionDoc))
    .map((i) => ({
      ...i,
      url: invitacionUrl(i.code),
      cuando: cuandoLabel(i.fecha, i.hora),
      creada: dateTime(i.createdAt),
    }));
}

/** La invitación de la ruta pública `/invitacion/:code`.
 *
 *  Devuelve `null` también para las revocadas: una invitación dada de baja
 *  tiene que dejar de abrir, no mostrar la tarjeta con un cartel. */
export async function getInvitacionByCode(code: string): Promise<Invitacion | null> {
  const snap = await adminDb()
    .collection(COL.invitacion)
    .where("code", "==", code)
    .limit(1)
    .get();

  const doc = snap.docs[0];
  if (!doc) return null;

  const inv = aInvitacion(doc.id, doc.data() as InvitacionDoc);
  return inv.estado === "activa" ? inv : null;
}

/* ── cronograma ──────────────────────────────────────────────────────────── */

/** Un evento con todo lo que las vistas muestran ya resuelto.
 *
 *  `fecha` no sale de la entidad —los eventos no la guardan— sino del día del
 *  cronograma, copiada acá. Es la única concesión del modelo de un solo día, y
 *  está por `getProximosEventos`: devuelve filas sueltas, sin el envoltorio de
 *  `Cronograma`, y quien las reciba tiene que poder armar un `Date` o una
 *  etiqueta completa sin una segunda lectura para averiguar de qué día son.
 */
export interface EventoRow extends Evento {
  /** "YYYY-MM-DD" — el día del cronograma */
  fecha: string;
  /** "19:30", o "01:00" si el evento cruza la medianoche */
  fin: string;
  /** el evento termina después de las 00:00 */
  cruzaMedianoche: boolean;
  /** "17:30 – 19:30" (con "+1" si termina al día siguiente) */
  horario: string;
  /** para ordenar y para separar lo que ya pasó */
  startsAt: number;
  pasado: boolean;
}

/** El cronograma completo: el día y sus eventos.
 *
 *  Los dos juntos y no dos lecturas sueltas: la pantalla necesita las dos
 *  cosas y pedirlas por separado deja abierta la posibilidad de dibujar los
 *  eventos de un día bajo el título de otro.
 */
export interface Cronograma {
  /** "YYYY-MM-DD" */
  fecha: string;
  /** "sábado 12 de septiembre de 2026" — el título de la pantalla */
  fechaLarga: string;
  eventos: EventoRow[];
}

/** "YYYY-MM-DD" de hoy, en hora local. El fallback cuando todavía nadie fijó el
 *  día del cronograma: mejor que un mes vacío en el calendario del panel. */
const hoyISO = (): string => {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
};

/** El día en que ocurre todo el cronograma. Documento único
 *  `trapnexport-config/cronograma`; si no existe, hoy. */
export async function getFechaCronograma(): Promise<string> {
  const snap = await adminDb().collection(COL.config).doc(CONFIG_CRONOGRAMA).get();
  const d = snap.data() as CronogramaConfigDoc | undefined;
  return d?.fecha ?? hoyISO();
}

const aEvento = (id: string, d: EventoDoc): Evento => ({
  id,
  nombre: d.nombre,
  descripcion: d.descripcion,
  hora: d.hora,
  duracion: d.duracion,
  lugar: d.lugar,
  tipo: d.tipo,
  // Los eventos que se cargaron antes de que el formato existiera no traen el
  // campo: "auto" decide por el contenido y queda igual que antes.
  formato: d.formato ?? "auto",
  createdAt: millis(d.createdAt),
});

export async function getEventos(fechaConocida?: string): Promise<EventoRow[]> {
  const now = Date.now();
  const [fecha, snap] = await Promise.all([
    fechaConocida ? Promise.resolve(fechaConocida) : getFechaCronograma(),
    adminDb().collection(COL.evento).get(),
  ]);

  return snap.docs
    .map((doc) => aEvento(doc.id, doc.data() as EventoDoc))
    .map((e) => {
      const startsAt = fromISODate(fecha, e.hora).getTime();
      const { hora: fin, diaSiguiente } = horaMas(e.hora, e.duracion);

      return {
        ...e,
        fecha,
        fin,
        cruzaMedianoche: diaSiguiente,
        horario: `${e.hora} – ${fin}${diaSiguiente ? " (+1)" : ""}`,
        startsAt,
        pasado: startsAt < now,
      };
    })
    // Por hora y no por `createdAt`: el cronograma se lee en el orden en que
    // transcurre el día, no en el que se fue cargando.
    .sort((a, b) => a.startsAt - b.startsAt);
}

export async function getCronograma(): Promise<Cronograma> {
  const fecha = await getFechaCronograma();

  return {
    fecha,
    fechaLarga: longDate(fecha),
    eventos: await getEventos(fecha),
  };
}

/* ── portada de la home ──────────────────────────────────────────────────── */

/** La cuenta regresiva, resuelta: ya sabe a qué día y a qué hora cuenta.
 *
 *  Viaja como `fecha`/`hora` en strings y **no** como un timestamp a propósito,
 *  por lo mismo que el cronograma guarda horas y no instantes: el evento es a
 *  las 21:00 en la cancha. Si el servidor convirtiera a milisegundos tendría que
 *  elegir una zona —y en producción corre en UTC, así que el contador saldría
 *  tres horas corrido—. El `Date` lo arma el navegador con `fromISODate`, que es
 *  el mismo reloj contra el que el contador después descuenta.
 */
export interface CuentaRegresivaVM {
  /** "YYYY-MM-DD" */
  fecha: string;
  /** "HH:mm" */
  hora: string;
  eyebrow: string;
  titulo?: string;
  mensajeFinal: string;
}

export interface PortadaVM {
  /** `null` = apagada o sin fecha: la home no dibuja contador */
  countdown: CuentaRegresivaVM | null;
  /** vacío = la home cae en sus imágenes de relleno */
  slides: SlidePortada[];
}

/** Hora del primer evento del día, para el contador atado al cronograma.
 *
 *  El cronograma no guarda un instante de arranque —cada evento tiene su hora—
 *  así que "cuándo empieza el día" es la hora del primero. Sin eventos cargados
 *  cae en `PORTADA_VACIA`: el día está fijado pero vacío, y contar a la
 *  medianoche de ese día diría que ya pasó. */
const horaDeArranque = (eventos: EventoRow[]): string =>
  eventos[0]?.hora ?? PORTADA_VACIA.countdown.hora;

/** El documento de la portada tal como se carga en el formulario del panel.
 *
 *  Sin resolver nada: es el estado del formulario, con la fecha fija que haya
 *  quedado guardada aunque el origen sea el cronograma. Lo que la home consume
 *  es `getPortada`. */
export async function getPortadaConfig(): Promise<PortadaInput> {
  const snap = await adminDb().collection(COL.config).doc(CONFIG_PORTADA).get();
  const d = snap.data() as PortadaConfigDoc | undefined;
  if (!d) return PORTADA_VACIA;

  const c = d.countdown;
  return {
    countdown: {
      activa: c?.activa ?? PORTADA_VACIA.countdown.activa,
      origen: c?.origen ?? PORTADA_VACIA.countdown.origen,
      fecha: c?.fecha ?? "",
      hora: c?.hora ?? PORTADA_VACIA.countdown.hora,
      eyebrow: c?.eyebrow ?? PORTADA_VACIA.countdown.eyebrow,
      titulo: c?.titulo ?? "",
      mensajeFinal: c?.mensajeFinal ?? PORTADA_VACIA.countdown.mensajeFinal,
    },
    slides: (d.slides ?? []).map((sl) => ({
      src: sl.src,
      alt: sl.alt ?? "",
      caption: sl.caption ?? "",
    })),
  };
}

/** La portada de la home: contador resuelto y slides.
 *
 *  `cronograma` se recibe de afuera porque la home ya lo leyó para la solapa del
 *  programa: pedirlo de nuevo acá sería releer la colección entera de eventos
 *  para sacarle una hora. Sin el parámetro lo lee por su cuenta.
 */
export async function getPortada(cronograma?: Cronograma): Promise<PortadaVM> {
  const config = await getPortadaConfig();
  const { countdown: c, slides } = config;

  if (!c.activa) return { countdown: null, slides };

  if (c.origen === "fija") {
    // Sin fecha cargada no hay a qué contar. Es el estado de quien pasó el
    // origen a "fija" y todavía no eligió el día: mejor sin contador que uno
    // contando a la nada.
    const countdown = c.fecha
      ? { fecha: c.fecha, hora: c.hora, eyebrow: c.eyebrow, titulo: c.titulo || undefined, mensajeFinal: c.mensajeFinal }
      : null;
    return { countdown, slides };
  }

  const { fecha, eventos } = cronograma ?? (await getCronograma());

  return {
    countdown: {
      fecha,
      hora: horaDeArranque(eventos),
      eyebrow: c.eyebrow,
      // Sin título propio, el del primer evento: el contador de la home dice a
      // qué se está contando sin que haya que repetir el nombre en dos lugares.
      titulo: c.titulo || eventos[0]?.nombre || undefined,
      mensajeFinal: c.mensajeFinal,
    },
    slides,
  };
}

/* ── el feed público ─────────────────────────────────────────────────────── */

/** Una encuesta como la consume la solapa "Premios" del feed.
 *
 *  Es la misma colección que edita el panel; el feed sólo se queda con lo que
 *  necesita para mostrar el `Poll` y votar. Las cerradas no viajan —el feed no
 *  muestra resultados y una votación cerrada no acepta más votos—; las que no
 *  están abiertas todavía (borrador, típicamente los premios de video) viajan
 *  con `proximamente: true` para dibujarlas grises, sin `Poll`.
 */
export interface EncuestaFeedVM {
  id: string;
  /** el título del desplegable: el nombre corto de la categoría. Sale del
   *  documento —lo que se cargó en el panel— y ya no de `PREMIOS`. */
  nombre: string;
  pregunta: string;
  descripcion?: string;
  multiple: boolean;
  /** todavía no se puede votar: se muestra la lista de opciones en gris */
  proximamente: boolean;
  /** el único video de la encuesta, si tiene: va arriba de las opciones */
  video?: string;
  /** con `multiple`, cuántas opciones se pueden elegir; sin tope si es 0 */
  maxOpciones?: number;
  opciones: { id: string; texto: string; media?: string }[];
  /** lo que esta persona ya votó acá, según su documento en
   *  `trapnexport-encuesta/{id}/voto/{uid}` — `null` sin sesión o sin voto
   *  todavía. Sin esto el "Votado" del feed vivía sólo en el estado de React:
   *  recargar la página lo perdía y dejaba votar de nuevo, aunque el servidor
   *  ya tuviera el voto (y lo ignorara: ver el dedupe en `votarEncuesta`). */
  voto: string[] | null;
}

export async function getEncuestasFeed(): Promise<EncuestaFeedVM[]> {
  const [uid, snap] = await Promise.all([
    getCurrentUid(),
    // Sin `orderBy`: el orden lo pone `ordenDePremio` más abajo. Una query
    // ordenada por `createdAt` además **descarta** los documentos que no tengan
    // el campo, así que una encuesta cargada sin `createdAt` no llegaría nunca
    // al feed y en el panel —que ordena por lo mismo— tampoco se vería.
    adminDb().collection(COL.encuesta).get(),
  ]);

  const encuestas = snap.docs
    .map((doc) => aEncuesta(doc.id, doc.data() as EncuestaDoc))
    .filter((e) => e.estado !== "cerrada")
    .sort(porOrden);

  // Un `get()` por encuesta abierta y no una query sola: son pocas (una por
  // premio) y `voto` es una subcolección por documento, no colectionGroup con
  // un campo por el que filtrar por uid.
  const votos = uid
    ? await Promise.all(
        encuestas.map((e) =>
          e.estado === "abierta"
            ? adminDb().collection(COL.encuesta).doc(e.id).collection(SUB_VOTO).doc(uid).get()
            : null,
        ),
      )
    : null;

  return encuestas.map((e, i) => {
    const votoSnap = votos?.[i];
    const opciones = ((votoSnap?.data() as VotoDoc | undefined)?.opciones ?? []).filter((id) =>
      e.opciones.some((o) => o.id === id),
    );

    return {
      id: e.id,
      // Sin nombre cargado el título cae a la pregunta: una categoría sin
      // título es peor que una titulada con lo que pregunta.
      nombre: e.nombre || e.pregunta,
      pregunta: e.pregunta,
      descripcion: e.descripcion,
      multiple: e.multiple,
      maxOpciones: e.multiple ? e.maxOpciones : undefined,
      proximamente: e.estado !== "abierta",
      video: e.video,
      opciones: e.opciones.map((o) => ({ id: o.id, texto: o.texto, media: o.media })),
      voto: opciones.length ? opciones : null,
    };
  });
}

/** Una noticia publicada, para la solapa "Noticias" del feed. */
export interface NoticiaFeedVM {
  id: string;
  titulo: string;
  copete: string;
  cuerpo: string;
  autor: string;
  /** "14 mar 2026" — la fecha del último cambio, ya formateada */
  fecha: string;
}

export async function getNoticiasFeed(): Promise<NoticiaFeedVM[]> {
  const snap = await adminDb().collection(COL.noticia).orderBy("createdAt", "desc").get();

  return snap.docs
    .map((doc) => aNoticia(doc.id, doc.data() as NoticiaDoc))
    .filter((n) => n.estado === "publicada")
    .map((n) => ({
      id: n.id,
      titulo: n.titulo,
      copete: n.copete,
      cuerpo: n.cuerpo,
      autor: n.autor,
      fecha: shortDate(n.updatedAt ?? n.createdAt),
    }));
}

/* ── el panel ────────────────────────────────────────────────────────────── */

export interface ContenidoStats {
  noticias: number;
  noticiasBorrador: number;
  encuestas: number;
  encuestasAbiertas: number;
  votos: number;
  invitaciones: number;
  invitacionesActivas: number;
  eventos: number;
  /** eventos que todavía no ocurrieron: es el número útil de un cronograma */
  eventosProximos: number;
  /** "sáb 12 sep" — el día en que ocurre todo el cronograma */
  diaEvento: string;
}

export async function getContenidoStats(): Promise<ContenidoStats> {
  const db = adminDb();
  const now = Date.now();

  const [
    noticias,
    noticiasBorrador,
    encuestasSnap,
    invitaciones,
    invitacionesActivas,
    fecha,
    eventos,
  ] = await Promise.all([
    db.collection(COL.noticia).count().get(),
    db.collection(COL.noticia).where("estado", "==", "borrador").count().get(),
    // Los votos se suman de las opciones de cada encuesta, que son un array
    // embebido: no hay `count()` que los cuente sin traer los documentos. Son
    // pocas encuestas, así que el costo es bajo.
    db.collection(COL.encuesta).get(),
    db.collection(COL.invitacion).count().get(),
    db.collection(COL.invitacion).where("estado", "==", "activa").count().get(),
    getFechaCronograma(),
    db.collection(COL.evento).get(),
  ]);

  const encuestas = encuestasSnap.docs.map((d) => d.data() as EncuestaDoc);
  const eventosProximos = eventos.docs.filter((d) => {
    const e = d.data() as EventoDoc;
    return fromISODate(fecha, e.hora).getTime() >= now;
  }).length;

  return {
    noticias: noticias.data().count,
    noticiasBorrador: noticiasBorrador.data().count,
    encuestas: encuestas.length,
    encuestasAbiertas: encuestas.filter((e) => e.estado === "abierta").length,
    votos: encuestas.reduce(
      (n, e) => n + (e.opciones ?? []).reduce((m, o) => m + (o.votos ?? 0), 0),
      0,
    ),
    invitaciones: invitaciones.data().count,
    invitacionesActivas: invitacionesActivas.data().count,
    eventos: eventos.size,
    eventosProximos,
    diaEvento: isoShort(fecha),
  };
}

/** Los próximos N eventos, para la card de "lo que viene" del panel. */
export async function getProximosEventos(limit = 4): Promise<EventoRow[]> {
  const all = await getEventos();
  return all.filter((e) => !e.pasado).slice(0, limit);
}
