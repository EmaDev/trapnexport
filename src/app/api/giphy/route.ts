import { NextResponse } from "next/server";

import { getCurrentUid } from "@/lib/auth/sesion";
import { buscarGifs, giphyHabilitado } from "@/lib/social/giphy";

/** El buscador de GIFs del selector de comentarios.
 *
 *  Es una ruta y no una Server Action porque esto es una lectura que se dispara
 *  al tipear: una Server Action es siempre un POST sin caché y serializa las
 *  llamadas de a una, así que buscar "festejo" letra por letra daría seis POST
 *  en fila esperándose entre sí. Acá cada tecla es un GET abortable —el selector
 *  cancela el anterior con un `AbortController`— y la respuesta se puede cachear.
 *
 *  **Pide sesión.** No porque los GIFs sean secretos, sino porque la cuota de la
 *  API es por clave y nuestra clave está del otro lado: sin este corte,
 *  `/api/giphy?q=…` es un proxy abierto a la API de Giphy pagado con nuestra
 *  cuota. Y comentar ya pide sesión, así que no le cierra la puerta a nadie que
 *  pudiera usar el selector.
 */

/*  `firebase-admin` (vía `getCurrentUid`) no corre en el runtime edge. */
export const runtime = "nodejs";

export async function GET(request: Request) {
  const uid = await getCurrentUid();
  if (!uid) {
    return NextResponse.json({ error: "Iniciá sesión para buscar GIFs." }, { status: 401 });
  }

  /*  Sin clave no es un error del cliente ni algo que el selector pueda
   *  reintentar: es una app a la que le falta configuración. El 503 y el mensaje
   *  son para que se vea en la UI en vez de aparecer como "no hay resultados",
   *  que mandaría a buscar el bug en el lugar equivocado. */
  if (!giphyHabilitado()) {
    return NextResponse.json(
      { error: "Los GIFs no están configurados (falta GIPHY_API_KEY)." },
      { status: 503 },
    );
  }

  const q = new URL(request.url).searchParams.get("q") ?? "";
  const gifs = await buscarGifs(q);

  return NextResponse.json(
    { gifs },
    {
      /*  `private`: la respuesta depende de la sesión —sin ella es un 401—, así
       *  que no puede quedar en una caché compartida. El cacheo que importa está
       *  del lado del servidor, en el `next: { revalidate }` de `giphy.ts`: es
       *  el que ahorra cuota. Estos 60 segundos son para que volver a abrir el
       *  selector en la misma pestaña no vuelva a pedir. */
      headers: { "Cache-Control": "private, max-age=60" },
    },
  );
}
