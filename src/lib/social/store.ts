import { avatarUrl } from "@/lib/media";
import { JUGADORES } from "@/lib/trap-awards";
import type {
  CommentRow,
  Conversation,
  NotificationRow,
  Post,
  User,
} from "@/lib/social/types";

/** Base de datos en memoria — el único lugar que hay que reemplazar por Firestore.
 *
 *  Vive en `globalThis` a propósito: en `next dev` cada recompilación descarta
 *  los módulos, y sin esto una publicación desaparecía al guardar un archivo.
 *  Todo lo demás (queries, actions, pantallas) habla con este objeto y no sabe
 *  de dónde salen los datos, así que migrar a Firestore es reescribir
 *  `queries.ts` y `actions.ts`, no las pantallas.
 *
 *  Las cuentas no se escriben acá: salen de `JUGADORES` (`lib/trap-awards.ts`),
 *  que es el plantel real. El `id` de cada cuenta **es** el id del jugador, así
 *  que una publicación o un seguimiento apuntan al mismo jugador
 *  que vota en los premios y que tiene perfil en `/historia` — sin tabla de
 *  equivalencias en el medio. Lo único inventado son los textos: publicaciones,
 *  comentarios y mensajes son de relleno hasta que la gente escriba los suyos.
 */
export interface Db {
  users: User[];
  posts: Post[];
  comments: CommentRow[];
  conversations: Conversation[];
  notifications: NotificationRow[];
  /** sesión simulada: a quién representa el módulo público mientras no hay auth */
  currentUserId: string;
}

const MIN = 60_000;
const HOUR = 60 * MIN;
const DAY = 24 * HOUR;

/** La cuenta desde la que se ve la app mientras no haya login. */
const YO = "emanuel-cisterna";

/** Lo poco que una cuenta tiene además del nombre: la bio y la verificación.
 *
 *  Es un mapa parcial y no un campo de `Jugador` porque son dos cosas
 *  distintas: el plantel es dato del evento, esto es dato de la red social. El
 *  que no está acá entra igual, con la bio vacía. */
const PERFILES: Record<string, Partial<User>> = {
  [YO]: {
    bio: "Armo la app de los Trap Awards. Acá comparto el proceso.",
    verified: true,
    ficha: {
      edad: 27,
      peso: 74,
      altura: 178,
      dorsal: 10,
      piernaHabil: "derecha",
      posicion: "mediocampista",
      ciudad: "Rosario",
    },
  },
  "leandro-atondo": {
    bio: "Organización de la segunda edición. Preguntas por acá.",
    verified: true,
    ficha: { edad: 31, dorsal: 5, piernaHabil: "izquierda", posicion: "defensor" },
  },
  "federico-rodriguez": {
    bio: "Arco y cámara. Los videos de la gala los subo yo.",
    ficha: { dorsal: 1, posicion: "arquero", piernaHabil: "derecha" },
  },
  "josue-ferreiro": { bio: "Si la pelota va al área, algo va a pasar." },
  "martin-motta": { bio: "Caños con y sin sentido." },
  "naza-sochan": { bio: "Primer año en el Trapo." },
  "yago-taboada": { bio: "Vine por el asado y me quedé por el fútbol." },
};

function seed(): Db {
  const now = Date.now();

  /** Las cuentas del plantel, en el orden de la lista.
   *
   *  `joinedAt` se abre en abanico —una semana entre cuenta y cuenta— y no es
   *  el mismo instante para todas: `/admin/usuarios` ordena por antigüedad y
   *  con dieciocho fechas idénticas la tabla quedaría en un orden arbitrario
   *  que cambia entre renders. */
  const users: User[] = JUGADORES.map((j, i) => ({
    id: j.id,
    name: j.nombre,
    handle: j.handle,
    avatar: avatarUrl(j.nombre, j.handle),
    joinedAt: now - (400 - i * 7) * DAY,
    ...PERFILES[j.id],
  }));

  // La única cuenta que no es del plantel: existe para que el panel de
  // moderación tenga algo real que moderar (una cuenta suspendida).
  users.push({
    id: "promo",
    name: "Cuenta Promo",
    handle: "promo_2x1",
    avatar: avatarUrl("Cuenta Promo", "promo_2x1"),
    bio: "OFERTAS, escribime por privado",
    suspended: true,
    joinedAt: now - 3 * DAY,
  });

  // El feed arranca vacío: las publicaciones de relleno se fueron cuando el
  // compositor pasó a subir imágenes de verdad a Firebase Storage
  // (`lib/storage/post-image.ts`). Lo que se postee desde la app es lo único
  // que hay hasta que esto lea de Firestore.
  const posts: Post[] = [];
  const comments: CommentRow[] = [];

  const conversations: Conversation[] = [
    {
      id: "conv1",
      participantIds: [YO, "leandro-atondo"],
      messages: [
        {
          id: "m1",
          fromId: "leandro-atondo",
          text: "¿Viste la lista de premios que subí?",
          at: now - 3 * HOUR,
        },
        {
          id: "m2",
          fromId: YO,
          text: "Sí, ya están las diecisiete cargadas en el panel. ¿Ponemos fecha de cierre?",
          at: now - 150 * MIN,
        },
        {
          id: "m3",
          fromId: "leandro-atondo",
          text: "Dale, cuando confirmemos el día de la gala te aviso.",
          at: now - 40 * MIN,
        },
      ],
    },
    {
      id: "conv2",
      participantIds: [YO, "federico-rodriguez"],
      messages: [
        {
          id: "m4",
          fromId: "federico-rodriguez",
          text: "Che, ¿los premios de video los dejo cerrados hasta subir los clips?",
          at: now - 2 * DAY,
        },
        {
          id: "m5",
          fromId: YO,
          text: "Sí, quedan en borrador. Los abrís vos desde el panel cuando estén.",
          at: now - 2 * DAY + 5 * MIN,
        },
      ],
    },
    {
      id: "conv3",
      participantIds: [YO, "yago-taboada"],
      messages: [
        {
          id: "m6",
          fromId: "yago-taboada",
          text: "¿La invitación de la gala la mando yo por el grupo?",
          at: now - 5 * DAY,
        },
      ],
    },
  ];

  // Sin notificaciones de relleno: la campana arranca vacía y sólo muestra lo
  // que generen las acciones en vivo (post nuevo, mensaje, cambio de cronograma,
  // noticia publicada) vía `lib/social/notify.ts`.
  const notifications: NotificationRow[] = [];


  return {
    users,
    posts,
    comments,
    conversations,
    notifications,
    currentUserId: YO,
  };
}

const globalForDb = globalThis as unknown as { __socialDb?: Db };

export const db: Db = (globalForDb.__socialDb ??= seed());

/** id corto y único dentro del proceso; el backend real lo reemplaza por el suyo. */
export const newId = (prefix: string) =>
  `${prefix}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;
