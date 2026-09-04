"use client";

import { useCallback, useEffect, useState } from "react";
import { BottomSheet, Button, usePrefersReducedMotion, useSnackbar } from "lib-kit-components";

import { DownloadIcon, InstagramIcon, WhatsAppIcon } from "@/components/atoms/icons";
import { PlayerCard } from "@/components/organisms/PlayerCard";
import { ESTILOS, PALETAS, type CartaVM, type EstiloCarta } from "@/lib/carta/carta";
import { textoCarta } from "@/lib/carta/compartir";
import { renderCarta } from "@/lib/carta/render";
import {
  abrirWhatsApp,
  compartirEnInstagram,
  copiarImagen,
  descargarImagen,
} from "@/lib/invitacion/compartir";
import { absoluteUrl } from "@/lib/site";

/** La hoja de "Ver carta jugador": la carta, los tres estilos y compartir.
 *
 *  Tres decisiones que se explican solas mirando el código pero no mirando la
 *  pantalla:
 *
 *  1. **El PNG se pre-genera.** Apenas se abre la hoja —y cada vez que cambia
 *     el estilo— se dibuja la carta en un canvas y se guarda el blob. No es
 *     optimización: Safari descarta `navigator.share` y `clipboard.write` si
 *     entre el gesto del usuario y la llamada hubo un `await` largo, y dibujar
 *     la carta lo es. Es el mismo motivo por el que
 *     `lib/invitacion/compartir.ts` expone `prepararStory` aparte.
 *  2. **`dragToClose` apagado.** La carta se inclina con el dedo
 *     (`onPointerMove`); con el arrastre activo, mover el dedo hacia abajo
 *     sobre la carta cierra la hoja en vez de inclinarla.
 *  3. **La hoja monta la carta sólo cuando está abierta.** El efecto corre un
 *     `requestAnimationFrame` continuo mientras está en reposo, y dejarlo vivo
 *     debajo de una hoja cerrada es un bucle por cuadro que nadie mira.
 */
export function PlayerCardSheet({
  carta,
  open,
  onClose,
}: {
  carta: CartaVM;
  open: boolean;
  onClose: () => void;
}) {
  const { snack } = useSnackbar();
  const quieto = usePrefersReducedMotion();
  const [estilo, setEstilo] = useState<EstiloCarta>("clasica");

  /** El PNG dibujado, junto con **de qué** se dibujó.
   *
   *  Guardar el estilo y la carta al lado del blob, en vez de un `png` suelto
   *  más un `dibujando`, es lo que hace imposible compartir una imagen vieja:
   *  `vigente` compara contra lo que se está mostrando ahora, así que apenas
   *  cambia el estilo —o el perfil, si la persona se cambió el avatar— el blob
   *  anterior deja de contar sin que haya que acordarse de limpiarlo. También
   *  evita el `setState` síncrono dentro del efecto, que encadena renders. */
  const [hecho, setHecho] = useState<{
    estilo: EstiloCarta;
    carta: CartaVM;
    blob: Blob | null;
  } | null>(null);

  const vigente = hecho !== null && hecho.estilo === estilo && hecho.carta === carta;
  const png = vigente ? hecho.blob : null;
  const dibujando = open && !vigente;

  const url = absoluteUrl(`/u/${carta.handle}`);
  const texto = textoCarta(carta.nombre, carta.general, carta.club, url);

  useEffect(() => {
    if (!open) return;
    // La bandera y no un contador: al cambiar de estilo el efecto se limpia y
    // se vuelve a correr, y el dibujo anterior queda descartado por su propia
    // clausura sin poder pisar al nuevo.
    let vivo = true;
    renderCarta(carta, estilo).then((blob) => {
      if (vivo) setHecho({ estilo, carta, blob });
    });
    return () => {
      vivo = false;
    };
  }, [open, estilo, carta]);

  /** Todas las acciones necesitan el PNG. Si todavía se está dibujando —o si
   *  falló—, avisa en vez de no hacer nada: un botón que no responde se lee
   *  como roto. */
  const conPng = useCallback(
    (accion: (blob: Blob) => void | Promise<void>) => () => {
      if (dibujando) {
        snack({ message: "La carta se está preparando, probá en un segundo." });
        return;
      }
      if (!png) {
        snack({ message: "No se pudo preparar la imagen.", variant: "error" });
        return;
      }
      void accion(png);
    },
    [dibujando, png, snack],
  );

  const copiar = conPng(async (blob) => {
    const r = await copiarImagen(blob);
    if (r === "copiado") {
      snack({ message: "Imagen copiada", variant: "success" });
      return;
    }
    if (r === "sin-soporte") {
      // Firefox y Safari viejos no implementan `ClipboardItem` con PNG. No
      // falló nada: se baja el archivo, que es el mismo resultado con un paso
      // más, y se lo dice.
      descargarImagen(blob, `carta-${carta.handle}.png`);
      snack({ message: "Tu navegador no copia imágenes: la descargamos." });
      return;
    }
    snack({ message: "No se pudo copiar la imagen.", variant: "error" });
  });

  const instagram = conPng(async (blob) => {
    const r = await compartirEnInstagram(blob, carta.nombre, texto, "carta");
    if (r === "descarga") {
      snack({ message: "Carta descargada: subila a tu historia de Instagram." });
    }
    if (r === "error") snack({ message: "No se pudo compartir la carta.", variant: "error" });
    // "sistema" y "cancelado" no dicen nada: en el primero la hoja nativa ya
    // dio su propia devolución, y en el segundo la persona decidió salir.
  });

  const whatsapp = conPng(async (blob) => {
    const archivo = new File([blob], `carta-${carta.handle}.png`, { type: "image/png" });

    // WhatsApp acepta las dos cosas y por eso este botón es el único con dos
    // caminos: si el sistema sabe compartir archivos, va la imagen —que es lo
    // que la persona quiere mandar—; si no, va el link al perfil por `wa.me`,
    // que es lo único que un navegador de escritorio puede hacer.
    if (navigator.canShare?.({ files: [archivo] })) {
      try {
        await navigator.share({ files: [archivo], text: texto });
        return;
      } catch (e) {
        if ((e as DOMException | undefined)?.name === "AbortError") return;
        // Si el share falla por cualquier otra razón, el link sigue sirviendo.
      }
    }
    abrirWhatsApp(texto);
  });

  return (
    <BottomSheet
      open={open}
      onClose={onClose}
      title="Tu carta"
      size="xl"
      showClose
      dragToClose={false}
    >
      <div className="flex flex-col items-center gap-5 pb-2">
        {open && <PlayerCard carta={carta} estilo={estilo} quieto={quieto} />}

        {!carta.conTrayectoria && (
          // No presentar como dato lo que es una estimación. Los que tienen
          // ficha en `/historia` sí traen números que ya existían en el club.
          <p className="max-w-xs text-center text-xs text-muted">
            Los valores se estiman con tu puesto y tu ficha. Completá
            posición, edad y dorsal para afinarla.
          </p>
        )}

        {/* Selector de diseño. Es un `radiogroup` y no tres botones sueltos:
            son opciones excluyentes de una misma cosa y así el lector de
            pantalla anuncia "1 de 3". */}
        <div role="radiogroup" aria-label="Diseño de la carta" className="flex gap-2">
          {ESTILOS.map((id) => {
            const p = PALETAS[id];
            const activo = id === estilo;
            return (
              <button
                key={id}
                type="button"
                role="radio"
                aria-checked={activo}
                onClick={() => setEstilo(id)}
                className={`flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm font-medium transition-colors ${
                  activo ? "border-primary bg-primary/10 text-primary" : "border-border text-muted"
                }`}
              >
                <span
                  aria-hidden
                  className="size-4 rounded-full"
                  style={{
                    background: `linear-gradient(140deg, ${p.fondo[0]}, ${p.fondo[1]})`,
                    boxShadow: `0 0 0 1px ${p.filete}`,
                  }}
                />
                {p.nombre}
              </button>
            );
          })}
        </div>

        {/* Qué cambia con cada uno. El selector muestra el color de la carta
            en la muestra, pero lo que cambia es el maquetado entero, y eso una
            bolita de color no lo puede decir. */}
        <p className="-mt-3 max-w-xs text-center text-xs text-muted">
          {PALETAS[estilo].descripcion}
        </p>

        <div className="grid w-full max-w-sm grid-cols-1 gap-2 sm:grid-cols-3">
          <Button
            variant="outline"
            fullWidth
            loading={dibujando}
            leftIcon={<DownloadIcon className="size-5" width="1em" height="1em" />}
            onClick={copiar}
          >
            Copiar imagen
          </Button>
          <Button
            variant="outline"
            fullWidth
            loading={dibujando}
            leftIcon={<InstagramIcon className="size-5" width="1em" height="1em" />}
            onClick={instagram}
          >
            Instagram
          </Button>
          <Button
            variant="outline"
            fullWidth
            loading={dibujando}
            leftIcon={<WhatsAppIcon className="size-5" width="1em" height="1em" />}
            onClick={whatsapp}
          >
            WhatsApp
          </Button>
        </div>
      </div>
    </BottomSheet>
  );
}
