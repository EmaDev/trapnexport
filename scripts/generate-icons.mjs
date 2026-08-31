// Genera los íconos de la app (public/icons) con el escudo del club.
//
//   npm run icons
//
// Sin dependencias: rasteriza polígonos a mano sobre un buffer RGBA y lo
// comprime con el `zlib` de Node. Son los íconos del manifest, así que de acá
// sale también la pantalla de arranque que dibuja Android al abrir la PWA
// instalada — el `SplashScreen` de la app es otra cosa y va aparte, en
// `AppShell.tsx`.
//
// ⚠️ La geometría de abajo es la MISMA que `public/escudo.svg`, en la misma caja
// de 1080. Están duplicadas porque este script no puede parsear un SVG sin
// arrastrar una dependencia de render: si se toca el escudo, se tocan los dos y
// se vuelve a correr `npm run icons`. Las curvas de los hombros del blasón se
// aproximan con un punto intermedio: a 192px la diferencia no existe.
//
// Lo que el escudo tiene y el ícono no: nada. Las letras de TRAP entran, aunque
// a 192px se lean como una textura y no como palabra — igual que en el escudo
// real a ese tamaño.

import { deflateSync } from "node:zlib";
import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

/* ── colores ─────────────────────────────────────────────────────────────── */

const FROM = [0x50, 0x10, 0x8b]; // --color-primary, el fondo del ícono
const TO = [0x75, 0x2e, 0xb8]; // --color-accent
const NEGRO = [0x11, 0x11, 0x11];
const BLANCO = [0xff, 0xff, 0xff];
const VIOLETA = [0x6f, 0x21, 0xa8]; // el del escudo, no el del tema
const ORO = [0xe0, 0xac, 0x2b];

/* ── geometría, en la caja de 1080 de public/escudo.svg ──────────────────── */

const rect = (x, y, w, h) => [
  [x, y],
  [x + w, y],
  [x + w, y + h],
  [x, y + h],
];

/** Estrella de cinco puntas: radio exterior 1, interior 0.382. */
const STAR = [
  [0, -1],
  [0.2246, -0.3091],
  [0.9511, -0.309],
  [0.3633, 0.118],
  [0.5878, 0.809],
  [0, 0.382],
  [-0.5878, 0.809],
  [-0.3633, 0.118],
  [-0.9511, -0.309],
  [-0.2246, -0.3091],
];
const star = (cx, cy, r) => STAR.map(([x, y]) => [cx + x * r, cy + y * r]);

const BLASON = [
  [163, 244],
  [917, 244],
  [917, 686],
  [903, 754],
  [863, 802],
  [540, 1046],
  [217, 802],
  [177, 754],
  [163, 686],
];

const FILETE = [
  [179, 260],
  [901, 260],
  [901, 686],
  [888, 745],
  [851, 788],
  [540, 1018],
  [229, 788],
  [192, 745],
  [179, 686],
];

/** El blasón interior. Recorta todo el contenido: los bastones y el violeta
 *  terminan en diagonal porque el escudo los corta, igual que en el SVG. */
const INTERIOR = [
  [195, 276],
  [885, 276],
  [885, 686],
  [874, 735],
  [839, 774],
  [540, 990],
  [241, 774],
  [206, 735],
  [195, 686],
];

const LETRAS = [
  // T
  rect(279, 316, 96, 24),
  rect(315, 340, 24, 84),
  // R
  rect(421, 316, 24, 108),
  rect(421, 316, 96, 24),
  rect(493, 316, 24, 44),
  rect(421, 360, 96, 24),
  [
    [466, 384],
    [490, 384],
    [517, 424],
    [493, 424],
  ],
  // A
  [
    [563, 424],
    [587, 424],
    [623, 316],
    [599, 316],
  ],
  [
    [635, 424],
    [659, 424],
    [623, 316],
    [599, 316],
  ],
  rect(583, 378, 56, 22),
  // P
  rect(705, 316, 24, 108),
  rect(705, 316, 96, 24),
  rect(777, 316, 24, 44),
  rect(705, 360, 96, 24),
];

/** Las capas, en orden de pintado (de abajo hacia arriba). El rasterizador las
 *  recorre al revés y gana la primera que contenga al punto. */
const CAPAS = [
  { color: ORO, polys: [star(305, 134, 80), star(540, 96, 92), star(775, 134, 80)] },
  { color: NEGRO, polys: [BLASON] },
  { color: BLANCO, polys: [FILETE] },
  { color: NEGRO, polys: [rect(195, 276, 690, 208)], clip: INTERIOR },
  {
    // El marco blanco de la banda, como cuatro barras: el rasterizador rellena
    // polígonos, no dibuja trazos.
    color: BLANCO,
    clip: INTERIOR,
    polys: [
      rect(206.5, 284.5, 667, 15),
      rect(206.5, 438.5, 667, 15),
      rect(206.5, 284.5, 15, 169),
      rect(858.5, 284.5, 15, 169),
    ],
  },
  { color: BLANCO, polys: LETRAS, clip: INTERIOR },
  { color: VIOLETA, polys: [rect(195, 524, 283, 480)], clip: INTERIOR },
  {
    color: NEGRO,
    clip: INTERIOR,
    polys: [rect(315, 524, 44, 480), rect(195, 690, 283, 44)],
  },
  {
    color: NEGRO,
    clip: INTERIOR,
    polys: [
      rect(600, 538, 34, 470),
      rect(660, 538, 34, 470),
      rect(720, 538, 34, 470),
      rect(780, 538, 34, 470),
      rect(840, 538, 34, 470),
    ],
  },
];

const CAPAS_DE_ARRIBA = [...CAPAS].reverse();

/** Caja del escudo dentro de los 1080: de la punta de la estrella del medio
 *  (y=4) a la punta del blasón (y=1046), y de borde a borde en x. */
const CAJA = { x: 163, y: 4, w: 754, h: 1042 };

/* ── salida ──────────────────────────────────────────────────────────────── */

const OUTPUT = [
  // Radio 22.5%: la esquina redondeada que espera Android/iOS para un ícono
  // "any". `apple-icon` va con la misma forma porque iOS no recorta.
  { file: "icon-192.png", size: 192, radius: 0.225, fit: 0.82 },
  { file: "icon-512.png", size: 512, radius: 0.225, fit: 0.82 },
  { file: "apple-icon-180.png", size: 180, radius: 0.225, fit: 0.82 },
  // Maskable: cuadrado a sangre y escudo más chico, porque Android recorta la
  // forma que quiera y sólo el 80% central está garantizado. El escudo es alto
  // y angosto, así que acá paga bajar bastante.
  { file: "icon-maskable-512.png", size: 512, radius: 0, fit: 0.6 },
];

const SAMPLES = 4; // 4×4 por pixel: suficiente para que no se vean escalones

function insidePolygon(points, x, y) {
  let inside = false;
  for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
    const [xi, yi] = points[i];
    const [xj, yj] = points[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) {
      inside = !inside;
    }
  }
  return inside;
}

function insideRoundedRect(size, radius, x, y) {
  if (x < 0 || y < 0 || x > size || y > size) return false;
  if (radius <= 0) return true;
  // Sólo las cuatro esquinas necesitan el test de distancia.
  const cx = x < radius ? radius : x > size - radius ? size - radius : x;
  const cy = y < radius ? radius : y > size - radius ? size - radius : y;
  if (cx === x || cy === y) return true;
  return (x - cx) ** 2 + (y - cy) ** 2 <= radius ** 2;
}

function render({ size, radius, fit }) {
  const r = radius * size;
  // El escudo entra por su alto, que es su lado largo.
  const scale = (size * fit) / CAJA.h;
  const midX = CAJA.x + CAJA.w / 2;
  const midY = CAJA.y + CAJA.h / 2;
  const toCrest = (px, py) => [
    (px - size / 2) / scale + midX,
    (py - size / 2) / scale + midY,
  ];

  const rgba = Buffer.alloc(size * size * 4);
  const step = 1 / SAMPLES;
  const offset = step / 2;
  const total = SAMPLES * SAMPLES;

  for (let py = 0; py < size; py++) {
    for (let px = 0; px < size; px++) {
      let shape = 0;
      const sum = [0, 0, 0];

      for (let sy = 0; sy < SAMPLES; sy++) {
        for (let sx = 0; sx < SAMPLES; sx++) {
          const x = px + offset + sx * step;
          const y = py + offset + sy * step;
          if (!insideRoundedRect(size, r, x, y)) continue;
          shape += 1;

          // Fondo: el mismo degradé diagonal de la marca en la app.
          const t = (x / size + y / size) / 2;
          let color = FROM.map((c, i) => c + (TO[i] - c) * t);

          const [cx, cy] = toCrest(x, y);
          for (const capa of CAPAS_DE_ARRIBA) {
            if (capa.clip && !insidePolygon(capa.clip, cx, cy)) continue;
            if (capa.polys.some((poly) => insidePolygon(poly, cx, cy))) {
              color = capa.color;
              break;
            }
          }

          for (let c = 0; c < 3; c++) sum[c] += color[c];
        }
      }

      if (shape === 0) continue;
      const i = (py * size + px) * 4;
      for (let c = 0; c < 3; c++) rgba[i + c] = Math.round(sum[c] / shape);
      rgba[i + 3] = Math.round((shape / total) * 255);
    }
  }

  return rgba;
}

/* ── PNG mínimo (color type 6, 8 bits, sin filtros) ─────────────────────── */

const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});

function crc32(buf) {
  let c = 0xffffffff;
  for (const byte of buf) c = CRC_TABLE[(c ^ byte) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const head = Buffer.alloc(4);
  head.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([head, body, crc]);
}

function encodePng(size, rgba) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // bits por canal
  ihdr[9] = 6; // RGBA
  // Un byte de filtro (0 = None) por scanline, como pide el formato.
  const raw = Buffer.alloc(size * (size * 4 + 1));
  for (let y = 0; y < size; y++) {
    raw[y * (size * 4 + 1)] = 0;
    rgba.copy(raw, y * (size * 4 + 1) + 1, y * size * 4, (y + 1) * size * 4);
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(raw, { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

const iconsDir = join(dirname(fileURLToPath(import.meta.url)), "..", "public", "icons");

for (const icon of OUTPUT) {
  writeFileSync(join(iconsDir, icon.file), encodePng(icon.size, render(icon)));
  console.log(`✓ ${icon.file} (${icon.size}×${icon.size})`);
}
