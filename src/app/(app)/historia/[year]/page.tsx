import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { getClub, getPlayer, getSeason, getSeasonSlugs } from "@/lib/historia/queries";
import type { Player } from "@/lib/historia/types";
import { absoluteUrl } from "@/lib/site";
import { YearClient } from "./YearClient";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ year: string }>;
}): Promise<Metadata> {
  const { year } = await params;
  const season = await getSeason(year);
  if (!season) return { title: "Temporada no encontrada" };

  const club = await getClub();
  const url = absoluteUrl(`/historia/${season.year}`);
  const title = `${season.year}: ${season.title}`;

  return {
    title,
    description: `${season.competition} · ${season.position}. ${season.tagline}`,
    alternates: { canonical: url },
    openGraph: {
      type: "article",
      url,
      // Ver el comentario de `/historia`: el club y la app son el mismo nombre.
      title: `${title} · ${club.name}`,
      description: season.tagline,
    },
    twitter: { card: "summary" },
  };
}

export default async function YearPage({ params }: { params: Promise<{ year: string }> }) {
  const { year } = await params;
  const season = await getSeason(year);
  if (!season) notFound();

  // El salón de la temporada guarda `playerId`, no el jugador entero: los datos
  // no duplican al plantel. Resolverlo es tarea del servidor, así el cliente
  // recibe la pantalla armada y no tiene que buscar en dos colecciones.
  const hallOfFame = (
    await Promise.all(
      season.hallOfFame.map(async (h) => {
        const player = await getPlayer(h.playerId);
        return player ? { player, reason: h.reason } : null;
      }),
    )
  ).filter((h): h is { player: Player; reason: string } => h !== null);

  // Las temporadas vecinas, para poder recorrer la historia sin volver atrás.
  const numbers = (await getSeasonSlugs()).map(Number).sort((a, b) => a - b);
  const i = numbers.indexOf(season.year);

  return (
    <YearClient
      season={season}
      hallOfFame={hallOfFame}
      prev={numbers[i - 1] ?? null}
      next={numbers[i + 1] ?? null}
    />
  );
}
