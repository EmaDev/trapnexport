import { contenidoDb } from "@/lib/contenido/store";
import type { Encuesta, Evento, Invitacion, Noticia } from "@/lib/contenido/types";
import { absoluteUrl } from "@/lib/site";
import { dateTime, fromISODate, horaMas, isoShort, longDate } from "@/lib/time";

/** Lecturas del contenido del club, ya mapeadas a lo que esperan las pantallas.
 *
 *  Mitad "read" del par con `actions.ts`. Cada fila **extiende la entidad** en
 *  vez de proyectar un subconjunto: la tabla del panel muestra la versión
 *  formateada (`fecha`, `creada`) y el formulario de edición se prellena con
 *  los campos crudos de la misma fila. Proyectar sólo lo visible obligaría a
 *  pedir la entidad de nuevo al abrir el modal.
 */

/* ── noticias ────────────────────────────────────────────────────────────── */

export interface NoticiaRow extends Noticia {
  /** `createdAt` formateado, que es lo que se muestra en la tabla */
  creada: string;
}

export async function getNoticias(): Promise<NoticiaRow[]> {
  return [...contenidoDb.noticias]
    .sort((a, b) => b.createdAt - a.createdAt)
    .map((n) => ({ ...n, creada: dateTime(n.updatedAt ?? n.createdAt) }));
}

/* ── encuestas ───────────────────────────────────────────────────────────── */

export interface EncuestaRow extends Encuesta {
  totalVotos: number;
  creada: string;
  /** "Cierra el sáb 12 sep" o "Sin fecha de cierre" */
  cierre: string;
}

const cierreLabel = (e: Encuesta): string => {
  if (e.estado === "cerrada") return "Cerrada";
  if (!e.cierra) return "Sin fecha de cierre";
  return `Cierra el ${isoShort(e.cierra)}`;
};

export async function getEncuestas(): Promise<EncuestaRow[]> {
  return [...contenidoDb.encuestas]
    .sort((a, b) => b.createdAt - a.createdAt)
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

/** El link es absoluto y sale de `absoluteUrl`, el mismo helper que el
 *  `canonical` de cada ruta: si el panel copiara un link relativo o armado a
 *  mano, el preview de WhatsApp se resolvería contra otro host que el que abre
 *  el invitado. */
const invitacionUrl = (code: string) => absoluteUrl(`/invitacion/${code}`);

const cuandoLabel = (fecha: string, hora: string) => `${isoShort(fecha)} · ${hora}`;

export async function getInvitaciones(): Promise<InvitacionRow[]> {
  return [...contenidoDb.invitaciones]
    .sort((a, b) => b.createdAt - a.createdAt)
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
  const found = contenidoDb.invitaciones.find((i) => i.code === code);
  return found && found.estado === "activa" ? found : null;
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

export async function getEventos(): Promise<EventoRow[]> {
  const now = Date.now();
  const fecha = contenidoDb.fechaEvento;

  return [...contenidoDb.eventos]
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
  const fecha = contenidoDb.fechaEvento;

  return {
    fecha,
    fechaLarga: longDate(fecha),
    eventos: await getEventos(),
  };
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
  const now = Date.now();
  const { noticias, encuestas, invitaciones, fechaEvento, eventos } = contenidoDb;

  return {
    noticias: noticias.length,
    noticiasBorrador: noticias.filter((n) => n.estado === "borrador").length,
    encuestas: encuestas.length,
    encuestasAbiertas: encuestas.filter((e) => e.estado === "abierta").length,
    votos: encuestas.reduce(
      (n, e) => n + e.opciones.reduce((m, o) => m + o.votos, 0),
      0,
    ),
    invitaciones: invitaciones.length,
    invitacionesActivas: invitaciones.filter((i) => i.estado === "activa").length,
    eventos: eventos.length,
    eventosProximos: eventos.filter(
      (e) => fromISODate(fechaEvento, e.hora).getTime() >= now,
    ).length,
    diaEvento: isoShort(fechaEvento),
  };
}

/** Los próximos N eventos, para la card de "lo que viene" del panel. */
export async function getProximosEventos(limit = 4): Promise<EventoRow[]> {
  const all = await getEventos();
  return all.filter((e) => !e.pasado).slice(0, limit);
}
