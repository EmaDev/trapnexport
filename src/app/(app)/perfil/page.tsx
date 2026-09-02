import type { Metadata } from "next";
import { redirect } from "next/navigation";

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

  /*  Sin sesión no hay perfil propio que mostrar. Se manda a `/login` con
   *  `next`, así después de entrar vuelve acá y no al feed.
   *
   *  El corte lo hace ahora el servidor y no `PerfilClient`: antes era un gate
   *  de cliente porque `getMyProfile()` devolvía la cuenta semilla y los datos
   *  viajaban igual aunque no se dibujaran — "una pantalla que no muestra, no un
   *  permiso que no da", decía el comentario. Con la sesión en una cookie que el
   *  servidor lee, ya no hay nada que mandar. */
  if (!profile) redirect("/login?next=/perfil");

  const posts = await getPostsByHandle(profile.handle);

  // La carta se arma acá y no en el cliente porque necesita la historia del
  // club, que sale de Firestore con el Admin SDK: no hay forma de leerla desde
  // el navegador, y aunque la hubiera, bajar el plantel entero para sacar cinco
  // números y un dorsal no tiene sentido. Lo que baja por props es el
  // view-model ya resuelto.
  //
  // Las dos fuentes son opcionales y se emparejan por `playerId`, NO por el id
  // de la cuenta: desde que las cuentas son reales, `profile.id` es el uid de
  // Firebase Auth y `JUGADORES`/`PLAYERS` se siguen indexando por el slug del
  // jugador ("naza-sochan"). `UserDoc.playerId` es el puente entre los dos, y lo
  // tiene sólo quien reclamó una cuenta del plantel.
  //
  // Una cuenta de hincha no tiene `playerId` y no está en ninguna de las dos: la
  // carta sale igual, con los valores estimados.
  const jugador = profile.playerId
    ? JUGADORES.find((j) => j.id === profile.playerId)
    : undefined;
  const [player, club] = await Promise.all([
    profile.playerId ? getPlayer(profile.playerId) : Promise.resolve(null),
    getClub(),
  ]);

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
