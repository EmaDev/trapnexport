"use server";

import { revalidatePath } from "next/cache";

import { contenidoDb, invitacionCode, newId } from "@/lib/contenido/store";
import {
  EFECTO_INVITACION,
  PLANTILLA_INVITACION,
  REVELACION_INVITACION,
  type EfectoInvitacion,
  type EncuestaInput,
  type EstadoEncuesta,
  type EstadoInvitacion,
  type EstadoNoticia,
  type EventoInput,
  type InvitacionInput,
  type InvitacionMasivaInput,
  type NoticiaInput,
  type PlantillaInvitacion,
  type ResultadoMasivo,
  type RevelacionInvitacion,
} from "@/lib/contenido/types";
import { mediaUrl } from "@/lib/media";
import { fromISODate } from "@/lib/time";

/** Escrituras del contenido del club, como Server Actions.
 *
 *  Mitad "write" del par con `queries.ts`. Los formularios del panel las llaman
 *  igual que a un fetch y no conocen el store. Cuando entre Firestore, cada
 *  cuerpo pasa a escribir en su colección; las firmas no cambian.
 *
 *  Cada `saveX` es alta **y** modificación: sin `id` inserta, con `id`
 *  actualiza. Devuelven el id del registro guardado porque el panel lo
 *  necesita para dos cosas —abrir la tarjeta recién creada y armar el link de
 *  invitación— y volver a leer la tabla para encontrarlo sería un viaje de más.
 *
 *  Todas revalidan su ruta y `/admin`, que muestra los contadores.
 */

/** Sanea un campo de texto de formulario: recorta y corta a un largo máximo.
 *
 *  Va en el servidor y no (sólo) en el `maxLength` del input: el `maxLength`
 *  es una ayuda de tipeo, no una validación — una Server Action es un endpoint
 *  público y se la puede llamar sin pasar por el formulario. */
const text = (v: string, max = 240) => v.trim().slice(0, max);

/** Una hora `"HH:mm"` de 24 h, o el fallback. Mismo motivo que `text`: el
 *  `TimePicker` del panel no valida nada del lado del servidor. */
const time = (v: string, fallback: string) =>
  /^([01]\d|2[0-3]):[0-5]\d$/.test(v) ? v : fallback;

/** Un valor de una lista cerrada, o el fallback. Mismo motivo que `text`: el
 *  `Select` del panel no valida del lado del servidor, y un `efecto` que no
 *  existe deja la tarjeta sin animación —y a la ruta pública sin saber cuál
 *  montar— sin que nada avise. */
const oneOf = <T extends string>(v: string, allowed: readonly T[], fallback: T): T =>
  (allowed as readonly string[]).includes(v) ? (v as T) : fallback;

/** Una fecha `"YYYY-MM-DD"` que además existe en el calendario, o `null`.
 *  El regex deja pasar "2026-02-31"; el round-trip por `fromISODate`, no. */
const isoDate = (v: string): string | null => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(v)) return null;
  const d = fromISODate(v);
  const p = (n: number) => String(n).padStart(2, "0");
  const back = `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
  return back === v ? v : null;
};

const revalidate = (path: string) => {
  revalidatePath(path);
  revalidatePath("/admin");
};

/* ── noticias ────────────────────────────────────────────────────────────── */

export async function saveNoticia(input: NoticiaInput): Promise<string | null> {
  const titulo = text(input.titulo, 120);
  if (!titulo) return null;

  const data = {
    titulo,
    copete: text(input.copete, 320),
    cuerpo: text(input.cuerpo, 8000),
    estado: input.estado,
    autor: text(input.autor, 80) || "Prensa TNE",
    destacada: input.destacada,
  };

  const existing = input.id
    ? contenidoDb.noticias.find((n) => n.id === input.id)
    : undefined;

  // Una sola destacada por vez: marcar una apaga la anterior. Si no, la
  // portada pública tendría que elegir entre dos y elegiría la primera del
  // array, que es un orden que nadie controla desde el panel.
  if (data.destacada) {
    for (const n of contenidoDb.noticias) n.destacada = false;
  }

  if (existing) {
    Object.assign(existing, data, { updatedAt: Date.now() });
    revalidate("/admin/noticias");
    return existing.id;
  }

  const id = newId("n");
  contenidoDb.noticias.unshift({
    ...data,
    id,
    cover: mediaUrl(titulo.slice(0, 24), id),
    createdAt: Date.now(),
  });

  revalidate("/admin/noticias");
  return id;
}

export async function setNoticiaEstado(id: string, estado: EstadoNoticia): Promise<void> {
  const n = contenidoDb.noticias.find((x) => x.id === id);
  if (!n) return;

  n.estado = estado;
  n.updatedAt = Date.now();
  revalidate("/admin/noticias");
}

export async function deleteNoticia(id: string): Promise<void> {
  const i = contenidoDb.noticias.findIndex((n) => n.id === id);
  if (i !== -1) contenidoDb.noticias.splice(i, 1);
  revalidate("/admin/noticias");
}

/* ── encuestas ───────────────────────────────────────────────────────────── */

export async function saveEncuesta(input: EncuestaInput): Promise<string | null> {
  const pregunta = text(input.pregunta, 160);
  // Una opción vale si tiene texto **o** una URL de media: un video o una
  // imagen puede no llevar rótulo. `media` se recorta más largo porque es una
  // URL, no una etiqueta.
  const opciones = input.opciones
    .map((o) => ({ texto: text(o.texto, 120), media: text(o.media ?? "", 400) || undefined }))
    .filter((o) => o.texto || o.media);
  if (!pregunta || opciones.length < 2) return null;

  const existing = input.id
    ? contenidoDb.encuestas.find((e) => e.id === input.id)
    : undefined;

  const meta = {
    pregunta,
    descripcion: text(input.descripcion ?? "", 320) || undefined,
    multiple: input.multiple,
    resultadosVisibles: input.resultadosVisibles,
    estado: input.estado,
    cierra: input.cierra || undefined,
  };

  // La clave con la que se reconoce una opción entre ediciones: el texto, o la
  // URL de media cuando la opción no tiene texto.
  const clave = (o: { texto: string; media?: string }) => o.texto || o.media || "";

  if (existing) {
    // Editar una encuesta **no** borra los votos de las opciones que siguen.
    // El match es por clave y no por posición: reordenar la lista en el
    // formulario no tiene por qué mover los votos de una opción a otra. La
    // media sí se pisa con lo último que se cargó.
    existing.opciones = opciones.map((o) => {
      const previa = existing.opciones.find((p) => clave(p) === clave(o));
      return previa
        ? { ...previa, texto: o.texto, media: o.media }
        : { id: newId("o"), texto: o.texto, votos: 0, media: o.media };
    });
    Object.assign(existing, meta);

    revalidate("/admin/encuestas");
    return existing.id;
  }

  const id = newId("e");
  contenidoDb.encuestas.unshift({
    ...meta,
    id,
    opciones: opciones.map((o) => ({
      id: newId("o"),
      texto: o.texto,
      votos: 0,
      media: o.media,
    })),
    createdAt: Date.now(),
  });

  revalidate("/admin/encuestas");
  return id;
}

export async function setEncuestaEstado(
  id: string,
  estado: EstadoEncuesta,
): Promise<void> {
  const e = contenidoDb.encuestas.find((x) => x.id === id);
  if (!e) return;

  e.estado = estado;
  revalidate("/admin/encuestas");
}

export async function deleteEncuesta(id: string): Promise<void> {
  const i = contenidoDb.encuestas.findIndex((e) => e.id === id);
  if (i !== -1) contenidoDb.encuestas.splice(i, 1);
  revalidate("/admin/encuestas");
}

/* ── invitaciones ────────────────────────────────────────────────────────── */

/** Las listas cerradas que valida `oneOf`. Salen de las claves del mapa de
 *  etiquetas y no de un array escrito a mano: agregar una plantilla o un efecto
 *  ya obliga a darle etiqueta, y así no hay un segundo lugar donde olvidarse de
 *  sumarlo —que se vería como una opción del panel que el servidor descarta. */
const PLANTILLAS = Object.keys(PLANTILLA_INVITACION) as PlantillaInvitacion[];
const EFECTOS = Object.keys(EFECTO_INVITACION) as EfectoInvitacion[];
const REVELACIONES = Object.keys(REVELACION_INVITACION) as RevelacionInvitacion[];

export async function saveInvitacion(input: InvitacionInput): Promise<string | null> {
  const invitado = text(input.invitado, 80);
  const titulo = text(input.titulo, 120);
  if (!invitado || !titulo || !input.fecha) return null;

  const data = {
    invitado,
    titulo,
    mensaje: text(input.mensaje, 400),
    fecha: input.fecha,
    hora: input.hora || "21:00",
    lugar: text(input.lugar, 120),
    plantilla: oneOf(input.plantilla, PLANTILLAS, "gala"),
    efecto: oneOf(input.efecto, EFECTOS, "holo"),
    revelacion: oneOf(input.revelacion, REVELACIONES, "lacre"),
    estado: input.estado,
  };

  const existing = input.id
    ? contenidoDb.invitaciones.find((i) => i.id === input.id)
    : undefined;

  if (existing) {
    // El `code` no se toca al editar, ni siquiera si cambia el nombre del
    // invitado: el link ya está mandado y romperlo desde el panel sería
    // invalidar una invitación sin querer.
    Object.assign(existing, data);
    revalidate("/admin/invitaciones");
    revalidatePath(`/invitacion/${existing.code}`);
    return existing.id;
  }

  const id = newId("i");
  const code = invitacionCode(invitado, titulo);
  contenidoDb.invitaciones.unshift({ ...data, id, code, createdAt: Date.now() });

  revalidate("/admin/invitaciones");
  return id;
}

/** Cuántas invitaciones admite un solo pegado.
 *
 *  El tope no es por rendimiento —crear mil filas en memoria no cuesta nada—
 *  sino porque una lista de más de trescientos nombres casi siempre es un
 *  pegado equivocado: una planilla entera, una columna de más. Cortar y avisar
 *  es mejor que generar seiscientos links que después hay que borrar de a uno.
 */
const TOPE_MASIVO = 300;

/** Dos nombres son la misma persona si sólo difieren en mayúsculas, acentos o
 *  espacios de más. "josé pérez" y "Jose  Perez" no pueden generar dos
 *  invitaciones para la misma cena. */
const claveNombre = (v: string) =>
  v
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();

/** Alta masiva: un diseño, una lista de nombres, una invitación por nombre.
 *
 *  Cada una recibe su propio `code` y por lo tanto su propio link: es lo que
 *  hace que sean invitaciones personales y no un link compartido con ochenta
 *  personas. Por eso tampoco se pueden reusar entre sí ni deducir uno del otro.
 *
 *  Los repetidos se **saltean, no se rechazan**. El caso real es pegar la lista
 *  dos veces —o agregarle diez nombres al final y volver a pegarla entera—, y
 *  ahí lo que se espera es que se creen los diez que faltaban, no que falle
 *  todo ni que aparezcan setenta invitaciones duplicadas. Se los informa para
 *  que quien carga vea qué quedó afuera.
 */
export async function saveInvitacionesMasivas(
  input: InvitacionMasivaInput,
): Promise<ResultadoMasivo> {
  const titulo = text(input.titulo, 120);
  const fecha = isoDate(input.fecha);
  if (!titulo || !fecha) {
    return { creadas: 0, repetidos: [], error: "Faltan el título o la fecha del evento" };
  }

  const nombres = input.nombres
    .split(/[\n;]+/)
    .map((n) => text(n, 80))
    .filter(Boolean);

  if (!nombres.length) {
    return { creadas: 0, repetidos: [], error: "La lista de nombres está vacía" };
  }
  if (nombres.length > TOPE_MASIVO) {
    return {
      creadas: 0,
      repetidos: [],
      error: `Son ${nombres.length} nombres y el máximo por tanda es ${TOPE_MASIVO}`,
    };
  }

  const comunes = {
    titulo,
    fecha,
    mensaje: text(input.mensaje, 400),
    hora: time(input.hora, "21:00"),
    lugar: text(input.lugar, 120),
    plantilla: oneOf(input.plantilla, PLANTILLAS, "gala"),
    efecto: oneOf(input.efecto, EFECTOS, "holo"),
    revelacion: oneOf(input.revelacion, REVELACIONES, "lacre"),
    estado: input.estado,
  };

  // Las que ya existen para este evento, y las que se repiten dentro del mismo
  // pegado: las dos se saltean con el mismo criterio.
  const vistos = new Set(
    contenidoDb.invitaciones
      .filter((i) => i.titulo === titulo && i.fecha === fecha)
      .map((i) => claveNombre(i.invitado)),
  );

  const nuevas: typeof contenidoDb.invitaciones = [];
  const repetidos: string[] = [];
  const ahora = Date.now();

  nombres.forEach((invitado, i) => {
    const clave = claveNombre(invitado);
    if (vistos.has(clave)) {
      repetidos.push(invitado);
      return;
    }
    vistos.add(clave);
    nuevas.push({
      ...comunes,
      invitado,
      id: newId("i"),
      code: invitacionCode(invitado, titulo),
      // El índice **resta**, y eso ordena la tanda. Creadas todas en el mismo
      // milisegundo, la tabla —que ordena por `createdAt` descendente— las
      // mostraría barajadas; restando, la primera de la lista es la más nueva
      // y la tanda se lee en la tabla en el mismo orden en que se pegó.
      createdAt: ahora - i,
    });
  });

  // Un solo `unshift` y no uno por nombre: `unshift` mueve el array entero en
  // cada llamada, y con trescientas invitaciones eso son trescientos corrimientos
  // de una lista que ya viene creciendo.
  contenidoDb.invitaciones.unshift(...nuevas);

  revalidate("/admin/invitaciones");
  return { creadas: nuevas.length, repetidos };
}

export async function setInvitacionEstado(
  id: string,
  estado: EstadoInvitacion,
): Promise<void> {
  const inv = contenidoDb.invitaciones.find((x) => x.id === id);
  if (!inv) return;

  inv.estado = estado;
  revalidate("/admin/invitaciones");
  // Revocar tiene que apagar el link ya servido, no sólo la fila del panel.
  revalidatePath(`/invitacion/${inv.code}`);
}

export async function deleteInvitacion(id: string): Promise<void> {
  const i = contenidoDb.invitaciones.findIndex((x) => x.id === id);
  if (i === -1) return;

  const [gone] = contenidoDb.invitaciones.splice(i, 1);
  revalidate("/admin/invitaciones");
  revalidatePath(`/invitacion/${gone.code}`);
}

/* ── cronograma ──────────────────────────────────────────────────────────── */

export async function saveEvento(input: EventoInput): Promise<string | null> {
  const nombre = text(input.nombre, 120);
  // Sin fecha: el evento hereda el día del cronograma. Lo único obligatorio
  // que queda es el nombre — la hora tiene un default razonable y el día no se
  // elige acá.
  if (!nombre) return null;

  const data = {
    nombre,
    descripcion: text(input.descripcion, 600),
    hora: time(input.hora, "20:00"),
    // Un evento de duración 0 o negativa se dibuja como un bloque vacío en la
    // línea de tiempo; 15 minutos es el piso razonable de algo que pasa.
    duracion: Math.min(Math.max(Math.round(input.duracion) || 90, 15), 1440),
    lugar: text(input.lugar, 120),
    tipo: input.tipo,
  };

  const existing = input.id
    ? contenidoDb.eventos.find((e) => e.id === input.id)
    : undefined;

  if (existing) {
    Object.assign(existing, data);
    revalidate("/admin/cronograma");
    return existing.id;
  }

  const id = newId("ev");
  contenidoDb.eventos.push({ ...data, id, createdAt: Date.now() });

  revalidate("/admin/cronograma");
  return id;
}

export async function deleteEvento(id: string): Promise<void> {
  const i = contenidoDb.eventos.findIndex((e) => e.id === id);
  if (i !== -1) contenidoDb.eventos.splice(i, 1);
  revalidate("/admin/cronograma");
}

/** Mueve el cronograma entero a otro día. Devuelve la fecha guardada, o `null`
 *  si no era una fecha válida.
 *
 *  Escribe **un** campo, no N eventos: como los eventos guardan sólo la hora
 *  (ver `Evento` en `types.ts`), cambiar el día es atómico por construcción y
 *  no existe el estado intermedio de "la mitad se movió". Los horarios no se
 *  tocan: el programa del día es el mismo, corrido de fecha.
 */
export async function setFechaEvento(fecha: string): Promise<string | null> {
  const iso = isoDate(fecha);
  if (!iso) return null;

  contenidoDb.fechaEvento = iso;
  revalidate("/admin/cronograma");
  return iso;
}
