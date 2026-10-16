"use client";

import { onAuthStateChanged, type User } from "firebase/auth";
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  query,
  runTransaction,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  type Timestamp,
} from "firebase/firestore";

import { auth, db } from "@/lib/firebase/client";
import { COL } from "@/lib/firebase/collections";
import type { Diapositiva } from "./guion";

/** El control remoto de la gala: el celular le dice a la proyección que avance.
 *
 *  Van por Firestore, directo entre los dos navegadores, y no por el servidor:
 *  `onSnapshot` le entrega el comando a la proyección en lo que tarda un
 *  mensaje del chat, y no hay que mantener una conexión propia abierta. Las
 *  dos puntas escriben **como el admin** con el SDK del navegador, y las
 *  reglas sólo dejan pasar a quien tiene el claim `admin`.
 *
 *    trapnexport-presentacion/vivo              lo que está proyectado
 *    trapnexport-presentacion/vivo/comando/{id} lo que pide el celular
 *
 *  Los comandos son documentos sueltos y no un campo del estado: dos toques
 *  rápidos en "siguiente" sobre un mismo campo se pisan y la proyección avanza
 *  una sola vez. Como documentos, llegan los dos. La proyección borra cada uno
 *  después de ejecutarlo.
 *
 *  Cada apertura de la proyección es una **sesión** nueva. El celular manda
 *  con la sesión que ve en el estado, y la proyección sólo escucha la suya:
 *  un toque que quedó en vuelo de la presentación anterior no hace avanzar la
 *  que se acaba de abrir.
 */

const ESTADO = "vivo";
const SUB_COMANDO = "comando";

const refEstado = () => doc(db, COL.presentacion, ESTADO);
const refComandos = () => collection(db, COL.presentacion, ESTADO, SUB_COMANDO);

/** Cada cuánto la proyección avisa que sigue abierta. */
export const LATIDO_MS = 15_000;

/** Sin latido por más que esto, el celular la da por cerrada. */
export const LATIDO_VENCIDO_MS = 45_000;

/* ── el modelo ───────────────────────────────────────────────────────────── */

export type Accion = "siguiente" | "anterior" | "ir" | "pausa" | "silencio";

export interface Comando {
  accion: Accion;
  /** sólo con `ir` */
  indice?: number;
}

/** Una viñeta, tal como la ve el celular. */
export interface VinetaRemota {
  rotulo: string;
  tipo: Diapositiva["tipo"];
  /** Lo que el que presenta tiene que saber y el salón todavía no: quién gana,
   *  en la viñeta del ganador. Sólo se ve en el celular. */
  nota?: string;
}

export interface EstadoRemoto {
  sesion: string;
  activa: boolean;
  indice: number;
  vinetas: VinetaRemota[];
  silencio: boolean;
  latido?: Timestamp | null;
}

export const vinetasDe = (guion: Diapositiva[]): VinetaRemota[] =>
  guion.map((d) => {
    const v: VinetaRemota = { rotulo: d.rotulo, tipo: d.tipo };
    if (d.tipo === "ganador") {
      v.nota = d.ganadores.length
        ? d.ganadores.map((g) => g.texto).join(", ")
        : "Sin votos";
    }
    return v;
  });

/* ── sesión ──────────────────────────────────────────────────────────────── */

/** El usuario del SDK del navegador, cuando termine de restaurarse, y si
 *  tiene el claim `admin`. La cookie del panel no alcanza: Firestore valida el
 *  token del SDK, que es otra cosa. */
export function alListoAdmin(cb: (usuario: User | null, esAdmin: boolean) => void) {
  return onAuthStateChanged(auth, async (usuario) => {
    if (!usuario) return cb(null, false);
    try {
      const token = await usuario.getIdTokenResult();
      cb(usuario, token.claims.admin === true);
    } catch {
      cb(usuario, false);
    }
  });
}

/* ── la proyección ───────────────────────────────────────────────────────── */

export interface Receptor {
  /** publicar la viñeta actual */
  mover: (indice: number) => void;
  silenciar: (valor: boolean) => void;
  cerrar: () => void;
}

/** Abre una sesión: publica el guion, escucha los comandos y late.
 *
 *  `alError` recibe el motivo si Firestore no deja escribir o escuchar —casi
 *  siempre, que en este navegador no hay sesión de admin del SDK—. La gala
 *  sigue andando con el teclado: el control remoto es un agregado. */
export function abrirReceptor(
  guion: Diapositiva[],
  indiceInicial: number,
  alComando: (c: Comando) => void,
  alError: (mensaje: string) => void,
  alConectar: () => void,
): Receptor {
  const sesion = crypto.randomUUID();
  let cerrado = false;
  let dejarDeEscuchar: (() => void) | null = null;
  let latidoId = 0;

  const fallo = (e: unknown) => {
    if (cerrado) return;
    const codigo = (e as { code?: string })?.code;
    alError(
      codigo === "permission-denied"
        ? "Este navegador no tiene sesión de admin en Firebase. Cerrá sesión del panel y volvé a entrar."
        : "No se pudo conectar con Firestore.",
    );
  };

  const estado: Omit<EstadoRemoto, "latido"> = {
    sesion,
    activa: true,
    indice: indiceInicial,
    vinetas: vinetasDe(guion),
    silencio: false,
  };

  setDoc(refEstado(), { ...estado, latido: serverTimestamp() })
    .then(() => {
      if (cerrado) return;
      alConectar();

      dejarDeEscuchar = onSnapshot(
        query(refComandos(), where("sesion", "==", sesion)),
        (snap) => {
          for (const cambio of snap.docChanges()) {
            if (cambio.type !== "added") continue;
            const d = cambio.doc.data() as Comando;
            alComando({ accion: d.accion, indice: d.indice });
            void deleteDoc(cambio.doc.ref).catch(() => {});
          }
        },
        fallo,
      );

      latidoId = window.setInterval(() => {
        void updateDoc(refEstado(), { latido: serverTimestamp() }).catch(() => {});
      }, LATIDO_MS);
    })
    .catch(fallo);

  return {
    mover: (indice) => {
      if (cerrado) return;
      void updateDoc(refEstado(), { indice, latido: serverTimestamp() }).catch(() => {});
    },
    silenciar: (valor) => {
      if (cerrado) return;
      void updateDoc(refEstado(), { silencio: valor }).catch(() => {});
    },
    cerrar: () => {
      cerrado = true;
      window.clearInterval(latidoId);
      dejarDeEscuchar?.();
      // Sólo apaga la sesión si sigue siendo la suya: si ya se abrió otra
      // proyección, no le corresponde a esta cerrarla.
      void runTransaction(db, async (t) => {
        const actual = await t.get(refEstado());
        if (actual.data()?.sesion === sesion) t.update(refEstado(), { activa: false });
      }).catch(() => {});
    },
  };
}

/* ── el celular ──────────────────────────────────────────────────────────── */

export function escucharEstado(
  cb: (estado: EstadoRemoto | null) => void,
  alError: (mensaje: string) => void,
) {
  return onSnapshot(
    refEstado(),
    (snap) => cb(snap.exists() ? (snap.data() as EstadoRemoto) : null),
    (e) =>
      alError(
        (e as { code?: string }).code === "permission-denied"
          ? "Este celular no tiene sesión de admin. Iniciá sesión en el panel desde acá."
          : "No se pudo conectar con Firestore.",
      ),
  );
}

export function enviarComando(sesion: string, comando: Comando) {
  // Sin `indice` cuando no hace falta: Firestore rechaza un campo `undefined`.
  return addDoc(refComandos(), {
    accion: comando.accion,
    ...(comando.indice !== undefined ? { indice: comando.indice } : {}),
    sesion,
    creado: serverTimestamp(),
  });
}
