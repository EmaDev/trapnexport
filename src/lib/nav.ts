import type { useRouter } from "next/navigation";

type Router = ReturnType<typeof useRouter>;

/** Vuelve una pantalla atrás sin apilar una entrada nueva.
 *
 *  Las pantallas empujadas —la bandeja, la conversación, el buscador— se
 *  abren con un `push`, así que su flecha de regreso tiene que **desapilar**.
 *  Un `push` al destino "de vuelta" parece lo mismo pero deja la pantalla que
 *  se está cerrando en el historial, y con dos pantallas que se apuntan entre
 *  sí eso es un ciclo: la conversación empuja la bandeja, la bandeja retrocede
 *  a la conversación, y no se sale más.
 *
 *  El `fallback` cubre el caso de la pantalla abierta en frío —un link
 *  compartido, la notificación, la URL escrita a mano—: ahí no hay nada que
 *  desapilar y `back()` se saldría de la app. `history.length` es lo único que
 *  el navegador expone: no distingue de qué sitio viene la entrada anterior,
 *  pero en una pestaña recién abierta vale 1, que es exactamente el caso que
 *  hay que atajar.
 *
 *  Y va con `replace`, no con `push`, por el mismo motivo que existe esta
 *  función: un `push` dejaría la pantalla que se está cerrando en el
 *  historial y reconstruiría el ciclo justo en el caso que quiere cubrir
 *  (entrar en frío a una conversación, volver a la bandeja y volver otra vez).
 */
export function backOr(router: Router, fallback: string): void {
  if (typeof window !== "undefined" && window.history.length > 1) router.back();
  else router.replace(fallback);
}
