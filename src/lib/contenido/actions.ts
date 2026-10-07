"use server";

import { FieldValue, Timestamp } from "firebase-admin/firestore";
import { revalidatePath } from "next/cache";

import { requireAdmin } from "@/lib/admin/auth";
import { adminDb } from "@/lib/firebase/admin";
import { COL, CONFIG_CRONOGRAMA, CONFIG_PORTADA } from "@/lib/firebase/collections";
import type {
  EncuestaDoc,
  InvitacionDoc,
  NoticiaDoc,
  OpcionEncuestaDoc,
  PortadaConfigDoc,
} from "@/lib/firebase/schema";
import { porOrden } from "@/lib/contenido/queries";
import { invitacionCode, newId } from "@/lib/contenido/store";
import {
  EFECTO_INVITACION,
  FORMATO_EVENTO,
  MAX_SLIDES,
  PLANTILLA_INVITACION,
  PORTADA_VACIA,
  REVELACION_INVITACION,
  type EfectoInvitacion,
  type EncuestaInput,
  type EstadoEncuesta,
  type EstadoInvitacion,
  type EstadoNoticia,
  type EventoInput,
  type FormatoEvento,
  type InvitacionInput,
  type InvitacionMasivaInput,
  type NoticiaInput,
  type OrigenCuentaRegresiva,
  type PlantillaInvitacion,
  type PortadaInput,
  type ResultadoMasivo,
  type RevelacionInvitacion,
} from "@/lib/contenido/types";
import { notifyAll } from "@/lib/social/notify";
import { ordenDePremio } from "@/lib/trap-awards";
import { fromISODate, isoShort } from "@/lib/time";

/** Escrituras del contenido del club, como Server Actions.
 *
 *  Mitad "write" del par con `queries.ts`. Los formularios del panel las llaman
 *  igual que a un fetch y no conocen la base. Van por el Admin SDK, que se
 *  saltea `firestore.rules`: cargar una noticia o abrir una votación no es un
 *  permiso que se pueda derivar del token de quien escribe, así que
 *  `firestore.rules` deja estas colecciones cerradas a cualquier cliente y la
 *  única puerta es esto.
 *
 *  Cada acción empieza por `requireAdmin()`. No es redundante con el guard de
 *  la página: una Server Action es un endpoint POST que se puede invocar sin
 *  pasar por ninguna pantalla.
 *
 *  Cada `saveX` es alta **y** modificación: sin `id` inserta, con `id`
 *  actualiza. Devuelven el id del registro guardado porque el panel lo
 *  necesita para abrir la tarjeta recién creada y para armar el link de
 *  invitación.
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

/** Firestore rechaza `undefined` en un campo. Los opcionales (`descripcion`,
 *  `cierra`, `media`) se omiten del objeto en vez de escribirse vacíos. */
const sinVacios = <T extends Record<string, unknown>>(obj: T): T =>
  Object.fromEntries(Object.entries(obj).filter(([, v]) => v !== undefined)) as T;

const revalidate = (path: string) => {
  revalidatePath(path);
  revalidatePath("/admin");
};

/** Aviso de campanita a toda la comunidad por un cambio del panel (cronograma,
 *  noticia o votación nueva). Además de crear las notificaciones revalida las
 *  superficies donde se ven: la lista dedicada y el feed, que es donde viven
 *  las solapas de cronograma y encuestas. */
const avisar = async (
  text: string,
  kind: "cronograma" | "noticia" | "encuesta",
  description?: string,
) => {
  await notifyAll({ kind, text, description, href: "/" });
  revalidatePath("/notificaciones");
  revalidatePath("/");
};

/* ── noticias ────────────────────────────────────────────────────────────── */

export async function saveNoticia(input: NoticiaInput): Promise<string | null> {
  await requireAdmin();

  const titulo = text(input.titulo, 120);
  if (!titulo) return null;

  const db = adminDb();
  const col = db.collection(COL.noticia);

  const data = {
    titulo,
    copete: text(input.copete, 320),
    cuerpo: text(input.cuerpo, 8000),
    estado: input.estado,
    autor: text(input.autor, 80) || "Prensa TNE",
    destacada: input.destacada ?? false,
  };

  const ref = input.id ? col.doc(input.id) : col.doc();
  const prev = input.id ? await ref.get() : null;
  const existing = prev?.exists ? (prev.data() as NoticiaDoc) : null;
  if (input.id && !existing) return null;

  // Una sola destacada por vez: marcar una apaga la anterior. Si no, la portada
  // pública tendría que elegir entre dos y elegiría una sin criterio.
  const batch = db.batch();
  if (data.destacada) {
    const otras = await col.where("destacada", "==", true).get();
    for (const d of otras.docs) {
      if (d.id !== ref.id) batch.update(d.ref, { destacada: false });
    }
  }

  if (existing) {
    batch.update(ref, { ...data, updatedAt: FieldValue.serverTimestamp() });
  } else {
    batch.set(ref, {
      ...data,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });
  }
  await batch.commit();

  // Una noticia "nace" para la comunidad cuando pasa a publicada, sea al
  // crearla así o al publicarla desde el borrador. Editar una ya publicada no
  // vuelve a avisar.
  const sePublica =
    (existing?.estado ?? "borrador") !== "publicada" && data.estado === "publicada";

  revalidate("/admin/noticias");
  if (sePublica) await avisar(`Nueva noticia: ${titulo}`, "noticia", data.copete || undefined);
  return ref.id;
}

export async function setNoticiaEstado(id: string, estado: EstadoNoticia): Promise<void> {
  await requireAdmin();

  const ref = adminDb().collection(COL.noticia).doc(id);
  const snap = await ref.get();
  if (!snap.exists) return;
  const n = snap.data() as NoticiaDoc;

  const sePublica = n.estado !== "publicada" && estado === "publicada";
  await ref.update({ estado, updatedAt: FieldValue.serverTimestamp() });

  revalidate("/admin/noticias");
  if (sePublica) await avisar(`Nueva noticia: ${n.titulo}`, "noticia", n.copete || undefined);
}

export async function deleteNoticia(id: string): Promise<void> {
  await requireAdmin();
  await adminDb().collection(COL.noticia).doc(id).delete();
  revalidate("/admin/noticias");
}

/* ── encuestas ───────────────────────────────────────────────────────────── */

export async function saveEncuesta(input: EncuestaInput): Promise<string | null> {
  await requireAdmin();

  const pregunta = text(input.pregunta, 160);
  // Una opción vale si tiene texto **o** una URL de media: una imagen puede no
  // llevar rótulo. `media` se recorta más largo porque es una URL, no una
  // etiqueta.
  const opciones = input.opciones
    .map((o) => ({ texto: text(o.texto, 120), media: text(o.media ?? "", 400) || undefined }))
    .filter((o) => o.texto || o.media);
  if (!pregunta || opciones.length < 2) return null;

  const col = adminDb().collection(COL.encuesta);
  const ref = input.id ? col.doc(input.id) : col.doc();
  const prev = input.id ? await ref.get() : null;
  const existing = prev?.exists ? (prev.data() as EncuestaDoc) : null;
  if (input.id && !existing) return null;

  // Un solo video para toda la encuesta: va arriba y las opciones quedan como
  // lista. Ver `contenido/media.ts`. No entra en `meta` porque vacío **no** es
  // lo mismo que ausente: `sinVacios` omitiría la clave y el `update` dejaría
  // en la base el video anterior, así que quitarlo del formulario no lo
  // quitaría de la encuesta. Vacío se borra explícitamente más abajo.
  const video = text(input.video ?? "", 400);

  // `nombre`, `maxOpciones` y `orden` se guardan **vacíos a propósito** cuando
  // el formulario los deja en blanco: son los campos que antes salían de
  // `PREMIOS` cruzando por id, y omitirlos dejaría en la base el valor anterior.
  // Borrar el nombre desde el panel tiene que borrarlo de verdad.
  const nombre = text(input.nombre ?? "", 60);
  const maxOpciones = Math.max(0, Math.trunc(Number(input.maxOpciones) || 0));

  /*  El orden. El formulario lo manda de vuelta tal como lo leyó —no se edita a
   *  mano, se mueve con las flechas de la tabla—, así que guardar una edición
   *  no toca el puesto. Lo que sí resuelve acá es el **alta**: una encuesta
   *  nueva sin orden se va al final de la lista.
   *
   *  Sin eso caería en `ordenDePremio`, que para un id que no es uno de los
   *  premios sembrados devuelve `PREMIOS.length`: con el orden ya normalizado
   *  en 0..n-1 eso la mete en el medio del feed, y aparecería pisando a una
   *  categoría que ya estaba anunciada en ese puesto. */
  const cargado = Number.isFinite(Number(input.orden)) ? Math.trunc(Number(input.orden)) : null;
  const orden = cargado ?? (input.id ? null : await proximoOrden());

  const meta = sinVacios({
    pregunta,
    descripcion: text(input.descripcion ?? "", 320) || undefined,
    multiple: input.multiple,
    resultadosVisibles: input.resultadosVisibles,
    estado: input.estado,
    cierra: input.cierra || undefined,
  });

  /** Los tres opcionales que se pueden **vaciar**: en el alta se omiten, en la
   *  edición se borran con `FieldValue.delete()`. Mismo criterio que `video`. */
  const propios = {
    nombre: nombre || null,
    // El tope sólo tiene sentido si se puede elegir más de una.
    maxOpciones: input.multiple && maxOpciones > 0 ? maxOpciones : null,
    orden,
  };

  // La clave con la que se reconoce una opción entre ediciones: el texto, o la
  // URL de media cuando la opción no tiene texto.
  const clave = (o: { texto: string; media?: string }) => o.texto || o.media || "";

  // Editar una encuesta **no** borra los votos de las opciones que siguen. El
  // match es por clave y no por posición: reordenar la lista en el formulario
  // no tiene por qué mover los votos de una opción a otra. La media sí se pisa
  // con lo último que se cargó.
  const previas = existing?.opciones ?? [];
  const nuevasOpciones: OpcionEncuestaDoc[] = opciones.map((o) => {
    const previa = previas.find((p) => clave(p) === clave(o));
    return sinVacios({
      id: previa?.id ?? newId("o"),
      texto: o.texto,
      votos: previa?.votos ?? 0,
      media: o.media,
    });
  });

  if (existing) {
    await ref.update({
      ...meta,
      video: video || FieldValue.delete(),
      ...Object.fromEntries(
        Object.entries(propios).map(([k, v]) => [k, v ?? FieldValue.delete()]),
      ),
      opciones: nuevasOpciones,
    });
  } else {
    await ref.set({
      ...meta,
      ...(video ? { video } : {}),
      ...sinVacios(
        Object.fromEntries(
          Object.entries(propios).map(([k, v]) => [k, v ?? undefined]),
        ),
      ),
      opciones: nuevasOpciones,
      createdAt: FieldValue.serverTimestamp(),
    });
  }

  // Una votación "nace" para la comunidad cuando queda abierta —sea al crearla
  // así o al abrirla desde el borrador—. Un borrador no se ve en el feed, así
  // que avisar de uno mandaría a votar algo que no está. Editar una ya abierta
  // no vuelve a avisar. Mismo criterio que `saveNoticia` con `publicada`.
  const seAbre = (existing?.estado ?? "borrador") !== "abierta" && meta.estado === "abierta";

  revalidate("/admin/encuestas");
  if (seAbre) await avisar(`Nueva votación: ${pregunta}`, "encuesta", meta.descripcion);
  return ref.id;
}

/** Las encuestas con lo justo para ordenarlas, ya en el orden del feed.
 *
 *  `select()` y no `get()`: para acomodar la lista alcanzan las dos claves del
 *  criterio, y bajarse las opciones de cada categoría —con sus URLs de media—
 *  para después descartarlas sería leer la colección entera de gusto.
 *
 *  Sin `orderBy("orden")`, por lo mismo que `getEncuestas`: la query saltearía
 *  los documentos que todavía no tienen el campo, que son justo los que hay que
 *  acomodar. El orden lo pone `porOrden` en memoria, que es el del feed. */
const encuestasEnOrden = async () => {
  const snap = await adminDb().collection(COL.encuesta).select("orden", "createdAt").get();

  return snap.docs
    .map((d) => ({
      ref: d.ref,
      id: d.id,
      orden: typeof d.get("orden") === "number" ? (d.get("orden") as number) : undefined,
      createdAt: d.get("createdAt") instanceof Timestamp ? d.get("createdAt").toMillis() : 0,
    }))
    .sort(porOrden);
};

/** El puesto que le toca a una encuesta nueva: uno más que el de la última.
 *
 *  Uno más que el **máximo** y no la cantidad de encuestas: la lista puede
 *  tener huecos —borrar una categoría deja el orden en 0, 1, 3— y puestos que
 *  todavía salen de `PREMIOS` y no del documento, los dos casos en los que
 *  contar filas devuelve un número que ya está ocupado y mete la encuesta
 *  nueva en el medio del feed. Como la lista viene ordenada, el máximo es el
 *  puesto efectivo de la última. */
const proximoOrden = async () => {
  const todas = await encuestasEnOrden();
  const ultima = todas.at(-1);
  return ultima ? (ultima.orden ?? ordenDePremio(ultima.id)) + 1 : 0;
};

/** Mueve una encuesta un lugar en el orden con el que se la ve: el del feed y
 *  el de la gala. Es el único lugar que escribe `orden`.
 *
 *  Reescribe el orden **entero**, y no sólo las dos filas que se cruzan como
 *  hace `moverEra`. Allá las etapas son siempre una permutación de 0..n-1, acá
 *  no: las categorías sembradas antes de que `orden` fuera un campo lo tienen
 *  vacío y caen al puesto que tienen en `PREMIOS`. Intercambiar dos números
 *  sobre esa mezcla deja empates —dos encuestas con el mismo puesto, desempate
 *  por fecha de alta— y la fila vuelve sola a donde estaba al siguiente click.
 *  Normalizar en cada movida hace que a partir del primero el orden sea
 *  explícito y no dependa más de lo sembrado. Son una decena de documentos y
 *  el batch sólo escribe los que cambian de puesto.
 *
 *  Revalida además el feed: es la superficie donde se ve el cambio, y es lo
 *  único que mueve esta acción —no hay snack ni refresh del lado del socio. */
export async function moverEncuesta(id: string, direccion: "sube" | "baja"): Promise<void> {
  await requireAdmin();

  const todas = await encuestasEnOrden();
  const i = todas.findIndex((e) => e.id === id);
  const j = direccion === "sube" ? i - 1 : i + 1;
  if (i < 0 || j < 0 || j >= todas.length) return;

  [todas[i], todas[j]] = [todas[j], todas[i]];

  const batch = adminDb().batch();
  todas.forEach((e, puesto) => {
    if (e.orden !== puesto) batch.update(e.ref, { orden: puesto });
  });
  await batch.commit();

  revalidate("/admin/encuestas");
  revalidatePath("/");
}

export async function setEncuestaEstado(
  id: string,
  estado: EstadoEncuesta,
): Promise<void> {
  await requireAdmin();

  const ref = adminDb().collection(COL.encuesta).doc(id);
  const snap = await ref.get();
  if (!snap.exists) return;
  const e = snap.data() as EncuestaDoc;

  await ref.update({ estado });

  // borrador → abierta es el momento en que la votación se hace pública: avisa
  // a la comunidad, igual que publicar una noticia. Cerrarla no notifica.
  const seAbre = e.estado !== "abierta" && estado === "abierta";

  revalidate("/admin/encuestas");
  if (seAbre) await avisar(`Nueva votación: ${e.pregunta}`, "encuesta", e.descripcion);
}

export async function deleteEncuesta(id: string): Promise<void> {
  await requireAdmin();
  await adminDb().collection(COL.encuesta).doc(id).delete();
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
  await requireAdmin();

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

  const col = adminDb().collection(COL.invitacion);

  if (input.id) {
    const ref = col.doc(input.id);
    const snap = await ref.get();
    if (!snap.exists) return null;
    const existing = snap.data() as InvitacionDoc;

    // El `code` no se toca al editar, ni siquiera si cambia el nombre del
    // invitado: el link ya está mandado y romperlo desde el panel sería
    // invalidar una invitación sin querer.
    await ref.update(data);
    revalidate("/admin/invitaciones");
    revalidatePath(`/invitacion/${existing.code}`);
    return ref.id;
  }

  const ref = col.doc();
  const code = invitacionCode(invitado, titulo);
  await ref.set({ ...data, code, createdAt: FieldValue.serverTimestamp() });

  revalidate("/admin/invitaciones");
  return ref.id;
}

/** Cuántas invitaciones admite un solo pegado.
 *
 *  El tope no es por rendimiento —crear mil filas no cuesta casi nada— sino
 *  porque una lista de más de trescientos nombres casi siempre es un pegado
 *  equivocado: una planilla entera, una columna de más. Cortar y avisar es
 *  mejor que generar seiscientos links que después hay que borrar de a uno.
 *
 *  Además, un batch de Firestore admite 500 escrituras: con el tope en 300 el
 *  alta masiva entra siempre en un solo commit atómico.
 */
const TOPE_MASIVO = 300;

/** Dos nombres son la misma persona si sólo difieren en mayúsculas, acentos o
 *  espacios de más. "josé pérez" y "Jose  Perez" no pueden generar dos
 *  invitaciones para la misma cena. */
const claveNombre = (v: string) =>
  v
    .normalize("NFD")
    .replace(new RegExp(`[${String.fromCharCode(0x300)}-${String.fromCharCode(0x36f)}]`, "g"), "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();

/** Alta masiva: un diseño, una lista de nombres, una invitación por nombre.
 *
 *  Cada una recibe su propio `code` y por lo tanto su propio link: es lo que
 *  hace que sean invitaciones personales y no un link compartido con ochenta
 *  personas.
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
  await requireAdmin();

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

  const db = adminDb();
  const col = db.collection(COL.invitacion);

  // Las que ya existen para este evento, y las que se repiten dentro del mismo
  // pegado: las dos se saltean con el mismo criterio.
  const yaCargadas = await col
    .where("titulo", "==", titulo)
    .where("fecha", "==", fecha)
    .get();
  const vistos = new Set(
    yaCargadas.docs.map((d) => claveNombre((d.data() as InvitacionDoc).invitado)),
  );

  const batch = db.batch();
  const repetidos: string[] = [];
  // El índice **resta** de `createdAt`: creadas todas casi en el mismo instante,
  // la tabla —que ordena por `createdAt` descendente— las mostraría barajadas;
  // restando, la primera de la lista es la más nueva y la tanda se lee en el
  // mismo orden en que se pegó.
  const ahora = Date.now();
  let creadas = 0;

  nombres.forEach((invitado, i) => {
    const clave = claveNombre(invitado);
    if (vistos.has(clave)) {
      repetidos.push(invitado);
      return;
    }
    vistos.add(clave);
    batch.set(col.doc(), {
      ...comunes,
      invitado,
      code: invitacionCode(invitado, titulo),
      createdAt: Timestamp.fromMillis(ahora - i),
    });
    creadas++;
  });

  if (creadas) await batch.commit();

  revalidate("/admin/invitaciones");
  return { creadas, repetidos };
}

export async function setInvitacionEstado(
  id: string,
  estado: EstadoInvitacion,
): Promise<void> {
  await requireAdmin();

  const ref = adminDb().collection(COL.invitacion).doc(id);
  const snap = await ref.get();
  if (!snap.exists) return;
  const inv = snap.data() as InvitacionDoc;

  await ref.update({ estado });
  revalidate("/admin/invitaciones");
  // Revocar tiene que apagar el link ya servido, no sólo la fila del panel.
  revalidatePath(`/invitacion/${inv.code}`);
}

export async function deleteInvitacion(id: string): Promise<void> {
  await requireAdmin();

  const ref = adminDb().collection(COL.invitacion).doc(id);
  const snap = await ref.get();
  if (!snap.exists) return;
  const inv = snap.data() as InvitacionDoc;

  await ref.delete();
  revalidate("/admin/invitaciones");
  revalidatePath(`/invitacion/${inv.code}`);
}

/* ── cronograma ──────────────────────────────────────────────────────────── */

const FORMATOS = Object.keys(FORMATO_EVENTO) as FormatoEvento[];

export async function saveEvento(input: EventoInput): Promise<string | null> {
  await requireAdmin();

  const nombre = text(input.nombre, 120);
  // Sin fecha: el evento hereda el día del cronograma. Lo único obligatorio
  // que queda es el nombre — la hora tiene un default razonable y el día no se
  // elige acá.
  if (!nombre) return null;

  const data = {
    nombre,
    // 1200 y no 600: con formato de ítems la descripción deja de ser una frase
    // y pasa a ser el programa del bloque —"recepción / brindis / palabras /
    // cena"—, y doce renglones no entran en 600 caracteres. Los saltos de línea
    // sobreviven: `text` sólo recorta puntas, y son lo que separa los ítems.
    descripcion: text(input.descripcion, 1200),
    hora: time(input.hora, "20:00"),
    // Un evento de duración 0 o negativa se dibuja como un bloque vacío en la
    // línea de tiempo; 15 minutos es el piso razonable de algo que pasa.
    duracion: Math.min(Math.max(Math.round(input.duracion) || 90, 15), 1440),
    lugar: text(input.lugar, 120),
    tipo: input.tipo,
    formato: oneOf(input.formato ?? "auto", FORMATOS, "auto"),
  };

  const col = adminDb().collection(COL.evento);
  const ref = input.id ? col.doc(input.id) : col.doc();

  if (input.id) {
    const snap = await ref.get();
    if (!snap.exists) return null;
    await ref.update(data);
    revalidate("/admin/cronograma");
    await avisar(
      `Cambió un evento del cronograma: ${nombre}`,
      "cronograma",
      data.descripcion || undefined,
    );
    return ref.id;
  }

  await ref.set({ ...data, createdAt: FieldValue.serverTimestamp() });
  revalidate("/admin/cronograma");
  await avisar(
    `Nuevo evento en el cronograma: ${nombre}`,
    "cronograma",
    `${data.hora} · ${data.lugar || "a confirmar"}`,
  );
  return ref.id;
}

export async function deleteEvento(id: string): Promise<void> {
  await requireAdmin();

  const ref = adminDb().collection(COL.evento).doc(id);
  const snap = await ref.get();
  if (!snap.exists) return;
  const { nombre } = snap.data() as { nombre: string };

  await ref.delete();
  revalidate("/admin/cronograma");
  await avisar(`Se quitó del cronograma: ${nombre}`, "cronograma");
}

/** Mueve el cronograma entero a otro día. Devuelve la fecha guardada, o `null`
 *  si no era una fecha válida.
 *
 *  Escribe **un** campo del documento `trapnexport-config/cronograma`, no N
 *  eventos: como los eventos guardan sólo la hora, cambiar el día es atómico
 *  por construcción y no existe el estado intermedio de "la mitad se movió".
 *  Los horarios no se tocan: el programa del día es el mismo, corrido de fecha.
 */
export async function setFechaEvento(fecha: string): Promise<string | null> {
  await requireAdmin();

  const iso = isoDate(fecha);
  if (!iso) return null;

  const ref = adminDb().collection(COL.config).doc(CONFIG_CRONOGRAMA);
  const anterior = (await ref.get()).data()?.fecha as string | undefined;

  await ref.set({ fecha: iso, updatedAt: FieldValue.serverTimestamp() });

  revalidate("/admin/cronograma");
  if (iso !== anterior) {
    await avisar(`El cronograma se movió al ${isoShort(iso)}`, "cronograma");
  }
  return iso;
}

/* ── portada de la home ──────────────────────────────────────────────────── */

/** Una URL de imagen para el `src` de un `<img>`: `https://` de Storage, un
 *  `data:image/` generado por `lib/media.ts` o una ruta de `public/`. Cualquier
 *  otra cosa —`javascript:` a la cabeza— se descarta. Misma función que `src` en
 *  `historia/actions.ts`, por el mismo motivo: el valor llega de un input de
 *  texto donde se puede pegar cualquier cosa. */
const imagen = (v: string): string => {
  const s = v.trim();
  if (!s) return "";
  const ok = s.startsWith("https://") || s.startsWith("data:image/") || s.startsWith("/");
  return ok ? s.slice(0, 2_000_000) : "";
};

const ORIGENES: readonly OrigenCuentaRegresiva[] = ["cronograma", "fija"];

/** Guarda la portada de la home: cuenta regresiva y carrusel, juntos.
 *
 *  Un solo `set` sobre `trapnexport-config/portada` porque es un solo documento
 *  (ver `PortadaConfigDoc`): guardar los slides y el contador por separado deja
 *  abierto el estado en el que se guardó uno y el otro no.
 *
 *  Devuelve `false` sólo si el contador quedó sin a qué contar —origen `fija`
 *  sin fecha válida—, que es el único error que el formulario no puede corregir
 *  solo. Un slide sin imagen no es un error: se descarta, porque es la fila que
 *  quedó recién agregada y sin cargar.
 *
 *  Revalida `/`: la home es un Server Component y el contador y el carrusel
 *  salen de acá, así que sin esto el cambio no se ve hasta el próximo deploy.
 */
export async function savePortada(input: PortadaInput): Promise<boolean> {
  await requireAdmin();

  const c = input.countdown;
  const origen = oneOf(c.origen, ORIGENES, PORTADA_VACIA.countdown.origen);
  const fecha = isoDate(c.fecha ?? "");

  // La fecha fija es obligatoria sólo cuando es la que se usa. Con origen
  // `cronograma` el contador tiene a qué contar igual, así que una fecha fija
  // vacía (o inválida) no frena el guardado: se omite el campo.
  if (origen === "fija" && !fecha) return false;

  const doc: PortadaConfigDoc = {
    countdown: sinVacios({
      activa: !!c.activa,
      origen,
      fecha: fecha ?? undefined,
      hora: time(c.hora ?? "", PORTADA_VACIA.countdown.hora),
      eyebrow: text(c.eyebrow, 40) || PORTADA_VACIA.countdown.eyebrow,
      titulo: text(c.titulo, 80) || undefined,
      mensajeFinal: text(c.mensajeFinal, 80) || PORTADA_VACIA.countdown.mensajeFinal,
    }),
    slides: (input.slides ?? [])
      .map((sl) => ({
        src: imagen(sl?.src ?? ""),
        alt: text(sl?.alt, 120),
        caption: text(sl?.caption, 80),
      }))
      // Una fila sin imagen no es un slide: es la que se agregó y no se cargó.
      .filter((sl) => !!sl.src)
      .slice(0, MAX_SLIDES)
      .map((sl) => sinVacios({ src: sl.src, alt: sl.alt, caption: sl.caption || undefined })),
    updatedAt: FieldValue.serverTimestamp() as unknown as PortadaConfigDoc["updatedAt"],
  };

  await adminDb().collection(COL.config).doc(CONFIG_PORTADA).set(doc);

  revalidate("/admin/portada");
  revalidatePath("/");
  return true;
}
