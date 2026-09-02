"use client";

import { subirArchivo, subirImagen } from "@/lib/storage/imagen";

/** Subida del avatar y del carrete, a Firebase Storage.
 *
 *  Antes esto devolvía data-URIs y el archivo entero viajaba en el body de una
 *  Server Action hasta el store en memoria. Eso imponía dos límites que ya no
 *  existen —el tope de `serverActions.bodySizeLimit` y el 33% que suma base64—
 *  y uno que sí importaba: un data-URI no entra en un documento de Firestore,
 *  que tiene tope de 1 MB, así que con las cuentas ya en la base no había dónde
 *  guardarlo.
 *
 *  Ahora el archivo va del navegador al bucket y por la action viaja sólo la
 *  `downloadURL` más la ruta, para poder borrarlo después. El motor es el mismo
 *  que usan el compositor del feed y el panel de la historia
 *  (`lib/storage/imagen.ts`); lo que cambia acá es la carpeta, cuánto se
 *  comprime y qué tipos se aceptan.
 *
 *  Las imágenes se comprimen; los videos no se pueden, así que sólo se validan
 *  por tamaño.
 */

/** Lado largo del avatar. Se muestra a 80px en el perfil y a 40 en el feed, así
 *  que 512 alcanza de sobra incluso en pantallas densas. */
const AVATAR_EDGE = 512;

/** Lado largo de las fotos del carrete: se ven a pantalla completa. */
const CARRETE_EDGE = 1600;

/** Tope de video. Sin comprimir, es el peso que efectivamente se sube. */
export const MAX_VIDEO_BYTES = 25 * 1024 * 1024;

/** Tope de imagen de ENTRADA. La compresión la deja muy por debajo, pero un
 *  archivo enorme igual hay que decodificarlo en memoria primero, y ahí es donde
 *  revienta una pestaña de celular. */
export const MAX_IMAGE_BYTES = 25 * 1024 * 1024;

export type UploadResult =
  | { ok: true; src: string; path: string }
  | { ok: false; error: string };

const fmtMB = (bytes: number) => `${Math.round(bytes / (1024 * 1024))} MB`;

/** Traduce el error de la subida a algo que se le pueda mostrar a alguien.
 *
 *  `storage/unauthorized` es el caso que vale la pena distinguir: no es una
 *  falla, es que la sesión se cayó y las reglas del bucket ya no dejan escribir.
 *  El resto se agrupa: para quien sube una foto, "se cortó" y "el bucket dijo
 *  que no" son lo mismo. */
const mensajeDeError = (err: unknown): string => {
  const code = (err as { code?: string } | undefined)?.code ?? "";
  if (code === "storage/unauthorized") {
    return "Tu sesión venció. Volvé a entrar y probá de nuevo.";
  }
  if (err instanceof Error && err.message) return err.message;
  return "No se pudo subir el archivo. Probá de nuevo.";
};

/** Sube la foto de perfil. */
export async function uploadAvatar(file: File): Promise<UploadResult> {
  if (!file.type.startsWith("image/")) {
    return { ok: false, error: "Ese archivo no es una imagen." };
  }
  if (file.size > MAX_IMAGE_BYTES) {
    return { ok: false, error: `La imagen supera los ${fmtMB(MAX_IMAGE_BYTES)}.` };
  }

  try {
    const { src, path } = await subirImagen(file, {
      carpeta: "trapnexport-avatar",
      maxEdge: AVATAR_EDGE,
      porUsuario: true,
    });
    return { ok: true, src, path };
  } catch (err) {
    return { ok: false, error: mensajeDeError(err) };
  }
}

/** Sube una foto o un video al carrete. Despacha por tipo: es lo que usan los
 *  inputs que aceptan las dos cosas (`accept="image/*,video/*"`). */
export async function uploadMedia(
  file: File,
): Promise<UploadResult & { kind?: "image" | "video" }> {
  if (file.type.startsWith("video/")) {
    if (file.size > MAX_VIDEO_BYTES) {
      return {
        ok: false,
        error: `El video supera los ${fmtMB(MAX_VIDEO_BYTES)}. Recortalo y volvé a intentar.`,
      };
    }
    try {
      const { src, path } = await subirArchivo(file, {
        carpeta: "trapnexport-carrete",
        porUsuario: true,
      });
      return { ok: true, src, path, kind: "video" };
    } catch (err) {
      return { ok: false, error: mensajeDeError(err) };
    }
  }

  if (file.type.startsWith("image/")) {
    if (file.size > MAX_IMAGE_BYTES) {
      return { ok: false, error: `La imagen supera los ${fmtMB(MAX_IMAGE_BYTES)}.` };
    }
    try {
      const { src, path } = await subirImagen(file, {
        carpeta: "trapnexport-carrete",
        maxEdge: CARRETE_EDGE,
        porUsuario: true,
      });
      return { ok: true, src, path, kind: "image" };
    } catch (err) {
      return { ok: false, error: mensajeDeError(err) };
    }
  }

  return { ok: false, error: "Sólo se pueden subir imágenes y videos." };
}
