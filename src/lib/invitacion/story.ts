import type { PlantillaInvitacion } from "@/lib/contenido/types";

/** La invitación dibujada como imagen 1080×1920, para mandarla a Instagram.
 *
 *  Instagram no se puede compartir como un link: no hay intent web que suba una
 *  story, y `wa.me` no tiene equivalente. Lo único que funciona de verdad desde
 *  el navegador es entregarle un **archivo** al sistema —`navigator.share` con
 *  `files`, que en el celular abre la hoja nativa con Instagram adentro— o, si
 *  eso no está, bajar el PNG para que la persona lo suba a mano. Las dos
 *  necesitan la misma imagen, y por eso existe este módulo.
 *
 *  Se dibuja a mano en un canvas y no se captura el DOM de la tarjeta. Capturar
 *  el DOM pide `html2canvas` (una dependencia entera para una sola pantalla),
 *  falla con los degradés y los filtros de los efectos, y ese recorte igual
 *  saldría en 3:4 o 4:5 y no en el 9:16 vertical que es lo único que Instagram
 *  muestra a pantalla completa. Acá el formato es el punto de partida.
 *
 *  El único recurso externo es el escudo, que es un SVG de `public/` — mismo
 *  origen y sin `foreignObject`, así que no ensucia el canvas y `toBlob` sigue
 *  funcionando.
 */

export interface StoryInput {
  invitado: string;
  titulo: string;
  mensaje: string;
  /** ya formateado: "sábado 12 de septiembre · 21:00 h" */
  cuando: string;
  lugar: string;
  plantilla: PlantillaInvitacion;
  club: string;
  /** ruta del escudo, la misma que usa la tarjeta */
  crest: string;
  /** el link de la invitación, que va al pie */
  url: string;
}

const W = 1080;
const H = 1920;

/* ── paleta ──────────────────────────────────────────────────────────────── */

/** Los tres esquemas, uno por plantilla.
 *
 *  Los colores están escritos acá y no leídos de las variables CSS a propósito:
 *  la story se ve sobre el fondo de Instagram, no sobre el de la app, y no
 *  puede cambiar de claro a oscuro según el tema del que la comparte. La
 *  invitación de Marta tiene que salir igual desde los dos.
 */
const ESQUEMAS: Record<
  PlantillaInvitacion,
  { fondo: [string, string]; texto: string; suave: string; tenue: string; regla: string }
> = {
  gala: {
    fondo: ["#0a0a0a", "#50108b"],
    texto: "#ffffff",
    suave: "rgba(255,255,255,0.82)",
    tenue: "rgba(255,255,255,0.55)",
    regla: "rgba(255,255,255,0.22)",
  },
  cancha: {
    fondo: ["#1a0630", "#050505"],
    texto: "#ffffff",
    suave: "rgba(255,255,255,0.85)",
    tenue: "rgba(255,255,255,0.58)",
    regla: "rgba(255,255,255,0.26)",
  },
  minima: {
    fondo: ["#ffffff", "#f0e9f7"],
    texto: "#0a0a0a",
    suave: "#3d3d3d",
    tenue: "#6b6b6b",
    regla: "#d9cfe6",
  },
};

/* ── tipografía ──────────────────────────────────────────────────────────── */

/** La misma familia que la página, leída del documento en vez de escrita acá.
 *  `next/font` genera el nombre de la familia en el build (`__Inter_xxxxx`): un
 *  `"Inter"` a mano en el canvas dibujaría con la fuente del sistema y la
 *  imagen no se parecería a la vista previa. */
const familia = () => {
  const desde = document.body ? getComputedStyle(document.body).fontFamily : "";
  return desde || "system-ui, sans-serif";
};

const fuente = (px: number, peso = 400) => `${peso} ${px}px ${familia()}`;

/** Corta el texto en líneas que entran en `max`, hasta `maxLineas`. Lo que
 *  sobra se descarta con puntos suspensivos: una story con el mensaje cortado
 *  al final es mejor que una con el texto pisando la fecha. */
function envolver(
  ctx: CanvasRenderingContext2D,
  texto: string,
  max: number,
  maxLineas: number,
): string[] {
  const palabras = texto.split(/\s+/).filter(Boolean);
  const lineas: string[] = [];
  let actual = "";
  let sobra = false;

  for (const palabra of palabras) {
    const tentativa = actual ? `${actual} ${palabra}` : palabra;
    if (ctx.measureText(tentativa).width <= max || !actual) {
      actual = tentativa;
      continue;
    }
    if (lineas.length === maxLineas - 1) {
      sobra = true;
      break;
    }
    lineas.push(actual);
    actual = palabra;
  }

  if (actual) lineas.push(actual);
  if (sobra && lineas.length) {
    lineas[lineas.length - 1] = `${lineas[lineas.length - 1].replace(/[.,;:]$/, "")}…`;
  }
  return lineas;
}

/** Achica la fuente hasta que el texto entra en `maxLineas`. El nombre del
 *  invitado es lo más grande de la imagen y también lo único de largo
 *  impredecible: sin esto, "Ana" y "María de los Ángeles Etchegoyen" comparten
 *  cuerpo y la segunda se come media story. */
function ajustar(
  ctx: CanvasRenderingContext2D,
  texto: string,
  max: number,
  maxLineas: number,
  desde: number,
  hasta: number,
  peso: number,
): { lineas: string[]; px: number } {
  for (let px = desde; px > hasta; px -= 4) {
    ctx.font = fuente(px, peso);
    const lineas = envolver(ctx, texto, max, maxLineas + 1);
    if (lineas.length <= maxLineas) return { lineas, px };
  }
  ctx.font = fuente(hasta, peso);
  return { lineas: envolver(ctx, texto, max, maxLineas), px: hasta };
}

/** Texto con espaciado entre letras, dibujado carácter por carácter.
 *
 *  `ctx.letterSpacing` existe pero recién desde Chrome 99 y Safari 17, y los
 *  rótulos —CUÁNDO, DÓNDE, el nombre del club— dependen del tracking para
 *  leerse como rótulos y no como texto chiquito. Char por char anda en todos
 *  lados y son cuatro palabras por imagen: el costo es nulo. */
function trackeado(
  ctx: CanvasRenderingContext2D,
  texto: string,
  cx: number,
  y: number,
  espacio: number,
) {
  const chars = [...texto];
  const ancho =
    chars.reduce((t, ch) => t + ctx.measureText(ch).width, 0) + espacio * (chars.length - 1);
  const anterior = ctx.textAlign;
  ctx.textAlign = "left";
  let x = cx - ancho / 2;
  for (const ch of chars) {
    ctx.fillText(ch, x, y);
    x += ctx.measureText(ch).width + espacio;
  }
  ctx.textAlign = anterior;
}

/* ── esperas con techo ───────────────────────────────────────────────────── */

/** Espera `promesa`, pero nunca más de `techoMs`.
 *
 *  Las dos esperas de este módulo son por recursos del navegador —las fuentes
 *  y el escudo— y ninguna de las dos tiene garantizado un final: un `Image`
 *  cuyo `onload` no llega tampoco dispara `onerror`, y `document.fonts.ready`
 *  depende de que no queden cargas en curso. Una promesa así no falla, se
 *  queda: sin excepción, sin nada en consola y con el botón de Instagram en
 *  "Preparando…" para siempre. El techo convierte ese caso en una story un
 *  poco peor, que es un final.
 *
 *  Vencerse **no** es un error. Sin la fuente, `measureText` mide con la de
 *  respaldo y el texto queda un poco más suelto; sin el escudo, la story sale
 *  sin logo. Las dos son mejores que no tener imagen.
 */
function conTecho<T>(promesa: Promise<T>, techoMs: number): Promise<T | null> {
  return Promise.race([
    promesa,
    new Promise<null>((resolver) => setTimeout(() => resolver(null), techoMs)),
  ]);
}

/* ── el escudo ───────────────────────────────────────────────────────────── */

/** `escudo.svg` declara `viewBox` pero no `width`/`height`, y un SVG sin tamaño
 *  intrínseco puede llegar a `drawImage` con `naturalWidth` en 0. Darle medidas
 *  al `Image` antes de asignarle el `src` se las fija, y el `drawImage` de
 *  abajo pasa además destino explícito. Si el escudo no carga, la story sale
 *  sin él: quedarse sin imagen por un logo sería peor. */
function cargarEscudo(src: string, lado: number): Promise<HTMLImageElement | null> {
  return conTecho(
    new Promise<HTMLImageElement | null>((resolve) => {
      const img = new Image(lado, lado);
      img.onload = () => resolve(img);
      img.onerror = () => resolve(null);
      img.src = src;
    }),
    2000,
  );
}

/* ── el dibujo ───────────────────────────────────────────────────────────── */

/** El fondo de cada plantilla. Es la parte que las distingue: la retícula de
 *  abajo es la misma en las tres, para que la información caiga siempre en el
 *  mismo lugar y la story se lea igual sin importar el diseño elegido. */
function fondo(ctx: CanvasRenderingContext2D, plantilla: PlantillaInvitacion) {
  const c = ESQUEMAS[plantilla];

  const g = ctx.createLinearGradient(0, 0, W * 0.4, H);
  g.addColorStop(0, c.fondo[0]);
  g.addColorStop(1, c.fondo[1]);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);

  if (plantilla === "cancha") {
    // El reflector, el mismo recurso que usa `photoUrl` para las fotos de
    // archivo: sin él, el degradé plano no se lee como un estadio de noche.
    const luz = ctx.createRadialGradient(W * 0.72, 260, 0, W * 0.72, 260, 720);
    luz.addColorStop(0, "rgba(180,120,240,0.42)");
    luz.addColorStop(1, "rgba(180,120,240,0)");
    ctx.fillStyle = luz;
    ctx.fillRect(0, 0, W, H);

    ctx.strokeStyle = "rgba(255,255,255,0.10)";
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.arc(W / 2, H - 120, 360, Math.PI, 2 * Math.PI);
    ctx.stroke();
  }

  if (plantilla === "gala") {
    const halo = ctx.createRadialGradient(W / 2, H * 0.42, 0, W / 2, H * 0.42, 820);
    halo.addColorStop(0, "rgba(255,255,255,0.10)");
    halo.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = halo;
    ctx.fillRect(0, 0, W, H);
  }

  if (plantilla === "minima") {
    ctx.fillStyle = "rgba(80,16,139,0.07)";
    ctx.beginPath();
    ctx.arc(W - 60, 180, 320, 0, 2 * Math.PI);
    ctx.fill();
  }

  // El filete: en gala es el marco de la tarjeta, en las otras dos ordena la
  // composición contra los bordes del teléfono.
  ctx.strokeStyle = c.regla;
  ctx.lineWidth = 3;
  ctx.strokeRect(56, 56, W - 112, H - 112);
}

/** Dibuja la invitación y devuelve el PNG. */
export async function renderStory(inv: StoryInput): Promise<Blob | null> {
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;

  // Sin esto la primera story sale con la fuente del sistema: `next/font` la
  // carga async y `measureText` mide con la de respaldo hasta que resuelve.
  // Con techo: ver `conTecho`.
  if (document.fonts) await conTecho(document.fonts.ready, 1500);

  const c = ESQUEMAS[inv.plantilla];
  const margen = 128;
  const ancho = W - margen * 2;
  const cx = W / 2;

  fondo(ctx, inv.plantilla);
  ctx.textAlign = "center";
  ctx.textBaseline = "alphabetic";

  // El bloque de arriba arranca a 380 y no pegado al borde: el de abajo está
  // anclado al pie, y con el escudo a 180 la composición quedaba toda cargada
  // arriba con un hueco muerto en el medio de la story.
  let y = 380;

  const escudo = await cargarEscudo(inv.crest, 200);
  if (escudo) ctx.drawImage(escudo, cx - 100, y - 200, 200, 200);
  y += 76;

  ctx.fillStyle = c.tenue;
  ctx.font = fuente(30, 600);
  trackeado(ctx, `${inv.club.toUpperCase()} INVITA A`, cx, y, 10);
  y += 128;

  // El nombre. Es lo único que hace suya la invitación y por eso manda la
  // composición: todo lo de abajo se acomoda a las líneas que ocupe.
  const nombre = ajustar(ctx, inv.invitado, ancho, 3, 116, 56, 700);
  ctx.fillStyle = c.texto;
  for (const linea of nombre.lineas) {
    ctx.fillText(linea, cx, y);
    y += nombre.px * 1.12;
  }
  y += 40;

  const titulo = ajustar(ctx, inv.titulo, ancho, 2, 58, 36, 600);
  ctx.fillStyle = c.texto;
  for (const linea of titulo.lineas) {
    ctx.fillText(linea, cx, y);
    y += titulo.px * 1.28;
  }
  y += 24;

  if (inv.mensaje) {
    ctx.font = fuente(36, 400);
    ctx.fillStyle = c.suave;
    for (const linea of envolver(ctx, inv.mensaje, ancho - 40, 4)) {
      ctx.fillText(linea, cx, y);
      y += 52;
    }
  }

  // El bloque de cuándo y dónde va anclado al pie y no debajo del mensaje: es
  // el dato que el invitado vuelve a mirar, y con el nombre y el mensaje de
  // largo variable, dejarlo flotar lo movería de altura en cada invitación.
  const pie = H - 300;
  ctx.strokeStyle = c.regla;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(margen, pie - 190);
  ctx.lineTo(W - margen, pie - 190);
  ctx.stroke();

  // Estos dos van en **una** línea y por eso se achican en vez de cortarse:
  // son los dos datos que el invitado va a mirar dos veces, y una fecha que
  // termina en "21:00…" es peor que una fecha cuatro puntos más chica. El piso
  // de 26 px alcanza para la fecha larga en castellano con el lugar completo.
  const linea = (texto: string, py: number) => {
    const { lineas, px } = ajustar(ctx, texto, ancho, 1, 40, 26, 600);
    ctx.font = fuente(px, 600);
    ctx.fillText(lineas[0] ?? "", cx, py);
  };

  ctx.fillStyle = c.tenue;
  ctx.font = fuente(24, 600);
  trackeado(ctx, "CUÁNDO", cx, pie - 130, 8);
  ctx.fillStyle = c.texto;
  // `longDate` devuelve el día en minúscula ("sábado, 19 de…"), que es lo
  // correcto en medio de una oración y no al principio de una línea. La tarjeta
  // lo arregla con `first-letter:uppercase`; el canvas no tiene CSS.
  linea(inv.cuando.charAt(0).toUpperCase() + inv.cuando.slice(1), pie - 78);

  if (inv.lugar) {
    ctx.fillStyle = c.tenue;
    ctx.font = fuente(24, 600);
    trackeado(ctx, "DÓNDE", cx, pie - 18, 8);
    ctx.fillStyle = c.texto;
    linea(inv.lugar, pie + 34);
  }

  ctx.fillStyle = c.tenue;
  ctx.font = fuente(26, 500);
  ctx.fillText(inv.url.replace(/^https?:\/\//, ""), cx, H - 140);

  return new Promise((resolve) => canvas.toBlob((b) => resolve(b), "image/png"));
}
