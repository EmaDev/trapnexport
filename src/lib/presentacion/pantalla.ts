"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

/** Lo que necesita cualquier pantalla que se proyecta: pantalla completa, que
 *  el dispositivo no se apague y —en el teléfono— que no rote sola.
 *
 *  Vive acá y no dentro de un presentador porque hay **dos** en la app y no
 *  tienen nada más en común:
 *
 *    `admin/presentacion/Presentador`        la gala de los Trap Awards
 *    `organisms/TrayectoriaPresentador`      la historia del club, en /historia
 *
 *  Son pantallas distintas —una revela ganadores con redoble, la otra recorre
 *  una línea de tiempo— pero las tres capacidades de abajo son idénticas y
 *  ninguna es trivial: el wake lock hay que volver a pedirlo después de un
 *  alt-tab, la pantalla completa sólo se concede dentro de un gesto y el
 *  bloqueo de orientación falla distinto en cada navegador. Tenerlo dos veces
 *  garantizaba que se arreglara una sola.
 */

/* ── que no se apague ────────────────────────────────────────────────────── */

/** `navigator.wakeLock` todavía no está en el `lib.dom` de todas las versiones
 *  de TypeScript y no lo trae Safari en escritorio: se declara mínimo acá y se
 *  usa detrás de un `if`. */
interface WakeLockMinimo {
  release: () => Promise<void>;
  addEventListener: (tipo: "release", cb: () => void) => void;
}

interface NavegadorConWakeLock {
  wakeLock?: { request: (tipo: "screen") => Promise<WakeLockMinimo> };
}

export function useMantenerPantallaEncendida() {
  useEffect(() => {
    const nav = navigator as Navigator & NavegadorConWakeLock;
    if (!nav.wakeLock) return;

    let lock: WakeLockMinimo | null = null;
    let vivo = true;

    const pedir = async () => {
      try {
        const nuevo = await nav.wakeLock!.request("screen");
        // El efecto pudo desmontarse mientras la promesa estaba en vuelo: sin
        // esta guarda el lock queda tomado después de cerrar la presentación.
        if (!vivo) {
          void nuevo.release();
          return;
        }
        lock = nuevo;
      } catch {
        // Sin permiso, batería baja o pestaña oculta. La presentación funciona
        // igual; lo único que se pierde es que la pantalla no se apague sola.
      }
    };

    // El navegador suelta el lock al esconder la pestaña. Volver a pedirlo al
    // reaparecer es lo que hace que sobreviva a un alt-tab a mitad de la gala.
    const alVolver = () => {
      if (document.visibilityState === "visible" && !lock) void pedir();
    };

    void pedir();
    document.addEventListener("visibilitychange", alVolver);

    return () => {
      vivo = false;
      document.removeEventListener("visibilitychange", alVolver);
      void lock?.release().catch(() => {});
      lock = null;
    };
  }, []);
}

/* ── pantalla completa ───────────────────────────────────────────────────── */

export interface PantallaCompleta {
  activa: boolean;
  entrar: () => Promise<void>;
  salir: () => Promise<void>;
}

export function usePantallaCompleta(
  ref: React.RefObject<HTMLDivElement | null>,
): PantallaCompleta {
  const [activa, setActiva] = useState(false);

  useEffect(() => {
    const sincronizar = () => setActiva(Boolean(document.fullscreenElement));
    document.addEventListener("fullscreenchange", sincronizar);
    sincronizar();
    return () => document.removeEventListener("fullscreenchange", sincronizar);
  }, []);

  const entrar = useCallback(async () => {
    // `catch` y no `throw`: el navegador rechaza el pedido si no viene de un
    // gesto o si la pestaña está embebida. La presentación sigue andando en
    // ventana, que es peor pero no es un error que valga la pena mostrar.
    try {
      await ref.current?.requestFullscreen();
    } catch {
      /* queda en ventana */
    }
  }, [ref]);

  const salir = useCallback(async () => {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
    } catch {
      /* nada que hacer */
    }
  }, []);

  // Memoizado: el objeto es dependencia del efecto del teclado, y uno nuevo por
  // render volvería a colgar y descolgar el listener con cada tecla.
  return useMemo(() => ({ activa, entrar, salir }), [activa, entrar, salir]);
}

/* ── orientación ─────────────────────────────────────────────────────────── */

/** `ScreenOrientation.lock` existe en Android/Chrome pero no en iOS ni en
 *  escritorio, y su tipo no está en todas las versiones del `lib.dom`. */
interface OrientacionBloqueable {
  lock?: (orientacion: "landscape" | "portrait") => Promise<void>;
  unlock?: () => void;
}

/** Fija la orientación del dispositivo mientras dura la presentación.
 *
 *  Sólo funciona en pantalla completa y sólo en los navegadores que la
 *  implementan —en iOS y en escritorio el pedido se rechaza—, así que es una
 *  mejora y nunca un requisito: si falla, la presentación se ve igual y el
 *  teléfono simplemente sigue rotando con el sensor. Por eso devuelve `void` y
 *  no un booleano: no hay nada que el llamador pueda hacer distinto si no se
 *  concede.
 */
export async function fijarOrientacion(cual: "landscape" | "portrait"): Promise<void> {
  const orientacion = screen.orientation as ScreenOrientation & OrientacionBloqueable;
  try {
    await orientacion.lock?.(cual);
  } catch {
    /* el dispositivo sigue rotando con el sensor */
  }
}

/** Devuelve el control de la rotación al sensor. Se llama al salir; el
 *  navegador la suelta solo al dejar la pantalla completa, pero no todos, y
 *  soltarla dos veces no cuesta nada. */
export function soltarOrientacion(): void {
  const orientacion = screen.orientation as ScreenOrientation & OrientacionBloqueable;
  try {
    orientacion.unlock?.();
  } catch {
    /* ya estaba suelta */
  }
}
