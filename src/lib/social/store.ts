import { avatarUrl, mediaUrl } from "@/lib/media";
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
  // moderación tenga algo real que moderar (una suspendida y un post oculto).
  users.push({
    id: "promo",
    name: "Cuenta Promo",
    handle: "promo_2x1",
    avatar: avatarUrl("Cuenta Promo", "promo_2x1"),
    bio: "OFERTAS, escribime por privado",
    suspended: true,
    joinedAt: now - 3 * DAY,
  });

  const posts: Post[] = [
    {
      id: "p1",
      authorId: "leandro-atondo",
      text:
        "Ya está la lista de la segunda edición: diecisiete premios. Catorce se " +
        "votan entre nosotros, tres salen de los videos y el once ideal es el " +
        "único donde se eligen varios. El que no vota no se queja del resultado.",
      media: [
        {
          src: mediaUrl("Trap Awards II", "p1a"),
          alt: "Las diecisiete categorías de la segunda edición",
        },
      ],
      createdAt: now - 2 * HOUR,
      likedBy: [YO, "martin-motta", "yago-taboada"],
      savedBy: [YO],
      shares: 4,
    },
    {
      id: "p2",
      authorId: "federico-rodriguez",
      text:
        "Los premios de gol, caño y asistencia no se abren hasta que estén los " +
        "videos. Si tenés algo grabado de la temporada, mandámelo antes del " +
        "viernes: lo que no llegue no entra en la votación.",
      media: [],
      createdAt: now - 5 * HOUR,
      likedBy: [YO, "leandro-atondo"],
      savedBy: [],
      shares: 1,
    },
    {
      id: "p3",
      authorId: "josue-ferreiro",
      text: "Tres fotos de la última fecha. La del medio es la única donde estoy corriendo.",
      media: [
        { src: mediaUrl("Última fecha 01", "p3a"), alt: "Foto de la última fecha, número 1" },
        { src: mediaUrl("Última fecha 02", "p3b"), alt: "Foto de la última fecha, número 2" },
        { src: mediaUrl("Última fecha 03", "p3c"), alt: "Foto de la última fecha, número 3" },
      ],
      createdAt: now - 26 * HOUR,
      likedBy: [YO, "leandro-atondo", "martin-motta", "agustin-carranza"],
      savedBy: ["leandro-atondo"],
      shares: 9,
    },
    {
      id: "p4",
      authorId: YO,
      text:
        "Arranqué el panel de la app de los premios. La regla que me puse: el " +
        "panel no tiene datos propios, lee exactamente lo mismo que ven ustedes " +
        "en la votación.",
      media: [],
      createdAt: now - 2 * DAY,
      likedBy: ["leandro-atondo", "naza-sochan"],
      savedBy: [],
      shares: 0,
    },
    {
      id: "p5",
      authorId: "promo",
      text: "OFERTA IMPERDIBLE 2x1, escribime por privado ahora",
      media: [],
      createdAt: now - 30 * HOUR,
      likedBy: [],
      savedBy: [],
      shares: 0,
      hidden: true,
    },
  ];

  const comments: CommentRow[] = [
    {
      id: "c1",
      postId: "p1",
      authorId: "mariano-cisterna",
      text: "El once ideal se vota por nombre o por puesto?",
      createdAt: now - 100 * MIN,
      likedBy: ["leandro-atondo"],
      parentId: null,
    },
    {
      id: "c2",
      postId: "p1",
      authorId: "leandro-atondo",
      text: "Por nombre: elegís once y el equipo se arma con los más votados.",
      createdAt: now - 80 * MIN,
      likedBy: ["mariano-cisterna", YO],
      parentId: "c1",
    },
    {
      id: "c3",
      postId: "p1",
      authorId: "yago-taboada",
      text: "Falta el premio al peor asado del año y lo sabemos todos.",
      createdAt: now - 40 * MIN,
      likedBy: [],
      parentId: null,
    },
    {
      id: "c4",
      postId: "p3",
      authorId: "naza-sochan",
      text: "La segunda es la mejor foto del año, sin discusión.",
      createdAt: now - 20 * HOUR,
      likedBy: ["josue-ferreiro"],
      parentId: null,
      pinned: true,
    },
    {
      id: "c5",
      postId: "p2",
      authorId: "martin-motta",
      text: "Te paso dos caños esta noche. Uno es de Agus, para ser justos.",
      createdAt: now - 3 * HOUR,
      likedBy: [],
      parentId: null,
    },
  ];

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

  const notifications: NotificationRow[] = [
    {
      id: "n1",
      userId: YO,
      kind: "comment",
      actorId: "leandro-atondo",
      text: "Leandro Atondo comentó tu publicación",
      href: "/post/p4",
      at: now - 25 * MIN,
    },
    {
      id: "n2",
      userId: YO,
      kind: "like",
      actorId: "naza-sochan",
      text: "A Naza Sochan le gustó tu publicación",
      href: "/post/p4",
      at: now - 3 * HOUR,
    },
    {
      id: "n4",
      userId: YO,
      kind: "mention",
      actorId: "martin-motta",
      text: "Martin Motta te mencionó en un comentario",
      href: "/post/p2",
      at: now - 3 * DAY,
      read: true,
    },
  ];


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
