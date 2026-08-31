import { renderStory, type StoryInput } from "@/lib/invitacion/story";

/** Compartir la invitación por WhatsApp y por Instagram.
 *
 *  Las dos plataformas se comparten distinto y no hay forma de unificarlas:
 *
 *  - **WhatsApp** recibe un link. `wa.me/?text=` abre la app en el celular y
 *    WhatsApp Web en la compu, con el mensaje ya escrito y el chat todavía sin
 *    elegir. Es un `window.open` y nada más.
 *  - **Instagram** no recibe links: no existe un intent web que suba una story,
 *    y `instagram://story-camera` abre la cámara vacía —sin la invitación—, así
 *    que como botón de compartir es peor que no tener botón. Lo que sí funciona
 *    es darle al sistema un archivo: `navigator.share` con `files` abre la hoja
 *    nativa y ahí está Instagram. Donde no hay Web Share con archivos (todo el
 *    escritorio, Firefox móvil) se baja el PNG para subirlo a mano.
 *
 *  Por eso Instagram devuelve un resultado y WhatsApp no: el camino que tomó
 *  cambia lo que hay que decirle a la persona después de tocar el botón.
 */

/** El mensaje que va en el chat. El link va **al final y en su propia línea**:
 *  WhatsApp arma el preview con la última URL del texto, y un link en el medio
 *  de una oración se corta al hacer tap en algunos clientes viejos. */
export const textoWhatsApp = (club: string, titulo: string, url: string) =>
  `Te invitamos: ${titulo}\nDe parte de ${club}.\nAbrí tu invitación personal:\n${url}`;

export function abrirWhatsApp(texto: string) {
  window.open(`https://wa.me/?text=${encodeURIComponent(texto)}`, "_blank", "noopener");
}

/* ── Instagram ───────────────────────────────────────────────────────────── */

/** Qué terminó pasando al tocar el botón de Instagram.
 *
 *  `cancelado` existe separado de `error` porque cerrar la hoja del sistema es
 *  una decisión, no una falla: si cayera en `error` la persona vería un cartel
 *  rojo por haber tocado "cancelar", y si cayera en la descarga se le bajaría
 *  al teléfono un PNG que acaba de decidir no compartir. */
export type ResultadoInstagram = "sistema" | "descarga" | "cancelado" | "error";

const slug = (v: string) =>
  v
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 40) || "trapnexport";

function descargar(blob: Blob, nombre: string) {
  const href = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = href;
  a.download = nombre;
  a.click();
  // Sin el revoke el blob —1 MB de PNG— queda vivo hasta que se cierra la
  // pestaña. El timeout es porque revocar en el mismo tick cancela la descarga
  // en Safari, que lee la URL después del click.
  setTimeout(() => URL.revokeObjectURL(href), 10_000);
}

/** Genera el PNG 9:16 de la invitación. Se expone aparte de `compartir` para
 *  poder llamarlo apenas monta la pantalla y tener el archivo listo: Safari
 *  exige que `navigator.share` salga del gesto del usuario y descarta la
 *  llamada si antes hubo un `await` largo, y dibujar la story lo es. */
export const prepararStory = (inv: StoryInput) => renderStory(inv);

/** `prefijo` nombra el archivo que ve la persona en su galeria o en la hoja del
 *  sistema. La invitacion no lo pasa y sigue siendo `invitacion-<nombre>.png`;
 *  la carta de jugador pasa `carta` y sale `carta-<nombre>.png`. Todo lo demas
 *  de esta funcion ya era generico: recibe un blob, un nombre y un texto. */
export async function compartirEnInstagram(
  png: Blob | null,
  invitado: string,
  texto: string,
  prefijo = "invitacion",
): Promise<ResultadoInstagram> {
  if (!png) return "error";

  const archivo = new File([png], `${prefijo}-${slug(invitado)}.png`, {
    type: "image/png",
  });

  // `canShare` con el archivo puesto, no `!!navigator.share`: Chrome de
  // escritorio tiene `share` pero rechaza los archivos, y sin la pregunta
  // completa el `share` tira y la persona no recibe nada.
  if (navigator.canShare?.({ files: [archivo] })) {
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

  descargar(png, archivo.name);
  return "descarga";
}
