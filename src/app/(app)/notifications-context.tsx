"use client";

import { createContext, useContext } from "react";
import type { AppNotification } from "lib-kit-components";

import type { SessionVM } from "@/lib/social/queries";

/** Contexto mínimo del shell público.
 *
 *  Las pantallas son Server Components, así que no pueden tener el estado del
 *  drawer de notificaciones. El estado vive en `AppShell` y cada header pide
 *  desde acá lo único que necesita: cuántas hay sin leer y cómo abrirlo. La
 *  campana es una `action` del header, no un componente — `AppHeaderCardSlot`
 *  recibe datos (`HeaderAction[]`), no nodos.
 *
 *  Va también la sesión: el compositor y las cajas de comentarios necesitan el
 *  avatar de quien escribe, y pasarlo por props desde cada página sería
 *  repetir lo mismo en cinco pantallas.
 *
 *  Y los mensajes sin leer: desde que la mensajería directa dejó de ser un tab
 *  del `BottomNav`, el badge no lo dibuja la nav sino la acción de sobre del
 *  header de cada pantalla raíz, y esa acción se arma en el cliente.
 */
export interface AppShellContextValue {
  items: AppNotification[];
  unread: number;
  open: () => void;
  session: SessionVM;
  /** conversaciones con el último mensaje sin leer */
  unreadChats: number;
}

export const NotificationsCtx = createContext<AppShellContextValue | null>(null);

export function useNotifications(): AppShellContextValue {
  const ctx = useContext(NotificationsCtx);
  if (!ctx) throw new Error("useNotifications fuera del AppShell");
  return ctx;
}

/** Atajo para las pantallas que sólo quieren saber quién está logueado. */
export const useSession = (): SessionVM => useNotifications().session;
