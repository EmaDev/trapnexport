import type { Metadata } from "next";

import { construirCarta } from "@/lib/carta/carta";
import { getClub, getPlayer } from "@/lib/historia/queries";
import { getMyProfile, getPostsByHandle } from "@/lib/social/queries";
import { JUGADORES } from "@/lib/trap-awards";
import { PerfilClient } from "./PerfilClient";

/** Perfil propio: es de sesión, no se indexa. El indexable es /u/[handle]. */
export const metadata: Metadata = {
  title: "Perfil",
  robots: { index: false, follow: false },
};

export default async function PerfilPage() {
  const profile = await getMyProfile();
  const posts = await getPostsByHandle(profile.handle);

  // La carta se arma acá y no en el cliente porque necesita la historia del
  // club, que sale de Firestore con el Admin SDK: no hay forma de leerla desde
  // el navegador, y aunque la hubiera, bajar el plantel entero para sacar cinco
  // números y un dorsal no tiene sentido. Lo que baja por props es el
  // view-model ya resuelto.
  //
  // Las dos fuentes son opcionales y se emparejan por id, que es el mismo en
  // los tres lados (`JUGADORES`, `PLAYERS` de historia y las cuentas del feed):
  // una cuenta de hincha no está en ninguna de las dos y la carta sale igual,
  // con los valores estimados.
  const jugador = JUGADORES.find((j) => j.id === profile.id);
  const [player, club] = await Promise.all([getPlayer(profile.id), getClub()]);

  const carta = construirCarta({
    nombre: profile.name,
    apodo: jugador?.apodo,
    handle: profile.handle,
    avatar: profile.avatar,
    ficha: profile.ficha,
    skills: player?.skills,
    dorsalHistoria: player?.number,
    club: club.name,
    crest: club.crest,
  });

  return <PerfilClient profile={profile} posts={posts} carta={carta} />;
}
