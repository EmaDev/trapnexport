"use client";

import { useState } from "react";
import { BottomSheet, Button, usePlatform, usePwaInstall, useSnackbar } from "lib-kit-components";

import {
  CheckIcon,
  DotsVerticalIcon,
  IosShareIcon,
  PlusIcon,
  SparkleIcon,
} from "@/components/atoms/icons";
import { APP_NAME } from "@/lib/site";

/** Un paso de la receta: el ícono que la persona va a tocar, y qué tocar. */
interface Paso {
  icon: React.ReactNode;
  texto: React.ReactNode;
}

/** La ayuda de "cómo instalar la app".
 *
 *  Existe porque instalar una PWA no tiene un botón universal: en Chromium hay
 *  un evento (`beforeinstallprompt`) que abre el diálogo nativo, y en iOS no
 *  hay absolutamente nada — sólo el menú de compartir de Safari. Un único
 *  botón "Instalar" sería mentira en la mitad de los teléfonos, así que esta
 *  hoja resuelve las dos cosas: si el navegador puede, ofrece el botón; si no,
 *  muestra la receta exacta de esa plataforma.
 *
 *  No reemplaza a `PwaInstallPrompt` —el cartel que `AppShell` levanta solo y
 *  que se puede posponer catorce días—: eso es la app ofreciéndose, esto es la
 *  persona preguntando. Por eso ésta no tiene "no mostrar más" y se abre
 *  siempre desde el ícono de ayuda.
 *
 *  Los íconos de los pasos son los del sistema y no los de la app (el compartir
 *  cuadrado de iOS, los tres puntos de Chrome): la instrucción sirve si la
 *  persona reconoce el botón que tiene que tocar en su pantalla.
 */
export function ComoInstalarSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { snack } = useSnackbar();
  const { platform, isStandalone, canInstall, install } = usePwaInstall();
  const { browser } = usePlatform();
  const [instalando, setInstalando] = useState(false);

  // En iOS sólo Safari puede instalar. Chrome, Firefox y Edge en iPhone son
  // Safari por dentro pero **no** exponen "Añadir a pantalla de inicio", así
  // que darles la receta de Safari los manda a buscar un menú que no tienen.
  const iosSinSafari = platform === "ios" && browser !== "safari";

  /** Si hay botón de instalación de un toque.
   *
   *  `canInstall` del hook incluye a iOS Safari —porque ahí SÍ se puede
   *  instalar, a mano— pero `install()` devuelve "unsupported": no existe
   *  `beforeinstallprompt` en iOS y no hay forma de abrir ese diálogo desde la
   *  página. Un botón que nunca hace nada es peor que no tenerlo, así que en
   *  iOS quedan sólo los pasos. */
  const conBotonNativo = canInstall && platform !== "ios";

  const instalar = async () => {
    setInstalando(true);
    try {
      const r = await install();
      if (r === "accepted") {
        snack({ message: "¡Listo! Buscá el ícono en tu pantalla de inicio.", variant: "success" });
        onClose();
      }
      // "dismissed" no dice nada: la persona ya vio el diálogo y decidió. Y
      // "unsupported" tampoco: si llegó acá es porque el botón se ofreció, y
      // abajo siguen los pasos manuales para hacerlo igual.
    } finally {
      setInstalando(false);
    }
  };

  const pasos: Paso[] =
    platform === "ios"
      ? [
          {
            icon: <IosShareIcon />,
            texto: (
              <>
                Tocá <strong className="font-semibold">Compartir</strong> en la barra de abajo de
                Safari.
              </>
            ),
          },
          {
            icon: <PlusIcon />,
            texto: (
              <>
                Bajá en la lista y elegí{" "}
                <strong className="font-semibold">Añadir a pantalla de inicio</strong>.
              </>
            ),
          },
          {
            icon: <CheckIcon />,
            texto: (
              <>
                Confirmá con <strong className="font-semibold">Añadir</strong>. El ícono queda
                junto al resto de tus apps.
              </>
            ),
          },
        ]
      : platform === "android"
        ? [
            {
              icon: <DotsVerticalIcon />,
              texto: (
                <>
                  Abrí el menú <strong className="font-semibold">⋮</strong> arriba a la derecha del
                  navegador.
                </>
              ),
            },
            {
              icon: <PlusIcon />,
              texto: (
                <>
                  Elegí <strong className="font-semibold">Instalar app</strong> —o{" "}
                  <strong className="font-semibold">Añadir a pantalla principal</strong>, según la
                  versión.
                </>
              ),
            },
            {
              icon: <CheckIcon />,
              texto: <>Confirmá y listo: se abre sola, sin la barra del navegador.</>,
            },
          ]
        : [
            {
              icon: <PlusIcon />,
              texto: (
                <>
                  Buscá el ícono de <strong className="font-semibold">instalar</strong> al final de
                  la barra de direcciones (una pantalla con una flecha).
                </>
              ),
            },
            {
              icon: <DotsVerticalIcon />,
              texto: (
                <>
                  Si no está, abrí el menú del navegador y elegí{" "}
                  <strong className="font-semibold">Instalar {APP_NAME}</strong>.
                </>
              ),
            },
            {
              icon: <CheckIcon />,
              texto: <>Se abre en su propia ventana, como cualquier programa.</>,
            },
          ];

  return (
    <BottomSheet
      open={open}
      onClose={onClose}
      title={`Cómo instalar ${APP_NAME}`}
      description="Se instala como una app de verdad: ícono propio, pantalla completa y sin la barra del navegador."
      size="auto"
      showClose
    >
      <div className="flex flex-col gap-4 pb-2">
        {isStandalone ? (
          // Ya la tiene instalada: mostrarle la receta sería mandarla a hacer
          // algo que ya hizo.
          <div className="flex items-center gap-3 rounded-2xl border border-success/30 bg-success/5 p-4">
            <CheckIcon className="size-6 shrink-0 text-success" />
            <p className="text-sm">
              Ya la estás usando instalada. Nada que hacer acá.
            </p>
          </div>
        ) : (
          <>
            {iosSinSafari && (
              // El único caso donde no hay receta posible: hay que cambiar de
              // navegador primero, y decirlo es más útil que dar pasos que en
              // esta pantalla no existen.
              <div className="rounded-2xl border border-primary/25 bg-primary/5 p-4 text-sm">
                En iPhone sólo <strong className="font-semibold">Safari</strong> puede instalar
                apps. Abrí esta misma página en Safari y volvé a tocar la ayuda.
              </div>
            )}

            <ol className="flex flex-col gap-3">
              {pasos.map((paso, i) => (
                <li key={i} className="flex items-start gap-3">
                  <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-surface-alt text-primary [&>svg]:size-5">
                    {paso.icon}
                  </span>
                  <p className="pt-1.5 text-sm leading-snug">
                    <span className="mr-1 font-semibold text-muted">{i + 1}.</span>
                    {paso.texto}
                  </p>
                </li>
              ))}
            </ol>

            {/* Los pasos van SIEMPRE, también cuando hay botón: es el camino
                que funciona en todos lados, y si el diálogo nativo no aparece
                —pasó el evento, cambió el navegador— la persona no queda sin
                salida. */}
            {conBotonNativo && (
              <Button fullWidth loading={instalando} onClick={instalar}>
                Instalar ahora
              </Button>
            )}
          </>
        )}

        <div className="flex items-start gap-3 rounded-2xl bg-surface-alt p-4">
          <SparkleIcon className="size-5 shrink-0 text-primary" />
          <p className="text-xs text-muted">
            Instalada abre más rápido, entra en pantalla completa y puede avisarte con
            notificaciones cuando pasa algo en el club.
          </p>
        </div>
      </div>
    </BottomSheet>
  );
}
