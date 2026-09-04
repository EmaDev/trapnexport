"use client";

import { useEffect, useRef, useState } from "react";
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
 *    subir una foto  → se comprime a 512px y va a Firebase Storage; por la
 *                      action viaja la `downloadURL` más la ruta del bucket
 *    elegir generado → `avatarUrl(nombre, semilla)`, el mismo helper que usa
 *                      el store para sembrar los avatares del plantel
 *
 *  Las opciones generadas existen porque no todo el mundo quiere subir una
 *  foto, y un avatar con iniciales en el violeta de marca se ve mejor en el
 *  feed que una silueta gris. Son doce semillas fijas: el mismo handle da
 *  siempre las mismas doce, así que la grilla no cambia entre visitas.
 *
 *  ## Elegir y guardar son dos pasos
 *
 *  Antes eran uno solo: tocar una foto la subía y la aplicaba de una. Ahora
 *  elegir sólo llena `pendiente` —que es lo que dibuja la vista previa— y
 *  recién `guardar()` sube y escribe. Una foto de perfil se mira antes de
 *  aceptarla, y además así hay un lugar donde mostrar que algo falló: con el
 *  camino de un paso, un error de subida o de escritura dejaba la pantalla
 *  igual que un éxito.
 *
 *  ## Dónde vive el input
 *
 *  **Fuera del `BottomSheet`, a propósito.** El sheet es un `motion.div` con
 *  `drag` adentro de un `AnimatePresence`: cualquier cosa que lo cierre
 *  —arrastrarlo, tocar el fondo, volver a la app después del selector nativo—
 *  desmonta su contenido, y un `<input type="file">` desmontado nunca dispara
 *  su `change`, así que elegir una foto no hacía nada. Acá afuera sobrevive.
 *
 *  Y no se esconde con `display:none` (`className="hidden"`) sino con opacidad:
 *  Safari en iOS ignora el `.click()` programático sobre un input que no está
 *  renderizado, que es la otra mitad de por qué el botón no abría nada en el
 *  teléfono.
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
  /** lo que está guardado hoy; se actualiza optimista recién al guardar */
  const [shown, setShown] = useState(src);
  /** lo elegido y todavía sin guardar */
  const [pendiente, setPendiente] = useState<
    { src: string; file?: File; objectUrl?: string } | null
  >(null);
  const [busy, setBusy] = useState(false);

  const presets = Array.from({ length: 12 }, (_, i) => avatarUrl(name, `${handle}-v${i}`));

  /*  El `objectURL` de la vista previa se revoca a mano: si no, el blob de la
   *  foto elegida queda en memoria hasta recargar la página, y acá se puede
   *  elegir una atrás de otra sin guardar ninguna. */
  const soltarPreview = (p: { objectUrl?: string } | null) => {
    if (p?.objectUrl) URL.revokeObjectURL(p.objectUrl);
  };
  useEffect(() => () => soltarPreview(pendiente), [pendiente]);

  const cerrar = () => {
    soltarPreview(pendiente);
    setPendiente(null);
    setOpen(false);
  };

  const elegirArchivo = (file: File | undefined) => {
    // Sin esto, elegir el MISMO archivo dos veces seguidas no dispara `change`
    // y parece que el botón dejó de andar.
    if (fileRef.current) fileRef.current.value = "";
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      snack({ message: "Ese archivo no es una imagen.", variant: "error" });
      return;
    }

    soltarPreview(pendiente);
    const objectUrl = URL.createObjectURL(file);
    setPendiente({ src: objectUrl, file, objectUrl });
    // El selector nativo saca la app de foco; si el sheet se cerró de camino,
    // se vuelve a abrir para mostrar lo que se acaba de elegir.
    setOpen(true);
  };

  /** Sube (si hay archivo) y escribe. Es el único lugar que toca la cuenta.
   *
   *  `path` sólo lo trae la foto subida: los presets son avatares generados por
   *  `avatarUrl` y no son un archivo del bucket. Sin él, `updateAvatar` borra el
   *  `avatarPath` guardado — que es lo correcto, porque volver a un preset deja
   *  la foto anterior sin nadie que la referencie. */
  const guardar = async () => {
    if (!pendiente || busy) return;
    setBusy(true);
    try {
      let next = pendiente.src;
      let path: string | undefined;

      if (pendiente.file) {
        const res = await uploadAvatar(pendiente.file);
        if (!res.ok) {
          snack({ message: res.error, variant: "error" });
          return;
        }
        next = res.src;
        path = res.path;
      }

      const guardado = await updateAvatar(next, path);
      if (!guardado.ok) {
        snack({ message: guardado.error, variant: "error" });
        return;
      }

      setShown(next);
      cerrar();
      snack({ message: "Foto de perfil actualizada" });
    } catch {
      snack({ message: "No se pudo guardar la foto. Probá de nuevo.", variant: "error" });
    } finally {
      setBusy(false);
    }
  };

  const vista = pendiente?.src ?? shown;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Cambiar foto de perfil"
        className="group relative size-20 shrink-0 rounded-full outline-none ring-2 ring-white/70 focus-visible:ring-4 focus-visible:ring-white"
      >
        {/* eslint-disable-next-line @next/next/no-img-element -- data-URI o downloadURL */}
        <img src={shown} alt="" className="size-20 rounded-full object-cover" />
        <span className="absolute -bottom-0.5 -right-0.5 grid size-7 place-items-center rounded-full bg-primary text-white ring-2 ring-surface">
          <CameraIcon className="size-4" width="1em" height="1em" />
        </span>
      </button>

      {/* Fuera del sheet y escondido por opacidad: ver el comentario de arriba. */}
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        aria-hidden
        tabIndex={-1}
        className="pointer-events-none fixed left-0 top-0 size-px opacity-0"
        onChange={(e) => elegirArchivo(e.target.files?.[0])}
      />

      <BottomSheet
        open={open}
        onClose={cerrar}
        title="Foto de perfil"
        description="Subí una foto tuya o elegí uno de los avatares del club."
        size="auto"
        footer={
          pendiente ? (
            <div className="flex gap-2">
              <Button variant="outline" fullWidth disabled={busy} onClick={cerrar}>
                Cancelar
              </Button>
              <Button fullWidth loading={busy} onClick={() => void guardar()}>
                Guardar foto
              </Button>
            </div>
          ) : undefined
        }
      >
        <div className="flex flex-col gap-5 pb-2">
          {/* Vista previa de lo elegido. Sólo aparece con algo pendiente: sin
              esto no había forma de ver la foto antes de que quedara puesta. */}
          {pendiente && (
            <div className="flex items-center gap-4 rounded-2xl border border-border p-3">
              {/* eslint-disable-next-line @next/next/no-img-element -- blob local */}
              <img
                src={pendiente.src}
                alt="Vista previa de la nueva foto de perfil"
                className="size-20 shrink-0 rounded-full object-cover"
              />
              <div className="min-w-0">
                <p className="text-sm font-semibold">Así va a quedar</p>
                <p className="text-xs text-muted">
                  Todavía no se guardó. Tocá <strong>Guardar foto</strong> para confirmar.
                </p>
              </div>
            </div>
          )}

          <Button
            variant="outline"
            fullWidth
            disabled={busy}
            leftIcon={<ImageIcon className="size-5" width="1em" height="1em" />}
            onClick={() => fileRef.current?.click()}
          >
            {pendiente?.file ? "Elegir otra foto" : "Subir una foto"}
          </Button>

          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">
              Avatares del club
            </p>
            <ul className="grid grid-cols-6 gap-2">
              {presets.map((preset) => {
                const active = preset === vista;
                return (
                  <li key={preset}>
                    <button
                      type="button"
                      aria-label="Usar este avatar"
                      aria-pressed={active}
                      disabled={busy}
                      onClick={() => {
                        soltarPreview(pendiente);
                        setPendiente({ src: preset });
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
