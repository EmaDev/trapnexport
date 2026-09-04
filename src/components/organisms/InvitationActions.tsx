"use client";

import { AnimatePresence, motion, type MotionProps } from "framer-motion";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";

import {
  CheckIcon,
  ChevronIcon,
  CloseIcon,
  InstagramIcon,
  WhatsAppIcon,
} from "@/components/atoms/icons";
import {
  abrirWhatsApp,
  compartirTarjeta,
  prepararStory,
  textoWhatsApp,
  type ResultadoTarjeta,
} from "@/lib/invitacion/compartir";
import type { StoryInput } from "@/lib/invitacion/story";
import { APP_NAME } from "@/lib/site";

/** Los botones de abajo de la invitación: compartirla y volver a la app.
 *
 *  Aparecen **después** de la tarjeta: `visible` lo decide `InvitationStage`
 *  con el aviso del efecto, no un retardo fijo de acá. La invitación es de una
 *  persona y lo primero que tiene que pasar es que la lea; una barra de botones
 *  entrando al mismo tiempo que su nombre convierte el momento en una pantalla
 *  de producto, y arriba de un sobre todavía cerrado es peor todavía: sería
 *  ofrecerle compartir una invitación que no vio.
 *
 *  Son dos bloques con dos pesos distintos, y el peso es lo que los ordena:
 *  arriba, dos botones de color en dos columnas, compartir por WhatsApp y por
 *  Instagram; abajo, sólo texto y un link, entrar a la app. Compartir es lo que
 *  la persona ya vino a hacer y son botones de verdad, con el color de cada
 *  plataforma; entrar a la app es lo que queremos que haga después, así que no
 *  compite con ellos —ni caja ni color propio, un link como cualquier otro de
 *  la app— y necesita una línea que diga para qué.
 *
 *  Los dos botones de compartir hacen **lo mismo**: dibujan la tarjeta y la
 *  dejan en el portapapeles, además de ofrecerla por la hoja del sistema cuando
 *  hay una. Lo que cambia es a dónde va la persona después, y por eso siguen
 *  siendo dos: WhatsApp abre el chat, Instagram no abre nada porque no se puede.
 *  Lo que se comparte es la imagen y no el link: la invitación se ve en el chat
 *  sin que nadie tenga que tocar nada.
 *
 *  No hay "copiar link": la dirección igual va adentro del mensaje de WhatsApp,
 *  y un botón para copiar la dirección de la página que ya se está mirando es
 *  una acción que casi nadie busca ocupando un cuarto de la barra.
 *
 *  El aviso de resultado es propio y no el `Snackbar` de la librería: esta ruta
 *  vive afuera del grupo `(app)`, sin su shell y sin su `SnackbarProvider`
 *  (`app/layout.tsx` sólo monta `AuthProvider`). Montar el provider entero para
 *  tres mensajes sería traer el chrome de la app a la única pantalla que a
 *  propósito no lo tiene.
 */

export interface InvitationActionsProps {
  /** todo lo que necesita la imagen 9:16 de la story */
  story: StoryInput;
  /** el link absoluto de la invitación */
  url: string;
  quieto: boolean;
  /** La tarjeta ya se ve. En `false` los botones están dibujados pero
   *  transparentes: el componente se monta igual desde el principio —para que
   *  el PNG de la story se vaya dibujando mientras tanto y para que el lugar
   *  quede reservado— y quien los saca de la vista es `InvitationStage`. */
  visible: boolean;
}

type Aviso = { texto: string; tono: "ok" | "error" } | null;

/* ── el botón ────────────────────────────────────────────────────────────── */

function Boton({
  onClick,
  icon,
  children,
  tono,
  disabled,
}: {
  onClick?: () => void;
  icon: React.ReactNode;
  children: React.ReactNode;
  /** los dos únicos que quedan: el de la app ya no es un botón, es un link
   *  de texto — ver más abajo */
  tono: "whatsapp" | "instagram";
  disabled?: boolean;
}) {
  const tonos = {
    // Los verdes y el degradé son los de las plataformas, no los de la marca:
    // un botón de WhatsApp en violeta no se reconoce como el de WhatsApp.
    whatsapp: "bg-[#25D366] text-[#052e16] shadow-md shadow-[#25D366]/20",
    instagram:
      "bg-[linear-gradient(95deg,#F58529,#DD2A7B_45%,#8134AF_75%,#515BD4)] text-white shadow-md shadow-[#DD2A7B]/20",
  } as const;

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      // `w-full` porque los dos viven en celdas de un grid de dos columnas y
      // un `button` con `display:flex` sigue midiendo por su contenido: sin
      // esto, "WhatsApp" salía más angosto que "Instagram" en la misma fila.
      className={`flex w-full items-center justify-center gap-2 rounded-xl px-3 py-2 text-[13px] font-semibold transition-transform active:scale-[0.97] disabled:opacity-60 ${tonos[tono]}`}
    >
      {icon}
      {children}
    </button>
  );
}

/* ── la barra ────────────────────────────────────────────────────────────── */

export function InvitationActions({
  story,
  url,
  quieto,
  visible,
}: InvitationActionsProps) {
  const [aviso, setAviso] = useState<Aviso>(null);
  /** cuál de los dos botones está trabajando; los dos se bloquean mientras
   *  tanto, para que dos toques seguidos no abran dos hojas del sistema */
  const [ocupado, setOcupado] = useState<"whatsapp" | "instagram" | null>(null);

  // El PNG de la story, dibujado apenas monta la pantalla y guardado acá.
  //
  // No es una optimización: es lo que hace que los botones funcionen en iOS.
  // Safari exige que `navigator.share` —y también `clipboard.write`— salgan del
  // gesto del usuario y descarta la llamada si en el medio hubo un `await`
  // largo, y dibujar 1080×1920 lo es. Con el blob ya hecho, el click comparte
  // de una.
  const png = useRef<Blob | null>(null);
  const dibujando = useRef<Promise<Blob | null> | null>(null);

  useEffect(() => {
    // Detrás del primer pintado: lo que la persona está mirando en ese segundo
    // es la tarjeta apareciendo, no un canvas de 1080×1920.
    const t = setTimeout(() => {
      dibujando.current = prepararStory(story).then((b) => {
        png.current = b;
        return b;
      });
    }, 1200);
    return () => clearTimeout(t);
    // Las invitaciones no cambian mientras están abiertas; en la vista previa
    // del panel sí, y ahí `InvitationStage` no monta esta barra.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!aviso) return;
    const t = setTimeout(() => setAviso(null), 5000);
    return () => clearTimeout(t);
  }, [aviso]);

  const texto = textoWhatsApp(story.club, story.titulo, url);

  /** La imagen, como **promesa** y sin esperarla: `compartirTarjeta` la
   *  necesita así para poder armar el `ClipboardItem` en el mismo tick del
   *  click aunque el dibujo todavía no haya terminado. Si el efecto de arriba
   *  no llegó a arrancar —un toque muy rápido—, se dibuja acá. */
  const imagen = useCallback((): Promise<Blob | null> => {
    if (png.current) return Promise.resolve(png.current);
    dibujando.current ??= prepararStory(story).then((b) => {
      png.current = b;
      return b;
    });
    return dibujando.current;
  }, [story]);

  /** El mensaje de después. Dice qué hacer con la tarjeta, y qué hacer depende
   *  de dónde quedó: pegarla si está en el portapapeles, buscarla si se bajó.
   *  `sistema` y `cancelado` no dicen nada — en el primero la hoja nativa ya
   *  dio su propia devolución y en el segundo la persona decidió salir. */
  const avisar = useCallback(
    (resultado: ResultadoTarjeta, pegar: string, bajada: string) => {
      if (resultado === "sistema" || resultado === "cancelado") return;
      setAviso(
        resultado === "portapapeles"
          ? { texto: `Copiamos la tarjeta: ${pegar}`, tono: "ok" }
          : resultado === "descarga"
            ? { texto: `Bajamos la tarjeta: ${bajada}`, tono: "ok" }
            : { texto: "No pudimos preparar la imagen", tono: "error" },
      );
    },
    [],
  );

  const alWhatsApp = useCallback(async () => {
    setOcupado("whatsapp");
    try {
      const resultado = await compartirTarjeta(imagen(), story.invitado, texto);
      if (resultado === "sistema" || resultado === "cancelado") return;

      // La imagen ya está —copiada o bajada— pero todavía no está en ningún
      // chat: acá es donde `wa.me` sigue sirviendo. Va después de compartir y
      // no antes porque abrir la pestaña le saca el foco al documento, y sin
      // foco Chrome rechaza la escritura del portapapeles.
      if (resultado !== "error") abrirWhatsApp(texto);
      avisar(resultado, "pegala en el chat.", "adjuntala en el chat.");
    } finally {
      // En el `finally` y no al final del cuerpo: si el dibujo o la hoja del
      // sistema tiran, el botón tiene que volver a servir. Deshabilitado para
      // siempre es peor que el error que lo dejó así.
      setOcupado(null);
    }
  }, [avisar, imagen, story.invitado, texto]);

  const alInstagram = useCallback(async () => {
    setOcupado("instagram");
    try {
      const resultado = await compartirTarjeta(imagen(), story.invitado, texto);
      // Instagram no tiene un `wa.me`: no existe un intent web que suba una
      // story. Donde no hubo hoja del sistema, la tarjeta queda en el
      // portapapeles y la persona la pega ella.
      avisar(
        resultado,
        "pegala en tu historia o en un chat.",
        "subila a tu historia.",
      );
    } finally {
      setOcupado(null);
    }
  }, [avisar, imagen, story.invitado, texto]);

  /** La entrada escalonada de cada botón, colgada de `visible`.
   *
   *  `initial: false` es lo que evita que la escalera corra sola al montar: el
   *  componente monta con la tarjeta todavía tapada, y sin eso los botones
   *  harían su entrada —invisible— contra el sobre cerrado y después ya no
   *  tendrían nada que animar cuando llegara el momento.
   *
   *  Devuelve `MotionProps` explícito y no un objeto inferido: sin la
   *  anotación, TypeScript lee la curva como `number[]` en vez de la tupla de
   *  cuatro que espera `ease`. */
  const entrada = (i: number): MotionProps => ({
    initial: false,
    animate: visible ? { opacity: 1, y: 0 } : { opacity: 0, y: 14 },
    transition: quieto
      ? { duration: 0 }
      : { delay: visible ? 0.1 + i * 0.1 : 0, duration: 0.45, ease: [0.16, 1, 0.3, 1] },
  });

  return (
    <>
      <div className="flex flex-col gap-5">
        {/* Compartir: chicos, de a dos, sin encabezado. Los dos logos ya dicen
            qué son y un rótulo arriba sólo agregaría una línea de texto. */}
        <div className="mx-auto grid w-full max-w-xs grid-cols-2 gap-2">
          <motion.div {...entrada(0)}>
            <Boton
              tono="whatsapp"
              icon={<WhatsAppIcon width={16} height={16} />}
              onClick={alWhatsApp}
              disabled={ocupado !== null}
            >
              {ocupado === "whatsapp" ? "Preparando…" : "WhatsApp"}
            </Boton>
          </motion.div>

          <motion.div {...entrada(1)}>
            <Boton
              tono="instagram"
              icon={<InstagramIcon width={16} height={16} />}
              onClick={alInstagram}
              disabled={ocupado !== null}
            >
              {ocupado === "instagram" ? "Preparando…" : "Instagram"}
            </Boton>
          </motion.div>
        </div>

        {/* La app. Ya no es un botón: al lado de un verde y un degradé
            cualquier caja compite con ellos, y esto es lo que la persona hace
            después de compartir, no al mismo tiempo. Un link de texto —el
            mismo trato que el handle en `PlayerSpotlight`— alcanza y no le
            pelea la fila a los dos de arriba. */}
        <motion.div {...entrada(2)} className="flex flex-col items-center gap-2.5">
          <p className="text-center text-sm leading-relaxed text-white/70 text-pretty">
            Entrá a {APP_NAME} para ver el cronograma del día, las novedades y
            quiénes más van.
          </p>
          <Link
            href="/"
            className="inline-flex items-center gap-0.5 py-1 text-sm font-semibold text-white transition-opacity active:opacity-70"
          >
            Ir a {APP_NAME}
            <ChevronIcon width={14} height={14} />
          </Link>
        </motion.div>
      </div>

      {/* El aviso. `aria-live` y no un `role="alert"`: es la confirmación de
          algo que la persona acaba de hacer, no una interrupción. */}
      <AnimatePresence>
        {aviso && (
          <motion.p
            key={aviso.texto}
            aria-live="polite"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 16 }}
            className={`fixed inset-x-4 bottom-5 z-50 mx-auto max-w-sm rounded-2xl px-4 py-3 text-center text-sm font-medium text-white shadow-2xl backdrop-blur ${
              aviso.tono === "ok" ? "bg-black/80" : "bg-danger/90"
            }`}
          >
            <span className="mr-1.5 inline-block align-[-3px]">
              {aviso.tono === "ok" ? (
                <CheckIcon width={15} height={15} />
              ) : (
                <CloseIcon width={15} height={15} />
              )}
            </span>
            {aviso.texto}
          </motion.p>
        )}
      </AnimatePresence>
    </>
  );
}
