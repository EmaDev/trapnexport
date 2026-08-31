#!/usr/bin/env node
/**
 * Genera el par de claves VAPID que necesita el push.
 *
 *   npm run vapid
 *
 * Imprime las dos líneas listas para pegar en `.env.local`. Correlo **una sola
 * vez** por entorno: si se regenera el par, todas las suscripciones existentes
 * dejan de aceptar nuestros envíos (el push service valida la firma contra la
 * clave pública con la que se creó cada suscripción) y hay que pedirle a cada
 * usuario que vuelva a activar el push en cada dispositivo.
 */
import webpush from "web-push";

const { publicKey, privateKey } = webpush.generateVAPIDKeys();

console.log(`
Pegá esto en .env.local (y en las variables de entorno del deploy):

NEXT_PUBLIC_VAPID_PUBLIC_KEY=${publicKey}
VAPID_PRIVATE_KEY=${privateKey}

La privada no se commitea ni lleva prefijo NEXT_PUBLIC_: con ella cualquiera
puede mandarle notificaciones a tus usuarios.
`);
