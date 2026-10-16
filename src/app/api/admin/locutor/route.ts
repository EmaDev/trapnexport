import { NextResponse } from "next/server";

import { getAdminSession } from "@/lib/admin/auth";
import {
  ErrorLocutor,
  locutorHabilitado,
  MAX_FRASE,
  vozDeFrase,
} from "@/lib/presentacion/elevenlabs";

/** El mp3 de una frase del locutor, para el presentador de la gala.
 *
 *  **Pide sesión de admin.** El cupo de ElevenLabs es por clave y la clave es
 *  nuestra: sin este corte, la ruta sería un sintetizador de voz abierto
 *  pagado por el club.
 *
 *  Es un POST y no un GET con `?texto=` para que los nombres no queden en los
 *  logs de acceso, y porque cada respuesta puede gastar cupo: no es una lectura
 *  que un prefetch tenga que poder disparar.
 */

/*  `firebase-admin` no corre en el runtime edge. */
export const runtime = "nodejs";

export async function POST(request: Request) {
  if (!(await getAdminSession())) {
    return NextResponse.json({ error: "Sólo el panel puede usar el locutor." }, { status: 401 });
  }

  if (!locutorHabilitado()) {
    return NextResponse.json(
      { error: "El locutor no está configurado (falta ELEVENLABS_API_KEY)." },
      { status: 503 },
    );
  }

  const cuerpo = (await request.json().catch(() => null)) as { texto?: unknown } | null;
  const texto = typeof cuerpo?.texto === "string" ? cuerpo.texto.trim() : "";
  if (!texto || texto.length > MAX_FRASE) {
    return NextResponse.json({ error: "Frase vacía o demasiado larga." }, { status: 400 });
  }

  try {
    const mp3 = await vozDeFrase(texto);
    return new Response(new Uint8Array(mp3), {
      headers: {
        "Content-Type": "audio/mpeg",
        "Cache-Control": "private, max-age=3600",
      },
    });
  } catch (e) {
    const estado = e instanceof ErrorLocutor ? e.estado : 500;
    const mensaje = e instanceof Error ? e.message : "No se pudo generar la voz.";
    // 502 para todo lo que viene de ElevenLabs: el problema no es del pedido
    // del presentador, y el mensaje original va en el cuerpo.
    return NextResponse.json({ error: mensaje }, { status: estado === 503 ? 503 : 502 });
  }
}
