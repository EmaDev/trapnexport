import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { InvitationStage } from "@/components/organisms/InvitationStage";
import { getInvitacionByCode } from "@/lib/contenido/queries";
import { getClub } from "@/lib/historia/queries";
import { FONDO_INVITACION } from "@/lib/invitacion/fondo";
import { absoluteUrl } from "@/lib/site";
import { longDate } from "@/lib/time";

/** La invitación, para el invitado: `/invitacion/:code`.
 *
 *  Vive **afuera** del grupo `(app)` a propósito. No es una pantalla de la app:
 *  es una landing que se abre desde un link de WhatsApp, muchas veces por gente
 *  que no tiene cuenta. Con el shell público traería `BottomNav`, splash e
 *  instalador —cuatro tabs a los que esa persona no va a ir— y la tarjeta
 *  quedaría dentro de una app en la que no está.
 *
 *  Se indexa `noindex`: el link es personal. No es secreto (quien lo tenga
 *  entra) pero no tiene por qué aparecer en una búsqueda del nombre del
 *  invitado.
 */

export async function generateMetadata({
  params,
}: {
  params: Promise<{ code: string }>;
}): Promise<Metadata> {
  const { code } = await params;
  const inv = await getInvitacionByCode(code);
  if (!inv) return { title: "Invitación no disponible", robots: { index: false } };

  const club = await getClub();

  return {
    title: `${inv.titulo} · Invitación para ${inv.invitado}`,
    description: `${club.name} invita a ${inv.invitado} · ${longDate(inv.fecha)} · ${inv.hora} h`,
    robots: { index: false, follow: false },
    alternates: { canonical: absoluteUrl(`/invitacion/${inv.code}`) },
    openGraph: {
      type: "website",
      url: absoluteUrl(`/invitacion/${inv.code}`),
      title: `${inv.invitado}, te invitamos`,
      description: `${inv.titulo} · ${longDate(inv.fecha)} · ${inv.hora} h`,
    },
  };
}

export default async function InvitacionPage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = await params;
  const inv = await getInvitacionByCode(code);

  // `getInvitacionByCode` devuelve null también para las revocadas: un link
  // dado de baja tiene que dar 404, no mostrar la tarjeta con un cartel encima.
  if (!inv) notFound();

  // El nombre y el escudo salen de la historia del club, que se edita en
  // /admin/historia: renombrar el club cambia también las invitaciones ya
  // emitidas, que es lo que se espera de una tarjeta a su nombre.
  const club = await getClub();

  return (
    <main
      className={`flex min-h-screen items-center justify-center px-4 py-10 ${FONDO_INVITACION}`}
    >
      <div className="flex w-full max-w-md flex-col">
        <InvitationStage
          invitado={inv.invitado}
          titulo={inv.titulo}
          mensaje={inv.mensaje}
          fecha={inv.fecha}
          hora={inv.hora}
          lugar={inv.lugar}
          plantilla={inv.plantilla}
          efecto={inv.efecto}
          revelacion={inv.revelacion}
          club={{ name: club.name, crest: club.crest }}
          url={absoluteUrl(`/invitacion/${inv.code}`)}
          seed={inv.code}
          // Por prop y no acá abajo: la nota se destapa junto con los botones,
          // cuando la tarjeta ya se leyó. Un Server Component puede pasar
          // elementos a uno de cliente, así que sigue rindiéndose en el
          // servidor.
          pie={
            <p className="text-center text-xs leading-relaxed text-white/45">
              Invitación personal de {club.name}. Si tenés dudas, respondé el
              mensaje por donde te llegó.
            </p>
          }
        />
      </div>
    </main>
  );
}
