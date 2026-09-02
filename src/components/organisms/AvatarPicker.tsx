"use client";

import { useRef, useState, useTransition } from "react";
import { BottomSheet, Button, useSnackbar } from "lib-kit-components";

import { CameraIcon, CheckIcon, ImageIcon } from "@/components/atoms/icons";
import { avatarUrl } from "@/lib/media";
import { uploadAvatar } from "@/lib/media-upload";
import { updateAvatar } from "@/lib/social/actions";

/** Foto de perfil con selector.
 *
 *  Dos caminos hacia lo mismo —`updateAvatar(src)` recibe un string y no sabe
 *  de dónde salió—:
 *
 *    subir una foto  → `readImage` la reescala a 1600px y devuelve un data-URI
 *    elegir generado → `avatarUrl(nombre, semilla)`, el mismo helper que usa
 *                      el store para sembrar los avatares del plantel
 *
 *  Las opciones generadas existen porque no todo el mundo quiere subir una
 *  foto, y un avatar con iniciales en el violeta de marca se ve mejor en el
 *  feed que una silueta gris. Son doce semillas fijas: el mismo handle da
 *  siempre las mismas doce, así que la grilla no cambia entre visitas.
 *
 *  El estado es optimista (`shown`): la action revalida `/perfil` y el avatar
 *  del servidor llega un tick después; sin esto la foto recién elegida vuelve a
 *  la vieja por un frame.
 */
export function AvatarPicker({
  src,
  name,
  handle,
}: {
  src: string;
  name: string;
  handle: string;
}) {
  const { snack } = useSnackbar();
  const fileRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [shown, setShown] = useState(src);
  const [busy, setBusy] = useState(false);
  const [, startTransition] = useTransition();

  const presets = Array.from({ length: 12 }, (_, i) => avatarUrl(name, `${handle}-v${i}`));

  /*  `path` sólo lo trae la foto subida: los presets son avatares generados por
   *  `avatarUrl` y no son un archivo del bucket. Sin él, `updateAvatar` borra el
   *  `avatarPath` guardado — que es lo correcto, porque volver a un preset deja
   *  la foto anterior sin nadie que la referencie. */
  const commit = (next: string, path?: string) => {
    setShown(next);
    startTransition(() => void updateAvatar(next, path));
  };

  const pick = async (file: File | undefined) => {
    if (!file) return;
    setBusy(true);
    try {
      const res = await uploadAvatar(file);
      if (!res.ok) {
        snack({ message: res.error, variant: "error" });
        return;
      }
      commit(res.src, res.path);
      setOpen(false);
      snack({ message: "Foto de perfil actualizada" });
    } finally {
      setBusy(false);
      // Sin esto, elegir el MISMO archivo dos veces seguidas no dispara
      // `change` y parece que el botón dejó de andar.
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Cambiar foto de perfil"
        className="group relative size-20 shrink-0 rounded-full outline-none ring-2 ring-white/70 focus-visible:ring-4 focus-visible:ring-white"
      >
        {/* eslint-disable-next-line @next/next/no-img-element -- data-URI */}
        <img src={shown} alt="" className="size-20 rounded-full object-cover" />
        <span className="absolute -bottom-0.5 -right-0.5 grid size-7 place-items-center rounded-full bg-primary text-white ring-2 ring-surface">
          <CameraIcon className="size-4" width="1em" height="1em" />
        </span>
      </button>

      <BottomSheet
        open={open}
        onClose={() => setOpen(false)}
        title="Foto de perfil"
        description="Subí una foto tuya o elegí uno de los avatares del club."
        size="auto"
      >
        <div className="flex flex-col gap-5 pb-2">
          <Button
            variant="outline"
            fullWidth
            loading={busy}
            leftIcon={<ImageIcon className="size-5" width="1em" height="1em" />}
            onClick={() => fileRef.current?.click()}
          >
            Subir una foto
          </Button>

          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => void pick(e.target.files?.[0])}
          />

          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">
              Avatares del club
            </p>
            <ul className="grid grid-cols-6 gap-2">
              {presets.map((preset) => {
                const active = preset === shown;
                return (
                  <li key={preset}>
                    <button
                      type="button"
                      aria-label="Usar este avatar"
                      aria-pressed={active}
                      onClick={() => {
                        commit(preset);
                        setOpen(false);
                        snack({ message: "Foto de perfil actualizada" });
                      }}
                      className={`relative aspect-square w-full rounded-full transition-transform active:scale-95 ${
                        active ? "ring-2 ring-primary ring-offset-2 ring-offset-surface" : ""
                      }`}
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element -- data-URI */}
                      <img src={preset} alt="" className="size-full rounded-full" />
                      {active && (
                        <span className="absolute inset-0 grid place-items-center rounded-full bg-black/40 text-white">
                          <CheckIcon className="size-4" width="1em" height="1em" />
                        </span>
                      )}
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        </div>
      </BottomSheet>
    </>
  );
}
