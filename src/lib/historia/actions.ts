"use server";

import { FieldValue } from "firebase-admin/firestore";
import { revalidatePath } from "next/cache";

import { requireAdmin } from "@/lib/admin/auth";
import { adminDb } from "@/lib/firebase/admin";
import { COL, HISTORIA_CLUB } from "@/lib/firebase/collections";
import type {
  ClipDoc,
  EraDoc,
  FotoDoc,
  FraseDoc,
  HistoriaClubDoc,
  PlayerDoc,
  TemporadaDoc,
} from "@/lib/firebase/schema";
import { SEED } from "@/lib/historia/seed";
import type {
  Balance,
  Clip,
  ClubIdentity,
  Era,
  Photo,
  Player,
  Quote,
  Season,
  Trophy,
} from "@/lib/historia/types";

/** Escrituras de la historia del club, como Server Actions.
 *
 *  Mitad "write" del par con `queries.ts`. Las llama `/admin/historia` igual
 *  que a un fetch, y el panel no conoce la base. Van por el Admin SDK, que se
 *  saltea `firestore.rules`: editar la historia del club no es un permiso que
 *  se pueda derivar del token de quien escribe, así que `firestore.rules` deja
 *  estas colecciones cerradas a cualquier cliente y la única puerta es esto.
 *
 *  Cada acción empieza por `requireAdmin()`. No es redundante con el guard de
 *  la página: una Server Action es un endpoint POST que se puede invocar sin
 *  pasar por ninguna pantalla.
 *
 *  Cada `guardarX` es alta **y** modificación: sin `id` inserta, con `id`
 *  actualiza. Devuelven el id guardado porque el panel lo necesita para dejar
 *  abierta la tarjeta recién creada.
 *
 *  Todas revalidan las rutas públicas que muestran lo que tocaron. La historia
 *  es contenido estático de Next: sin `revalidatePath`, un cambio en el panel
 *  no aparece en `/historia` hasta el próximo deploy.
 */

/* ── saneadores ──────────────────────────────────────────────────────────── */

/** Recorta y acota un campo de texto. Va en el servidor y no (sólo) en el
 *  `maxLength` del input: el `maxLength` es una ayuda de tipeo, no una
 *  validación — una Server Action es un endpoint público. Mismo criterio que
 *  `contenido/actions.ts`. */
const text = (v: unknown, max = 240): string =>
  typeof v === "string" ? v.trim().slice(0, max) : "";

/** Un entero dentro de un rango, o el fallback. Los años, los dorsales y las
 *  skills llegan de inputs numéricos que un `NaN` atraviesa sin ruido. */
const num = (v: unknown, min: number, max: number, fallback: number): number => {
  const n = Math.round(Number(v));
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : fallback;
};

/** Una URL de imagen: o una `https://` de Storage, o un `data:` generado por
 *  `lib/media.ts`, o una ruta de `public/`. Cualquier otra cosa —`javascript:`
 *  a la cabeza— se descarta: esto termina en el `src` de un `<img>`. */
const src = (v: unknown, fallback = ""): string => {
  const s = typeof v === "string" ? v.trim() : "";
  if (!s) return fallback;
  if (s.startsWith("https://") || s.startsWith("data:image/") || s.startsWith("/")) {
    return s.slice(0, 2_000_000);
  }
  return fallback;
};

const oneOf = <T extends string>(v: unknown, allowed: readonly T[], fallback: T): T =>
  (allowed as readonly string[]).includes(v as string) ? (v as T) : fallback;

/** Firestore rechaza `undefined` en un campo. Los opcionales (`quote`, `src`,
 *  `current`) se omiten del objeto en vez de escribirse vacíos. */
const sinVacios = <T extends Record<string, unknown>>(obj: T): T =>
  Object.fromEntries(Object.entries(obj).filter(([, v]) => v !== undefined)) as T;

/** id corto y único. Lo usan las listas embebidas —hitos, pasos de carrera,
 *  fotos de una ficha—: no son documentos, así que no tienen id de Firestore y
 *  igual hay que poder reconocerlas entre ediciones. Mismo generador que
 *  `contenido/store.ts`. */
const newId = (prefix: string) =>
  `${prefix}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;

/** "Naza Sochán" → "naza-sochan". El slug es el id del documento de un jugador
 *  y de ahí sale el deep link `/historia?jugador=naza-sochan`, así que tiene
 *  que ser legible y estable, no un id al azar. */
const DIACRITICOS = new RegExp(
  `[${String.fromCharCode(0x300)}-${String.fromCharCode(0x36f)}]`,
  "g",
);

const slug = (s: string): string =>
  s
    .normalize("NFD")
    .replace(DIACRITICOS, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 48);

const pares = (v: unknown, max = 12): { label: string; value: string }[] =>
  Array.isArray(v)
    ? v
        .slice(0, max)
        .map((p) => ({
          label: text((p as { label?: unknown })?.label, 40),
          value: text((p as { value?: unknown })?.value, 60),
        }))
        .filter((p) => p.label || p.value)
    : [];

const KINDS = [
  "titulo",
  "ascenso",
  "derrota",
  "debut",
  "obra",
  "partido",
  "homenaje",
  "evento",
] as const;

const unaFoto = (p: Photo, i: number): Photo => ({
  id: text(p?.id, 60) || newId(`f${i}`),
  src: src(p?.src),
  alt: text(p?.alt, 160),
  caption: text(p?.caption, 200),
  year: num(p?.year, 1900, 2200, new Date().getFullYear()),
});

const unClip = (c: Clip, i: number): Clip =>
  sinVacios({
    id: text(c?.id, 60) || newId(`c${i}`),
    title: text(c?.title, 120),
    description: text(c?.description, 300),
    year: num(c?.year, 1900, 2200, new Date().getFullYear()),
    duration: text(c?.duration, 12),
    poster: src(c?.poster),
    motion: src(c?.motion, src(c?.poster)),
    src: c?.src ? src(c.src) || undefined : undefined,
  });

const unaFrase = (q: Quote | undefined, id: string): Quote | undefined => {
  if (!q || !text(q.text, 400)) return undefined;
  return {
    id: text(q.id, 60) || id,
    text: text(q.text, 400),
    author: text(q.author, 80),
    role: text(q.role, 120),
    year: num(q.year, 1900, 2200, new Date().getFullYear()),
    avatar: src(q.avatar),
  };
};

/** Las rutas públicas que muestran la historia. Se revalidan todas juntas
 *  porque casi cualquier edición cruza más de una: el escudo del club sale en
 *  `/historia`, en `/perfil` y en la invitación; un jugador sale en la ficha y
 *  en el salón de la fama de cada temporada que lo nombra. Enumerar cuál toca
 *  en cada acción sería una tabla de dependencias que se desactualiza sola. */
const revalidar = (...extra: string[]) => {
  revalidatePath("/historia");
  revalidatePath("/historia/[year]", "page");
  revalidatePath("/perfil");
  revalidatePath("/admin/historia");
  for (const p of extra) revalidatePath(p);
};

/* ── la semilla, sección por sección ─────────────────────────────────────── */

/** Las siete secciones, con la colección y la semilla de cada una. */
type Seccion = "club" | "eras" | "temporadas" | "jugadores" | "frases" | "fotos" | "clips";

/** Copia a Firestore la semilla de **una** sección, y sólo si esa colección
 *  todavía está vacía. Devuelve si escribió algo.
 *
 *  ⚠️ Esto no es una comodidad: es lo que evita la única forma de perder
 *  contenido en este panel.
 *
 *  Mientras una colección está vacía, `queries.ts` sirve la semilla — así la
 *  app cuenta la historia completa desde el primer arranque. Pero apenas
 *  aparece **un** documento, el fallback se apaga entero: guardar una corrección
 *  de tipeo en la etapa 2020 crearía esa sola etapa y las otras cinco
 *  desaparecerían de `/historia` sin que nadie las haya borrado.
 *
 *  Por eso toda escritura de una sección siembra primero lo que le falta a esa
 *  sección. El resultado es que editar sobre la semilla se comporta como
 *  cualquiera esperaría: se guarda el cambio y lo demás queda como estaba.
 *
 *  Es idempotente: una colección con algo adentro no se toca nunca, ni siquiera
 *  parcialmente. Nadie va a recuperar por acá una etapa que borró a propósito.
 */
async function sembrarSeccion(seccion: Seccion): Promise<boolean> {
  const db = adminDb();

  if (seccion === "club") {
    const ref = db.collection(COL.historia).doc(HISTORIA_CLUB);
    if ((await ref.get()).exists) return false;
    await ref.set({
      ...SEED.club,
      trophies: SEED.trophies,
      balance: SEED.balance,
      updatedAt: FieldValue.serverTimestamp(),
    });
    return true;
  }

  // Las otras seis son colecciones con la misma forma: `id` sale del documento
  // y `orden` de la posición en la semilla.
  const { col, filas } = {
    eras: { col: COL.era, filas: SEED.eras },
    temporadas: { col: COL.temporada, filas: SEED.seasons },
    jugadores: { col: COL.historiaJugador, filas: SEED.players },
    frases: { col: COL.frase, filas: SEED.quotes },
    fotos: { col: COL.foto, filas: SEED.gallery },
    clips: { col: COL.clip, filas: SEED.clips },
  }[seccion];

  const ref = db.collection(col);
  if (!(await ref.limit(1).get()).empty) return false;

  type Fila = { id?: string; year?: number } & Record<string, unknown>;

  const batch = db.batch();
  (filas as readonly unknown[] as readonly Fila[]).forEach((fila, i) => {
    const { id, ...resto } = fila;
    // Las temporadas se guardan bajo su año y no bajo un id: es la URL pública.
    // Ver el comentario de `TemporadaDoc`. Son la única de las seis que no
    // trae `id`, así que el año hace de discriminante sin una bandera aparte.
    const docId = resto.year === undefined ? String(id) : String(resto.year);
    batch.set(ref.doc(docId), sinVacios({ ...resto, orden: i }));
  });
  await batch.commit();

  return true;
}

/* ── identidad, palmarés y balance ───────────────────────────────────────── */

export interface ClubInput extends ClubIdentity {
  trophies: Trophy[];
  balance: Balance;
}

/** Guarda la fila única de `trapnexport-historia/club`.
 *
 *  Va con `set` entero y no con `update` campo a campo: el formulario del panel
 *  manda siempre el objeto completo, y un merge parcial dejaría un documento a
 *  medio migrar la primera vez que se guarda sobre la semilla. */
export async function guardarClub(input: ClubInput): Promise<boolean> {
  await requireAdmin();

  const name = text(input.name, 80);
  if (!name) return false;

  const doc: HistoriaClubDoc = {
    name,
    nickname: text(input.nickname, 40),
    founded: num(input.founded, 1900, 2200, new Date().getFullYear()),
    stadium: text(input.stadium, 80),
    colors: text(input.colors, 80),
    motto: text(input.motto, 120),
    members: num(input.members, 0, 100_000, 0),
    crest: src(input.crest, "/escudo.svg"),
    intro: text(input.intro, 1200),
    trophies: (input.trophies ?? []).slice(0, 40).map((t, i) => ({
      id: text(t?.id, 60) || newId(`t${i}`),
      name: text(t?.name, 120),
      times: num(t?.times, 1, 999, 1),
      years: text(t?.years, 80),
      // Sin foto va "" y no se omite el campo: `PalmaresRail` cae en la copa
      // generada, así que el vacío es un estado válido y no un dato faltante.
      photo: src(t?.photo),
    })),
    balance: {
      finales: num(input.balance?.finales, 0, 999, 0),
      ganadas: num(input.balance?.ganadas, 0, 999, 0),
      perdidas: num(input.balance?.perdidas, 0, 999, 0),
      estrellas: num(input.balance?.estrellas, 0, 999, 0),
    },
    // `serverTimestamp()` es un centinela que el servidor resuelve al
    // escribir: no es un `Timestamp` todavía, y el tipo del documento describe
    // lo que se lee, no lo que se manda.
    updatedAt: FieldValue.serverTimestamp() as unknown as HistoriaClubDoc["updatedAt"],
  };

  await adminDb().collection(COL.historia).doc(HISTORIA_CLUB).set(doc);
  revalidar("/", "/invitacion/[code]");
  return true;
}

/* ── etapas ──────────────────────────────────────────────────────────────── */

export type EraInput = Era & { orden?: number };

export async function guardarEra(input: EraInput): Promise<string | null> {
  await requireAdmin();
  await sembrarSeccion("eras");

  const title = text(input.title, 120);
  if (!title) return null;

  const col = adminDb().collection(COL.era);
  const ref = input.id ? col.doc(input.id) : col.doc();

  // El orden por defecto manda la etapa nueva al final de la línea de tiempo.
  // Se calcula sólo en el alta: en una edición, reusar el conteo movería la
  // etapa de lugar cada vez que alguien corrige una falta de ortografía.
  const orden =
    input.orden ?? (input.id ? undefined : (await col.count().get()).data().count);

  const doc = sinVacios({
    period: text(input.period, 40),
    title,
    tagline: text(input.tagline, 200),
    description: text(input.description, 4000),
    photo: src(input.photo),
    current: input.current ? true : FieldValue.delete(),
    stats: pares(input.stats),
    milestones: (input.milestones ?? []).slice(0, 60).map((m, i) => ({
      id: text(m?.id, 60) || newId(`m${i}`),
      date: text(m?.date, 40),
      title: text(m?.title, 160),
      description: text(m?.description, 1200),
      kind: oneOf(m?.kind, KINDS, "evento"),
    })),
    orden,
  }) as unknown as EraDoc;

  await ref.set(doc, { merge: true });
  revalidar();
  return ref.id;
}

export async function borrarEra(id: string): Promise<void> {
  await requireAdmin();
  await sembrarSeccion("eras");
  await adminDb().collection(COL.era).doc(id).delete();
  revalidar();
}

/** Sube o baja una etapa en la línea de tiempo.
 *
 *  Intercambia el `orden` con el vecino en un batch: dos escrituras atómicas.
 *  Reescribir la columna entera con índices nuevos sería N escrituras por cada
 *  click de una flecha. */
export async function moverEra(id: string, direccion: "sube" | "baja"): Promise<void> {
  await requireAdmin();
  await sembrarSeccion("eras");

  const col = adminDb().collection(COL.era);
  const todas = (await col.orderBy("orden", "asc").get()).docs;
  const i = todas.findIndex((d) => d.id === id);
  const j = direccion === "sube" ? i - 1 : i + 1;
  if (i < 0 || j < 0 || j >= todas.length) return;

  const batch = adminDb().batch();
  batch.update(todas[i].ref, { orden: j });
  batch.update(todas[j].ref, { orden: i });
  await batch.commit();

  revalidar();
}

/* ── temporadas ──────────────────────────────────────────────────────────── */

export type SeasonInput = Season & {
  /** el año con el que estaba guardada, cuando se está editando y se lo cambia */
  originalYear?: number;
};

/** Guarda una temporada. El id del documento es el año.
 *
 *  Cambiar el año de una temporada guardada **mueve** el documento (escribe el
 *  nuevo y borra el viejo) en vez de actualizarlo: el id no se puede editar en
 *  Firestore, y dejar el documento viejo daría dos temporadas con el mismo
 *  contenido en `/historia/2025` y `/historia/2026`. */
export async function guardarTemporada(input: SeasonInput): Promise<string | null> {
  await requireAdmin();
  await sembrarSeccion("temporadas");

  const year = num(input.year, 1900, 2200, 0);
  if (!year) return null;

  const title = text(input.title, 120);
  if (!title) return null;

  const doc = sinVacios({
    year,
    title,
    tagline: text(input.tagline, 200),
    cover: src(input.cover),
    competition: text(input.competition, 160),
    position: text(input.position, 80),
    captain: text(input.captain, 80),
    topScorer: text(input.topScorer, 80),
    stats: pares(input.stats),
    highlights: (input.highlights ?? []).slice(0, 60).map((h, i) => ({
      id: text(h?.id, 60) || newId(`h${i}`),
      month: text(h?.month, 40),
      title: text(h?.title, 160),
      description: text(h?.description, 1200),
      kind: oneOf(h?.kind, KINDS, "evento"),
    })),
    hallOfFame: (input.hallOfFame ?? []).slice(0, 30).map((h) => ({
      playerId: text(h?.playerId, 60),
      reason: text(h?.reason, 200),
    })),
    gallery: (input.gallery ?? []).slice(0, 40).map(unaFoto),
    clips: (input.clips ?? []).slice(0, 40).map(unClip),
    quote: unaFrase(input.quote, `s${year}-q`),
  }) as unknown as TemporadaDoc;

  const col = adminDb().collection(COL.temporada);
  await col.doc(String(year)).set(doc);

  if (input.originalYear && input.originalYear !== year) {
    await col.doc(String(input.originalYear)).delete();
  }

  revalidar(`/historia/${year}`);
  return String(year);
}

export async function borrarTemporada(year: number | string): Promise<void> {
  await requireAdmin();
  await sembrarSeccion("temporadas");
  await adminDb().collection(COL.temporada).doc(String(year)).delete();
  revalidar(`/historia/${year}`);
}

/* ── jugadores ───────────────────────────────────────────────────────────── */

export type PlayerInput = Player & { orden?: number };

/** Guarda una ficha de trayectoria.
 *
 *  El id sale del nombre y no de Firestore: es lo que va en `?jugador=` y lo
 *  que empareja esta ficha con `trapnexport-jugador` y con `trap-awards.ts`.
 *  En una edición **no** se recalcula: cambiarle el id a un jugador guardado
 *  rompería los links compartidos y dejaría al salón de la fama de cada
 *  temporada apuntando a un `playerId` que ya no existe. */
export async function guardarJugador(input: PlayerInput): Promise<string | null> {
  await requireAdmin();
  await sembrarSeccion("jugadores");

  const name = text(input.name, 80);
  if (!name) return null;

  const id = input.id ? text(input.id, 60) : slug(name);
  if (!id) return null;

  const col = adminDb().collection(COL.historiaJugador);
  const orden =
    input.orden ?? (input.id ? undefined : (await col.count().get()).data().count);

  const doc = sinVacios({
    name,
    nickname: text(input.nickname, 60),
    number: num(input.number, 0, 999, 0),
    position: text(input.position, 60),
    years: text(input.years, 40),
    status: oneOf(input.status, ["plantel", "leyenda"] as const, "plantel"),
    foot: text(input.foot, 40),
    height: text(input.height, 40),
    birthplace: text(input.birthplace, 80),
    photo: src(input.photo),
    avatar: src(input.avatar),
    bio: text(input.bio, 4000),
    stats: pares(input.stats),
    skills: (input.skills ?? []).slice(0, 12).map((s) => ({
      label: text(s?.label, 40),
      value: num(s?.value, 0, 100, 0),
    })),
    career: (input.career ?? []).slice(0, 40).map((c, i) => ({
      id: text(c?.id, 60) || newId(`p${i}`),
      season: text(c?.season, 40),
      title: text(c?.title, 160),
      description: text(c?.description, 1200),
      status: oneOf(c?.status, ["done", "current"] as const, "done"),
    })),
    gallery: (input.gallery ?? []).slice(0, 40).map(unaFoto),
    clips: (input.clips ?? []).slice(0, 40).map(unClip),
    // Explícitamente `delete` y no `undefined`: la escritura va con `merge`, y
    // `sinVacios` descartaría el campo — con lo cual borrar la frase de una
    // ficha en el panel la dejaría intacta en la base.
    quote: unaFrase(input.quote, `${id}-q`) ?? FieldValue.delete(),
    orden,
  }) as unknown as PlayerDoc;

  await col.doc(id).set(doc, { merge: true });
  revalidar();
  return id;
}

export async function borrarJugador(id: string): Promise<void> {
  await requireAdmin();
  await sembrarSeccion("jugadores");
  await adminDb().collection(COL.historiaJugador).doc(id).delete();
  revalidar();
}

/* ── frases, museo y video ───────────────────────────────────────────────── */

export async function guardarFrase(input: Quote): Promise<string | null> {
  await requireAdmin();
  await sembrarSeccion("frases");

  const texto = text(input.text, 400);
  if (!texto) return null;

  const col = adminDb().collection(COL.frase);
  const ref = input.id ? col.doc(input.id) : col.doc();
  const orden = input.id ? undefined : (await col.count().get()).data().count;

  await ref.set(
    sinVacios({
      text: texto,
      author: text(input.author, 80),
      role: text(input.role, 120),
      year: num(input.year, 1900, 2200, new Date().getFullYear()),
      avatar: src(input.avatar),
      orden,
    }) as unknown as FraseDoc,
    { merge: true },
  );

  revalidar();
  return ref.id;
}

export async function borrarFrase(id: string): Promise<void> {
  await requireAdmin();
  await sembrarSeccion("frases");
  await adminDb().collection(COL.frase).doc(id).delete();
  revalidar();
}

export async function guardarFoto(input: Photo): Promise<string | null> {
  await requireAdmin();
  await sembrarSeccion("fotos");

  const imagen = src(input.src);
  if (!imagen) return null;

  const col = adminDb().collection(COL.foto);
  const ref = input.id ? col.doc(input.id) : col.doc();
  const orden = input.id ? undefined : (await col.count().get()).data().count;

  await ref.set(
    sinVacios({
      src: imagen,
      // El `alt` cae al epígrafe cuando está vacío: una foto sin texto
      // alternativo es una foto invisible para un lector de pantalla, y el
      // epígrafe describe lo mismo.
      alt: text(input.alt, 160) || text(input.caption, 160),
      caption: text(input.caption, 200),
      year: num(input.year, 1900, 2200, new Date().getFullYear()),
      orden,
    }) as unknown as FotoDoc,
    { merge: true },
  );

  revalidar();
  return ref.id;
}

export async function borrarFoto(id: string): Promise<void> {
  await requireAdmin();
  await sembrarSeccion("fotos");
  await adminDb().collection(COL.foto).doc(id).delete();
  revalidar();
}

export async function guardarClip(input: Clip): Promise<string | null> {
  await requireAdmin();
  await sembrarSeccion("clips");

  const title = text(input.title, 120);
  if (!title) return null;

  const col = adminDb().collection(COL.clip);
  const ref = input.id ? col.doc(input.id) : col.doc();
  const orden = input.id ? undefined : (await col.count().get()).data().count;

  const poster = src(input.poster);

  await ref.set(
    sinVacios({
      title,
      description: text(input.description, 300),
      year: num(input.year, 1900, 2200, new Date().getFullYear()),
      duration: text(input.duration, 12),
      poster,
      // Sin animación propia, el póster hace de las dos: `ClipCard` cambia de
      // `poster` a `motion` al reproducir y una cadena vacía dejaría la tarjeta
      // en blanco justo al tocarla.
      motion: src(input.motion, poster),
      src: input.src ? src(input.src) || FieldValue.delete() : FieldValue.delete(),
      orden,
    }) as unknown as ClipDoc,
    { merge: true },
  );

  revalidar();
  return ref.id;
}

export async function borrarClip(id: string): Promise<void> {
  await requireAdmin();
  await sembrarSeccion("clips");
  await adminDb().collection(COL.clip).doc(id).delete();
  revalidar();
}

/* ── importar la semilla ─────────────────────────────────────────────────── */

/** Cómo se llama cada sección en la snackbar del panel. */
const NOMBRE: Record<Seccion, string> = {
  club: "club",
  eras: "etapas",
  temporadas: "temporadas",
  jugadores: "jugadores",
  frases: "frases",
  fotos: "fotos",
  clips: "clips",
};

/** Copia a Firestore la historia de arranque, sección por sección.
 *
 *  Es el botón "Importar contenido actual" del panel, y no hace nada que las
 *  demás acciones no hagan ya por su cuenta: cada `guardarX` siembra su sección
 *  antes de escribir. Existe para poder hacerlo **a propósito y de una vez**,
 *  en lugar de que las siete colecciones se vayan llenando de a una la primera
 *  vez que alguien toca cada solapa.
 *
 *  Es idempotente y no destructiva: una colección que ya tiene algo no se toca.
 *  Por eso el botón puede quedarse en el panel para siempre en vez de ser un
 *  script de una sola vez.
 *
 *  Devuelve qué secciones importó, para que el panel lo diga en la snackbar en
 *  vez de dejar al admin adivinando si el click hizo algo.
 */
export async function importarSemilla(): Promise<string[]> {
  await requireAdmin();

  const secciones: Seccion[] = [
    "club",
    "eras",
    "temporadas",
    "jugadores",
    "frases",
    "fotos",
    "clips",
  ];

  // En serie y no en paralelo: son siete lotes de escritura sobre el mismo
  // proyecto y no hay ninguna prisa; hacerlo de a uno deja un error acotado a
  // su sección en vez de a medias en todas.
  const importadas: string[] = [];
  for (const seccion of secciones) {
    if (await sembrarSeccion(seccion)) importadas.push(NOMBRE[seccion]);
  }

  revalidar();
  return importadas;
}
