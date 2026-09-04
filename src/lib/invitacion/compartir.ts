import { renderStory, type StoryInput } from "@/lib/invitacion/story";

/** Compartir la invitación por WhatsApp y por Instagram.
 *
 *  Las dos mandan **la tarjeta como imagen**, no como link: el PNG 9:16 que
 *  dibuja `story.ts` es lo que la persona quiere mostrar, y un mensaje de texto
 *  con una URL adentro depende de que del otro lado alguien la abra. La imagen
 *  se ve sola en el chat.
 *
 *  Hay tres caminos para entregarla y se toman en este orden, porque cada uno
 *  existe donde el anterior no llega:
 *
 *  1. **El portapapeles.** Siempre, y arrancando en el mismo tick del click. Es
 *     lo más directo que hay —se pega en un chat, en un mail o donde sea— y no
 *     interrumpe nada: aunque después se abra la hoja del sistema, la imagen ya
 *     quedó copiada y no costó un paso más.
 *  2. **La hoja del sistema** (`navigator.share` con `files`). En el celular es
 *     el único modo de meter la imagen adentro de Instagram: no existe un
 *     intent web que suba una story, y `instagram://story-camera` abre la
 *     cámara vacía, sin la invitación. Para WhatsApp es lo mismo pero mejor que
 *     `wa.me`: la imagen llega al chat elegido sin pasos intermedios.
 *  3. **La descarga.** Donde no hay ni `ClipboardItem` con PNG ni Web Share con
 *     archivos —Firefox, sobre todo— la tarjeta termina igual en el disco, con
 *     un paso más.
 *
 *  `wa.me` sigue existiendo, pero ya no es el botón de WhatsApp: es lo que se
 *  abre **después** de copiar, en el escritorio, para dejarle a la persona el
 *  chat adelante donde pegar la imagen.
 */

/** El mensaje que acompaña a la tarjeta. El link va **al final y en su propia
 *  línea**: WhatsApp arma el preview con la última URL del texto, y un link en
 *  el medio de una oración se corta al hacer tap en algunos clientes viejos. */
export const textoWhatsApp = (club: string, titulo: string, url: string) =>
  `Te invitamos: ${titulo}\nDe parte de ${club}.\nAbrí tu invitación personal:\n${url}`;

export function abrirWhatsApp(texto: string) {
  const destino = `https://wa.me/?text=${encodeURIComponent(texto)}`;
  // La pestaña se abre después de escribir el portapapeles, o sea fuera del
  // tick del click: si el navegador lo lee como popup y devuelve `null`, se
  // navega la pestaña actual en vez de dejar a la persona sin WhatsApp. La
  // invitación no se pierde, queda en el historial.
  const ventana = window.open(destino, "_blank", "noopener");
  if (!ventana) window.location.href = destino;
}

/* ── el portapapeles ─────────────────────────────────────────────────────── */

/** Qué pasó al copiar la imagen.
 *
 *  `sin-soporte` es un caso aparte de `error` y no un detalle: Firefox y Safari
 *  hasta hace poco no implementan `ClipboardItem` con PNG, y ahí no falló
 *  nada — el navegador no sabe hacerlo. Quien llama ofrece la descarga en vez
 *  de mostrar un cartel rojo por algo que la persona no puede arreglar. */
export type ResultadoCopia = "copiado" | "sin-soporte" | "error";

/** Deja el PNG en el portapapeles.
 *
 *  Acepta el blob o **la promesa del blob** a propósito: Safari exige que
 *  `ClipboardItem` se construya en el mismo tick del gesto del usuario y
 *  descarta la escritura si antes hubo un `await`. Con la promesa adentro es el
 *  navegador el que espera el contenido, y el gesto sigue siendo válido — así
 *  el botón funciona aunque la story todavía se esté dibujando. */
export async function copiarImagen(
  png: Blob | null | Promise<Blob | null>,
): Promise<ResultadoCopia> {
  if (!png) return "error";
  if (typeof ClipboardItem === "undefined" || !navigator.clipboard?.write) {
    return "sin-soporte";
  }

  try {
    const contenido = Promise.resolve(png).then((blob) => {
      // Rechazar es la única forma de cancelar la escritura desde adentro: un
      // `ClipboardItem` con un blob vacío deja en el portapapeles una imagen
      // rota, que es peor que no haber copiado.
      if (!blob) throw new Error("la tarjeta no se pudo dibujar");
      return blob;
    });
    await navigator.clipboard.write([new ClipboardItem({ "image/png": contenido })]);
    return "copiado";
  } catch {
    // Chrome tira `NotAllowedError` si el documento perdió el foco entre el
    // click y la escritura — es el caso de quien toca el botón y se va a otra
    // ventana. No hay nada que distinguir: los dos terminan en "no se pudo".
    return "error";
  }
}

/** Descarga el PNG. Es la salida cuando el navegador no sabe copiar imágenes:
 *  la tarjeta termina igual en el teléfono, con un paso más. */
export function descargarImagen(png: Blob, nombre: string) {
  const href = URL.createObjectURL(png);
  const a = document.createElement("a");
  a.href = href;
  a.download = nombre;
  a.click();
  // Sin el revoke el blob —1 MB de PNG— queda vivo hasta que se cierra la
  // pestaña. El timeout es porque revocar en el mismo tick cancela la descarga
  // en Safari, que lee la URL después del click.
  setTimeout(() => URL.revokeObjectURL(href), 10_000);
}

/* ── el archivo ──────────────────────────────────────────────────────────── */

const slug = (v: string) =>
  v
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 40) || "trapnexport";

/** `prefijo` nombra el archivo que ve la persona en su galería o en la hoja del
 *  sistema. La invitación no lo pasa y sigue siendo `invitacion-<nombre>.png`;
 *  la carta de jugador pasa `carta` y sale `carta-<nombre>.png`. */
const nombreDe = (nombre: string, prefijo: string) => `${prefijo}-${slug(nombre)}.png`;

/** Genera el PNG 9:16 de la invitación. Se expone aparte de las funciones que
 *  comparten para poder llamarlo apenas monta la pantalla y tener el archivo
 *  listo: dibujar 1080×1920 tarda, y tanto el portapapeles como la hoja del
 *  sistema son mucho más confiables con el blob ya hecho. */
export const prepararStory = (inv: StoryInput) => renderStory(inv);

/** La hoja nativa del sistema, si es que hay una que acepte archivos.
 *  `no-disponible` no es un error: es todo el escritorio y Firefox móvil. */
async function porLaHojaDelSistema(
  archivo: File,
  texto: string,
): Promise<"sistema" | "cancelado" | "no-disponible" | "error"> {
  // `canShare` con el archivo puesto, no `!!navigator.share`: Chrome de
  // escritorio tiene `share` pero rechaza los archivos, y sin la pregunta
  // completa el `share` tira y la persona no recibe nada.
  if (!navigator.canShare?.({ files: [archivo] })) return "no-disponible";

  try {
    // Sin `url`: varias plataformas, al ver texto y link juntos, comparten el
    // link y descartan la imagen — que es justo lo que Instagram necesita.
    await navigator.share({ files: [archivo], text: texto });
    return "sistema";
  } catch (e) {
    if ((e as DOMException | undefined)?.name === "AbortError") return "cancelado";
    return "error";
  }
}

/* ── compartir la tarjeta ────────────────────────────────────────────────── */

/** Por dónde salió la tarjeta.
 *
 *  `cancelado` existe separado de `error` porque cerrar la hoja del sistema es
 *  una decisión, no una falla: si cayera en `error` la persona vería un cartel
 *  rojo por haber tocado "cancelar", y si cayera en la descarga se le bajaría
 *  al teléfono un PNG que acaba de decidir no compartir. */
export type ResultadoTarjeta =
  | "sistema"
  | "portapapeles"
  | "descarga"
  | "cancelado"
  | "error";

/** Copia la tarjeta al portapapeles y, si el sistema puede, la entrega también
 *  por su hoja de compartir.
 *
 *  El orden no es negociable: la copia arranca **antes** de cualquier `await`,
 *  en el mismo tick del click. Después de abrir la hoja del sistema el
 *  documento pierde el foco y Chrome rechaza la escritura, así que copiar
 *  primero es la única forma de tener las dos cosas.
 *
 *  Recibe la promesa del PNG y no el PNG ya resuelto: ver `copiarImagen`.
 *
 *  El resultado dice qué recibió la persona, que es lo único que cambia el
 *  mensaje de después: `portapapeles` pide pegar, `descarga` pide adjuntar y
 *  `sistema` no pide nada porque la hoja nativa ya hizo su propia devolución. */
export async function compartirTarjeta(
  pendiente: Blob | null | Promise<Blob | null>,
  nombre: string,
  texto: string,
  prefijo = "invitacion",
): Promise<ResultadoTarjeta> {
  const copia = copiarImagen(pendiente);

  const png = await pendiente;
  if (!png) {
    // La promesa de adentro del `ClipboardItem` también se rechaza sola; se
    // espera igual para no dejar un rechazo suelto.
    await copia;
    return "error";
  }

  const archivo = new File([png], nombreDe(nombre, prefijo), { type: "image/png" });
  const porSistema = await porLaHojaDelSistema(archivo, texto);
  if (porSistema === "sistema" || porSistema === "cancelado") return porSistema;

  if ((await copia) === "copiado") return "portapapeles";

  descargarImagen(png, archivo.name);
  return "descarga";
}

/** La carta de jugador: hoja del sistema y, donde no hay, descarga. El
 *  portapapeles no entra acá porque esa pantalla tiene su propio botón de
 *  copiar, y la persona elige. */
export async function compartirEnInstagram(
  png: Blob | null,
  invitado: string,
  texto: string,
  prefijo = "invitacion",
): Promise<"sistema" | "descarga" | "cancelado" | "error"> {
  if (!png) return "error";

  const archivo = new File([png], nombreDe(invitado, prefijo), { type: "image/png" });
  const resultado = await porLaHojaDelSistema(archivo, texto);
  if (resultado !== "no-disponible") return resultado;

  descargarImagen(png, archivo.name);
  return "descarga";
}
