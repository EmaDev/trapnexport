"use client";

import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";
import { Button, Card, Textarea, useSnackbar } from "lib-kit-components";

import { CloseIcon, ImageIcon, SendIcon } from "@/components/atoms/icons";
import { deletePostImage, uploadPostImage } from "@/lib/storage/post-image";
import { publishPost } from "@/lib/social/actions";
import type { SessionVM } from "@/lib/social/queries";

/** Cuántas imágenes entran en un post. Es el límite de `SocialPost`: muestra
 *  cuatro y colapsa el resto en un "+N", así que la quinta es peso que nadie
 *  ve. `publishPost` lo vuelve a aplicar del lado del servidor. */
const MAX_FOTOS = 4;

/** El creador de posteos.
 *
 *  Texto + hasta cuatro fotos. **Sólo fotos, no videos**: el post se dibuja con
 *  `SocialPost` de `lib-kit-components`, cuyo `PostMedia` es `{ src, alt }` y
 *  se renderiza con un `<img>` — un video ahí no se ve. Los videos van al
 *  carrete del perfil (`PersonalMediaUploader`), que dibujamos nosotros y sí
 *  monta un `<video>`.
 *
 *  Las fotos se comprimen fuerte en el navegador y se suben a Firebase Storage
 *  al elegirlas (`uploadPostImage`), no al publicar: la Server Action `publishPost`
 *  recibe la `downloadURL`, no el archivo. Quitar una foto ya subida la borra
 *  del bucket; abandonar el compositor sin publicar deja el archivo huérfano —es
 *  el precio de subir mientras se escribe y no al final.
 *
 *  Se usa embebido (el perfil, donde vive en la columna) y dentro de una hoja
 *  (el foro, donde lo abre el FAB). `onPublished` es lo único que separa los
 *  dos casos: la hoja lo necesita para cerrarse sola al publicar.
 */
export function PostComposer({
  session,
  onPublished,
}: {
  session: SessionVM;
  /** avisa que el post ya salió; el compositor embebido no lo necesita */
  onPublished?: () => void;
}) {
  const { snack } = useSnackbar();
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [text, setText] = useState("");
  const [fotos, setFotos] = useState<{ src: string; alt: string; path: string }[]>([]);
  const [leyendo, setLeyendo] = useState(false);
  const [pending, startTransition] = useTransition();

  const vacio = !text.trim() && fotos.length === 0;

  const addFiles = async (files: FileList | null) => {
    if (!files?.length) return;

    const libres = MAX_FOTOS - fotos.length;
    if (libres <= 0) {
      snack({ message: `Podés adjuntar hasta ${MAX_FOTOS} fotos.`, variant: "error" });
      return;
    }

    setLeyendo(true);
    try {
      const elegidas = Array.from(files).slice(0, libres);
      const subidas = await Promise.all(
        elegidas.map(async (f) => {
          try {
            const { src, path } = await uploadPostImage(f);
            return { ok: true as const, src, path, alt: f.name.replace(/\.[^.]+$/, "") };
          } catch (e) {
            return {
              ok: false as const,
              error: e instanceof Error ? e.message : "No se pudo subir la imagen.",
            };
          }
        }),
      );

      const ok = subidas.flatMap((r) => (r.ok ? [{ src: r.src, alt: r.alt, path: r.path }] : []));
      const fallo = subidas.find((r) => !r.ok);
      if (fallo && !fallo.ok) snack({ message: fallo.error, variant: "error" });

      if (ok.length) setFotos((prev) => [...prev, ...ok].slice(0, MAX_FOTOS));
      if (Array.from(files).length > libres) {
        snack({ message: `Sólo entran ${MAX_FOTOS} fotos por publicación.` });
      }
    } finally {
      setLeyendo(false);
      // permite volver a elegir el mismo archivo (el `change` no dispara si no
      // cambia el value)
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const publicar = () => {
    if (vacio) return;
    const payload = { text, media: fotos };

    // Se limpia antes de que resuelva la action: el post ya está aceptado y
    // dejar el texto en la caja invita a publicarlo dos veces.
    setText("");
    setFotos([]);
    // Antes de esperar a la action, por lo mismo: el post ya está aceptado y
    // dejar la hoja abierta durante el round-trip invita a publicarlo dos
    // veces. La confirmación la da la snackbar, que se ve por encima.
    onPublished?.();

    startTransition(async () => {
      await publishPost(payload.text, payload.media);
      // `refresh` re-corre el layout del módulo público: sin esto el post sale
      // pero el badge de la campana (que vive en `AppShell`, del lado servidor)
      // no se entera hasta recargar.
      router.refresh();
      snack({ message: "Publicado" });
    });
  };

  return (
    <Card variant="outline" padding="md" className="flex flex-col gap-3">
      <div className="flex gap-3">
        {/* eslint-disable-next-line @next/next/no-img-element -- data-URI */}
        <img src={session.avatar} alt="" className="size-10 shrink-0 rounded-full" />
        <Textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={`¿Qué estás pensando, ${session.name.split(" ")[0]}?`}
          rows={2}
          autoResize
          maxLength={500}
          showCount
          aria-label="Texto de la publicación"
        />
      </div>

      {fotos.length > 0 && (
        <ul className="grid grid-cols-4 gap-2">
          {fotos.map((f, i) => (
            <li key={f.src} className="relative aspect-square">
              {/* eslint-disable-next-line @next/next/no-img-element -- data-URI */}
              <img src={f.src} alt={f.alt} className="size-full rounded-xl object-cover" />
              <button
                type="button"
                aria-label={`Quitar ${f.alt}`}
                onClick={() => {
                  setFotos((prev) => prev.filter((_, j) => j !== i));
                  // El archivo ya está en el bucket: sacarlo de la lista también
                  // lo borra de ahí. Best-effort, no bloquea la UI.
                  void deletePostImage(f.path);
                }}
                className="absolute right-1 top-1 grid size-6 place-items-center rounded-full bg-black/65 text-white"
              >
                <CloseIcon className="size-3.5" width="1em" height="1em" />
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className="flex items-center gap-2">
        <Button
          variant="ghost"
          size="sm"
          loading={leyendo}
          disabled={fotos.length >= MAX_FOTOS}
          leftIcon={<ImageIcon className="size-5" width="1em" height="1em" />}
          onClick={() => fileRef.current?.click()}
        >
          Foto
        </Button>
        <span className="text-xs text-muted">
          {fotos.length}/{MAX_FOTOS}
        </span>

        <Button
          className="ml-auto"
          size="sm"
          loading={pending}
          // También bloqueado mientras sube una foto: si no, Publicar saldría
          // sin la imagen que todavía está en camino al bucket.
          disabled={vacio || leyendo}
          rightIcon={<SendIcon className="size-4" width="1em" height="1em" />}
          onClick={publicar}
        >
          Publicar
        </Button>
      </div>

      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={(e) => void addFiles(e.target.files)}
      />
    </Card>
  );
}
