import { adminDb } from "@/lib/firebase/admin";
import { COL, CONFIG_CRONOGRAMA } from "@/lib/firebase/collections";
import type {
  CronogramaConfigDoc,
  EncuestaDoc,
  EventoDoc,
  InvitacionDoc,
  NoticiaDoc,
} from "@/lib/firebase/schema";
import type { Encuesta, Evento, Invitacion, Noticia } from "@/lib/contenido/types";
import { absoluteUrl } from "@/lib/site";
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
}

const aEncuesta = (id: string, d: EncuestaDoc): Encuesta => ({
  id,
  pregunta: d.pregunta,
  descripcion: d.descripcion,
  opciones: (d.opciones ?? []).map((o) => ({
    id: o.id,
    texto: o.texto,
    votos: o.votos ?? 0,
    media: o.media,
  })),
  multiple: d.multiple,
  resultadosVisibles: d.resultadosVisibles,
  estado: d.estado,
  cierra: d.cierra,
  createdAt: millis(d.createdAt),
});

const cierreLabel = (e: Encuesta): string => {
  if (e.estado === "cerrada") return "Cerrada";
  if (!e.cierra) return "Sin fecha de cierre";
  return `Cierra el ${isoShort(e.cierra)}`;
};

export async function getEncuestas(): Promise<EncuestaRow[]> {
  const snap = await adminDb().collection(COL.encuesta).orderBy("createdAt", "desc").get();

  return snap.docs
    .map((doc) => aEncuesta(doc.id, doc.data() as EncuestaDoc))
    .map((e) => ({
      ...e,
      totalVotos: e.opciones.reduce((n, o) => n + o.votos, 0),
      creada: dateTime(e.createdAt),
      cierre: cierreLabel(e),
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
  pregunta: string;
  descripcion?: string;
  multiple: boolean;
  /** todavía no se puede votar: se muestra la lista de opciones en gris */
  proximamente: boolean;
  opciones: { id: string; texto: string; media?: string }[];
}

export async function getEncuestasFeed(): Promise<EncuestaFeedVM[]> {
  // Ascendente: el feed las lista en el orden en que se anuncian en la gala,
  // que es el de la semilla (`createdAt` escalonado por premio).
  const snap = await adminDb().collection(COL.encuesta).orderBy("createdAt", "asc").get();

  return snap.docs
    .map((doc) => aEncuesta(doc.id, doc.data() as EncuestaDoc))
    .filter((e) => e.estado !== "cerrada")
    .map((e) => ({
      id: e.id,
      pregunta: e.pregunta,
      descripcion: e.descripcion,
      multiple: e.multiple,
      proximamente: e.estado !== "abierta",
      opciones: e.opciones.map((o) => ({ id: o.id, texto: o.texto, media: o.media })),
    }));
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
