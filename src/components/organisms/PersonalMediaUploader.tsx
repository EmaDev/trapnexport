"use client";

import { useOptimistic, useRef, useState, useTransition } from "react";
import { Button, Card, useSnackbar } from "lib-kit-components";

import { PlusIcon, TrashIcon, VideoIcon } from "@/components/atoms/icons";
import { MAX_VIDEO_BYTES, uploadMedia } from "@/lib/media-upload";
import { addGalleryItem, removeGalleryItem } from "@/lib/social/actions";
import type { GalleryItem } from "@/lib/social/types";

const MB = (bytes: number) => Math.round(bytes / (1024 * 1024));

type Accion = { tipo: "alta"; item: GalleryItem } | { tipo: "baja"; id: string };

/** El carrete personal: subir fotos y videos propios al perfil.
 *
 *  No es el compositor. Lo que entra acá NO va al feed: queda en el perfil
 *  como material propio. Son dos gestos distintos y por eso son dos cajas
 *  distintas — mezclarlas obligaría a preguntar "¿esto lo publico o no?" en
 *  cada subida.
 *
 *  Las fotos se reescalan antes de salir; los videos van tal cual y por eso
 *  tienen tope de tamaño (`MAX_VIDEO_BYTES`): viajan como data-URI dentro de
 *  la Server Action, no hay bucket todavía.
 *
 *  `useOptimistic` y no `useState`: la lista real vive en el servidor y baja
 *  por props después de que la action revalide. El estado optimista pinta el
 *  ítem al instante y se descarta solo cuando llegan las props nuevas, sin
 *  quedar como una segunda fuente de verdad que haya que sincronizar.
 */
export function PersonalMediaUploader({ items }: { items: GalleryItem[] }) {
  const { snack } = useSnackbar();
  const fileRef = useRef<HTMLInputElement>(null);
  const [subiendo, setSubiendo] = useState(false);
  const [enviando, startTransition] = useTransition();

  const [vista, aplicar] = useOptimistic(items, (lista: GalleryItem[], a: Accion) =>
    a.tipo === "alta" ? [a.item, ...lista] : lista.filter((g) => g.id !== a.id),
  );

  const subir = async (files: FileList | null) => {
    if (!files?.length) return;
    setSubiendo(true);

    try {
      // Cada archivo se sube al bucket acá mismo; lo que falla avisa por su
      // nombre y no frena a los demás. Lo que queda en `listos` es lo que ya
      // está arriba: URL pública más la ruta, que es lo único que viaja después
      // por la Server Action.
      const listos: {
        kind: GalleryItem["kind"];
        src: string;
        path: string;
        alt: string;
      }[] = [];

      for (const file of Array.from(files)) {
        const res = await uploadMedia(file);
        if (!res.ok) {
          snack({ message: `${file.name}: ${res.error}`, variant: "error" });
          continue;
        }
        listos.push({
          kind: res.kind ?? "image",
          src: res.src,
          path: res.path,
          alt: file.name.replace(/\.[^.]+$/, "").slice(0, 80) || "Sin titulo",
        });
      }
      if (listos.length === 0) return;

      startTransition(async () => {
        for (const [i, m] of listos.entries()) {
          aplicar({
            tipo: "alta",
            item: {
              id: `tmp_${Date.now()}_${i}`,
              addedAt: Date.now(),
              kind: m.kind,
              src: m.src,
              alt: m.alt,
            },
          });
        }
        // En serie y no en paralelo: son escrituras que además mueven el
        // contador `stats.gallery` de la misma cuenta, y lanzarlas todas juntas
        // es pelearse por el mismo documento.
        for (const m of listos) await addGalleryItem(m);
      });
    } finally {
      setSubiendo(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const borrar = (item: GalleryItem) => {
    startTransition(async () => {
      aplicar({ tipo: "baja", id: item.id });
      await removeGalleryItem(item.id);
      snack({ message: item.kind === "video" ? "Video eliminado" : "Foto eliminada" });
    });
  };

  return (
    <Card variant="outline" padding="md" className="flex flex-col gap-3">
      <div className="flex items-center gap-3">
        <div className="min-w-0">
          <h3 className="text-sm font-semibold">Mis fotos y videos</h3>
          <p className="text-xs text-muted">
            Material propio, sólo para tu perfil. Videos de hasta {MB(MAX_VIDEO_BYTES)} MB.
          </p>
        </div>
        <Button
          className="ml-auto shrink-0"
          size="sm"
          variant="outline"
          loading={subiendo || enviando}
          leftIcon={<PlusIcon className="size-4" width="1em" height="1em" />}
          onClick={() => fileRef.current?.click()}
        >
          Subir
        </Button>
      </div>

      <input
        ref={fileRef}
        type="file"
        accept="image/*,video/*"
        multiple
        className="hidden"
        onChange={(e) => void subir(e.target.files)}
      />

      {vista.length === 0 ? (
        <p className="rounded-xl border border-dashed border-border px-4 py-6 text-center text-sm text-muted">
          Todavía no subiste nada. Tocá <strong className="font-semibold">Subir</strong> y
          elegí fotos o videos de tu galería.
        </p>
      ) : (
        <ul className="grid grid-cols-3 gap-2">
          {vista.map((item) => (
            <li key={item.id} className="relative aspect-square overflow-hidden rounded-xl bg-surface-alt">
              {item.kind === "video" ? (
                <>
                  {/* `preload="metadata"`: sin esto el navegador se baja los
                      data-URI enteros de todos los clips al pintar la grilla. */}
                  <video
                    src={item.src}
                    controls
                    playsInline
                    preload="metadata"
                    className="size-full object-cover"
                    aria-label={item.alt}
                  />
                  <span className="pointer-events-none absolute left-1 top-1 grid size-6 place-items-center rounded-md bg-black/65 text-white">
                    <VideoIcon className="size-3.5" width="1em" height="1em" />
                  </span>
                </>
              ) : (
                /* eslint-disable-next-line @next/next/no-img-element -- data-URI */
                <img src={item.src} alt={item.alt} className="size-full object-cover" />
              )}

              <button
                type="button"
                aria-label={`Eliminar ${item.alt}`}
                onClick={() => borrar(item)}
                className="absolute right-1 top-1 grid size-7 place-items-center rounded-full bg-black/65 text-white transition-colors hover:bg-danger"
              >
                <TrashIcon className="size-4" width="1em" height="1em" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
