/** Imágenes de relleno como data-URI SVG.
 *
 *  Mientras no haya storage real, avatares y media salen de acá: son
 *  deterministas (el mismo handle da siempre el mismo color), se quedan dentro
 *  de la paleta de marca, no pegan a ningún host y no rompen el CSP. Cuando
 *  conectes el backend, reemplazá el valor de `avatar` / `media[].src` por la
 *  URL real y nada más cambia: los componentes ya reciben un string.
 */

const hash = (seed: string) => {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) | 0;
  return Math.abs(h);
};

const dataUri = (svg: string) =>
  `data:image/svg+xml,${encodeURIComponent(svg.replace(/\s+/g, " ").trim())}`;

const initials = (name: string) =>
  name
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("");

/** El tono de la marca (#50108b ≈ hsl(271, 79%, 30%)). Todo lo generado acá se
 *  queda en ese tono y varía sólo en luminosidad: si los avatares salieran con
 *  hues al azar, el feed sería un arcoíris y la paleta —violeta, blanco y
 *  negro— dejaría de existir en la única pantalla que importa. */
const HUE = 271;

/** Avatar circular con las iniciales sobre un degradé del violeta de marca.
 *  La variación por semilla es de luminosidad, no de tono, y el rango está
 *  elegido para que el blanco de las iniciales nunca baje de 4.5:1. */
export function avatarUrl(name: string, seed = name): string {
  const light = 26 + (hash(seed) % 5) * 6; // 26 → 50
  const sat = 55 + (hash(`${seed}s`) % 4) * 8; // 55 → 79

  return dataUri(`
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 96 96">
      <defs>
        <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stop-color="hsl(${HUE} ${sat}% ${light + 10}%)"/>
          <stop offset="1" stop-color="hsl(${HUE} ${sat}% ${light}%)"/>
        </linearGradient>
      </defs>
      <rect width="96" height="96" rx="48" fill="url(#g)"/>
      <text x="48" y="49" fill="#fff" font-family="system-ui, sans-serif"
            font-size="38" font-weight="600" text-anchor="middle"
            dominant-baseline="central">${initials(name)}</text>
    </svg>
  `);
}

/** Media de un post: degradé violeta → negro con una etiqueta, en 4:3. */
export function mediaUrl(label: string, seed = label): string {
  const light = 24 + (hash(seed) % 4) * 7; // 24 → 45
  const angle = hash(`${seed}a`) % 2; // dos direcciones, para que no se repita

  return dataUri(`
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 600">
      <defs>
        <linearGradient id="g" x1="0" y1="${angle}" x2="1" y2="${1 - angle}">
          <stop offset="0" stop-color="hsl(${HUE} 72% ${light}%)"/>
          <stop offset="1" stop-color="#0a0a0a"/>
        </linearGradient>
      </defs>
      <rect width="800" height="600" fill="url(#g)"/>
      <circle cx="640" cy="140" r="180" fill="#fff" opacity="0.08"/>
      <circle cx="180" cy="470" r="140" fill="#fff" opacity="0.05"/>
      <text x="400" y="315" fill="#fff" font-family="system-ui, sans-serif"
            font-size="46" font-weight="600" text-anchor="middle"
            dominant-baseline="central" opacity="0.92">${label}</text>
    </svg>
  `);
}

/* ══════════════════════════════════════════════════════════════════════════
   HISTORIA DEL CLUB

   `/historia` necesita tres formas que `mediaUrl` no da: una "foto" de archivo
   en 16:9, un retrato de jugador en 3:4 y un clip que se mueva. Todo sigue las
   mismas dos reglas del módulo: se genera acá (ningún host externo, nada que
   rompa el CSP) y se queda en el tono 271° variando sólo luminosidad.

   El escudo NO se genera acá: es un asset de marca real y vive en
   `public/escudo.svg`. Lo de este archivo son placeholders hasta que haya
   storage; el escudo ya es el definitivo.

   El césped es violeta y no verde a propósito: `/historia` es, por scroll, la
   pantalla con más imágenes de la app; si fuera la única con un color propio,
   la paleta —violeta sobre neutros puros— dejaría de leerse justo ahí.
   ══════════════════════════════════════════════════════════════════════════ */

/** Franjas verticales de "césped", con un período fijo de 200px.
 *
 *  El período importa: `clipUrl` desplaza el grupo exactamente 200px para
 *  simular el paneo de cámara, y con franjas periódicas ese desplazamiento
 *  cierra sin salto visible. Si cambiás el ancho, cambiá también el `values`
 *  del `animateTransform` de allá.
 */
const grass = (light: number, y: number, h: number) =>
  Array.from({ length: 9 }, (_, i) => {
    const x = -200 + i * 200;
    return `<rect x="${x}" y="${y}" width="100" height="${h}" fill="hsl(${HUE} 60% ${
      light + 6
    }%)" opacity="0.55"/>`;
  }).join("");

/** Tribuna: puntos en cuatro filas que a tamaño de card leen como gente. */
const stands = () => {
  const rows: string[] = [];
  for (let r = 0; r < 4; r++) {
    for (let c = 0; c < 40; c++) {
      rows.push(`<circle cx="${12 + c * 30}" cy="${188 + r * 26}" r="5"/>`);
    }
  }
  return rows.join("");
};

/** "Foto" de archivo en 16:9: reflector, tribuna y cancha.
 *
 *  Es el reemplazo directo de una foto real: cuando haya storage, esto se
 *  cambia por la URL y ni el `Carousel` ni las cards se enteran.
 *
 *  Sin texto adentro, a diferencia de `mediaUrl`. Todos los consumidores de
 *  esta función dibujan su propia etiqueta encima —el `label` y el `badge` de
 *  `MediaCard`, el `caption` del `Carousel`, la barra de números de la etapa,
 *  el título de la portada de temporada— y una etiqueta grabada en el SVG se
 *  superpone con la de arriba. La variación entre fotos es de luz, no de texto:
 *  luminosidad, altura del horizonte y de dónde viene el reflector.
 */
export function photoUrl(seed: string): string {
  const light = 20 + (hash(seed) % 5) * 5; // 20 → 40
  const glow = 140 + (hash(`${seed}g`) % 5) * 230; // dónde cae el reflector
  const horizon = 300 + (hash(`${seed}h`) % 4) * 30; // 300 → 390

  return dataUri(`
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 675">
      <defs>
        <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stop-color="#0a0a0a"/>
          <stop offset="0.55" stop-color="hsl(${HUE} 70% ${light}%)"/>
          <stop offset="1" stop-color="hsl(${HUE} 66% ${light + 8}%)"/>
        </linearGradient>
        <radialGradient id="flood" cx="0.5" cy="0.5" r="0.5">
          <stop offset="0" stop-color="#fff" stop-opacity="0.32"/>
          <stop offset="1" stop-color="#fff" stop-opacity="0"/>
        </radialGradient>
      </defs>
      <rect width="1200" height="675" fill="url(#sky)"/>
      <circle cx="${glow}" cy="80" r="260" fill="url(#flood)"/>
      <g fill="#fff" opacity="0.12" transform="translate(0 ${horizon - 300})">
        ${stands()}
      </g>
      <g>${grass(light, horizon, 675 - horizon)}</g>
      <path d="M0 ${horizon}h1200" stroke="#fff" stroke-opacity="0.35" stroke-width="4"/>
      <circle cx="600" cy="${horizon + 230}" r="150" fill="none" stroke="#fff"
              stroke-opacity="0.28" stroke-width="4"/>
      <path d="M600 ${horizon}v${675 - horizon}" stroke="#fff"
            stroke-opacity="0.28" stroke-width="4"/>
    </svg>
  `);
}

/** Retrato de jugador en 3:4: silueta clara y el dorsal enorme de fondo. */
export function playerPhotoUrl(name: string, number: number, seed = name): string {
  const light = 22 + (hash(seed) % 4) * 6; // 22 → 40

  return dataUri(`
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 800">
      <defs>
        <linearGradient id="bg" x1="0" y1="0" x2="0.8" y2="1">
          <stop offset="0" stop-color="hsl(${HUE} 68% ${light + 14}%)"/>
          <stop offset="1" stop-color="#0a0a0a"/>
        </linearGradient>
      </defs>
      <rect width="600" height="800" fill="url(#bg)"/>
      <text x="300" y="380" fill="#fff" fill-opacity="0.12"
            font-family="system-ui, sans-serif" font-size="420" font-weight="800"
            text-anchor="middle" dominant-baseline="central">${number}</text>
      <g fill="#fff" opacity="0.9">
        <circle cx="300" cy="330" r="96"/>
        <path d="M300 448c-118 0-198 82-198 190v162h396V638c0-108-80-190-198-190Z"/>
      </g>
      <text x="300" y="756" fill="hsl(${HUE} 70% ${light}%)"
            font-family="system-ui, sans-serif" font-size="46" font-weight="700"
            text-anchor="middle">${initials(name)}</text>
    </svg>
  `);
}

/** Clip de archivo en 16:9. Con `playing`, la pelota entra al arco y el césped
 *  se desplaza: es SVG animado con SMIL, que corre igual dentro de un `<img>`
 *  sin script ni recursos externos.
 *
 *  No es un `<video>`: es la portada mientras no haya media real. El día que
 *  haya un `.mp4`, se llena `Clip.src` (ver `lib/historia.ts`) y `ClipCard`
 *  monta el `VideoPlayer` de la librería en vez de esto.
 *
 *  Sin texto adentro, por lo mismo que `photoUrl`: `ClipCard` ya escribe el
 *  año, la duración y el título arriba de la portada.
 */
export function clipUrl(seed: string, playing = false): string {
  const light = 18 + (hash(seed) % 4) * 5; // 18 → 33

  // El paneo: 200px es exactamente el período de las franjas, así que el loop
  // no tiene salto. Sin `playing` no hay ningún elemento animado en el SVG.
  const pan = playing
    ? `<animateTransform attributeName="transform" type="translate"
         values="0 0; -200 0" dur="5s" repeatCount="indefinite"/>`
    : "";

  // La pelota va centrada en (0,0): `animateMotion` posiciona el origen del
  // grupo sobre el path, no su bounding box.
  const ball = playing
    ? `<g>
         <circle r="26" fill="#fff"/>
         <path d="m0 -13 10 7.4-3.8 11.8h-12.4L-10 -5.6 0 -13Z"
               fill="hsl(${HUE} 78% ${light}%)"/>
         <animateMotion dur="2.6s" repeatCount="indefinite" rotate="auto"
           path="M110,540 Q470,150 980,330"/>
       </g>`
    : `<g transform="translate(600 340)">
         <circle r="62" fill="#fff" opacity="0.16"/>
         <circle r="62" fill="none" stroke="#fff" stroke-opacity="0.7" stroke-width="4"/>
         <path d="M-18 -26 30 0-18 26Z" fill="#fff"/>
       </g>`;

  const trail = playing
    ? `<path d="M110,540 Q470,150 980,330" fill="none" stroke="#fff"
             stroke-opacity="0.5" stroke-width="5" stroke-dasharray="18 22">
         <animate attributeName="stroke-dashoffset" from="120" to="0"
                  dur="1.3s" repeatCount="indefinite"/>
       </path>`
    : "";

  return dataUri(`
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 675">
      <defs>
        <linearGradient id="bg" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stop-color="#0a0a0a"/>
          <stop offset="0.5" stop-color="hsl(${HUE} 70% ${light}%)"/>
          <stop offset="1" stop-color="hsl(${HUE} 64% ${light + 10}%)"/>
        </linearGradient>
      </defs>
      <rect width="1200" height="675" fill="url(#bg)"/>
      <g>${grass(light, 300, 375)}${pan}</g>
      <path d="M0 300h1200" stroke="#fff" stroke-opacity="0.3" stroke-width="4"/>
      <path d="M950 250h190v210H950" fill="none" stroke="#fff"
            stroke-opacity="0.55" stroke-width="6"/>
      ${trail}
      ${ball}
    </svg>
  `);
}
