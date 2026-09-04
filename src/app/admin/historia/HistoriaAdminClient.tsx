"use client";

import { useState, useTransition } from "react";
import { Button, Tabs, useSnackbar, type TabItem } from "lib-kit-components";

import type { FichaCuentaRow } from "@/lib/admin/cuentas";
import { importarSemilla } from "@/lib/historia/actions";
import type { ClubInput } from "@/lib/historia/actions";
import type { Historia } from "@/lib/historia/types";
import { FrasesPanel, MuseoPanel, VideoPanel } from "./ArchivoPanels";
import { ClubPanel } from "./ClubPanel";
import { EtapasPanel } from "./EtapasPanel";
import { FichasPanel } from "./FichasPanel";
import { JugadoresPanel } from "./JugadoresPanel";
import { TemporadasPanel } from "./TemporadasPanel";

/** El panel de la historia del club: las secciones de `/historia`, cada una
 *  editable en su solapa.
 *
 *  Es la única pantalla del panel con `Tabs` en vez de una entrada propia en el
 *  `SideBar` por sección, y el motivo es que todas son **una** pantalla
 *  pública. Editar una temporada casi siempre implica mirar los jugadores (el
 *  salón de la fama los referencia por id) y las etapas (la temporada 2026 y la
 *  etapa 2026 cuentan lo mismo desde dos alturas distintas). Ocho ítems sueltos
 *  en la barra lateral —donde hoy hay siete en total— harían del panel un
 *  índice de la historia en vez de un panel.
 *
 *  Siete de las ocho solapas reciben los datos **ya cargados** por el Server
 *  Component, en un solo `getHistoria()`. Es la misma lectura que hace la
 *  pantalla pública, y por eso el panel muestra exactamente lo que ve el resto:
 *  si algo se sigue sirviendo de la semilla, acá también aparece la semilla —
 *  con el aviso de arriba para que no se confunda con contenido guardado.
 *
 *  La octava, "Fichas", es la excepción y conviene tenerlo presente: no edita
 *  la historia del club sino la ficha deportiva de cada **cuenta**, que es lo
 *  que `/historia` muestra en la trayectoria de quien la cargó. Está acá y no
 *  en `/admin/usuarios` porque el resultado se ve en esta pantalla pública, y
 *  por eso tampoco entra en el aviso de la semilla: las cuentas no tienen
 *  contenido de arranque que importar.
 */

const TABS: TabItem[] = [
  { id: "club", label: "Club" },
  { id: "etapas", label: "Etapas" },
  { id: "temporadas", label: "Temporadas" },
  { id: "jugadores", label: "Jugadores" },
  { id: "fichas", label: "Fichas" },
  { id: "frases", label: "Frases" },
  { id: "museo", label: "Museo" },
  { id: "video", label: "Video" },
];

/** Qué solapa cubre cada clave de `estadoDeCarga`, para el aviso de arriba. */
const SECCION_DE: Record<string, string> = {
  club: "Club",
  eras: "Etapas",
  temporadas: "Temporadas",
  jugadores: "Jugadores",
  frases: "Frases",
  fotos: "Museo",
  clips: "Video",
};

export function HistoriaAdminClient({
  historia,
  fichas,
  cargado,
}: {
  historia: Historia;
  /** las cuentas con su ficha deportiva, para la solapa "Fichas".
   *
   *  Viene aparte de `historia` y no adentro porque no es historia del club:
   *  son cuentas de `trapnexport-user`, y la única razón de que se editen en
   *  esta pantalla es que lo que se carga ahí se ve en `/historia`. */
  fichas: FichaCuentaRow[];
  cargado: Record<string, boolean>;
}) {
  const { snack } = useSnackbar();
  const [pending, startTransition] = useTransition();
  const [seccion, setSeccion] = useState("club");

  const pendientes = Object.entries(cargado)
    .filter(([, ok]) => !ok)
    .map(([k]) => SECCION_DE[k] ?? k);

  const club: ClubInput = {
    ...historia.club,
    trophies: historia.trophies,
    balance: historia.balance,
  };

  const importar = () =>
    startTransition(async () => {
      const importadas = await importarSemilla();
      snack({
        message: importadas.length
          ? `Importado: ${importadas.join(", ")}`
          : "Ya estaba todo en la base: no se pisó nada",
        variant: importadas.length ? "success" : "info",
      });
    });

  return (
    <div className="flex flex-col gap-5">
      {pendientes.length > 0 && (
        // Aviso informativo, no una advertencia: editar una sección que
        // todavía se sirve del texto de arranque es seguro — la acción
        // siembra esa sección antes de escribir (ver `sembrarSeccion` en
        // `historia/actions.ts`). Se dice igual porque explica por qué hay
        // contenido cargado sin que nadie lo haya escrito, y porque hacerlo de
        // una vez es más prolijo que ir llenando las colecciones de a una.
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-surface-alt/60 p-4">
          <div className="min-w-0">
            <p className="text-sm font-semibold">
              {pendientes.length === 1
                ? "Una sección todavía muestra el contenido de arranque"
                : "Algunas secciones todavía muestran el contenido de arranque"}
            </p>
            <p className="mt-0.5 text-sm text-muted">
              {pendientes.join(", ")}. Se {pendientes.length === 1 ? "puede" : "pueden"}{" "}
              editar igual —al guardar se cargan solas—, o importarlas todas de una vez
              acá. En ningún caso se pisa lo que ya esté cargado.
            </p>
          </div>
          <Button onClick={importar} loading={pending} variant="secondary">
            Importar contenido actual
          </Button>
        </div>
      )}

      <Tabs
        items={TABS}
        value={seccion}
        onChange={setSeccion}
        variant="segmented"
        scrollable
        panels={{
          club: <ClubPanel inicial={club} />,
          etapas: <EtapasPanel eras={historia.eras} />,
          temporadas: (
            <TemporadasPanel seasons={historia.seasons} players={historia.players} />
          ),
          jugadores: <JugadoresPanel players={historia.players} />,
          fichas: <FichasPanel cuentas={fichas} players={historia.players} />,
          frases: <FrasesPanel quotes={historia.quotes} />,
          museo: <MuseoPanel gallery={historia.gallery} />,
          video: <VideoPanel clips={historia.clips} />,
        }}
      />
    </div>
  );
}
