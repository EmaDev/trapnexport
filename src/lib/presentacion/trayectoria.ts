import type { Balance, ClubIdentity, Era, MilestoneKind } from "@/lib/historia";

/** El guion de la trayectoria: de las etapas de `/historia` a la lista de
 *  viñetas que se proyecta en el modo presentación.
 *
 *  Mismo criterio que `guion.ts`, el de la gala: es un módulo **puro**, sin
 *  `next/*` ni lecturas de base, porque lo ejecuta un componente cliente. Y es
 *  **derivado, no guardado**: la presentación es una función de `ERAS`, así que
 *  agregar un hito a la historia lo mete en la proyección sin tocar nada acá.
 *
 *  `balance` entra por parámetro y no se importa como constante, al revés de
 *  como estaba antes: los cuatro números del cierre se editan en
 *  `/admin/historia` igual que todo lo demás, y una constante importada los
 *  dejaría congelados en lo que decían el día del build.
 *
 *  La diferencia con la gala es qué se aplana. Allá cada categoría abre en
 *  varias placas (nominados, suspenso, ganador, resultados). Acá el desglose es
 *  el de la propia línea de tiempo:
 *
 *    portada   el escudo y las tres estrellas
 *    etapa     la apertura de cada capítulo: foto, años, bajada y números
 *    hito      un hecho puntual dentro de esa etapa
 *    cierre    el balance de finales y "la historia recién empieza"
 *
 *  Una etapa **no** se proyecta sola: cada etapa entra con su placa y detrás
 *  van sus hitos, de modo que el riel avanza dentro del capítulo antes de
 *  saltar al siguiente. Es lo que hace que la barra de progreso se lea como
 *  una línea de tiempo y no como un carrusel de tarjetas sueltas.
 */

/** Cómo se acomoda la proyección en la pantalla del dispositivo.
 *
 *  No es sólo el sentido del riel: cambia también hacia dónde entra la card y
 *  qué orientación se le pide al teléfono en pantalla completa. */
export type Orientacion = "horizontal" | "vertical";

interface VinetaBase {
  id: string;
  /** cómo se nombra en el índice y en el pie del riel */
  rotulo: string;
  /** a qué etapa pertenece: el riel usa esto para agrupar y para el color */
  eraId: string;
  /** el rango de años de esa etapa — el rótulo chico de arriba de la card */
  periodo: string;
  /** el índice de la etapa dentro de `ERAS`, de 0 en adelante */
  etapaIndice: number;
  /** primera viñeta de su etapa: son las únicas que el riel rotula, porque
   *  veintitantas marcas con año cada una no entran en un teléfono */
  abreEtapa: boolean;
}

export interface VinetaPortada extends VinetaBase {
  tipo: "portada";
  titulo: string;
  bajada: string;
  estrellas: number;
}

export interface VinetaEtapa extends VinetaBase {
  tipo: "etapa";
  titulo: string;
  bajada: string;
  cuerpo: string;
  foto: string;
  stats: { label: string; value: string }[];
  /** la etapa que todavía se está jugando */
  actual: boolean;
}

export interface VinetaHito extends VinetaBase {
  tipo: "hito";
  fecha: string;
  titulo: string;
  cuerpo: string;
  kind: MilestoneKind;
}

export interface VinetaCierre extends VinetaBase {
  tipo: "cierre";
  titulo: string;
  bajada: string;
  stats: { label: string; value: string }[];
}

export type Vineta = VinetaPortada | VinetaEtapa | VinetaHito | VinetaCierre;

/** Arma la proyección entera a partir de las etapas.
 *
 *  La portada y el cierre no salen de `ERAS` porque no son parte de la línea de
 *  tiempo: son el marco. Se les da el `eraId` de la primera y la última etapa
 *  para que el riel les dé un color coherente y no una marca huérfana al
 *  principio y al final.
 */
export function armarTrayectoria(
  eras: Era[],
  club: ClubIdentity,
  balance: Balance,
): Vineta[] {
  if (eras.length === 0) return [];

  const primera = eras[0];
  const ultima = eras[eras.length - 1];
  const vinetas: Vineta[] = [];

  vinetas.push({
    id: "portada",
    tipo: "portada",
    rotulo: "Portada",
    eraId: primera.id,
    periodo: `${club.founded} — hoy`,
    etapaIndice: 0,
    abreEtapa: false,
    titulo: club.name,
    bajada: `${eras.length} capítulos, de ${club.founded} a hoy`,
    estrellas: balance.estrellas,
  });

  eras.forEach((era, i) => {
    vinetas.push({
      id: era.id,
      tipo: "etapa",
      rotulo: `${era.period} · ${era.title}`,
      eraId: era.id,
      periodo: era.period,
      etapaIndice: i,
      abreEtapa: true,
      titulo: era.title,
      bajada: era.tagline,
      cuerpo: era.description,
      foto: era.photo,
      stats: era.stats,
      actual: Boolean(era.current),
    });

    for (const hito of era.milestones) {
      vinetas.push({
        id: hito.id,
        tipo: "hito",
        rotulo: hito.title,
        eraId: era.id,
        periodo: era.period,
        etapaIndice: i,
        abreEtapa: false,
        fecha: hito.date,
        titulo: hito.title,
        cuerpo: hito.description,
        kind: hito.kind,
      });
    }
  });

  vinetas.push({
    id: "cierre",
    tipo: "cierre",
    rotulo: "El presente",
    eraId: ultima.id,
    periodo: ultima.period,
    etapaIndice: eras.length - 1,
    abreEtapa: false,
    titulo: "La historia recién empieza",
    bajada: club.motto,
    stats: [
      { label: "Finales", value: String(balance.finales) },
      { label: "Ganadas", value: String(balance.ganadas) },
      { label: "Perdidas", value: String(balance.perdidas) },
      { label: "Estrellas", value: String(balance.estrellas) },
    ],
  });

  return vinetas;
}
