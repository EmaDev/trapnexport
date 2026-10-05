/** Cómo se muestra la media de una encuesta.
 *
 *  Hay dos formas de votar sobre media y **no** son la misma con distinto
 *  archivo:
 *
 *    imágenes → una por opción, y se votan desde un carrusel: cada tarjeta
 *               *es* una opción, así que hay tantas imágenes como opciones.
 *    video    → **uno solo** para toda la encuesta, arriba, y debajo la lista
 *               de opciones. El clip es el material que se mira (la compilación
 *               de los goles del año), no una de las alternativas: meterlo en
 *               un carrusel obligaría a cargar el mismo video N veces para que
 *               cada opción tuviera tarjeta, y a buscar la opción pasando
 *               videos en vez de leerlas todas juntas.
 *
 *  Por eso el video vive en `Encuesta.video` y las imágenes en
 *  `OpcionEncuesta.media`. Este módulo es el único lugar que decide cuál de
 *  las dos vistas corresponde, y lo comparten el feed y la vista previa del
 *  panel —que tiene que mostrar exactamente lo que va a ver el socio—.
 *
 *  No importa nada de `store.ts`: lo leen componentes cliente.
 */

/** Una URL http(s) a secas: es lo que habilita el preview de la media. */
export const esUrl = (s: string) => /^https?:\/\/\S+$/i.test(s.trim());

/** El id de un video de YouTube, en cualquiera de las formas en que se copia
 *  la URL: `watch?v=`, `youtu.be/`, `/shorts/`, `/embed/` y `/live/`.
 *
 *  Hace falta porque un link de YouTube **no** se puede reproducir en un
 *  `<video>`: la página no es el archivo. Hay que montar un `<iframe>` con la
 *  URL de embed, y para eso lo único que sirve del link original es el id. */
export const idYoutube = (url: string): string | undefined =>
  url
    .trim()
    .match(
      /^https?:\/\/(?:www\.|m\.)?(?:youtube\.com\/(?:watch\?(?:[^#]*&)?v=|shorts\/|embed\/|live\/|v\/)|youtu\.be\/)([\w-]{11})/i,
    )?.[1];

/** La URL de embed de un video de YouTube, lista para el `src` de un
 *  `<iframe>`. Va por `youtube-nocookie.com`: es el mismo reproductor sin las
 *  cookies de seguimiento, que acá no aportan nada. `rel=0` deja los videos
 *  sugeridos del final dentro del canal y no manda a mirar otra cosa en medio
 *  de la votación. */
export const embedYoutube = (id: string) =>
  `https://www.youtube-nocookie.com/embed/${id}?rel=0&playsinline=1`;

/** Un short de YouTube: se filma vertical, así que el iframe va 9/16 y no
 *  16/9. No se puede deducir del video —el iframe no tiene medidas propias—,
 *  sólo del link. */
export const esShortYoutube = (url: string) => /\/shorts\//i.test(url.trim());

/** Archivos de video que un `<video>` reproduce directo. */
const EXT_VIDEO = /\.(mp4|webm|ogg|mov|m4v)(\?|#|$)/i;

/** Distingue video de imagen: un archivo de video conocido o un link de
 *  YouTube. Todo lo demás se trata como imagen. */
export const esVideo = (url: string) => EXT_VIDEO.test(url.trim()) || !!idYoutube(url);

/** La imagen de una opción, o `undefined` si no tiene una.
 *
 *  Devuelve `undefined` para los videos a propósito: una opción nunca lleva
 *  video propio. Si quedó uno cargado ahí —de antes de que el video fuera de la
 *  encuesta— lo levanta `videoDeEncuesta`, que lo sube al encabezado. */
export const imagenDeOpcion = (media?: string): string | undefined => {
  const url = media?.trim();
  return url && esUrl(url) && !esVideo(url) ? url : undefined;
};

/** El video de una encuesta: el del documento y, si no hay, el primero que
 *  haya quedado cargado en una opción.
 *
 *  La segunda mitad es compatibilidad con las encuestas que se cargaron cuando
 *  el video iba por opción: sin ella, abrir una de esas en el feed dejaría de
 *  mostrar el clip. */
export const videoDeEncuesta = (
  video: string | undefined,
  opciones: { media?: string }[],
): string | undefined => {
  const propio = video?.trim();
  if (propio && esUrl(propio)) return propio;
  const enOpcion = opciones
    .map((o) => o.media?.trim())
    .find((url): url is string => !!url && esUrl(url) && esVideo(url));
  return enOpcion;
};
