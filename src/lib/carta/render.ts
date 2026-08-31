import { PALETAS, type CartaVM, type EstiloCarta } from "@/lib/carta/carta";

/** La carta dibujada como PNG 1080×1920, para compartirla.
 *
 *  Mismo criterio que `lib/invitacion/story.ts`, y por las mismas razones:
 *
 *  - **Se dibuja a mano, no se captura el DOM.** Capturar pide `html2canvas`
 *    —una dependencia entera— y aun así falla con los degradés, los
 *    `mix-blend-mode` y el `transform` 3D del efecto holográfico, que es
 *    justamente lo que hace que la carta se vea como se ve.
 *  - **9:16 y no el recorte de la carta.** Instagram muestra a pantalla
 *    completa el vertical; una carta 3:4 recortada sale con dos franjas grises.
 *    Acá el formato es el punto de partida y la carta va centrada, sobre un
 *    fondo del mismo estilo.
 *
 *  Lo único que cambia respecto de la story de la invitación es qué se dibuja.
 *  Las esperas con techo, la familia tipográfica leída del documento y la carga
 *  del escudo son el mismo problema resuelto igual — están duplicadas y no
 *  extraídas a propósito: son quince líneas y compartir un módulo ataría dos
 *  pantallas que no tienen ninguna otra relación.
 */

const W = 1080;
const H = 1920;

/* La carta dentro del lienzo. Deja aire arriba para el rótulo del club y abajo
   para el handle, que es lo que hace que la imagen se lea como una pieza y no
   como un recorte. */
const CW = 820;
const CH = 1180;
const CX = (W - CW) / 2;
const CY = 300;
/** El redondeo de las esquinas. Lo usan el relleno, el recorte de la foto a
 *  sangre y el filete, y los tres tienen que coincidir o el borde queda con un
 *  hilo del color de abajo asomando en las esquinas. */
const R = 56;

/* ── tipografía y esperas ────────────────────────────────────────────────── */

/** La familia de la página, leída del documento. `next/font` genera el nombre
 *  en el build (`__Inter_xxxxx`): un `"Inter"` escrito a mano dibujaría con la
 *  fuente del sistema y el PNG no se parecería a la carta de la pantalla. */
const familia = () => {
  const desde = document.body ? getComputedStyle(document.body).fontFamily : "";
  return desde || "system-ui, sans-serif";
};

const fuente = (px: number, peso = 400) => `${peso} ${px}px ${familia()}`;

/** Espera `promesa`, pero nunca más de `techoMs`. Las dos esperas de acá —las
 *  fuentes y las imágenes— pueden quedarse sin resolver ni fallar, y sin techo
 *  el botón de compartir se queda en "Preparando…" para siempre. Vencerse no
 *  es un error: la carta sale con la fuente de respaldo o sin escudo, que es
 *  mejor que no salir. */
function conTecho<T>(promesa: Promise<T>, techoMs: number): Promise<T | null> {
  return Promise.race([
    promesa,
    new Promise<null>((r) => setTimeout(() => r(null), techoMs)),
  ]);
}

/** Carga una imagen para el canvas. Todas las de esta pantalla son del mismo
 *  origen (`/escudo.svg`) o data-URI (el avatar, generado o subido), así que
 *  ninguna ensucia el canvas y `toBlob` sigue funcionando. El `Image(lado,
 *  lado)` es por el escudo: declara `viewBox` pero no `width`/`height`, y un
 *  SVG sin tamaño intrínseco puede llegar a `drawImage` con `naturalWidth` 0. */
function cargarImagen(src: string, lado: number): Promise<HTMLImageElement | null> {
  return conTecho(
    new Promise<HTMLImageElement | null>((resolve) => {
      const img = new Image(lado, lado);
      img.onload = () => resolve(img);
      img.onerror = () => resolve(null);
      img.src = src;
    }),
    2500,
  );
}

/* ── primitivas de dibujo ────────────────────────────────────────────────── */

/** Rectángulo redondeado. `roundRect` existe desde Chrome 99 / Safari 16, y
 *  todavía hay teléfonos abajo de eso: el respaldo dibuja el mismo camino con
 *  arcos y evita que la carta salga con las esquinas en punta. */
function camino(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  if (typeof ctx.roundRect === "function") {
    ctx.roundRect(x, y, w, h, r);
    return;
  }
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

/** Texto con espaciado entre letras, char por char. `ctx.letterSpacing` es de
 *  Chrome 99 / Safari 17, y los rótulos de la carta —el puesto, el nombre del
 *  club, las siglas— dependen del tracking para leerse como rótulos. */
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
  const previo = ctx.textAlign;
  ctx.textAlign = "left";
  let x = cx - ancho / 2;
  for (const ch of chars) {
    ctx.fillText(ch, x, y);
    x += ctx.measureText(ch).width + espacio;
  }
  ctx.textAlign = previo;
}

/** Igual que `trackeado` pero alineado a la izquierda desde `x`. La cara de
 *  retrato alinea todo su bloque contra el margen izquierdo, y centrar los
 *  rótulos ahí los dejaría fuera de eje con el nombre. */
function trackeadoIzq(
  ctx: CanvasRenderingContext2D,
  texto: string,
  x: number,
  y: number,
  espacio: number,
) {
  const previo = ctx.textAlign;
  ctx.textAlign = "left";
  let cursor = x;
  for (const ch of [...texto]) {
    ctx.fillText(ch, cursor, y);
    cursor += ctx.measureText(ch).width + espacio;
  }
  ctx.textAlign = previo;
}

/** Achica la fuente hasta que el texto entra en una línea de `max`. El nombre
 *  es lo más grande de la carta y lo único de largo impredecible: sin esto,
 *  "Naza" y "Santiago Del Valle" comparten cuerpo y el segundo se sale. */
function ajustar(
  ctx: CanvasRenderingContext2D,
  texto: string,
  max: number,
  desde: number,
  hasta: number,
  peso: number,
): number {
  for (let px = desde; px > hasta; px -= 2) {
    ctx.font = fuente(px, peso);
    if (ctx.measureText(texto).width <= max) return px;
  }
  ctx.font = fuente(hasta, peso);
  return hasta;
}

/* ── el dibujo ───────────────────────────────────────────────────────────── */

function fondoLienzo(ctx: CanvasRenderingContext2D, estilo: EstiloCarta) {
  const p = PALETAS[estilo];

  // El lienzo va SIEMPRE oscuro, también en la carta dorada: el fondo es lo
  // que rodea a la carta en la story, y un dorado sobre dorado la haría
  // desaparecer. Lo que cambia es el halo de atrás, que sí es del estilo.
  const g = ctx.createLinearGradient(0, 0, W * 0.3, H);
  g.addColorStop(0, "#12031f");
  g.addColorStop(1, "#050505");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);

  const halo = ctx.createRadialGradient(W / 2, CY + CH / 2, 0, W / 2, CY + CH / 2, 780);
  halo.addColorStop(0, p.halo);
  halo.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = halo;
  ctx.fillRect(0, 0, W, H);
}


/** El cuerpo de la carta: degradé y filete exterior. Las tres caras lo llaman
 *  antes de dibujar lo suyo — es el equivalente del `Marco` de `PlayerCard`. */
function cuerpo(ctx: CanvasRenderingContext2D, estilo: EstiloCarta) {
  const p = PALETAS[estilo];

  const g = ctx.createLinearGradient(CX, CY, CX + CW * 0.35, CY + CH);
  g.addColorStop(0, p.fondo[0]);
  g.addColorStop(0.52, p.fondo[1]);
  g.addColorStop(1, p.fondo[2]);

  camino(ctx, CX, CY, CW, CH, R);
  ctx.fillStyle = g;
  ctx.fill();
}

/** El filete exterior. Va DESPUÉS del contenido: en la cara de retrato la foto
 *  llega hasta el borde y taparía el filete si se dibujara antes. */
function filete(ctx: CanvasRenderingContext2D, estilo: EstiloCarta) {
  camino(ctx, CX, CY, CW, CH, R);
  ctx.strokeStyle = PALETAS[estilo].filete;
  ctx.lineWidth = 6;
  ctx.stroke();
}

/** El brillo especular en diagonal: la versión quieta del barrido que en la
 *  pantalla cruza la carta cada seis segundos y medio. Congelado en diagonal es
 *  como se ve una carta en una foto. */
function lustre(ctx: CanvasRenderingContext2D) {
  ctx.save();
  camino(ctx, CX, CY, CW, CH, R);
  ctx.clip();
  const g = ctx.createLinearGradient(CX, CY + CH, CX + CW, CY);
  g.addColorStop(0, "rgba(255,255,255,0)");
  g.addColorStop(0.46, "rgba(255,255,255,0)");
  g.addColorStop(0.54, "rgba(255,255,255,0.16)");
  g.addColorStop(0.62, "rgba(255,255,255,0)");
  ctx.fillStyle = g;
  ctx.fillRect(CX, CY, CW, CH);
  ctx.restore();
}

/** Dibuja `img` cubriendo el rectángulo, recortando el sobrante — el `object-fit:
 *  cover` de CSS, que el canvas no tiene. Sin esto una foto apaisada sale
 *  estirada en una carta vertical. */
function cubrir(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  x: number,
  y: number,
  w: number,
  h: number,
) {
  const iw = img.naturalWidth || w;
  const ih = img.naturalHeight || h;
  const escala = Math.max(w / iw, h / ih);
  const dw = iw * escala;
  const dh = ih * escala;
  ctx.drawImage(img, x + (w - dw) / 2, y + (h - dh) / 2, dw, dh);
}

/** El pie con los datos de la ficha, en una línea. Se achica hasta entrar: es
 *  información secundaria y vale más que la carta cierre bien. */
function pieDatos(ctx: CanvasRenderingContext2D, carta: CartaVM, color: string, y: number) {
  if (carta.pieDatos.length === 0) return;
  const linea = carta.pieDatos.map((d) => d.valor).join("  ·  ");
  const px = ajustar(ctx, linea, CW - 120, 30, 18, 500);
  ctx.font = fuente(px, 500);
  ctx.fillStyle = color;
  ctx.textAlign = "center";
  ctx.fillText(linea, CX + CW / 2, y);
}

/* ── clásica ─────────────────────────────────────────────────────────────── */

function dibujarClasica(
  ctx: CanvasRenderingContext2D,
  carta: CartaVM,
  avatar: HTMLImageElement | null,
) {
  const p = PALETAS.clasica;
  cuerpo(ctx, "clasica");
  lustre(ctx);

  // El filete interior: es lo que hace que se lea como acuñada.
  camino(ctx, CX + 18, CY + 18, CW - 36, CH - 36, R - 14);
  ctx.strokeStyle = p.regla;
  ctx.lineWidth = 2;
  ctx.stroke();

  /* Retrato redondo a la derecha. */
  const rr = 168;
  const rcx = CX + CW - 268;
  const rcy = CY + 250;
  ctx.save();
  ctx.beginPath();
  ctx.arc(rcx, rcy, rr, 0, 2 * Math.PI);
  ctx.clip();
  ctx.fillStyle = "rgba(0,0,0,0.25)";
  ctx.fillRect(rcx - rr, rcy - rr, rr * 2, rr * 2);
  if (avatar) cubrir(ctx, avatar, rcx - rr, rcy - rr, rr * 2, rr * 2);
  ctx.restore();
  ctx.beginPath();
  ctx.arc(rcx, rcy, rr, 0, 2 * Math.PI);
  ctx.strokeStyle = p.filete;
  ctx.lineWidth = 5;
  ctx.stroke();

  /* General, puesto y dorsal a la izquierda: lo primero que se mira. */
  const bx = CX + 178;
  ctx.textAlign = "center";
  ctx.fillStyle = p.texto;
  ctx.font = fuente(158, 800);
  ctx.fillText(String(carta.general), bx, CY + 248);

  ctx.font = fuente(46, 700);
  trackeado(ctx, carta.puesto, bx, CY + 318, 6);

  if (carta.dorsal) {
    ctx.strokeStyle = p.regla;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(bx - 78, CY + 356);
    ctx.lineTo(bx + 78, CY + 356);
    ctx.stroke();

    ctx.fillStyle = p.suave;
    ctx.font = fuente(40, 600);
    ctx.fillText(`#${carta.dorsal}`, bx, CY + 414);
  }

  /* Nombre, cruzando la carta bajo el retrato. */
  const cx = CX + CW / 2;
  let y = CY + 560;

  if (tieneApodo(carta)) {
    ctx.fillStyle = p.suave;
    ctx.font = fuente(30, 600);
    trackeado(ctx, carta.apodo.toUpperCase(), cx, y, 8);
    y += 62;
  }

  const npx = ajustar(ctx, carta.nombre.toUpperCase(), CW - 140, 82, 40, 800);
  ctx.fillStyle = p.texto;
  ctx.font = fuente(npx, 800);
  ctx.fillText(carta.nombre.toUpperCase(), cx, y);
  y += 46;

  ctx.strokeStyle = p.regla;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(CX + 90, y);
  ctx.lineTo(CX + CW - 90, y);
  ctx.stroke();

  /* Los seis, en dos columnas de tres. */
  y += 90;
  const colA = CX + CW * 0.3;
  const colB = CX + CW * 0.7;

  carta.atributos.forEach((a, i) => {
    const col = i < 3 ? colA : colB;
    const fila = y + (i % 3) * 92;

    ctx.textAlign = "right";
    ctx.fillStyle = p.texto;
    ctx.font = fuente(58, 800);
    ctx.fillText(String(a.valor), col + 12, fila);

    ctx.textAlign = "left";
    ctx.fillStyle = p.suave;
    ctx.font = fuente(32, 600);
    ctx.fillText(a.sigla, col + 30, fila);
  });

  pieDatos(ctx, carta, p.suave, CY + CH - 74);
  filete(ctx, "clasica");
}

/* ── retrato ─────────────────────────────────────────────────────────────── */

function dibujarRetrato(
  ctx: CanvasRenderingContext2D,
  carta: CartaVM,
  avatar: HTMLImageElement | null,
) {
  const p = PALETAS.retrato;
  cuerpo(ctx, "retrato");

  ctx.save();
  camino(ctx, CX, CY, CW, CH, R);
  ctx.clip();

  /* La foto a sangre. */
  if (avatar) cubrir(ctx, avatar, CX, CY, CW, CH);

  /* Los dos velos. Sin ellos, un texto blanco sobre una foto clara no llega a
     contraste en ningún lado, y el avatar puede ser cualquier foto subida. */
  const abajo = ctx.createLinearGradient(0, CY + CH, 0, CY + CH * 0.4);
  abajo.addColorStop(0, "rgba(0,0,0,0.93)");
  abajo.addColorStop(0.45, "rgba(0,0,0,0.72)");
  abajo.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = abajo;
  ctx.fillRect(CX, CY + CH * 0.4, CW, CH * 0.6);

  const arriba = ctx.createLinearGradient(0, CY, 0, CY + CH / 3);
  arriba.addColorStop(0, "rgba(0,0,0,0.62)");
  arriba.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = arriba;
  ctx.fillRect(CX, CY, CW, CH / 3);

  ctx.restore();
  lustre(ctx);

  /* General y puesto, arriba a la izquierda, sobre la foto. */
  ctx.textAlign = "left";
  ctx.fillStyle = p.texto;
  ctx.font = fuente(132, 800);
  ctx.fillText(String(carta.general), CX + 62, CY + 190);

  ctx.fillStyle = p.filete;
  ctx.font = fuente(40, 700);
  trackeadoIzq(ctx, carta.puesto, CX + 66, CY + 246, 8);

  /* Dorsal, en su redondel arriba a la derecha. */
  if (carta.dorsal) {
    const dcx = CX + CW - 118;
    const dcy = CY + 130;
    ctx.beginPath();
    ctx.arc(dcx, dcy, 50, 0, 2 * Math.PI);
    ctx.fillStyle = "rgba(0,0,0,0.45)";
    ctx.fill();
    ctx.strokeStyle = p.filete;
    ctx.lineWidth = 3;
    ctx.stroke();

    ctx.textAlign = "center";
    ctx.fillStyle = p.texto;
    ctx.font = fuente(42, 700);
    ctx.fillText(String(carta.dorsal), dcx, dcy + 15);
  }

  /* El bloque de abajo, anclado al pie: apodo, nombre, la fila de seis y los
     datos. Va anclado y no fluyendo porque el nombre es de largo variable y
     dejarlo flotar movería la fila de atributos en cada carta. */
  const base = CY + CH - 96;

  pieDatos(ctx, carta, p.suave, base + 32);

  ctx.textAlign = "center";
  carta.atributos.forEach((a, i) => {
    // Seis columnas iguales, con el número arriba de la sigla: seis pares en
    // línea no entran de otra forma.
    const col = CX + 72 + (i + 0.5) * ((CW - 144) / 6);
    ctx.fillStyle = p.texto;
    ctx.font = fuente(46, 800);
    ctx.fillText(String(a.valor), col, base - 44);
    ctx.fillStyle = p.suave;
    ctx.font = fuente(24, 700);
    ctx.fillText(a.sigla, col, base - 8);
  });

  ctx.strokeStyle = p.regla;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(CX + 72, base - 106);
  ctx.lineTo(CX + CW - 72, base - 106);
  ctx.stroke();

  ctx.textAlign = "left";
  const npx = ajustar(ctx, carta.nombre.toUpperCase(), CW - 144, 76, 36, 800);
  ctx.fillStyle = p.texto;
  ctx.font = fuente(npx, 800);
  ctx.fillText(carta.nombre.toUpperCase(), CX + 72, base - 148);

  if (tieneApodo(carta)) {
    ctx.fillStyle = p.filete;
    ctx.font = fuente(26, 600);
    trackeadoIzq(ctx, carta.apodo.toUpperCase(), CX + 74, base - 200, 8);
  }

  filete(ctx, "retrato");
}

/* ── ficha ───────────────────────────────────────────────────────────────── */

function dibujarFicha(
  ctx: CanvasRenderingContext2D,
  carta: CartaVM,
  avatar: HTMLImageElement | null,
) {
  const p = PALETAS.ficha;
  cuerpo(ctx, "ficha");
  lustre(ctx);

  const m = CX + 68;
  const der = CX + CW - 68;

  /* Encabezado: retrato chico, nombre y puesto, y el general encuadrado. */
  const lado = 132;
  ctx.save();
  camino(ctx, m, CY + 84, lado, lado, 26);
  ctx.clip();
  ctx.fillStyle = "rgba(255,255,255,0.08)";
  ctx.fillRect(m, CY + 84, lado, lado);
  if (avatar) cubrir(ctx, avatar, m, CY + 84, lado, lado);
  ctx.restore();
  camino(ctx, m, CY + 84, lado, lado, 26);
  ctx.strokeStyle = p.filete;
  ctx.lineWidth = 2;
  ctx.stroke();

  /* El general, chico y encuadrado: acá es un dato más, no el titular. */
  const gw = 128;
  const gh = 118;
  camino(ctx, der - gw, CY + 90, gw, gh, 18);
  ctx.strokeStyle = p.filete;
  ctx.lineWidth = 2;
  ctx.stroke();

  ctx.textAlign = "center";
  ctx.fillStyle = p.texto;
  ctx.font = fuente(62, 800);
  ctx.fillText(String(carta.general), der - gw / 2, CY + 158);
  ctx.fillStyle = p.suave;
  ctx.font = fuente(20, 700);
  trackeado(ctx, "GEN", der - gw / 2, CY + 188, 6);

  ctx.textAlign = "left";
  const anchoNombre = der - gw - m - lado - 60;
  const npx = ajustar(ctx, carta.nombre.toUpperCase(), anchoNombre, 46, 24, 800);
  ctx.fillStyle = p.texto;
  ctx.font = fuente(npx, 800);
  ctx.fillText(carta.nombre.toUpperCase(), m + lado + 28, CY + 146);

  ctx.fillStyle = p.suave;
  ctx.font = fuente(24, 600);
  const sub = carta.dorsal ? `${carta.puestoLargo} · #${carta.dorsal}` : carta.puestoLargo;
  ctx.fillText(sub, m + lado + 28, CY + 186);

  const regla = (y: number) => {
    ctx.strokeStyle = p.regla;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(m, y);
    ctx.lineTo(der, y);
    ctx.stroke();
  };
  regla(CY + 262);

  /* Los seis como barras: el nivel se compara de un vistazo, que es justo lo
     que una retícula de números sueltos no deja hacer. */
  const alto = 16;
  const salto = 116;
  const y0 = CY + 372;
  const xBarra = m + 92;
  const anchoBarra = der - 92 - xBarra;

  carta.atributos.forEach((a, i) => {
    const y = y0 + i * salto;

    ctx.textAlign = "left";
    ctx.fillStyle = p.suave;
    ctx.font = fuente(26, 700);
    ctx.fillText(a.sigla, m, y + 6);

    camino(ctx, xBarra, y - alto / 2, anchoBarra, alto, alto / 2);
    ctx.fillStyle = p.regla;
    ctx.fill();

    camino(ctx, xBarra, y - alto / 2, (anchoBarra * a.valor) / 99, alto, alto / 2);
    ctx.fillStyle = p.filete;
    ctx.fill();

    ctx.textAlign = "right";
    ctx.fillStyle = p.texto;
    ctx.font = fuente(32, 800);
    ctx.fillText(String(a.valor), der, y + 10);
  });

  regla(CY + CH - 150);
  pieDatos(ctx, carta, p.suave, CY + CH - 88);
  filete(ctx, "ficha");
}

/** El apodo sólo se dibuja si dice algo distinto del nombre: en las cuentas
 *  sin apodo cargado, `construirCarta` lo llena con el primer nombre. */
const tieneApodo = (carta: CartaVM) =>
  carta.apodo.toLowerCase() !== carta.nombre.toLowerCase();

/* ── entrada ─────────────────────────────────────────────────────────────── */

/** Dibuja la carta y devuelve el PNG. */
export async function renderCarta(carta: CartaVM, estilo: EstiloCarta): Promise<Blob | null> {
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;

  // Sin esto la primera carta sale con la fuente del sistema: `next/font` la
  // carga async y `measureText` mide con la de respaldo hasta que resuelve.
  if (document.fonts) await conTecho(document.fonts.ready, 1500);

  const [escudo, avatar] = await Promise.all([
    cargarImagen(carta.crest, 120),
    cargarImagen(carta.avatar, 900),
  ]);

  fondoLienzo(ctx, estilo);
  ctx.textBaseline = "alphabetic";

  if (estilo === "retrato") dibujarRetrato(ctx, carta, avatar);
  else if (estilo === "ficha") dibujarFicha(ctx, carta, avatar);
  else dibujarClasica(ctx, carta, avatar);

  /* Rótulo del club arriba y handle abajo: son del lienzo, no de la carta, y
     por eso van igual en los tres estilos. El handle es lo que hace que la
     imagen sirva de algo cuando alguien la ve en una story: dice de quién es. */
  ctx.textAlign = "center";
  if (escudo) ctx.drawImage(escudo, W / 2 - 44, CY - 210, 88, 88);
  ctx.fillStyle = "rgba(255,255,255,0.62)";
  ctx.font = fuente(28, 600);
  trackeado(ctx, carta.club.toUpperCase(), W / 2, CY - 78, 10);

  ctx.fillStyle = "rgba(255,255,255,0.68)";
  ctx.font = fuente(38, 600);
  ctx.fillText(`@${carta.handle}`, W / 2, CY + CH + 130);

  return new Promise((resolve) => canvas.toBlob((b) => resolve(b), "image/png"));
}
