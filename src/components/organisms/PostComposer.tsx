"use client";

import { useRef, useState, useTransition } from "react";
import { Button, Card, Textarea, useSnackbar } from "lib-kit-components";

import { CloseIcon, ImageIcon, SendIcon } from "@/components/atoms/icons";
import { readImage } from "@/lib/media-upload";
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
 *  monta un `<video>`. El día que la librería acepte video en `media`, esto es
 *  cambiar el `accept` del input y el `readImage` por `readMedia`.
 *
 *  Las fotos se reescalan en el navegador antes de salir (`readImage`): sin eso
 *  una foto de celular sola ya se pasa del `bodySizeLimit` de la Server Action.
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
  const fileRef = useRef<HTMLInputElement>(null);
  const [text, setText] = useState("");
  const [fotos, setFotos] = useState<{ src: string; alt: string }[]>([]);
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
      const leidas = await Promise.all(elegidas.map((f) => readImage(f)));

      const ok = leidas.flatMap((r, i) =>
        r.ok ? [{ src: r.src, alt: elegidas[i].name.replace(/\.[^.]+$/, "") }] : [],
      );
      const fallo = leidas.find((r) => !r.ok);
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
                onClick={() => setFotos((prev) => prev.filter((_, j) => j !== i))}
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
          disabled={vacio}
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
