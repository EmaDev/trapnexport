/** El fondo sobre el que se mira la invitación.
 *
 *  Es oscuro en las tres plantillas, incluida la clara: la tarjeta es el objeto
 *  y el fondo es la mesa donde está apoyada. Sobre un fondo claro, la plantilla
 *  mínima —que es blanca— pierde el borde y deja de leerse como una tarjeta, y
 *  el halo de la holográfica y las luces de la aurora no tienen contra qué
 *  brillar.
 *
 *  Vive en su propio módulo, y no junto a `InvitationStage`, por una razón que
 *  no se ve hasta que rompe: `InvitationStage` es `"use client"`, y una
 *  constante exportada desde un módulo cliente no llega al servidor como su
 *  valor sino como una referencia. La ruta pública `/invitacion/:code` es un
 *  Server Component y la usa en el `className` del `<main>`: importada desde
 *  allá, lo que terminaba en el atributo `class` era el texto de un stub
 *  —"Attempted to call FONDO_INVITACION() from the server"— y la pantalla salía
 *  blanca, sin error en consola. Este archivo no tiene directiva, así que lo
 *  pueden importar los dos lados.
 */
export const FONDO_INVITACION =
  "bg-[radial-gradient(130%_95%_at_50%_0%,#210a3d_0%,#0b0416_55%,#050208_100%)]";
