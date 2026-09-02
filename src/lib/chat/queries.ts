import { getCurrentUid } from "@/lib/auth/sesion";
import { adminDb } from "@/lib/firebase/admin";
import { CLUB_UID, COL, SUB_MENSAJE } from "@/lib/firebase/collections";
import type {
  ConversacionDoc,
  FsTimestamp,
  MensajeDoc,
  MensajeTipo,
} from "@/lib/firebase/schema";
import { getDirectorio, type Directorio } from "@/lib/social/directorio";
import type { AuthorVM } from "@/lib/social/queries";
import { relativeTime } from "@/lib/time";

/** Lecturas del chat.
 *
 *  Tres tipos de conversación sobre un solo modelo: directa de a dos, grupo de
 *  N, y la difusión del club — que **no** es un tipo aparte, sino una directa
 *  entre el club y cada destinatario. Esa es la decisión que hace que un aviso
 *  masivo se pueda contestar en privado sin que nadie vea la respuesta de otro.
 *
 *  La pantalla de conversación no usa esto: lee Firestore directo desde el
 *  navegador con `onSnapshot`, que es lo que hace que los mensajes lleguen solos
 *  (ver `firestore.rules` y `ConversationClient`). Acá quedan las lecturas de
 *  servidor: la bandeja, el encabezado y lo que necesita el panel.
 */

const aMillis = (t: FsTimestamp | undefined | null) => t?.toMillis() ?? 0;

/** El id de una conversación directa entre dos personas.
 *
 *  Determinístico y ordenado: `idDirecta(a, b) === idDirecta(b, a)`. Es lo que
 *  garantiza que haya **una sola** conversación por par. Con un id al azar, dos
 *  personas escribiéndose por primera vez al mismo tiempo crearían dos
 *  conversaciones y los mensajes se partirían entre las dos, sin forma de
 *  juntarlos después.
 */
export const idDirecta = (a: string, b: string) => [a, b].sort().join("__");

export interface ConversationVM {
  id: string;
  tipo: "directa" | "grupo";
  /** cómo se llama en la bandeja: el otro, o el nombre del grupo */
  titulo: string;
  /** el avatar de la bandeja: el del otro, o el del grupo */
  avatar: string;
  /** bajada: `@handle` en una directa, "N participantes" en un grupo */
  subtitulo: string;
  lastMessage: string;
  lastAt: number;
  time: string;
  unread: number;
  mine: boolean;
}

export interface MessageVM {
  id: string;
  autorId: string;
  autor: AuthorVM | null;
  texto: string;
  tipo: MensajeTipo;
  at: number;
  /** si lo escribió quien está mirando */
  propio: boolean;
}

/** El encabezado de una conversación, sin los mensajes. */
export interface ConversationHeadVM {
  id: string;
  tipo: "directa" | "grupo";
  titulo: string;
  avatar: string;
  subtitulo: string;
  participantes: (AuthorVM & { id: string })[];
}

const autorDe = (uid: string, dir: Directorio): AuthorVM => {
  const u = dir.byId(uid);
  return {
    name: u?.name ?? "Cuenta eliminada",
    handle: u?.handle ?? "desconocido",
    avatar: u?.avatar ?? "",
    verified: u?.verified,
  };
};

/** Cómo se ve una conversación desde los ojos de alguien.
 *
 *  Una directa se llama como el otro; un grupo, como el grupo. El "otro" de una
 *  directa es el participante que no soy yo — salvo en una conversación conmigo
 *  mismo, que no se puede crear pero que no vale la pena romper si aparece. */
function presentar(c: ConversacionDoc, viewerId: string, dir: Directorio) {
  if (c.tipo === "grupo") {
    return {
      titulo: c.nombre || "Grupo",
      avatar: c.avatar ?? "",
      subtitulo: `${c.participantIds.length} participantes`,
    };
  }

  const otroId = c.participantIds.find((id) => id !== viewerId) ?? viewerId;
  const otro = autorDe(otroId, dir);
  return {
    titulo: otro.name,
    avatar: otro.avatar,
    subtitulo: `@${otro.handle}`,
  };
}

/** Cuántos mensajes sin leer tiene alguien en una conversación.
 *
 *  No es un conteo: es 0 o 1. Con `lastReadAt` sabemos *si* hay algo nuevo sin
 *  leer un solo mensaje, y eso es todo lo que la bandeja dibuja —un punto—. El
 *  número exacto costaría una query de mensajes por conversación.
 *
 *  Reemplaza a la heurística anterior, que definía "no leído" como *"el último
 *  mensaje es del otro"*: con eso, entrar a la conversación no la marcaba leída
 *  y el badge no bajaba nunca. */
const sinLeer = (c: ConversacionDoc, viewerId: string): number => {
  const ultimo = aMillis(c.ultimoMensaje?.at);
  if (!ultimo) return 0;
  // Lo propio no cuenta como no leído aunque no se haya marcado.
  if (c.ultimoMensaje?.autorId === viewerId) return 0;
  return ultimo > aMillis(c.lastReadAt?.[viewerId]) ? 1 : 0;
};

async function conversacionesDe(uid: string) {
  const snap = await adminDb()
    .collection(COL.conversacion)
    .where("participantIds", "array-contains", uid)
    .orderBy("updatedAt", "desc")
    .limit(100)
    .get();

  return snap.docs.map((d) => ({ id: d.id, ...(d.data() as ConversacionDoc) }));
}

export async function getConversations(): Promise<ConversationVM[]> {
  const viewerId = await getCurrentUid();
  // Sin sesión no hay bandeja: hay que ser participante de algo.
  if (!viewerId) return [];

  const [convs, dir] = await Promise.all([conversacionesDe(viewerId), getDirectorio()]);

  return convs.map((c) => {
    const { titulo, avatar, subtitulo } = presentar(c, viewerId, dir);
    return {
      id: c.id,
      tipo: c.tipo,
      titulo,
      avatar,
      subtitulo,
      lastMessage: c.ultimoMensaje?.texto ?? "",
      lastAt: aMillis(c.ultimoMensaje?.at),
      time: c.ultimoMensaje ? relativeTime(aMillis(c.ultimoMensaje.at)) : "",
      unread: sinLeer(c, viewerId),
      mine: c.ultimoMensaje?.autorId === viewerId,
    };
  });
}

export async function getUnreadChats(): Promise<number> {
  return (await getConversations()).reduce((n, c) => n + c.unread, 0);
}

/** El encabezado de una conversación, o `null` si no existe o no sos parte.
 *
 *  Ser participante no es un detalle de presentación: sin este corte, cualquiera
 *  con el id lee una conversación ajena. La misma condición está en
 *  `firestore.rules`, porque la pantalla lee los mensajes directo del navegador.
 */
export async function getConversationHead(id: string): Promise<ConversationHeadVM | null> {
  const viewerId = await getCurrentUid();
  if (!viewerId) return null;

  const [snap, dir] = await Promise.all([
    adminDb().collection(COL.conversacion).doc(id).get(),
    getDirectorio(),
  ]);

  const c = snap.data() as ConversacionDoc | undefined;
  if (!c || !c.participantIds.includes(viewerId)) return null;

  const { titulo, avatar, subtitulo } = presentar(c, viewerId, dir);

  return {
    id: snap.id,
    tipo: c.tipo,
    titulo,
    avatar,
    subtitulo,
    participantes: c.participantIds.map((uid) => ({ id: uid, ...autorDe(uid, dir) })),
  };
}

/** Los mensajes de una conversación, para la carga inicial del servidor.
 *
 *  La pantalla los recibe ya renderizados y después se engancha con `onSnapshot`
 *  para los que van llegando: sin esta primera tanda, abrir un chat mostraría un
 *  hueco hasta que responda Firestore. */
export async function getMessages(id: string): Promise<MessageVM[]> {
  const viewerId = await getCurrentUid();
  if (!viewerId) return [];

  const [snap, dir] = await Promise.all([
    adminDb()
      .collection(COL.conversacion)
      .doc(id)
      .collection(SUB_MENSAJE)
      .orderBy("at", "asc")
      .limitToLast(100)
      .get(),
    getDirectorio(),
  ]);

  return snap.docs.map((d) => {
    const m = d.data() as MensajeDoc;
    return {
      id: d.id,
      autorId: m.autorId,
      autor: m.tipo === "sistema" ? null : autorDe(m.autorId, dir),
      texto: m.texto,
      tipo: m.tipo,
      at: aMillis(m.at),
      propio: m.autorId === viewerId,
    };
  });
}

/** Con quién se puede empezar una conversación o armar un grupo.
 *
 *  Todas las cuentas activas menos uno mismo y menos el club: al club se le
 *  contesta cuando escribe, no se le abre un chat. */
export async function getContactos(): Promise<(AuthorVM & { id: string })[]> {
  const viewerId = await getCurrentUid();
  if (!viewerId) return [];

  const dir = await getDirectorio();
  return dir
    .todas()
    .filter((u) => !u.suspended && u.id !== viewerId && u.id !== CLUB_UID)
    .map((u) => ({
      id: u.id,
      name: u.name,
      handle: u.handle,
      avatar: u.avatar,
      verified: u.verified,
    }))
    .sort((a, b) => a.name.localeCompare(b.name, "es"));
}

/* ── panel ───────────────────────────────────────────────────────────────── */

/** A quiénes les puede escribir el club.
 *
 *  Igual que `getContactos` pero sin sesión de por medio: la llama el panel,
 *  que ya pasó por `requireAdmin()`. Trae `playerId` porque el compositor ofrece
 *  "sólo el plantel" como alcance, y eso es exactamente quién lo tiene. */
export async function getContactosDelClub(): Promise<
  (AuthorVM & { id: string; esPlantel: boolean })[]
> {
  const dir = await getDirectorio();
  return dir
    .todas()
    .filter((u) => !u.suspended && u.id !== CLUB_UID)
    .map((u) => ({
      id: u.id,
      name: u.name,
      handle: u.handle,
      avatar: u.avatar,
      verified: u.verified,
      esPlantel: !!u.playerId,
    }))
    .sort((a, b) => a.name.localeCompare(b.name, "es"));
}

export interface DifusionRow {
  id: string;
  texto: string;
  alcance: string;
  destinatarios: number;
  enviadoPor: string;
  createdAt: number;
  fecha: string;
}

/** Lo que el club mandó por difusión. Es la auditoría del panel. */
export async function getDifusiones(): Promise<DifusionRow[]> {
  const [snap, dir] = await Promise.all([
    adminDb().collection(COL.difusion).orderBy("createdAt", "desc").limit(50).get(),
    getDirectorio(),
  ]);

  const ALCANCE: Record<string, string> = {
    todos: "Todos",
    plantel: "Plantel",
    seleccion: "Selección",
  };

  return snap.docs.map((d) => {
    const x = d.data() as import("@/lib/firebase/schema").DifusionDoc;
    return {
      id: d.id,
      texto: x.texto,
      alcance: ALCANCE[x.alcance] ?? x.alcance,
      destinatarios: x.destinatarios?.length ?? 0,
      enviadoPor: dir.byId(x.enviadoPor)?.name ?? "Administración",
      createdAt: aMillis(x.createdAt),
      fecha: relativeTime(aMillis(x.createdAt)),
    };
  });
}

/** La bandeja del club: lo que le contestaron a las difusiones.
 *
 *  Es la contracara de que la difusión se pueda responder. Con el plantel
 *  (~26 cuentas) es perfectamente manejable; si la app se abre a los hinchas,
 *  esta pantalla es lo que deja de escalar, y por eso el compositor filtra por
 *  alcance en vez de mandar siempre a todos. */
export async function getBandejaDelClub(): Promise<ConversationVM[]> {
  const [convs, dir] = await Promise.all([conversacionesDe(CLUB_UID), getDirectorio()]);

  return convs.map((c) => {
    const { titulo, avatar, subtitulo } = presentar(c, CLUB_UID, dir);
    return {
      id: c.id,
      tipo: c.tipo,
      titulo,
      avatar,
      subtitulo,
      lastMessage: c.ultimoMensaje?.texto ?? "",
      lastAt: aMillis(c.ultimoMensaje?.at),
      time: c.ultimoMensaje ? relativeTime(aMillis(c.ultimoMensaje.at)) : "",
      unread: sinLeer(c, CLUB_UID),
      mine: c.ultimoMensaje?.autorId === CLUB_UID,
    };
  });
}
