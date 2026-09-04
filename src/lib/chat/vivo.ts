"use client";

import {
  collection,
  doc,
  limitToLast,
  onSnapshot,
  orderBy,
  query,
  where,
  type Timestamp,
} from "firebase/firestore";

import { db } from "@/lib/firebase/client";
import { COL, SUB_MENSAJE } from "@/lib/firebase/collections";
import type { MessageVM } from "@/lib/chat/queries";
import type { AuthorVM } from "@/lib/social/queries";

/** Las escuchas en vivo del chat.
 *
 *  Es la **primera lectura directa del navegador a Firestore** en el módulo
 *  social: todo lo demás pasa por el servidor con el Admin SDK. Por eso
 *  `firestore.rules` deja de decir `if false` para estas dos colecciones y pasa
 *  a `request.auth.uid in resource.data.participantIds`.
 *
 *  Sólo lectura. Escribir sigue siendo del servidor
 *  (`lib/chat/actions.ts`) porque ningún envío es un documento solo: mueve el
 *  `ultimoMensaje` y el `updatedAt` de la conversación y dispara la campanita.
 *
 *  Las dos funciones devuelven el `unsubscribe`: hay que llamarlo al desmontar o
 *  la escucha queda corriendo y la siguiente suma otra encima.
 */

const aMillis = (t: Timestamp | null | undefined) => t?.toMillis() ?? Date.now();

/** Los mensajes de una conversación, en vivo.
 *
 *  `autor` viene resuelto desde afuera —el directorio de cuentas lo arma el
 *  servidor y baja por props— así que esto no tiene que leer `trapnexport-user`
 *  por cada mensaje. Un autor que no esté en el mapa es una cuenta que se
 *  registró después de que cargó la pantalla: se muestra genérico hasta el
 *  próximo refresh, que es mejor que una lectura extra por mensaje.
 */
export function escucharMensajes(
  conversationId: string,
  viewerId: string,
  autores: Record<string, AuthorVM>,
  onChange: (mensajes: MessageVM[]) => void,
): () => void {
  const q = query(
    collection(db, COL.conversacion, conversationId, SUB_MENSAJE),
    orderBy("at", "asc"),
    limitToLast(200),
  );

  return onSnapshot(
    q,
    (snap) => {
      onChange(
        snap.docs.map((d) => {
          const m = d.data() as {
            autorId: string;
            texto: string;
            tipo: "texto" | "sistema" | "imagen";
            at: Timestamp | null;
            imagen?: { src: string; width: number; height: number };
          };
          return {
            id: d.id,
            autorId: m.autorId,
            autor:
              m.tipo === "sistema"
                ? null
                : (autores[m.autorId] ?? {
                    name: "Alguien",
                    handle: "desconocido",
                    avatar: "",
                  }),
            texto: m.texto,
            tipo: m.tipo,
            at: aMillis(m.at),
            propio: m.autorId === viewerId,
            // Mismo recorte que `getMessages`: `path` se queda en el servidor.
            ...(m.imagen
              ? {
                  imagen: {
                    src: m.imagen.src,
                    width: m.imagen.width,
                    height: m.imagen.height,
                  },
                }
              : null),
          };
        }),
      );
    },
    () => {
      /*  Se traga el error a propósito. El caso real es la sesión que venció
       *  entre que cargó la pantalla y llegó el snapshot: las reglas rechazan la
       *  escucha y no hay nada que hacer desde acá. Lo que ya se pintó —los
       *  mensajes que trajo el servidor— se queda en pantalla, que es mejor que
       *  vaciar la conversación. */
    },
  );
}

/** Cuántas conversaciones tienen algo sin leer, en vivo.
 *
 *  Alimenta el badge del sobre en el header. Se calcula acá y no en el servidor
 *  porque el punto es justamente que baje solo al leer y suba solo al llegar un
 *  mensaje, sin recargar.
 */
export function escucharSinLeer(
  viewerId: string,
  onChange: (n: number) => void,
): () => void {
  const q = query(
    collection(db, COL.conversacion),
    where("participantIds", "array-contains", viewerId),
  );

  return onSnapshot(
    q,
    (snap) => {
      let n = 0;
      for (const d of snap.docs) {
        const c = d.data() as {
          ultimoMensaje?: { autorId: string; at: Timestamp | null };
          lastReadAt?: Record<string, Timestamp | null>;
        };
        const ultimo = c.ultimoMensaje?.at?.toMillis() ?? 0;
        if (!ultimo) continue;
        // Lo propio nunca cuenta como no leído.
        if (c.ultimoMensaje?.autorId === viewerId) continue;
        if (ultimo > (c.lastReadAt?.[viewerId]?.toMillis() ?? 0)) n += 1;
      }
      onChange(n);
    },
    () => {
      /* misma razón que arriba: se queda con lo que ya había */
    },
  );
}

/** Hasta dónde leyó cada participante, en vivo.
 *
 *  Es lo que dibuja el "Visto" abajo del último mensaje propio. Va sobre el
 *  documento de la conversación —no sobre los mensajes— porque `lastReadAt` es
 *  un mapa `uid → timestamp` que vive ahí: marcar leído no escribe nada en el
 *  mensaje.
 *
 *  Escucha aparte y no un campo más de `escucharMensajes` porque son dos
 *  documentos distintos: la subcolección y su padre. Cuesta una escucha más,
 *  que es el precio de que el "Visto" aparezca solo cuando el otro abre el
 *  chat, sin recargar.
 */
export function escucharLectura(
  conversationId: string,
  onChange: (lastReadAt: Record<string, number>) => void,
): () => void {
  return onSnapshot(
    doc(db, COL.conversacion, conversationId),
    (snap) => {
      const c = snap.data() as
        | { lastReadAt?: Record<string, Timestamp | null> }
        | undefined;

      const salida: Record<string, number> = {};
      for (const [uid, t] of Object.entries(c?.lastReadAt ?? {})) {
        salida[uid] = t?.toMillis() ?? 0;
      }
      onChange(salida);
    },
    () => {
      /*  Mismo criterio que las otras dos: sin el dato no se muestra el
       *  "Visto", que es exactamente lo mismo que pasa cuando el otro todavía
       *  no leyó. No hay nada que avisar. */
    },
  );
}
