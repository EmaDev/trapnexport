import { createHash } from "node:crypto";
import { getStorage } from "firebase-admin/storage";

import { adminApp } from "@/lib/firebase/admin";

/** La voz del locutor, generada con ElevenLabs. **Sólo servidor.**
 *
 *  La clave de la API no puede viajar al navegador: el presentador le pide cada
 *  frase a `/api/admin/locutor`, que es una ruta con sesión de admin, y ella es
 *  la única que habla con ElevenLabs.
 *
 *  Cada frase generada se guarda en el bucket (`locutor/<hash>.mp3`) y la
 *  segunda vez se sirve de ahí. Es lo que hace que ensayar la gala diez veces
 *  cueste lo mismo que presentarla una: el cupo del plan se gasta en frases
 *  nuevas, no en repeticiones. El hash incluye la voz, el modelo y los ajustes,
 *  así que cambiar cualquiera de ellos genera audios nuevos en vez de servir
 *  los de la voz anterior.
 *
 *  Ojo con la voz: el plan gratuito sólo deja usar por API las voces
 *  *premade* de ElevenLabs. Las de la biblioteca (como "Atlas") responden 402
 *  hasta que la cuenta tenga un plan pago o créditos cargados.
 */

/** "Brian - Deep, Resonant": la más grave de las premade, que son las que el
 *  plan gratuito deja usar por API. Se cambia con `ELEVENLABS_VOICE_ID`. */
const VOZ_POR_DEFECTO = "nPczCjzI2devNBz1zQrb";

/** El modelo que habla español. Los `turbo`/`flash` son más baratos pero
 *  pierden justamente lo que se busca acá: el peso y la intención. */
const MODELO = "eleven_multilingual_v2";

const FORMATO = "mp3_44100_128";

/** Estabilidad media para que tenga intención de locutor sin desbarrancar en
 *  una frase de tres palabras; `speed` apenas por debajo de 1 por el eco del
 *  salón, igual que la voz del navegador. */
const AJUSTES = {
  stability: 0.45,
  similarity_boost: 0.8,
  style: 0.3,
  use_speaker_boost: true,
  speed: 0.92,
};

/** Tope de una frase. Las de la gala son el nombre de un premio o de un
 *  jugador; algo más largo no viene del guion y no tiene por qué gastar cupo. */
export const MAX_FRASE = 160;

export const locutorHabilitado = () => Boolean(process.env.ELEVENLABS_API_KEY);

/** Un error de ElevenLabs, con el mensaje que ellos devuelven: "free users
 *  cannot use library voices", "quota exceeded"… Es lo que el presentador
 *  muestra en el standby para que se pueda arreglar antes de la gala. */
export class ErrorLocutor extends Error {
  constructor(
    readonly estado: number,
    mensaje: string,
  ) {
    super(mensaje);
  }
}

/** El archivo en el bucket, o `null` si no hay bucket configurado: sin caché
 *  la voz anda igual, sólo que cada apertura vuelve a gastar cupo. */
function archivo(clave: string) {
  const bucket = process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET;
  if (!bucket) return null;
  try {
    return getStorage(adminApp()).bucket(bucket).file(`locutor/${clave}.mp3`);
  } catch {
    return null;
  }
}

/** El mp3 de una frase: del bucket si ya se generó, de ElevenLabs si no. */
export async function vozDeFrase(texto: string): Promise<Buffer> {
  const apiKey = process.env.ELEVENLABS_API_KEY;
  if (!apiKey) throw new ErrorLocutor(503, "Falta ELEVENLABS_API_KEY.");

  const voz = process.env.ELEVENLABS_VOICE_ID || VOZ_POR_DEFECTO;
  const clave = createHash("sha256")
    .update(JSON.stringify([voz, MODELO, FORMATO, AJUSTES, texto]))
    .digest("hex")
    .slice(0, 32);

  const guardado = archivo(clave);
  if (guardado) {
    try {
      const [existe] = await guardado.exists();
      if (existe) return (await guardado.download())[0];
    } catch {
      /* el bucket falló: se genera de nuevo, que es más caro pero anda */
    }
  }

  const r = await fetch(
    `https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(voz)}?output_format=${FORMATO}`,
    {
      method: "POST",
      headers: {
        "xi-api-key": apiKey,
        "Content-Type": "application/json",
        Accept: "audio/mpeg",
      },
      body: JSON.stringify({ text: texto, model_id: MODELO, voice_settings: AJUSTES }),
      cache: "no-store",
    },
  );

  if (!r.ok) {
    const cuerpo = (await r.json().catch(() => null)) as {
      detail?: { message?: string } | string;
    } | null;
    const detalle =
      typeof cuerpo?.detail === "string" ? cuerpo.detail : cuerpo?.detail?.message;
    throw new ErrorLocutor(r.status, detalle || `ElevenLabs respondió ${r.status}.`);
  }

  const datos = Buffer.from(await r.arrayBuffer());

  if (guardado) {
    // Si no se puede guardar, la frase se sirve igual: la caché es un ahorro,
    // no una condición para que el locutor hable.
    await guardado
      .save(datos, { contentType: "audio/mpeg", resumable: false })
      .catch(() => {});
  }

  return datos;
}
