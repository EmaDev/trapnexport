import type { Metadata } from "next";
import { Suspense } from "react";

import { CLUB, getHistoria } from "@/lib/historia";
import { absoluteUrl } from "@/lib/site";
import { HistoriaClient } from "./HistoriaClient";

/** A diferencia del feed, el chat y el perfil, la historia del club **no** es
 *  de sesión: es contenido público e igual para todos, así que se indexa y
 *  lleva OpenGraph como `/post/:id` y `/u/:handle`. */
export const metadata: Metadata = {
  title: "Historia del club",
  description: `La historia de ${CLUB.name} desde ${CLUB.founded}: etapas, temporadas, títulos y jugadores.`,
  alternates: { canonical: absoluteUrl("/historia") },
  openGraph: {
    type: "website",
    url: absoluteUrl("/historia"),
    // Sin ` · ${APP_NAME}` como el resto de las rutas: el club se llama igual
    // que la app, y "Historia de Trap N Export · Trap N Export" es el mismo
    // nombre dos veces en el preview de WhatsApp.
    title: `Historia de ${CLUB.name}`,
    description: `${CLUB.founded} → hoy. La trayectoria completa, temporada por temporada.`,
  },
};

export default async function HistoriaPage() {
  const historia = await getHistoria();

  // El `Suspense` es obligatorio, no decorativo: `HistoriaClient` lee
  // `useSearchParams()` para el deep link `?jugador=`, y sin límite de suspenso
  // Next no puede prerenderizar esta ruta estática (falla el build).
  return (
    <Suspense>
      <HistoriaClient historia={historia} />
    </Suspense>
  );
}
