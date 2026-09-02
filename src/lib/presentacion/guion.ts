/** El guion de la gala: de las encuestas del panel a la lista de viñetas que
 *  se proyecta.
 *
 *  Es un módulo **puro**: no importa el store ni nada de `next/*`, porque lo
 *  ejecuta el presentador, que es un componente cliente. La página del panel
 *  lee las encuestas en el servidor, las traduce a `CategoriaVotacion` y le
 *  pasa esa lista al cliente; acá adentro no hay ni una lectura de base.
 *
 *  El guion es **derivado, no guardado**. Una presentación no es una entidad
 *  más del panel: es una función de las encuestas del momento en que se abre.
 *  Guardarla obligaría a sincronizarla con cada voto que entra, y lo que se
 *  proyecta en la gala tiene que ser el conteo de ese segundo, no una foto de
 *  cuando alguien armó la presentación.
 */

/* ── entrada ─────────────────────────────────────────────────────────────── */

export interface OpcionVotacion {
  id: string;
  texto: string;
  votos: number;
}

/** Una categoría lista para proyectar: la encuesta más el nombre del premio.
 *
 *  El nombre no sale de la encuesta —ahí lo que hay es la *pregunta*, "¿Quién
 *  fue el mejor arquero del año?"— sino de `PREMIOS`. En una placa de gala se
 *  anuncia "MEJOR ARQUERO", no la pregunta entera; la pregunta queda debajo,
 *  en chico.
 */
export interface CategoriaVotacion {
  id: string;
  /** "Mejor arquero" — el título de la placa */
  nombre: string;
  /** "¿Quién fue el mejor arquero del año?" — la bajada */
  pregunta: string;
  descripcion?: string;
  opciones: OpcionVotacion[];
  /** cuántos se llevan el premio: 1 casi siempre, 11 en el once ideal */
  cupos: number;
  totalVotos: number;
}

export interface OpcionesGuion {
  /** los ids de `CategoriaVotacion`, en el orden en que se anuncian */
  orden: string[];
  /** la placa con los nominados antes de abrir el sobre */
  nominados: boolean;
  /** el "y el ganador es…" con redoble */
  suspenso: boolean;
  /** la tabla con todos los votos después de revelar */
  resultados: boolean;
}

export const OPCIONES_POR_DEFECTO: Omit<OpcionesGuion, "orden"> = {
  nominados: true,
  suspenso: true,
  resultados: true,
};

/* ── el ganador ──────────────────────────────────────────────────────────── */

export interface Ganador {
  opcionId: string;
  texto: string;
  votos: number;
  /** sobre el total de votos de la categoría; 0 si nadie votó */
  porcentaje: number;
}

/** Los ganadores de una categoría: los `cupos` más votados.
 *
 *  Los empates en el corte entran **todos**. Si el once ideal tiene dos
 *  jugadores empatados en el puesto once, se anuncian los doce: desempatar por
 *  orden de lista sería inventar un criterio que nadie acordó, y en una gala el
 *  error se ve proyectado.
 *
 *  Sin votos no hay ganador: devuelve la lista vacía y la placa lo dice. Elegir
 *  al primero de la lista cuando todos tienen cero es peor que no mostrar nada.
 */
export function ganadoresDe(categoria: CategoriaVotacion): Ganador[] {
  const conVotos = categoria.opciones.filter((o) => o.votos > 0);
  if (conVotos.length === 0) return [];

  const ordenadas = [...conVotos].sort((a, b) => b.votos - a.votos);
  const corte = ordenadas[Math.min(categoria.cupos, ordenadas.length) - 1].votos;

  return ordenadas
    .filter((o) => o.votos >= corte)
    .map((o) => ({
      opcionId: o.id,
      texto: o.texto,
      votos: o.votos,
      porcentaje: categoria.totalVotos
        ? Math.round((o.votos / categoria.totalVotos) * 100)
        : 0,
    }));
}

/** Una fila de la tabla de resultados. */
export interface FilaResultado extends Ganador {
  posicion: number;
  /** 0–100, relativo a la opción más votada */
  ancho: number;
  ganadora: boolean;
}

/** Las opciones ordenadas por voto, con el ancho de barra ya resuelto.
 *
 *  El ancho es sobre el **más votado** y no sobre el total: en el once ideal
 *  cada uno elige once, así que la suma de los votos es once veces la cantidad
 *  de votantes y todos los porcentajes darían números chiquitos y sin sentido.
 *  Relativo al puntero, la barra dice lo único que importa proyectado: cuánto
 *  le sacó el primero al segundo.
 */
export function resultadosDe(categoria: CategoriaVotacion): FilaResultado[] {
  const ganadores = new Set(ganadoresDe(categoria).map((g) => g.opcionId));
  const ordenadas = [...categoria.opciones].sort((a, b) => b.votos - a.votos);
  const tope = ordenadas[0]?.votos ?? 0;

  return ordenadas.map((o, i) => ({
    opcionId: o.id,
    texto: o.texto,
    votos: o.votos,
    porcentaje: categoria.totalVotos
      ? Math.round((o.votos / categoria.totalVotos) * 100)
      : 0,
    posicion: i + 1,
    ancho: tope ? Math.round((o.votos / tope) * 100) : 0,
    ganadora: ganadores.has(o.id),
  }));
}

/* ── las viñetas ─────────────────────────────────────────────────────────── */

/** El efecto que suena **al entrar** a la viñeta.
 *
 *  Viaja en el modelo y no en el componente que la dibuja porque el orden del
 *  sonido es parte del guion: el redoble arranca cuando aparece el suspenso y
 *  la fanfarria pisa exactamente el corte a la placa del ganador. Con el efecto
 *  en cada placa, el presentador no tiene que saber nada de audio: reproduce el
 *  de la viñeta a la que entra y corta el loop de la que deja.
 */
export type Efecto =
  | "ninguno"
  | "apertura"
  | "categoria"
  | "nominados"
  | "redoble"
  | "fanfarria"
  | "aplausos"
  | "cierre";

/** Lo que dice el locutor al entrar a la viñeta.
 *
 *  Viaja en el modelo por la misma razón que `Efecto`: cuándo habla la voz es
 *  parte del guion y no de la placa que se dibuja. La `demora` está acá y no en
 *  `voz.ts` porque depende del efecto de **esta** viñeta —hay que dejar pasar
 *  la fanfarria antes de decir el nombre—, y esa relación sólo se ve desde el
 *  guion.
 */
export interface Locucion {
  /** Una frase por locución. Los ganadores van de a uno y no en una sola frase
   *  con comas: el once ideal son once nombres y así quedan separados por una
   *  pausa en vez de leídos de corrido. */
  frases: string[];
  /** ms entre que aparece la placa y que arranca la voz */
  demora: number;
}

/** El anuncio del premio entra después del golpe grave de la placa de
 *  categoría, que arranca a los 240 ms y termina de caer cerca de los 840. */
const DEMORA_CATEGORIA = 900;

/** El nombre del ganador entra sobre el acorde sostenido de la fanfarria —que
 *  se instala al segundo— y arriba de los aplausos, que empiezan a los 1100 ms.
 *  Es a propósito: en una gala el nombre se dice **con** el salón aplaudiendo,
 *  no después. El presentador le baja el volumen a la música mientras habla. */
const DEMORA_GANADOR = 1500;

interface Base {
  id: string;
  efecto: Efecto;
  /** lo que dice la voz al entrar; sin valor, la viñeta pasa en silencio */
  locucion?: Locucion;
  /** número de categoría dentro del guion; sin valor en las placas de marco */
  numero?: number;
  total?: number;
  /** el rótulo de esta viñeta en la barra de progreso y en el índice */
  rotulo: string;
}

export type Diapositiva =
  | (Base & { tipo: "standby" })
  | (Base & { tipo: "apertura" })
  | (Base & { tipo: "categoria"; categoria: CategoriaVotacion })
  | (Base & { tipo: "nominados"; categoria: CategoriaVotacion })
  | (Base & { tipo: "suspenso"; categoria: CategoriaVotacion })
  | (Base & { tipo: "ganador"; categoria: CategoriaVotacion; ganadores: Ganador[] })
  | (Base & { tipo: "resultados"; categoria: CategoriaVotacion; filas: FilaResultado[] })
  | (Base & { tipo: "cierre"; entregados: number });

/** Arma el guion completo.
 *
 *  El marco —standby, apertura y cierre— no es opcional: una gala que arranca
 *  en la primera categoría deja la pantalla mostrando el premio antes de que
 *  entre nadie a la sala. El standby es la placa que está puesta mientras se
 *  llena el salón, y por eso es la viñeta 0.
 */
export function armarGuion(
  categorias: CategoriaVotacion[],
  opciones: OpcionesGuion,
): Diapositiva[] {
  const porId = new Map(categorias.map((c) => [c.id, c]));
  const elegidas = opciones.orden
    .map((id) => porId.get(id))
    .filter((c): c is CategoriaVotacion => Boolean(c));

  const total = elegidas.length;

  const cuerpo = elegidas.flatMap((categoria, i): Diapositiva[] => {
    const numero = i + 1;
    const marca = { numero, total };
    const ganadores = ganadoresDe(categoria);

    const bloque: Diapositiva[] = [
      {
        tipo: "categoria",
        id: `${categoria.id}:categoria`,
        efecto: "categoria",
        // El nombre del premio y no la pregunta: proyectada se lee "MEJOR
        // ARQUERO", y eso es lo que anuncia un locutor. Leer "¿Quién fue el
        // mejor arquero del año?" en voz alta suena a formulario.
        locucion: { frases: [categoria.nombre], demora: DEMORA_CATEGORIA },
        rotulo: categoria.nombre,
        categoria,
        ...marca,
      },
    ];

    if (opciones.nominados) {
      bloque.push({
        tipo: "nominados",
        id: `${categoria.id}:nominados`,
        efecto: "nominados",
        rotulo: `${categoria.nombre} · nominados`,
        categoria,
        ...marca,
      });
    }

    if (opciones.suspenso) {
      bloque.push({
        tipo: "suspenso",
        id: `${categoria.id}:suspenso`,
        efecto: "redoble",
        rotulo: `${categoria.nombre} · suspenso`,
        categoria,
        ...marca,
      });
    }

    bloque.push({
      tipo: "ganador",
      id: `${categoria.id}:ganador`,
      efecto: "fanfarria",
      // Sin ganadores la placa dice "Sin votos todavía" y la voz se calla: que
      // el locutor anuncie que no hay nada es peor que el silencio.
      locucion: ganadores.length
        ? { frases: ganadores.map((g) => g.texto), demora: DEMORA_GANADOR }
        : undefined,
      rotulo: `${categoria.nombre} · ganador`,
      categoria,
      ganadores,
      ...marca,
    });

    if (opciones.resultados) {
      bloque.push({
        tipo: "resultados",
        id: `${categoria.id}:resultados`,
        efecto: "aplausos",
        rotulo: `${categoria.nombre} · resultados`,
        categoria,
        filas: resultadosDe(categoria),
        ...marca,
      });
    }

    return bloque;
  });

  return [
    { tipo: "standby", id: "standby", efecto: "ninguno", rotulo: "En espera" },
    { tipo: "apertura", id: "apertura", efecto: "apertura", rotulo: "Ya comenzamos" },
    ...cuerpo,
    { tipo: "cierre", id: "cierre", efecto: "cierre", rotulo: "Cierre", entregados: total },
  ];
}
