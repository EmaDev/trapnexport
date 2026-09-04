import { cache } from "react";

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
  Historia,
  Milestone,
  MilestoneKind,
  Photo,
  Player,
  PlayerStatus,
  Quote,
  Season,
  SeasonHighlight,
  Trophy,
} from "@/lib/historia/types";
import { getDirectorio, type Cuenta } from "@/lib/social/directorio";

/** Lecturas de la historia del club, ya mapeadas a lo que esperan las
 *  pantallas. Mitad "read" del par con `actions.ts`.
 *
 *  Van con el Admin SDK —que se saltea `firestore.rules`— porque todo lo que
 *  las llama corre en el servidor: `/historia`, `/historia/:año`, `/perfil`,
 *  `/invitacion/:code` y las páginas de `/admin/historia`. Por eso estas
 *  colecciones quedan cerradas a cualquier cliente en `firestore.rules`.
 *
 *  ⚠️ `@/lib/historia` —el barrel— **no** reexporta nada de acá, y no es un
 *  olvido: ese barrel termina en el bundle del navegador porque
 *  `lib/presentacion/trayectoria.ts` lo importa y lo usa un componente
 *  cliente. Reexportar estas funciones arrastraría `firebase-admin` con ellas.
 *  Quien necesita los datos reales importa `@/lib/historia/queries` de forma
 *  explícita, y eso sólo lo puede hacer un Server Component o una acción.
 *
 *  ## Por qué cae a la semilla
 *
 *  Cada lectura devuelve `SEED` cuando su colección está vacía. Es lo que hace
 *  que la app arranque contando la historia completa en un proyecto de
 *  Firebase recién creado, sin un paso de seed obligatorio entre `npm run dev`
 *  y la primera pantalla — y lo que deja usar el botón "Importar contenido
 *  actual" del panel cuando se quiera, y no antes de poder mirar nada.
 *
 *  El fallback es **por colección**, no global: importar las etapas no borra
 *  las frases de la semilla ni al revés, así que se puede migrar de a una
 *  sección sin que la pantalla quede a medias.
 *
 *  Y es "colección vacía", no "error de red": si Firestore falla, la excepción
 *  sube. Servir la semilla ante un error convertiría una caída en "la historia
 *  volvió a como estaba en 2026" sin que nadie se entere.
 */

/* ── saneadores ──────────────────────────────────────────────────────────── */

/** Los `kind` y los `status` se guardan como `string` en Firestore —un
 *  documento no puede declarar una unión— así que se validan al leer. Un valor
 *  que no esté en la lista dejaría a `EraTimeline` sin ícono ni color, y un
 *  default es preferible a una pantalla rota. */
const KINDS: MilestoneKind[] = [
  "titulo",
  "ascenso",
  "derrota",
  "debut",
  "obra",
  "partido",
  "homenaje",
  "evento",
];

const unKind = (v: string): MilestoneKind =>
  (KINDS as string[]).includes(v) ? (v as MilestoneKind) : "evento";

const unStatus = (v: string): PlayerStatus => (v === "leyenda" ? "leyenda" : "plantel");

const unPaso = (v: string): "done" | "current" => (v === "current" ? "current" : "done");

/* ── identidad, palmarés y balance ───────────────────────────────────────── */

/** Las tres cosas que viven en `trapnexport-historia/club`.
 *
 *  Se leen juntas porque son **un** documento: pedirlas por separado serían
 *  tres viajes idénticos a la misma fila. `getClub`, `getTrophies` y
 *  `getBalance` existen igual, para quien necesita sólo una. */
export async function getClubDoc(): Promise<{
  club: ClubIdentity;
  trophies: Trophy[];
  balance: Balance;
}> {
  const snap = await adminDb().collection(COL.historia).doc(HISTORIA_CLUB).get();
  const d = snap.data() as HistoriaClubDoc | undefined;

  if (!d) return { club: SEED.club, trophies: SEED.trophies, balance: SEED.balance };

  return {
    club: {
      name: d.name,
      nickname: d.nickname,
      founded: d.founded,
      stadium: d.stadium,
      colors: d.colors,
      motto: d.motto,
      members: d.members,
      crest: d.crest,
      intro: d.intro,
    },
    trophies: d.trophies ?? [],
    balance: d.balance ?? SEED.balance,
  };
}

export async function getClub(): Promise<ClubIdentity> {
  return (await getClubDoc()).club;
}

export async function getTrophies(): Promise<Trophy[]> {
  return (await getClubDoc()).trophies;
}

export async function getBalance(): Promise<Balance> {
  return (await getClubDoc()).balance;
}

/* ── etapas ──────────────────────────────────────────────────────────────── */

const aEra = (id: string, d: EraDoc): Era => ({
  id,
  period: d.period,
  title: d.title,
  tagline: d.tagline,
  description: d.description,
  photo: d.photo,
  ...(d.current ? { current: true } : {}),
  stats: d.stats ?? [],
  milestones: (d.milestones ?? []).map(
    (m): Milestone => ({
      id: m.id,
      date: m.date,
      title: m.title,
      description: m.description,
      kind: unKind(m.kind),
    }),
  ),
});

/** Las etapas, de la más vieja a la más nueva: la línea de tiempo se lee hacia
 *  adelante. Es lo contrario de las temporadas, que se leen desde hoy. */
export async function getEras(): Promise<Era[]> {
  const snap = await adminDb().collection(COL.era).orderBy("orden", "asc").get();
  if (snap.empty) return SEED.eras;
  return snap.docs.map((doc) => aEra(doc.id, doc.data() as EraDoc));
}

/* ── temporadas ──────────────────────────────────────────────────────────── */

const aSeason = (d: TemporadaDoc): Season => ({
  year: d.year,
  title: d.title,
  tagline: d.tagline,
  cover: d.cover,
  competition: d.competition,
  position: d.position,
  captain: d.captain,
  topScorer: d.topScorer,
  stats: d.stats ?? [],
  highlights: (d.highlights ?? []).map(
    (h): SeasonHighlight => ({
      id: h.id,
      month: h.month,
      title: h.title,
      description: h.description,
      kind: unKind(h.kind),
    }),
  ),
  hallOfFame: d.hallOfFame ?? [],
  gallery: d.gallery ?? [],
  clips: d.clips ?? [],
  ...(d.quote ? { quote: d.quote } : {}),
});

/** Las temporadas, de la más reciente a la más vieja. */
export async function getSeasons(): Promise<Season[]> {
  const snap = await adminDb().collection(COL.temporada).orderBy("year", "desc").get();
  if (snap.empty) return [...SEED.seasons].sort((a, b) => b.year - a.year);
  return snap.docs.map((doc) => aSeason(doc.data() as TemporadaDoc));
}

/** Una temporada por su año, que es el id del documento: un `get` directo y no
 *  una query. Ver el comentario de `TemporadaDoc`. */
export async function getSeason(year: string | number): Promise<Season | null> {
  const n = Number(year);
  if (!Number.isFinite(n)) return null;

  const col = adminDb().collection(COL.temporada);
  const snap = await col.doc(String(n)).get();
  const d = snap.data() as TemporadaDoc | undefined;
  if (d) return aSeason(d);

  // Sin documento hay dos casos distintos, y confundirlos resucitaría en la
  // ruta pública una temporada que alguien borró del panel: o la colección
  // todavía está vacía y corresponde la semilla, o está cargada y ese año
  // simplemente no existe → 404.
  if (!(await col.limit(1).get()).empty) return null;

  return SEED.seasons.find((s) => s.year === n) ?? null;
}

/** Para `generateStaticParams`: qué temporadas tienen página propia. */
export async function getSeasonSlugs(): Promise<string[]> {
  return (await getSeasons()).map((s) => String(s.year));
}

/* ── jugadores ───────────────────────────────────────────────────────────── */

/** Las cuentas que reclamaron un jugador, indexadas por `playerId`.
 *
 *  Es el puente entre las dos mitades de una misma persona: la ficha de
 *  trayectoria vive en `trapnexport-historia-jugador` y la edita el club; la
 *  ficha personal —datos y skills— vive en `trapnexport-user` y la edita ella.
 *
 *  Se resuelve con `getDirectorio()`, que ya trae las cuentas de una sola
 *  lectura memoizada por request: `/historia` la comparte con el header, el
 *  feed y las notificaciones de la misma pantalla, así que el cruce no agrega
 *  ningún viaje a Firestore.
 *
 *  Sólo cuentas **aprobadas**: mientras el reclamo está `pending` nadie
 *  verificó que esa persona sea ese jugador, y publicar en la historia del club
 *  lo que escribió quien todavía dice ser alguien es exactamente el agujero que
 *  la cola de solicitudes existe para tapar. Las suspendidas quedan afuera por
 *  lo mismo que quedan afuera del feed.
 */
const fichasDeCuentas = cache(async (): Promise<Map<string, Cuenta>> => {
  const dir = await getDirectorio();
  const porJugador = new Map<string, Cuenta>();

  for (const c of dir.todas()) {
    if (!c.playerId || c.suspended || !c.verified) continue;
    porJugador.set(c.playerId, c);
  }

  return porJugador;
});

const aPlayer = (id: string, d: PlayerDoc, cuenta?: Cuenta): Player => ({
  id,
  ...(cuenta ? { ficha: cuenta.ficha, handle: cuenta.handle } : {}),
  name: d.name,
  nickname: d.nickname,
  number: d.number,
  position: d.position,
  years: d.years,
  status: unStatus(d.status),
  foot: d.foot,
  height: d.height,
  birthplace: d.birthplace,
  photo: d.photo,
  avatar: d.avatar,
  bio: d.bio,
  stats: d.stats ?? [],
  skills: d.skills ?? [],
  career: (d.career ?? []).map((c) => ({
    id: c.id,
    season: c.season,
    title: c.title,
    description: c.description,
    status: unPaso(c.status),
  })),
  gallery: d.gallery ?? [],
  clips: d.clips ?? [],
  ...(d.quote ? { quote: d.quote } : {}),
});

/** Le pega a una ficha de la semilla la cuenta de esa persona, si la tiene.
 *
 *  La semilla también pasa por el cruce: un club que todavía no importó su
 *  historia tiene igual cuentas reales, y el jugador que cargó sus skills
 *  espera verlas en la pantalla — que la ficha de al lado sea contenido de
 *  arranque no es asunto suyo. */
const conCuenta = (p: Player, cuentas: Map<string, Cuenta>): Player => {
  const c = cuentas.get(p.id);
  return c ? { ...p, ficha: c.ficha, handle: c.handle } : p;
};

export async function getPlayers(): Promise<Player[]> {
  const [snap, cuentas] = await Promise.all([
    adminDb().collection(COL.historiaJugador).orderBy("orden", "asc").get(),
    fichasDeCuentas(),
  ]);

  if (snap.empty) return SEED.players.map((p) => conCuenta(p, cuentas));
  return snap.docs.map((doc) => aPlayer(doc.id, doc.data() as PlayerDoc, cuentas.get(doc.id)));
}

export async function getPlayer(id: string): Promise<Player | null> {
  const col = adminDb().collection(COL.historiaJugador);
  const [snap, cuentas] = await Promise.all([col.doc(id).get(), fichasDeCuentas()]);
  const d = snap.data() as PlayerDoc | undefined;
  if (d) return aPlayer(snap.id, d, cuentas.get(snap.id));

  // Mismo criterio que `getSeason`: la semilla sólo cubre la colección vacía.
  if (!(await col.limit(1).get()).empty) return null;

  const semilla = SEED.players.find((p) => p.id === id);
  return semilla ? conCuenta(semilla, cuentas) : null;
}

/* ── frases, museo y video ───────────────────────────────────────────────── */

export async function getQuotes(): Promise<Quote[]> {
  const snap = await adminDb().collection(COL.frase).orderBy("orden", "asc").get();
  if (snap.empty) return SEED.quotes;

  return snap.docs.map((doc) => {
    const d = doc.data() as FraseDoc;
    return {
      id: doc.id,
      text: d.text,
      author: d.author,
      role: d.role,
      year: d.year,
      avatar: d.avatar,
    };
  });
}

export async function getGallery(): Promise<Photo[]> {
  const snap = await adminDb().collection(COL.foto).orderBy("orden", "asc").get();
  if (snap.empty) return SEED.gallery;

  return snap.docs.map((doc) => {
    const d = doc.data() as FotoDoc;
    return { id: doc.id, src: d.src, alt: d.alt, caption: d.caption, year: d.year };
  });
}

export async function getClips(): Promise<Clip[]> {
  const snap = await adminDb().collection(COL.clip).orderBy("orden", "asc").get();
  if (snap.empty) return SEED.clips;

  return snap.docs.map((doc) => {
    const d = doc.data() as ClipDoc;
    return {
      id: doc.id,
      title: d.title,
      description: d.description,
      year: d.year,
      duration: d.duration,
      poster: d.poster,
      motion: d.motion,
      ...(d.src ? { src: d.src } : {}),
    };
  });
}

/* ── todo junto ──────────────────────────────────────────────────────────── */

/** Todo lo que necesita `/historia`, en un solo `await`.
 *
 *  La pantalla es una sola y consume las siete colecciones: pedirlas de a una
 *  desde el Server Component serían siete viajes de red en fila. */
export async function getHistoria(): Promise<Historia> {
  const [{ club, trophies, balance }, eras, seasons, players, quotes, gallery, clips] =
    await Promise.all([
      getClubDoc(),
      getEras(),
      getSeasons(),
      getPlayers(),
      getQuotes(),
      getGallery(),
      getClips(),
    ]);

  return { club, balance, trophies, eras, seasons, players, quotes, gallery, clips };
}

/** Qué secciones ya viven en la base y cuáles todavía se sirven de la semilla.
 *
 *  Lo usa el panel para el aviso de arriba de todo: mientras una sección diga
 *  `false`, lo que se ve en `/historia` es el texto original y una edición
 *  parcial podría sorprender. */
export async function estadoDeCarga(): Promise<Record<string, boolean>> {
  const db = adminDb();
  const [club, eras, temporadas, jugadores, frases, fotos, clips] = await Promise.all([
    db.collection(COL.historia).doc(HISTORIA_CLUB).get(),
    db.collection(COL.era).limit(1).get(),
    db.collection(COL.temporada).limit(1).get(),
    db.collection(COL.historiaJugador).limit(1).get(),
    db.collection(COL.frase).limit(1).get(),
    db.collection(COL.foto).limit(1).get(),
    db.collection(COL.clip).limit(1).get(),
  ]);

  return {
    club: club.exists,
    eras: !eras.empty,
    temporadas: !temporadas.empty,
    jugadores: !jugadores.empty,
    frases: !frases.empty,
    fotos: !fotos.empty,
    clips: !clips.empty,
  };
}

/** Los tres números de la historia que muestra el acceso rápido de `/admin`.
 *
 *  Va con `count()` y no trayendo los documentos: el panel necesita "6 etapas ·
 *  5 temporadas · 20 jugadores", no las seis etapas con sus hitos adentro. Y
 *  cae a la semilla por colección, igual que las lecturas de arriba, para que
 *  el número del panel coincida con lo que se ve en la app. */
export async function getHistoriaStats(): Promise<{
  etapas: number;
  temporadas: number;
  jugadores: number;
}> {
  const db = adminDb();
  const [etapas, temporadas, jugadores] = await Promise.all([
    db.collection(COL.era).count().get(),
    db.collection(COL.temporada).count().get(),
    db.collection(COL.historiaJugador).count().get(),
  ]);

  return {
    etapas: etapas.data().count || SEED.eras.length,
    temporadas: temporadas.data().count || SEED.seasons.length,
    jugadores: jugadores.data().count || SEED.players.length,
  };
}
