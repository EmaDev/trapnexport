/** Tiempo relativo en español ("hace 2 h").
 *
 *  La librería exporta su propio `relativeTime`, pero su bundle entero está
 *  marcado `"use client"`: importarlo desde un Server Component devuelve una
 *  referencia de cliente, no la función. Como el feed formatea `SocialPost.time`
 *  en el servidor (es un string ya formateado, no un timestamp), la copia vive acá.
 */
const UNITS: [limit: number, div: number, one: string, many: string][] = [
  [60_000, 1_000, "s", "s"],
  [3_600_000, 60_000, "min", "min"],
  [86_400_000, 3_600_000, "h", "h"],
  [604_800_000, 86_400_000, "día", "días"],
  [2_592_000_000, 604_800_000, "sem", "sem"],
  [31_536_000_000, 2_592_000_000, "mes", "meses"],
];

export function relativeTime(at: number | Date, now: number = Date.now()): string {
  const ms = now - (at instanceof Date ? at.getTime() : at);
  if (ms < 45_000) return "recién";

  for (const [limit, div, one, many] of UNITS) {
    if (ms < limit) {
      const n = Math.floor(ms / div);
      return `hace ${n} ${n === 1 ? one : many}`;
    }
  }
  const years = Math.floor(ms / 31_536_000_000);
  return `hace ${years} ${years === 1 ? "año" : "años"}`;
}

/** "14 mar 2024" — para perfiles ("se unió en…") y tablas del admin. */
export function shortDate(at: number | Date): string {
  return new Intl.DateTimeFormat("es-AR", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(at instanceof Date ? at : new Date(at));
}

/** "14/03/2024 18:05" — el admin necesita la hora exacta, no "hace 2 h". */
export function dateTime(at: number | Date): string {
  return new Intl.DateTimeFormat("es-AR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(at instanceof Date ? at : new Date(at));
}

/** "2026-09-12" → `Date` en hora **local**, sin corrimiento de zona.
 *
 *  `new Date("2026-09-12")` parsea el string como UTC medianoche, así que en
 *  Argentina (UTC-3) devuelve el 11 a las 21:00 y todo lo que formatee esa
 *  fecha muestra el día anterior. El constructor por partes no tiene ese
 *  problema. Una hora `"HH:mm"` opcional se aplica encima.
 */
export function fromISODate(iso: string, time?: string): Date {
  const [y, m, d] = iso.split("-").map(Number);
  const [hh, mm] = (time ?? "00:00").split(":").map(Number);
  return new Date(y, (m ?? 1) - 1, d ?? 1, hh || 0, mm || 0);
}

/** "2026-09-12" → "sábado 12 de septiembre de 2026". Para la tarjeta de
 *  invitación, que es lo único donde la fecha es el contenido y no un dato. */
export function longDate(iso: string): string {
  return new Intl.DateTimeFormat("es-AR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(fromISODate(iso));
}

/** "2026-09-12" → "sáb 12 sep". Para tablas y listas del cronograma. */
export function isoShort(iso: string): string {
  return new Intl.DateTimeFormat("es-AR", {
    weekday: "short",
    day: "numeric",
    month: "short",
  }).format(fromISODate(iso));
}

/** "17:30" → 1050. Minutos desde la medianoche del día del evento.
 *
 *  Es la unidad con la que se ordena y se cruza el cronograma: como todo pasa
 *  el mismo día, comparar dos eventos es comparar dos números, sin `Date` ni
 *  zona horaria de por medio. */
export function minutosDeHora(hora: string): number {
  const [h, m] = hora.split(":").map(Number);
  return (h || 0) * 60 + (m || 0);
}

/** "21:00" + 240 → `{ hora: "01:00", diaSiguiente: true }`.
 *
 *  El cronograma es de un solo día, pero un evento puede terminar pasada la
 *  medianoche: la cena de aniversario que arranca a las 21 y dura cuatro horas
 *  sigue siendo del día del evento. Devolver el cruce aparte —en vez de sumar
 *  un día a la fecha— es lo que deja mostrarla como "01:00 (+1)" y no como un
 *  evento que se mudó de día. */
export function horaMas(
  hora: string,
  minutos: number,
): { hora: string; diaSiguiente: boolean } {
  const total = minutosDeHora(hora) + minutos;
  const p = (n: number) => String(n).padStart(2, "0");
  return {
    hora: `${p(Math.floor(total / 60) % 24)}:${p(((total % 60) + 60) % 60)}`,
    diaSiguiente: total >= 1440,
  };
}

/** "14:32" — la hora suelta de un mensaje del chat. */
export function clockTime(at: number | Date): string {
  return new Intl.DateTimeFormat("es-AR", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(at instanceof Date ? at : new Date(at));
}

/** "Hoy 14:32", "Ayer 09:05", "12 sept 14:32", "12 sept 2024 14:32".
 *
 *  El sello que separa tandas de mensajes en el hilo. Es la hora *y* el día
 *  porque un hilo de chat se lee de una: sin el día, dos mensajes con "14:32"
 *  separados por una semana parecen seguidos.
 *
 *  Depende de la zona horaria de quien mira, así que en SSR el servidor
 *  —UTC— y el navegador pueden escribir cosas distintas. Quien lo pinta lleva
 *  `suppressHydrationWarning`: **qué** mensajes llevan sello se decide por la
 *  diferencia entre timestamps, que no depende de la zona, así que lo único
 *  que puede diferir es el texto.
 */
export function chatStamp(at: number | Date, now: number = Date.now()): string {
  const d = at instanceof Date ? at : new Date(at);
  const hoy = new Date(now);
  const ayer = new Date(now);
  ayer.setDate(hoy.getDate() - 1);

  const mismoDia = (a: Date, b: Date) =>
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate();

  if (mismoDia(d, hoy)) return `Hoy ${clockTime(d)}`;
  if (mismoDia(d, ayer)) return `Ayer ${clockTime(d)}`;

  const fecha = new Intl.DateTimeFormat("es-AR", {
    day: "numeric",
    month: "short",
    // El año sólo cuando no es este: en un chat activo sería ruido en cada sello.
    ...(d.getFullYear() === hoy.getFullYear() ? {} : { year: "numeric" }),
  }).format(d);

  return `${fecha} ${clockTime(d)}`;
}
