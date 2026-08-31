"use client";

import { AnimatePresence, motion, type MotionProps } from "framer-motion";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";

import {
  CheckIcon,
  CloseIcon,
  HomeIcon,
  InstagramIcon,
  WhatsAppIcon,
} from "@/components/atoms/icons";
import {
  abrirWhatsApp,
  compartirEnInstagram,
  prepararStory,
  textoWhatsApp,
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
 *  Son dos bloques con dos pesos distintos, y la diferencia de tamaño es la que
 *  los ordena: arriba, chicos y en dos columnas, compartir por WhatsApp y por
 *  Instagram; abajo, ancho completo y con una línea que lo explica, entrar a la
 *  app. Compartir es lo que la persona ya vino a hacer; entrar a la app es lo
 *  que queremos que haga después, y necesita decir por qué.
 *
 *  No hay "copiar link": el link igual va al portapapeles solo antes de abrir
 *  la hoja de Instagram —que es el único momento en que hace falta, para pegar
 *  el sticker— y un botón para copiar la dirección de la página que ya se está
 *  mirando es una acción que casi nadie busca ocupando un cuarto de la barra.
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

/** El portapapeles, con techo de tiempo.
 *
 *  `writeText` no siempre rechaza: con el documento sin foco —que es justo lo
 *  que pasa cuando se abre la hoja de compartir del sistema— Chromium deja la
 *  promesa esperando a que el foco vuelva, y puede no volver. Es el mismo
 *  riesgo que cubre `conTecho` en `story.ts`: una promesa que no resuelve no
 *  falla, se queda, y dejaría el botón de Instagram en "Preparando…" sin un
 *  solo error en consola.
 *
 *  Devuelve `false` al vencer, y quien llama ajusta el mensaje: es la
 *  diferencia entre decirle a la persona que el link ya está copiado y pedirle
 *  que lo copie ella. */
async function copiarAlPortapapeles(texto: string, techoMs = 1500): Promise<boolean> {
  try {
    return await Promise.race([
      navigator.clipboard.writeText(texto).then(() => true),
      new Promise<boolean>((resolver) => setTimeout(() => resolver(false), techoMs)),
    ]);
  } catch {
    return false;
  }
}

/* ── el botón ────────────────────────────────────────────────────────────── */

function Boton({
  onClick,
  href,
  icon,
  children,
  tono,
  chico,
  disabled,
}: {
  onClick?: () => void;
  href?: string;
  icon: React.ReactNode;
  children: React.ReactNode;
  /** `whatsapp` e `instagram` van con el color de la plataforma; `tenue` es el
   *  botón de la app, que no compite con ellos */
  tono: "whatsapp" | "instagram" | "tenue";
  /** los de compartir, que van de a dos por fila */
  chico?: boolean;
  disabled?: boolean;
}) {
  const base =
    // `w-full` porque los de compartir viven en celdas de un grid de dos
    // columnas y un `button` con `display:flex` sigue midiendo por su
    // contenido: sin esto, "WhatsApp" salía más angosto que "Instagram" en la
    // misma fila.
    "flex w-full items-center justify-center gap-2 font-semibold transition-transform active:scale-[0.97] disabled:opacity-60";

  // La jerarquía es de tamaño y no de color: los tres botones tienen que poder
  // convivir sin que ninguno grite. Compartir es lo urgente pero no lo más
  // importante, así que va chico; entrar a la app va ancho.
  const medida = chico
    ? "rounded-xl px-3 py-2 text-[13px]"
    : "rounded-2xl px-4 py-3 text-sm";

  const tonos = {
    // Los verdes y el degradé son los de las plataformas, no los de la marca:
    // un botón de WhatsApp en violeta no se reconoce como el de WhatsApp.
    whatsapp: "bg-[#25D366] text-[#052e16] shadow-md shadow-[#25D366]/20",
    instagram:
      "bg-[linear-gradient(95deg,#F58529,#DD2A7B_45%,#8134AF_75%,#515BD4)] text-white shadow-md shadow-[#DD2A7B]/20",
    tenue: "border border-white/25 bg-white/10 text-white backdrop-blur",
  } as const;

  const clase = `${base} ${medida} ${tonos[tono]}`;

  if (href) {
    return (
      <Link href={href} className={clase}>
        {icon}
        {children}
      </Link>
    );
  }

  return (
    <button type="button" onClick={onClick} disabled={disabled} className={clase}>
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
  const [preparando, setPreparando] = useState(false);

  // El PNG de la story, dibujado apenas monta la pantalla y guardado acá.
  //
  // No es una optimización: es lo que hace que el botón de Instagram funcione
  // en iOS. Safari exige que `navigator.share` salga del gesto del usuario y
  // descarta la llamada si en el medio hubo un `await` largo — y dibujar
  // 1080×1920 lo es. Con el blob ya hecho, el click comparte de una.
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

  const alWhatsApp = useCallback(() => abrirWhatsApp(texto), [texto]);

  const alInstagram = useCallback(async () => {
    setPreparando(true);
    try {
      // El link va al portapapeles **antes** de abrir la hoja: Instagram no
      // acepta links por el share, así que la única forma de que la story lleve
      // a la invitación es que la persona pegue el sticker de link a mano.
      // Copiarlo después llega tarde: para entonces ya está en Instagram.
      const copiado = await copiarAlPortapapeles(url);

      const blob = png.current ?? (await (dibujando.current ?? prepararStory(story)));
      png.current = blob;

      const resultado = await compartirEnInstagram(blob, story.invitado, texto);
      if (resultado === "cancelado") return;

      // Sin botón de copiar, el link sólo llega al portapapeles por acá: si el
      // copiado falló no hay a dónde mandar a la persona, así que el mensaje no
      // lo menciona en vez de pedirle algo que no puede hacer.
      const conLink = copiado ? " El link quedó copiado por si querés pegarlo." : "";

      setAviso(
        resultado === "sistema"
          ? { texto: `Listo.${conLink}`, tono: "ok" }
          : resultado === "descarga"
            ? { texto: `Bajamos la imagen: subila a tu historia.${conLink}`, tono: "ok" }
            : { texto: "No pudimos preparar la imagen", tono: "error" },
      );
    } finally {
      // En el `finally` y no al final del cuerpo: si el dibujo o la hoja del
      // sistema tiran, el botón tiene que volver a servir. Deshabilitado para
      // siempre es peor que el error que lo dejó así.
      setPreparando(false);
    }
  }, [story, texto, url]);

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
              chico
              icon={<WhatsAppIcon width={16} height={16} />}
              onClick={alWhatsApp}
            >
              WhatsApp
            </Boton>
          </motion.div>

          <motion.div {...entrada(1)}>
            <Boton
              tono="instagram"
              chico
              icon={<InstagramIcon width={16} height={16} />}
              onClick={alInstagram}
              disabled={preparando}
            >
              {preparando ? "Preparando…" : "Instagram"}
            </Boton>
          </motion.div>
        </div>

        {/* La app. El texto va **arriba** del botón y no adentro: el botón dice
            a dónde lleva y la línea dice para qué, y meter las dos cosas en la
            etiqueta daría un botón de dos renglones que ya no se lee de un
            golpe. */}
        <motion.div {...entrada(2)} className="flex flex-col items-center gap-2.5">
          <p className="text-center text-sm leading-relaxed text-white/70 text-pretty">
            Entrá a {APP_NAME} para ver el cronograma del día, las novedades y
            quiénes más van.
          </p>
          <Boton tono="tenue" icon={<HomeIcon width={18} height={18} />} href="/">
            Ir a {APP_NAME}
          </Boton>
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
