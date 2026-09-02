import type { Metadata } from "next";
import { Suspense } from "react";

import { getClub, getHistoria } from "@/lib/historia/queries";
import { absoluteUrl } from "@/lib/site";
import { HistoriaClient } from "./HistoriaClient";

/** A diferencia del feed, el chat y el perfil, la historia del club **no** es
 *  de sesión: es contenido público e igual para todos, así que se indexa y
 *  lleva OpenGraph como `/post/:id` y `/u/:handle`.
 *
 *  Es `generateMetadata` y ya no un `metadata` estático porque el nombre y el
 *  año de fundación se editan en `/admin/historia`: un objeto constante los
 *  congelaría en lo que decían el día del build, y el título de WhatsApp
 *  seguiría diciendo el nombre viejo después de renombrar el club. */
export async function generateMetadata(): Promise<Metadata> {
  const club = await getClub();

  return {
    title: "Historia del club",
    description: `La historia de ${club.name} desde ${club.founded}: etapas, temporadas, títulos y jugadores.`,
    alternates: { canonical: absoluteUrl("/historia") },
    openGraph: {
      type: "website",
      url: absoluteUrl("/historia"),
      // Sin ` · ${APP_NAME}` como el resto de las rutas: el club se llama igual
      // que la app, y "Historia de Trap N Export · Trap N Export" es el mismo
      // nombre dos veces en el preview de WhatsApp.
      title: `Historia de ${club.name}`,
      description: `${club.founded} → hoy. La trayectoria completa, temporada por temporada.`,
    },
  };
}

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
