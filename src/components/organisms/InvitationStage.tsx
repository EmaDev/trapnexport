"use client";

import { motion } from "framer-motion";
import { useCallback, useState, type ReactNode } from "react";
import { usePrefersReducedMotion } from "lib-kit-components";

import { InvitationActions } from "@/components/organisms/InvitationActions";
import { InvitationCard } from "@/components/organisms/InvitationCard";
import { EfectoTarjeta } from "@/components/organisms/InvitationEfectos";
import { InvitationRevelacion } from "@/components/organisms/InvitationRevelacion";
import type {
  EfectoInvitacion,
  PlantillaInvitacion,
  RevelacionInvitacion,
} from "@/lib/contenido/types";
import { longDate } from "@/lib/time";

/** La invitación en movimiento: la tarjeta, su efecto y los botones.
 *
 *  Es el único límite cliente de la ruta pública. `/invitacion/:code` sigue
 *  siendo un Server Component —resuelve la invitación, arma la metadata y tira
 *  404 si está revocada— y baja acá con los datos ya resueltos. La tarjeta de
 *  adentro tampoco cambió: `InvitationCard` sigue sin estado y sin
 *  `"use client"`, y por eso lo que se ve es exactamente lo mismo que dibuja la
 *  vista previa del panel.
 *
 *  `prefers-reduced-motion` se resuelve **una sola vez, acá**, y baja por prop
 *  a los efectos y a los botones. Que cada pieza consultara el media query por
 *  su cuenta abriría la puerta a que la tarjeta se quede quieta mientras la
 *  barra de abajo sigue entrando escalonada.
 *
 *  La pantalla se arma con tres decisiones apiladas, de afuera hacia adentro:
 *  `revelacion` es la tapa que hay que sacar, `efecto` es cómo se mueve la
 *  tarjeta una vez destapada y `plantilla` es cómo se ve. Las tres son
 *  independientes y cualquier combinación es válida.
 *
 *  Acá también vive `revelada`, que es el orden de la pantalla: primero la
 *  invitación, después todo lo demás. Quién avisa depende de si hay tapa: con
 *  tapa avisa la tapa —que sabe cuándo la sacaron—, y sin tapa avisa el efecto
 *  al terminar su entrada. Hasta ese momento los botones y la nota del pie
 *  están dibujados pero transparentes.
 *
 *  Dibujados y no desmontados, que es la parte que importa: si aparecieran de
 *  la nada, el bloque crecería ~150 px y la tarjeta saltaría hacia arriba justo
 *  en el cuadro en que la persona la está mirando. Reservar el lugar desde el
 *  principio deja la composición quieta y hace que lo único que cambie sea la
 *  opacidad. Mientras están tapados van `inert`: sin foco, sin clicks y fuera
 *  del lector de pantalla, porque un botón que no se ve tampoco se toca.
 */

export interface InvitationStageProps {
  invitado: string;
  titulo: string;
  mensaje: string;
  /** "YYYY-MM-DD" */
  fecha: string;
  /** "HH:mm" */
  hora: string;
  lugar: string;
  plantilla: PlantillaInvitacion;
  efecto: EfectoInvitacion;
  revelacion: RevelacionInvitacion;
  club: { name: string; crest: string };
  /** el link absoluto, para compartir. La vista previa del panel no lo tiene
   *  hasta que la invitación existe, y por eso puede venir vacío. */
  url: string;
  /** el `code`: siembra las partículas de los efectos */
  seed: string;
  /** La nota al pie de la ruta pública. Llega por prop —desde un Server
   *  Component, que puede pasar elementos— y no queda escrita en la página
   *  porque tiene que aparecer con los botones y no antes: es parte de lo que
   *  se destapa cuando la tarjeta ya se leyó. */
  pie?: ReactNode;
  /** La barra de compartir. En `false` queda sólo la tarjeta animada, que es
   *  lo que necesita la vista previa del formulario: ahí la invitación todavía
   *  no tiene link, y unos botones que no llevan a ningún lado enseñan mal
   *  cómo se va a ver. */
  conAcciones?: boolean;
  className?: string;
}

export function InvitationStage({
  invitado,
  titulo,
  mensaje,
  fecha,
  hora,
  lugar,
  plantilla,
  efecto,
  revelacion,
  club,
  url,
  seed,
  pie,
  conAcciones = true,
  className = "",
}: InvitationStageProps) {
  const quieto = usePrefersReducedMotion();

  const [revelada, setRevelada] = useState(false);
  // Estable: es dependencia de los efectos que arman temporizadores con ella, y
  // una función nueva por render los reiniciaría en cada uno.
  const revelar = useCallback(() => setRevelada(true), []);

  const conPortada = revelacion !== "directa" && !quieto;

  return (
    <div className={`relative isolate mx-auto flex w-full max-w-md flex-col gap-6 ${className}`}>
      <InvitationRevelacion
        tipo={revelacion}
        crest={club.crest}
        seed={seed}
        quieto={quieto}
        onAbierta={revelar}
      >
        <EfectoTarjeta
          efecto={efecto}
          seed={seed}
          quieto={quieto}
          conPortada={conPortada}
          onRevelado={revelar}
        >
          <InvitationCard
            invitado={invitado}
            titulo={titulo}
            mensaje={mensaje}
            fecha={fecha}
            hora={hora}
            lugar={lugar}
            plantilla={plantilla}
            club={club}
          />
        </EfectoTarjeta>
      </InvitationRevelacion>

      {conAcciones && (
        <div inert={!revelada} className="flex flex-col gap-5">
          <InvitationActions
            url={url}
            quieto={quieto}
            visible={revelada}
            story={{
              invitado,
              titulo,
              mensaje,
              cuando: `${longDate(fecha)} · ${hora} h`,
              lugar,
              plantilla,
              club: club.name,
              crest: club.crest,
              url,
            }}
          />

          {pie && (
            <motion.div
              initial={false}
              animate={{ opacity: revelada ? 1 : 0 }}
              // Último de la fila: entra después de los tres botones.
              transition={
                quieto ? { duration: 0 } : { duration: 0.45, delay: revelada ? 0.4 : 0 }
              }
            >
              {pie}
            </motion.div>
          )}
        </div>
      )}
    </div>
  );
}
