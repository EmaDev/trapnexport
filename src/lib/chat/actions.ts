"use server";

import { FieldValue } from "firebase-admin/firestore";
import { revalidatePath } from "next/cache";

import { requireAdmin } from "@/lib/admin/auth";
import { getCurrentUid } from "@/lib/auth/sesion";
import { idDirecta } from "@/lib/chat/queries";
import { adminDb } from "@/lib/firebase/admin";
import { CLUB_UID, COL, SUB_MENSAJE } from "@/lib/firebase/collections";
import type { ConversacionDoc, DifusionAlcance } from "@/lib/firebase/schema";
import { getDirectorio } from "@/lib/social/directorio";
import { notifyUser } from "@/lib/social/notify";

/** Escrituras del chat.
 *
 *  Todas pasan por el servidor aunque la **lectura** de los mensajes la haga el
 *  navegador directo con `onSnapshot`. El motivo es que ningún envío es un
 *  documento solo: escribir un mensaje mueve además `ultimoMensaje` y
 *  `updatedAt` de la conversación —que es lo que ordena la bandeja y lo que
 *  decide si hay algo sin leer— y dispara la campanita. Repartir eso entre
 *  cliente y servidor sería garantizar que en algún momento no coincidan.
 */

/** Un mensaje no puede ser infinito: es una burbuja de chat, no un posteo. */
const MAX_TEXTO = 2000;

/** Cuántas escrituras entran en un lote de Firestore. El tope real es 500. */
const LOTE = 450;

const recorte = (s: string, max = 90) => {
  const linea = s.trim().split("\n")[0];
  if (linea.length <= max) return linea;
  return linea.slice(0, linea.lastIndexOf(" ", max) > 0 ? linea.lastIndexOf(" ", max) : max) + "…";
};

const revalidarChat = (id?: string) => {
  revalidatePath("/chat");
  if (id) revalidatePath(`/chat/${id}`);
  // El badge de sobres vive en el layout del módulo público.
  revalidatePath("/", "layout");
};

/* ── abrir conversaciones ────────────────────────────────────────────────── */

/** Abre —o encuentra— la conversación directa con alguien. Devuelve su id.
 *
 *  `set` con `merge` y no `create`: el id es determinístico, así que "abrir" una
 *  conversación que ya existe tiene que ser inofensivo. Los campos que se
 *  reescriben son los mismos que ya estaban.
 */
export async function abrirDirecta(otroId: string): Promise<string | null> {
  const uid = await getCurrentUid();
  if (!uid || !otroId || otroId === uid) return null;

  const dir = await getDirectorio();
  const otro = dir.byId(otroId);
  if (!otro || otro.suspended) return null;

  const id = idDirecta(uid, otroId);

  await adminDb()
    .collection(COL.conversacion)
    .doc(id)
    .set(
      {
        tipo: "directa",
        participantIds: [uid, otroId].sort(),
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true },
    );

  revalidarChat(id);
  return id;
}

/** Crea un grupo. Devuelve su id.
 *
 *  Lo puede crear cualquier cuenta con sesión: agrupar gente es comportamiento
 *  normal de una red social, y las reglas ya garantizan que sólo un participante
 *  lea la conversación. La moderación la cubre el panel.
 *
 *  Id al azar y no determinístico, al revés que la directa: el mismo conjunto de
 *  personas puede tener dos grupos distintos y eso es legítimo.
 */
export async function crearGrupo(
  nombre: string,
  participantes: string[],
): Promise<string | null> {
  const uid = await getCurrentUid();
  if (!uid) return null;

  const limpio = nombre.trim().slice(0, 60);
  if (!limpio) return null;

  const dir = await getDirectorio();
  // El creador siempre adentro; sin duplicados, sin suspendidas, sin el club.
  const ids = [
    ...new Set([uid, ...participantes.filter((p) => {
      const u = dir.byId(p);
      return !!u && !u.suspended && p !== CLUB_UID;
    })]),
  ];
  // Un grupo de uno es una nota para uno mismo; de dos, una directa con otro
  // nombre. Se pide alguien más además del creador.
  if (ids.length < 2) return null;

  const ref = adminDb().collection(COL.conversacion).doc();

  const batch = adminDb().batch();
  batch.set(ref, {
    tipo: "grupo",
    nombre: limpio,
    participantIds: ids,
    creadoPor: uid,
    lastReadAt: {},
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  });
  batch.set(ref.collection(SUB_MENSAJE).doc(), {
    autorId: uid,
    texto: `${dir.byId(uid)?.name ?? "Alguien"} creó el grupo`,
    tipo: "sistema",
    at: FieldValue.serverTimestamp(),
  });
  await batch.commit();

  revalidarChat(ref.id);
  return ref.id;
}

/** Suma gente a un grupo y lo deja anotado en el hilo. */
export async function agregarAlGrupo(
  conversationId: string,
  nuevos: string[],
): Promise<void> {
  const uid = await getCurrentUid();
  if (!uid) return;

  const db2 = adminDb();
  const ref = db2.collection(COL.conversacion).doc(conversationId);
  const snap = await ref.get();
  const c = snap.data() as ConversacionDoc | undefined;

  if (!c || c.tipo !== "grupo") return;
  // Sólo un participante suma gente: si no, cualquiera se mete solo en
  // cualquier grupo con el id.
  if (!c.participantIds.includes(uid)) return;

  const dir = await getDirectorio();
  const suma = nuevos.filter(
    (p) => !c.participantIds.includes(p) && !!dir.byId(p) && !dir.byId(p)!.suspended,
  );
  if (!suma.length) return;

  const nombres = suma.map((p) => dir.byId(p)?.name ?? "Alguien").join(", ");

  const batch = db2.batch();
  batch.update(ref, {
    participantIds: FieldValue.arrayUnion(...suma),
    updatedAt: FieldValue.serverTimestamp(),
  });
  batch.set(ref.collection(SUB_MENSAJE).doc(), {
    autorId: uid,
    texto: `${dir.byId(uid)?.name ?? "Alguien"} agregó a ${nombres}`,
    tipo: "sistema",
    at: FieldValue.serverTimestamp(),
  });
  await batch.commit();

  revalidarChat(conversationId);
}

/** Salir de un grupo. */
export async function salirDelGrupo(conversationId: string): Promise<void> {
  const uid = await getCurrentUid();
  if (!uid) return;

  const db2 = adminDb();
  const ref = db2.collection(COL.conversacion).doc(conversationId);
  const snap = await ref.get();
  const c = snap.data() as ConversacionDoc | undefined;

  if (!c || c.tipo !== "grupo" || !c.participantIds.includes(uid)) return;

  const dir = await getDirectorio();

  const batch = db2.batch();
  batch.update(ref, {
    participantIds: FieldValue.arrayRemove(uid),
    updatedAt: FieldValue.serverTimestamp(),
  });
  batch.set(ref.collection(SUB_MENSAJE).doc(), {
    autorId: uid,
    texto: `${dir.byId(uid)?.name ?? "Alguien"} salió del grupo`,
    tipo: "sistema",
    at: FieldValue.serverTimestamp(),
  });
  await batch.commit();

  revalidarChat(conversationId);
}

/* ── mensajes ────────────────────────────────────────────────────────────── */

/** Escribe el mensaje, mueve la conversación y avisa. Núcleo compartido.
 *
 *  `comoUid` es quién firma. Existe para que la difusión del panel pueda
 *  escribir como el club: es el único caso en que quien manda no es quien tiene
 *  la sesión, y por eso la función es interna y no una Server Action.
 */
async function escribir(
  conversationId: string,
  comoUid: string,
  texto: string,
  avisar: boolean,
): Promise<void> {
  const db2 = adminDb();
  const ref = db2.collection(COL.conversacion).doc(conversationId);
  const snap = await ref.get();
  const c = snap.data() as ConversacionDoc | undefined;
  if (!c || !c.participantIds.includes(comoUid)) return;

  const ahora = FieldValue.serverTimestamp();

  const batch = db2.batch();
  batch.set(ref.collection(SUB_MENSAJE).doc(), {
    autorId: comoUid,
    texto,
    tipo: "texto",
    at: ahora,
  });
  batch.update(ref, {
    ultimoMensaje: { texto: recorte(texto, 140), autorId: comoUid, at: ahora },
    updatedAt: ahora,
    // Quien escribe leyó todo lo suyo por definición: sin esto, mandar un
    // mensaje dejaría la conversación marcada como no leída para uno mismo.
    [`lastReadAt.${comoUid}`]: ahora,
  });
  await batch.commit();

  if (!avisar) return;

  const dir = await getDirectorio();
  const nombre = dir.byId(comoUid)?.name ?? "Alguien";
  const esGrupo = c.tipo === "grupo";

  // Una campanita por participante, menos quien escribió. En un grupo son N-1.
  await Promise.all(
    c.participantIds
      .filter((p) => p !== comoUid)
      .map((p) =>
        notifyUser(p, {
          kind: "message",
          actorId: comoUid,
          text: esGrupo
            ? `${nombre} escribió en ${c.nombre || "un grupo"}`
            : `${nombre} te envió un mensaje`,
          description: recorte(texto),
          href: `/chat/${conversationId}`,
        }),
      ),
  );
}

export async function sendMessage(conversationId: string, text: string): Promise<void> {
  const uid = await getCurrentUid();
  if (!uid) return;

  const clean = text.trim().slice(0, MAX_TEXTO);
  if (!clean) return;

  await escribir(conversationId, uid, clean, true);

  revalidarChat(conversationId);
  revalidatePath("/notificaciones");
}

/** Marca la conversación como leída hasta ahora.
 *
 *  La llama la pantalla al abrirse. Es lo que hace que el badge baje — antes no
 *  bajaba nunca, porque "no leído" se calculaba como "el último mensaje es del
 *  otro" y entrar a leerlo no cambiaba nada.
 */
export async function marcarLeida(conversationId: string): Promise<void> {
  const uid = await getCurrentUid();
  if (!uid) return;

  await adminDb()
    .collection(COL.conversacion)
    .doc(conversationId)
    .update({ [`lastReadAt.${uid}`]: FieldValue.serverTimestamp() })
    .catch(() => {});

  revalidarChat();
}

/* ── difusión desde el panel ─────────────────────────────────────────────── */

export type ResultadoDifusion =
  | { ok: true; enviados: number }
  | { ok: false; error: string };

/** Manda un mensaje del club a muchos destinatarios, uno por uno.
 *
 *  **Fan-out y no un canal de anuncios.** Se abre —o continúa— una conversación
 *  directa entre el club y cada destinatario, así que cada uno contesta en
 *  privado y no ve a los demás. Es más caro que un documento único con N
 *  participantes, y es a propósito: un canal de una sola vía ya existe y se
 *  llama campanita (`notifyAll`). Lo que justifica que esto esté en el chat es
 *  justamente que haya vuelta.
 *
 *  El remitente es el club (`CLUB_UID`) y no el admin que apretó enviar. Quién
 *  lo mandó queda en `DifusionDoc.enviadoPor`.
 */
export async function enviarDifusion(
  texto: string,
  alcance: DifusionAlcance,
  seleccion: string[] = [],
): Promise<ResultadoDifusion> {
  const admin = await requireAdmin();

  const clean = texto.trim().slice(0, MAX_TEXTO);
  if (!clean) return { ok: false, error: "El mensaje está vacío." };

  const dir = await getDirectorio();
  const activas = dir.todas().filter((u) => !u.suspended && u.id !== CLUB_UID);

  const destinatarios =
    alcance === "todos"
      ? activas.map((u) => u.id)
      : alcance === "plantel"
        ? activas.filter((u) => u.playerId).map((u) => u.id)
        : activas.filter((u) => seleccion.includes(u.id)).map((u) => u.id);

  if (!destinatarios.length) {
    return { ok: false, error: "No hay destinatarios para ese alcance." };
  }

  const db2 = adminDb();

  /*  Las conversaciones primero, en lotes: un batch de Firestore admite 500
   *  escrituras y acá son dos por destinatario (la conversación y el mensaje).
   *  Es el mismo motivo por el que `notifyAll` parte en tandas. */
  for (let i = 0; i < destinatarios.length; i += LOTE / 2) {
    const tanda = destinatarios.slice(i, i + LOTE / 2);
    const batch = db2.batch();

    for (const uid of tanda) {
      const ref = db2.collection(COL.conversacion).doc(idDirecta(CLUB_UID, uid));
      const ahora = FieldValue.serverTimestamp();

      batch.set(
        ref,
        {
          tipo: "directa",
          participantIds: [CLUB_UID, uid].sort(),
          ultimoMensaje: { texto: recorte(clean, 140), autorId: CLUB_UID, at: ahora },
          createdAt: ahora,
          updatedAt: ahora,
        },
        { merge: true },
      );
      batch.set(ref.collection(SUB_MENSAJE).doc(), {
        autorId: CLUB_UID,
        texto: clean,
        tipo: "texto",
        at: ahora,
      });
    }

    await batch.commit();
  }

  // La campanita de cada uno. Aparte del lote de arriba porque `notifyUser`
  // escribe en otra colección y ya trae su propio manejo.
  await Promise.all(
    destinatarios.map((uid) =>
      notifyUser(uid, {
        kind: "message",
        actorId: CLUB_UID,
        text: "Mensaje del club",
        description: recorte(clean),
        href: `/chat/${idDirecta(CLUB_UID, uid)}`,
      }),
    ),
  );

  // El registro de auditoría: qué se mandó, a quiénes y quién fue.
  await db2.collection(COL.difusion).add({
    texto: clean,
    alcance,
    destinatarios,
    enviadoPor: admin.uid,
    createdAt: FieldValue.serverTimestamp(),
  });

  revalidarChat();
  revalidatePath("/admin/mensajes");
  revalidatePath("/notificaciones");

  return { ok: true, enviados: destinatarios.length };
}

/** Responde desde el panel, como el club, en una conversación de su bandeja. */
export async function responderComoClub(
  conversationId: string,
  texto: string,
): Promise<void> {
  await requireAdmin();

  const clean = texto.trim().slice(0, MAX_TEXTO);
  if (!clean) return;

  await escribir(conversationId, CLUB_UID, clean, true);

  revalidatePath("/admin/mensajes");
  revalidarChat(conversationId);
  revalidatePath("/notificaciones");
}
