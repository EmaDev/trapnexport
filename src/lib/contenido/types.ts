/** Modelo de dominio del contenido que administra el club.
 *
 *  Es un módulo aparte de `social/` a propósito. `social/` es la red —cuentas,
 *  publicaciones, comentarios, reportes— y lo escriben los usuarios; esto lo
 *  escribe **sólo** el panel: noticias, encuestas, invitaciones y cronograma.
 *  Compartir el store mezclaría dos ciclos de vida distintos (lo que modera el
 *  admin vs. lo que publica el admin) en la misma colección.
 *
 *  Mismo par read/write que `social/`: `queries.ts` lee, `actions.ts` escribe,
 *  las pantallas no tocan `store.ts`.
 *
 *  Las fechas de calendario van como `"YYYY-MM-DD"` y las horas como `"HH:mm"`,
 *  en strings y no en timestamps. Un evento del cronograma ocurre a las 21:00
 *  **en la cancha**, no en un instante UTC: guardarlo como número obliga a
 *  elegir una zona al escribir y a deshacerla al leer, y el día que el server
 *  corra en otra zona la fecha se mueve. `fromISODate` en `lib/time.ts` es el
 *  único lugar que las convierte a `Date`, siempre en hora local.
 *
 *  El cronograma, además, es de **un solo día**: la fecha vive una sola vez en
 *  `ContenidoDb.fechaEvento` y los eventos sólo guardan la hora. Ver `Evento`.
 */

/* ── noticias ────────────────────────────────────────────────────────────── */

export type EstadoNoticia = "borrador" | "publicada";

export interface Noticia {
  id: string;
  titulo: string;
  /** la bajada: el párrafo que se lee debajo del título */
  copete: string;
  cuerpo: string;
  /** URL de la portada. Vacío hasta que haya un uploader de imágenes en el
   *  panel: hoy ninguna noticia trae una. */
  cover?: string;
  estado: EstadoNoticia;
  autor: string;
  createdAt: number;
  updatedAt?: number;
  /** una sola noticia destacada por vez: guardarla apaga la anterior */
  destacada?: boolean;
}

/* ── encuestas ───────────────────────────────────────────────────────────── */

export type EstadoEncuesta = "borrador" | "abierta" | "cerrada";

export interface OpcionEncuesta {
  id: string;
  texto: string;
  votos: number;
  /** URL de una imagen o un video: la opción se muestra como media, no como
   *  texto. Se distingue imagen de video por la extensión de la URL. */
  media?: string;
}

export interface Encuesta {
  id: string;
  pregunta: string;
  descripcion?: string;
  opciones: OpcionEncuesta[];
  /** permite elegir más de una opción */
  multiple: boolean;
  /** los porcentajes se ven mientras la votación está abierta. En `false` el
   *  `Poll` va en modo anónimo: no muestra barras, totales ni el voto propio. */
  resultadosVisibles: boolean;
  estado: EstadoEncuesta;
  /** "YYYY-MM-DD"; vacío = sin fecha de cierre */
  cierra?: string;
  createdAt: number;
}

/* ── invitaciones ────────────────────────────────────────────────────────── */

/** Las tres plantillas de la tarjeta. Cambian el diseño, no los campos: la
 *  misma invitación se ve igual de completa en las tres. */
export type PlantillaInvitacion = "gala" | "cancha" | "minima";

/** Cómo se **mueve** la tarjeta una vez que el invitado la tiene delante.
 *
 *  Es una dimensión aparte de `plantilla` y de `revelacion`, y las tres
 *  responden preguntas distintas: `plantilla` es cómo se ve quieta —lo que se
 *  imprime en la imagen que se comparte y lo que lee alguien con
 *  `prefers-reduced-motion`—, `revelacion` es cómo se destapa, y `efecto` es
 *  cómo se comporta después. Fundirlas daría treinta y seis diseños que
 *  mantener donde hay tres, y obligaría a elegir el movimiento eligiendo los
 *  colores.
 *
 *  - `holo`   — se inclina en 3D siguiendo el puntero, el dedo o el giroscopio,
 *               con un brillo holográfico que se mueve con ella.
 *  - `aurora` — flota sobre luces que respiran y el texto se revela por partes.
 *  - `flote`  — sólo respira, muy despacio. Es el sobrio de los tres, y el que
 *               corresponde cuando lo que tiene que lucirse es la revelación.
 */
export type EfectoInvitacion = "holo" | "aurora" | "flote";

/** Cómo llega la tarjeta antes de que se la pueda leer.
 *
 *  Es la parte que convierte abrir el link en un momento y no en cargar una
 *  página: la invitación llega **tapada** y el invitado la destapa. Va separada
 *  de `efecto` porque son decisiones independientes —cualquier revelación
 *  combina con cualquier movimiento— y porque tenerlas juntas obligaba a elegir
 *  el sobre lacrado renunciando a la tarjeta holográfica.
 *
 *  - `directa`  — sin tapa: la tarjeta aparece con la entrada de su efecto.
 *  - `lacre`    — un sobre cerrado con lacre; se toca y la solapa se abre.
 *  - `cortina`  — dos hojas con el escudo al medio, que se abren a los costados.
 *  - `raspar`   — una raspadita: se descubre pasando el dedo por encima.
 *
 *  Las tres tapas se abren solas a los pocos segundos si nadie las toca. El
 *  gesto es lo lindo, pero no puede ser la única forma de llegar al contenido.
 */
export type RevelacionInvitacion = "directa" | "lacre" | "cortina" | "raspar";

export type EstadoInvitacion = "activa" | "revocada";

export interface Invitacion {
  id: string;
  /** lo que va en la URL pública: `/invitacion/:code`. Único e inmutable. */
  code: string;
  /** a quién va dirigida — es lo único que personaliza la tarjeta */
  invitado: string;
  titulo: string;
  mensaje: string;
  /** "YYYY-MM-DD" */
  fecha: string;
  /** "HH:mm" */
  hora: string;
  lugar: string;
  plantilla: PlantillaInvitacion;
  /** cómo se mueve la tarjeta ya destapada. Ver `EfectoInvitacion`. */
  efecto: EfectoInvitacion;
  /** cómo llega tapada, y qué gesto la destapa. Ver `RevelacionInvitacion`. */
  revelacion: RevelacionInvitacion;
  estado: EstadoInvitacion;
  createdAt: number;
}

/* ── cronograma ──────────────────────────────────────────────────────────── */

/** El tipo define el color del evento en la línea de tiempo. */
export type TipoEvento = "partido" | "entrenamiento" | "institucional" | "social";

/** Un bloque del cronograma.
 *
 *  **No tiene fecha.** El cronograma entero ocurre un único día —el que guarda
 *  `ContenidoDb.fechaEvento`— y cada evento sólo elige su horario dentro de ese
 *  día. La fecha no se repite en cada fila por dos razones: repetirla permitiría
 *  que dos eventos la tuvieran distinta, que es exactamente el estado que este
 *  modelo no admite; y mover el día sería un update de N filas —con la mitad
 *  del cronograma quedándose atrás si una falla— en vez de uno solo.
 */
export interface Evento {
  id: string;
  nombre: string;
  descripcion: string;
  /** "HH:mm" — hora de inicio dentro del día del evento */
  hora: string;
  /** minutos; con `hora` define el bloque en la línea de tiempo. Puede cruzar
   *  la medianoche: eso no lo convierte en un evento de otro día. */
  duracion: number;
  lugar: string;
  tipo: TipoEvento;
  createdAt: number;
}

/* ── etiquetas compartidas ───────────────────────────────────────────────── */

/** El tipo de evento define su color, y el color tiene que ser el mismo en la
 *  tabla del panel, en el calendario y en cualquier vista pública del
 *  cronograma. Vive con el tipo, y no en `queries.ts`, por una razón concreta:
 *  los formularios del panel son componentes cliente y `queries.ts` importa el
 *  store — sacar la etiqueta de ahí arrastraría toda la base al bundle del
 *  navegador. `types.ts` no importa nada. */
export const TIPO_EVENTO: Record<
  TipoEvento,
  { label: string; color: "primary" | "accent" | "success" | "danger" | "muted" }
> = {
  partido: { label: "Partido", color: "primary" },
  entrenamiento: { label: "Entrenamiento", color: "success" },
  institucional: { label: "Institucional", color: "muted" },
  social: { label: "Social", color: "accent" },
};

export const ESTADO_ENCUESTA: Record<EstadoEncuesta, string> = {
  borrador: "Borrador",
  abierta: "Abierta",
  cerrada: "Cerrada",
};

export const ESTADO_NOTICIA: Record<EstadoNoticia, string> = {
  borrador: "Borrador",
  publicada: "Publicada",
};

export const PLANTILLA_INVITACION: Record<PlantillaInvitacion, string> = {
  gala: "Gala",
  cancha: "Cancha",
  minima: "Mínima",
};

/** El efecto y la revelación llevan descripción y la plantilla no: el nombre de
 *  un diseño se entiende viendo la vista previa, el de una animación no se ve
 *  hasta que ocurre. En los `Select` del panel la descripción es el `hint` de la
 *  opción elegida, así que quien carga la invitación sabe qué eligió antes de
 *  mirar. */
export const EFECTO_INVITACION: Record<
  EfectoInvitacion,
  { label: string; descripcion: string }
> = {
  holo: {
    label: "Holográfica",
    descripcion:
      "Se inclina en 3D siguiendo el mouse, el dedo o el giroscopio del teléfono.",
  },
  aurora: {
    label: "Aurora",
    descripcion: "Flota sobre luces que respiran y el texto se revela por partes.",
  },
  flote: {
    label: "Flote",
    descripcion: "Sólo respira, muy despacio. El sobrio, para que luzca la revelación.",
  },
};

export const REVELACION_INVITACION: Record<
  RevelacionInvitacion,
  { label: string; descripcion: string }
> = {
  directa: {
    label: "Directa",
    descripcion: "Sin tapa: la tarjeta aparece sola con la entrada de su efecto.",
  },
  lacre: {
    label: "Sobre lacrado",
    descripcion: "Llega en un sobre cerrado; se toca el lacre y la solapa se abre.",
  },
  cortina: {
    label: "Cortina",
    descripcion: "Dos hojas con el escudo al medio que se abren hacia los costados.",
  },
  raspar: {
    label: "Raspadita",
    descripcion: "Se descubre pasando el dedo por encima, como un raspadito.",
  },
};

/* ── entradas de las acciones ────────────────────────────────────────────── */

/** Lo que manda un formulario del panel.
 *
 *  `id` opcional es lo que hace que `saveX` sea alta **y** modificación: sin
 *  `id` crea, con `id` actualiza. Dos acciones separadas duplicarían la
 *  validación entera para cambiar una sola línea.
 *
 *  Van acá y no en `actions.ts` porque un archivo `"use server"` sólo puede
 *  exportar funciones async: un `export interface` ahí rompe el build.
 */
export type NoticiaInput = Omit<Noticia, "id" | "cover" | "createdAt" | "updatedAt"> & {
  id?: string;
};

/** Una opción tal como la carga el formulario: texto y, para videos o
 *  imágenes, la URL en `media`. Sin votos —no se editan a mano desde el panel—
 *  ni `id` —lo pone la acción al guardar—. */
export interface OpcionInput {
  texto: string;
  media?: string;
}

export type EncuestaInput = Omit<Encuesta, "id" | "opciones" | "createdAt"> & {
  id?: string;
  opciones: OpcionInput[];
};

export type InvitacionInput = Omit<Invitacion, "id" | "code" | "createdAt"> & {
  id?: string;
};

/** El alta masiva: un diseño y una lista de nombres.
 *
 *  Es la misma invitación repetida N veces cambiando **sólo** el invitado, que
 *  es exactamente lo que la tarjeta personaliza. El evento es uno solo —mismo
 *  título, misma fecha, mismo lugar, misma tapa— y por eso esos campos no se
 *  repiten por fila: si viajaran con cada nombre, dos invitados podrían
 *  terminar con horarios distintos para la misma cena, que es el estado que
 *  este alta no admite.
 *
 *  Los nombres llegan como un solo texto y no como `string[]` porque del otro
 *  lado hay un `Textarea` donde se pega una lista: partirla es trabajo del
 *  servidor, que es el único que puede garantizar que el corte, el recorte y el
 *  descarte de repetidos sean los mismos para todos.
 */
export type InvitacionMasivaInput = Omit<InvitacionInput, "id" | "invitado"> & {
  /** un nombre por línea */
  nombres: string;
};

/** Lo que devuelve el alta masiva.
 *
 *  No alcanza con el número de creadas: quien pega ochenta nombres necesita
 *  saber cuáles **no** se cargaron y por qué, o va a tener que comparar la
 *  tabla contra su lista a mano. Los repetidos se devuelven con nombre y
 *  apellido, no contados. */
export interface ResultadoMasivo {
  creadas: number;
  /** ya tenían invitación para este mismo título y fecha */
  repetidos: string[];
  /** faltan el título o la fecha, o la lista quedó vacía */
  error?: string;
}

export type EventoInput = Omit<Evento, "id" | "createdAt"> & { id?: string };
