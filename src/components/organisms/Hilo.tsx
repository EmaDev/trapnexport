"use client";

import { AnimatePresence, motion } from "framer-motion";
import {
  Fragment,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  ImageZoom,
  useHaptics,
  useKeyboardInset,
  useMediaQuery,
  useSnackbar,
} from "lib-kit-components";

import { Avatar } from "@/components/atoms/Avatar";
import { ArrowDownIcon, CloseIcon, ImageIcon, SendIcon } from "@/components/atoms/icons";
import type { MessageVM } from "@/lib/chat/queries";
import type { MensajeImagenDoc } from "@/lib/firebase/schema";
import {
  deleteChatImage,
  uploadChatImage,
  type UploadedChatImage,
} from "@/lib/storage/chat-image";
import { chatStamp, clockTime } from "@/lib/time";

/** El hilo de mensajes de una conversación, con su compositor.
 *
 *  Reemplaza al `Chatbot` de la librería, que era un andamio consciente y ya no
 *  alcanza. `Chatbot` modela los mensajes como `role: "user" | "bot"`: dos
 *  participantes por definición, sin autor por mensaje. Con grupos hay que poder
 *  mostrar **quién** escribió cada uno, y con mensajes de sistema —"Fulano
 *  agregó a Mengano"— hay una tercera forma que no es ninguna de las dos.
 *
 *  ## La caja
 *
 *  Es una columna de dos filas —el hilo, que scrollea, y el compositor, que
 *  no— y depende de que su padre le dé un alto: `flex-1` dentro de algo que
 *  ocupe exactamente el viewport. Ese alto lo pone `AppShell` para la ruta de
 *  la conversación (ver el bloque `conversacion` de ahí). Sin eso el hilo crece
 *  con los mensajes y el compositor termina **abajo del último mensaje** en vez
 *  de pegado al borde inferior, que es como se veía antes.
 *
 *  El scroll es del hilo, no de la ventana: por eso el header de la
 *  conversación no es `sticky` sino una fila más de la columna, y por eso el
 *  chip de "ir al final" puede anclarse contra el borde del scroller.
 *
 *  ## Las formas
 *
 *    - propio     — burbuja a la derecha, degradé de marca, sin nombre
 *    - de otro    — burbuja a la izquierda, con avatar; el nombre sólo en grupos
 *    - foto       — la imagen ocupa la burbuja entera, con el pie debajo si hay
 *    - de sistema — centrado, sin burbuja ni avatar
 *
 *  Los mensajes seguidos de la misma persona se agrupan: se pegan entre sí (2px
 *  en vez de 10), pierden las esquinas del lado por el que se tocan, y el
 *  avatar y el nombre aparecen una sola vez por tanda —el avatar abajo, contra
 *  la última burbuja; el nombre arriba, sobre la primera—. Una foto agrupa
 *  igual que un texto: sigue siendo alguien diciendo algo.
 *
 *  La hora no se muestra por mensaje: va como sello cada vez que pasa media
 *  hora entre uno y otro, y suelta al tocar cualquier burbuja de texto. En una
 *  foto el toque abre el visor, que es lo que se espera de una foto.
 */

/** cuánto silencio hace falta para que el hilo ponga un sello con la hora */
const PAUSA = 30 * 60_000;
/** a cuántos px del fondo se sigue considerando que estás "abajo" */
const CERCA = 120;
/** alto máximo del campo antes de que empiece a scrollear él */
const ALTO_CAMPO = 128;

/** Caja máxima de una foto dentro del hilo, en px.
 *
 *  La imagen entra **entera** en esta caja, no la llena recortando: una captura
 *  de pantalla vertical recortada al centro no muestra ni el principio ni el
 *  final, que es justo lo que se quería mandar. El tamaño real está a un toque
 *  de distancia en el visor. */
const FOTO_ANCHO = 240;
const FOTO_ALTO = 320;

/** El lugar que ocupa una foto en el hilo, a partir de sus medidas reales. */
const medida = (w: number, h: number) => {
  const ancho = Math.max(1, w);
  const alto = Math.max(1, h);
  const escala = Math.min(FOTO_ANCHO / ancho, FOTO_ALTO / alto, 1);
  return { width: Math.round(ancho * escala), height: Math.round(alto * escala) };
};

/** Un mensaje que ya se mandó pero todavía no volvió por el `onSnapshot`. */
interface Pendiente {
  id: string;
  texto: string;
  at: number;
  imagen?: MensajeImagenDoc;
}

/** ¿Este mensaje en vuelo ya llegó por el snapshot?
 *
 *  Se compara por contenido y no por id porque el id lo pone Firestore al
 *  escribir: el de la burbuja optimista es local y nunca va a coincidir. Una
 *  foto se reconoce por su `src`, que es una URL con un token al azar por
 *  subida y por lo tanto única; un texto, por el texto, que no lo es —mandar
 *  "dale" dos veces seguidas saca las dos burbujas optimistas con la primera
 *  confirmación, y la segunda entra igual cuando llega—. */
const yaLlego = (x: Pendiente, mensajes: MessageVM[]) =>
  mensajes.some(
    (m) =>
      m.propio &&
      m.at >= x.at - 60_000 &&
      (x.imagen
        ? m.imagen?.src === x.imagen.src
        : m.tipo === "texto" && m.texto === x.texto),
  );

/** `useLayoutEffect` avisa por consola si corre en el servidor, y en el
 *  servidor no hay nada que medir. El primer salto al fondo tiene que ser
 *  *antes* del pintado —si no se ve el hilo arrancando arriba y bajando solo—,
 *  así que no alcanza con `useEffect`. */
const useIsoLayoutEffect = typeof window === "undefined" ? useEffect : useLayoutEffect;

export function Hilo({
  mensajes,
  viewerId,
  esGrupo,
  onSend,
  onSendImage,
  enviando,
  intro,
  leido = false,
}: {
  mensajes: MessageVM[];
  /** quién mira: los mensajes en vuelo se agrupan con los suyos */
  viewerId: string;
  esGrupo: boolean;
  onSend: (texto: string) => Promise<void> | void;
  /** la foto ya está en el bucket: por acá viaja sólo su URL, ruta y medidas */
  onSendImage: (imagen: MensajeImagenDoc, pie: string) => Promise<void> | void;
  /** deshabilita el envío mientras la conversación no está lista */
  enviando?: boolean;
  /** cabecera del hilo: quién es el otro, arriba de todo */
  intro?: React.ReactNode;
  /** el otro ya leyó lo último que mandaste */
  leido?: boolean;
}) {
  const [texto, setTexto] = useState("");
  const [mandando, setMandando] = useState(false);
  const [pendientes, setPendientes] = useState<Pendiente[]>([]);
  const [abierta, setAbierta] = useState<string | null>(null);
  const [abajo, setAbajo] = useState(true);
  const [foto, setFoto] = useState<UploadedChatImage | null>(null);
  const [subiendo, setSubiendo] = useState(false);
  const [visor, setVisor] = useState<{ src: string; pie: string } | null>(null);

  const scrollerRef = useRef<HTMLDivElement>(null);
  const campoRef = useRef<HTMLTextAreaElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  /*  Contador para el id de las burbujas en vuelo. La hora sola no alcanza:
   *  dos envíos dentro del mismo milisegundo darían la misma clave de lista. */
  const contador = useRef(0);
  /*  El mismo dato que `abajo`, pero legible desde un efecto sin meterlo como
   *  dependencia: si `abajo` fuera dependencia del autoscroll, scrollear a mano
   *  volvería a dispararlo. */
  const abajoRef = useRef(true);

  const { snack } = useSnackbar();
  const { haptic } = useHaptics();
  const { open: tecladoAbierto } = useKeyboardInset();
  /*  Enter manda sólo con teclado físico. En uno táctil el Enter es el salto de
   *  línea —no hay Shift a mano para pedirlo de otra forma— y el envío es el
   *  botón, que ahí está a un dedo de distancia. */
  const tactil = useMediaQuery("(pointer: coarse)");

  /*  Los que ya llegaron por el snapshot dejan de estar en vuelo.
   *
   *  Va como "ajustar estado cuando cambia una prop" —comparar contra la prop
   *  anterior en el render, no un efecto—, que es el patrón de React para esto
   *  y el mismo que usa `AppShell` con las notificaciones. En un efecto sería
   *  un render de más por cada emisión del snapshot, y la burbuja optimista
   *  quedaría un cuadro duplicada con la de verdad. */
  const [previos, setPrevios] = useState(mensajes);
  if (previos !== mensajes) {
    setPrevios(mensajes);
    setPendientes((p) => {
      const quedan = p.filter((x) => !yaLlego(x, mensajes));
      return quedan.length === p.length ? p : quedan;
    });
  }

  /** El hilo listo para dibujar: mensajes reales, los que están en vuelo, y
   *  para cada uno si abre tanda, si la cierra y si le toca sello. */
  const filas = useMemo(() => {
    const todos: (MessageVM & { pendiente?: boolean })[] = [
      ...mensajes,
      ...pendientes.map((p) => ({
        id: p.id,
        autorId: viewerId,
        autor: null,
        texto: p.texto,
        tipo: (p.imagen ? "imagen" : "texto") as MessageVM["tipo"],
        at: p.at,
        propio: true,
        pendiente: true,
        ...(p.imagen
          ? {
              imagen: {
                src: p.imagen.src,
                width: p.imagen.width,
                height: p.imagen.height,
              },
            }
          : null),
      })),
    ];

    return todos.map((m, i) => {
      const previo = todos[i - 1];
      const proximo = todos[i + 1];

      // El corte es por diferencia de timestamps y no por fecha: así el sello
      // que se dibuja es el mismo en el servidor y en el navegador aunque las
      // zonas horarias no coincidan. Ver `chatStamp`.
      const corte = !previo || m.at - previo.at > PAUSA;
      // Un mensaje de sistema corta la tanda: no es de nadie.
      const dicho = m.tipo !== "sistema";

      const sigueArriba =
        dicho && !corte && previo?.tipo !== "sistema" && previo?.autorId === m.autorId;
      const sigueAbajo =
        dicho &&
        !!proximo &&
        proximo.tipo !== "sistema" &&
        proximo.autorId === m.autorId &&
        proximo.at - m.at <= PAUSA;

      return {
        m,
        sello: corte ? chatStamp(m.at) : null,
        inicio: !sigueArriba,
        fin: !sigueAbajo,
      };
    });
  }, [mensajes, pendientes, viewerId]);

  const ultima = filas[filas.length - 1];
  const mostrarVisto =
    leido && ultima?.m.tipo !== "sistema" && !!ultima?.m.propio && !ultima.m.pendiente;

  const irAlFondo = (suave: boolean) => {
    const el = scrollerRef.current;
    if (!el) return;
    el.scrollTo({ top: el.scrollHeight, behavior: suave ? "smooth" : "auto" });
  };

  /*  Primer pintado: al fondo y sin animación. Un chat se abre por el final. */
  useIsoLayoutEffect(() => {
    irAlFondo(false);
  }, []);

  /*  Mensaje nuevo: baja sólo si quien mira ya estaba abajo. Arrastrarlo
   *  mientras lee hacia arriba es la forma más rápida de que pierda el hilo;
   *  para eso está el chip. La dependencia es la CANTIDAD y no el array: el
   *  snapshot emite objetos nuevos aunque no haya cambiado nada. */
  useEffect(() => {
    if (abajoRef.current) irAlFondo(true);
  }, [filas.length]);

  /*  El teclado achica la caja (ver `--kb-inset` en `AppShell`): sin esto, lo
   *  último queda tapado justo cuando se va a contestar. */
  useEffect(() => {
    if (tecladoAbierto && abajoRef.current) irAlFondo(false);
  }, [tecladoAbierto]);

  /*  El campo crece con el texto hasta un tope y después scrollea él. Es lo que
   *  evita el `min-h-[88px]` del `Textarea` de la librería, que es un campo de
   *  formulario y en una barra de chat ocupa un cuarto de la pantalla.
   *
   *  La miniatura de la foto también mueve el alto del compositor, así que
   *  entra en las dependencias por el mismo motivo. */
  useEffect(() => {
    const el = campoRef.current;
    if (el) {
      el.style.height = "0px";
      el.style.height = `${Math.min(el.scrollHeight, ALTO_CAMPO)}px`;
    }
    if (abajoRef.current) irAlFondo(false);
  }, [texto, foto, subiendo]);

  const alScrollear = () => {
    const el = scrollerRef.current;
    if (!el) return;
    const cerca = el.scrollHeight - el.scrollTop - el.clientHeight < CERCA;
    abajoRef.current = cerca;
    setAbajo(cerca);
  };

  /*  La foto se sube al elegirla, no al mandarla: así la espera se solapa con
   *  escribir el pie, en vez de sumarse después de apretar enviar. Es lo mismo
   *  que hace el compositor del feed. */
  const elegir = async (files: FileList | null) => {
    const file = files?.[0];
    if (!file) return;

    // La que estaba puesta antes de empezar: se manda una foto por mensaje, así
    // que reemplazarla deja a la anterior sin nadie que la referencie.
    const previa = foto;

    setSubiendo(true);
    try {
      const subida = await uploadChatImage(file);
      setFoto(subida);
      // El borrado va DESPUÉS de la subida nueva y fuera del updater de estado:
      // React invoca los updaters dos veces en StrictMode, y un efecto adentro
      // se ejecutaría dos veces con él.
      if (previa) void deleteChatImage(previa.path);
    } catch (e) {
      snack({
        message: e instanceof Error ? e.message : "No se pudo subir la foto.",
        variant: "error",
      });
    } finally {
      setSubiendo(false);
    }
  };

  const quitarFoto = () => {
    if (!foto) return;
    setFoto(null);
    void deleteChatImage(foto.path);
  };

  const enviar = async () => {
    const limpio = texto.trim();
    const adjunta = foto;
    if (subiendo || mandando || enviando) return;
    if (!limpio && !adjunta) return;

    const local: Pendiente = {
      id: `local-${Date.now()}-${contador.current++}`,
      texto: limpio,
      at: Date.now(),
      ...(adjunta
        ? {
            imagen: {
              src: adjunta.src,
              path: adjunta.path,
              width: adjunta.width,
              height: adjunta.height,
            },
          }
        : null),
    };

    // El campo se vacía y la burbuja aparece ANTES de esperar al servidor: el
    // mensaje ya está en camino, y dejar el texto puesto invita a mandarlo dos
    // veces. La burbuja va apagada hasta que vuelve por el snapshot.
    setTexto("");
    setFoto(null);
    setPendientes((p) => [...p, local]);
    setMandando(true);
    abajoRef.current = true;
    haptic("tap");

    try {
      if (local.imagen) await onSendImage(local.imagen, limpio);
      else await onSend(limpio);
    } catch {
      // No salió: se saca la burbuja y vuelve todo al compositor. Es la única
      // forma de no perderlo, y deja el reintento en manos de quien lo escribió.
      // La foto NO se borra del bucket: sigue siendo la que se va a mandar.
      setPendientes((p) => p.filter((x) => x.id !== local.id));
      setTexto((t) => t || limpio);
      if (adjunta) setFoto((f) => f ?? adjunta);
    } finally {
      setMandando(false);
    }
  };

  const puedeEnviar = (!!texto.trim() || !!foto) && !mandando && !enviando && !subiendo;

  return (
    <div className="flex min-h-0 flex-1 flex-col bg-surface">
      {/* `relative` con el scroller en `absolute inset-0`: el chip se ancla al
          borde de abajo del hilo, que es donde va a mirar quien lo necesita. */}
      <div className="relative min-h-0 flex-1">
        <div
          ref={scrollerRef}
          onScroll={alScrollear}
          className="scroll-native absolute inset-0 px-3 py-2"
        >
          <div className="mx-auto w-full max-w-2xl">
            {intro}

            <ul className="flex flex-col pb-1">
              {filas.map(({ m, sello, inicio, fin }) => (
                <Fragment key={m.id}>
                  {sello && (
                    <li className="py-4 text-center">
                      {/* La zona horaria del servidor no es la de quien mira:
                          el texto puede diferir y no hay nada que arreglar. */}
                      <span
                        suppressHydrationWarning
                        className="text-[11px] font-medium text-muted"
                      >
                        {sello}
                      </span>
                    </li>
                  )}

                  {m.tipo === "sistema" ? (
                    <li className="py-2 text-center">
                      <span className="rounded-full bg-surface-alt px-3 py-1 text-[11px] text-muted">
                        {m.texto}
                      </span>
                    </li>
                  ) : (
                    <li
                      className={[
                        "flex items-end gap-2",
                        inicio ? "mt-2.5" : "mt-0.5",
                        m.propio ? "justify-end" : "",
                      ].join(" ")}
                    >
                      {!m.propio && (
                        /* El hueco existe siempre: sin él, las burbujas de una
                           tanda quedarían corridas respecto de la última, que
                           es la única que lleva avatar. */
                        <div className="w-7 shrink-0">
                          {fin && (
                            <Avatar src={m.autor?.avatar} name={m.autor?.name ?? "?"} size={28} />
                          )}
                        </div>
                      )}

                      <div
                        className={`flex max-w-[76%] flex-col ${
                          m.propio ? "items-end" : "items-start"
                        }`}
                      >
                        {/* El nombre sólo en grupos y una vez por tanda: en una
                            directa ya está en el header, y repetirlo en cada
                            burbuja no dice nada nuevo. */}
                        {esGrupo && !m.propio && inicio && (
                          <span className="mb-1 ml-3.5 text-[11px] font-medium text-muted">
                            {m.autor?.name ?? "Alguien"}
                          </span>
                        )}

                        <Burbuja
                          m={m}
                          inicio={inicio}
                          fin={fin}
                          onTocar={() =>
                            m.imagen
                              ? setVisor({ src: m.imagen.src, pie: m.texto })
                              : setAbierta((a) => (a === m.id ? null : m.id))
                          }
                        />

                        <AnimatePresence initial={false}>
                          {abierta === m.id && (
                            <motion.div
                              initial={{ height: 0, opacity: 0 }}
                              animate={{ height: "auto", opacity: 1 }}
                              exit={{ height: 0, opacity: 0 }}
                              transition={{ duration: 0.16 }}
                              className="overflow-hidden"
                            >
                              <span
                                suppressHydrationWarning
                                className="block px-2 pt-1 text-[10px] text-muted"
                              >
                                {m.pendiente ? "Enviando…" : clockTime(m.at)}
                              </span>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>
                    </li>
                  )}
                </Fragment>
              ))}

              {mostrarVisto && (
                <li className="mt-1 pr-1 text-right text-[11px] text-muted">Visto</li>
              )}
            </ul>
          </div>
        </div>

        <AnimatePresence>
          {!abajo && (
            <motion.button
              type="button"
              onClick={() => irAlFondo(true)}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 8 }}
              className="absolute bottom-3 left-1/2 flex -translate-x-1/2 items-center gap-1 rounded-full bg-surface px-3 py-1.5 text-xs font-medium text-foreground shadow-lg ring-1 ring-border active:scale-95"
            >
              <ArrowDownIcon width="1em" height="1em" />
              Ir al final
            </motion.button>
          )}
        </AnimatePresence>
      </div>

      <div className="shrink-0 border-t border-border bg-surface px-3 pt-2 pb-3">
        {/* La foto elegida, antes de mandarse. Ocupa una fila propia arriba del
            campo y no un chip adentro: con la miniatura a la vista se entiende
            que el texto que se está escribiendo es su pie. */}
        <AnimatePresence initial={false}>
          {(foto || subiendo) && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.18 }}
              className="overflow-hidden"
            >
              <div className="mx-auto flex w-full max-w-2xl items-center gap-3 pb-2">
                <div className="relative shrink-0">
                  {foto ? (
                    // eslint-disable-next-line @next/next/no-img-element -- URL de Storage
                    <img
                      src={foto.src}
                      alt=""
                      className="size-16 rounded-xl object-cover"
                    />
                  ) : (
                    <div className="size-16 animate-pulse rounded-xl bg-surface-alt" />
                  )}

                  {foto && (
                    <button
                      type="button"
                      onClick={quitarFoto}
                      aria-label="Quitar la foto"
                      className="absolute -top-1.5 -right-1.5 grid size-6 place-items-center rounded-full bg-foreground text-surface transition-transform active:scale-90"
                    >
                      <CloseIcon width="0.85em" height="0.85em" />
                    </button>
                  )}
                </div>

                <p className="text-xs text-muted">
                  {subiendo ? "Subiendo la foto…" : "Podés agregarle un pie, o mandarla así."}
                </p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="mx-auto flex w-full max-w-2xl items-end gap-1.5">
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            disabled={subiendo || mandando}
            aria-label="Adjuntar una foto"
            className="grid size-11 shrink-0 place-items-center rounded-full text-primary transition-all hover:bg-surface-alt active:scale-90 disabled:opacity-40"
          >
            <ImageIcon />
          </button>
          {/* `value = ""` al salir: sin eso, elegir el mismo archivo dos veces
              seguidas no dispara `change` y la segunda no pasa nada. */}
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            hidden
            onChange={(e) => {
              void elegir(e.target.files);
              e.target.value = "";
            }}
          />

          <div className="flex min-h-11 flex-1 items-center rounded-[22px] border border-border bg-surface-alt px-4 py-2.5">
            <textarea
              ref={campoRef}
              value={texto}
              onChange={(e) => setTexto(e.target.value)}
              onKeyDown={(e) => {
                // `isComposing`: con un IME de por medio, el Enter que cierra la
                // sugerencia no es el Enter que manda el mensaje.
                if (tactil || e.key !== "Enter" || e.shiftKey || e.nativeEvent.isComposing) return;
                e.preventDefault();
                void enviar();
              }}
              rows={1}
              maxLength={2000}
              placeholder={foto ? "Agregá un pie…" : "Escribí un mensaje…"}
              aria-label={foto ? "Pie de la foto" : "Mensaje"}
              className="w-full resize-none bg-transparent text-[15px] leading-snug text-foreground outline-none placeholder:text-muted"
              style={{ maxHeight: ALTO_CAMPO }}
            />
          </div>

          {/* Siempre presente, no aparece con el texto: un botón que entra y
              sale mueve el ancho del campo en cada tecla. Lo que cambia es el
              color, que ya dice si hay algo para mandar. */}
          <button
            type="button"
            onClick={() => void enviar()}
            disabled={!puedeEnviar}
            aria-label="Enviar"
            className={[
              "grid size-11 shrink-0 place-items-center rounded-full transition-all duration-200",
              puedeEnviar
                ? "bg-primary text-white shadow-md shadow-primary/25 active:scale-90"
                : "scale-95 bg-surface-alt text-muted",
            ].join(" ")}
          >
            <SendIcon width="1.25em" height="1.25em" />
          </button>
        </div>
      </div>

      {/*  El visor va montado siempre: `ImageZoom` no dibuja nada con
          `open: false`, y sacarlo del árbol le cortaría la animación de salida.
          Mientras está abierto bloquea el scroll y los gestos del navegador,
          así que el hilo de atrás no se mueve. */}
      <ImageZoom
        src={visor?.src ?? ""}
        caption={visor?.pie || undefined}
        open={!!visor}
        onClose={() => setVisor(null)}
      />
    </div>
  );
}

/** La burbuja: texto, o foto con pie.
 *
 *  Sale a una función propia porque las dos formas comparten el color, el
 *  agrupado y las esquinas —que dependen de la posición en la tanda— pero no el
 *  relleno: una foto llena la burbuja hasta el borde y un texto no.
 */
function Burbuja({
  m,
  inicio,
  fin,
  onTocar,
}: {
  m: MessageVM & { pendiente?: boolean };
  inicio: boolean;
  fin: boolean;
  onTocar: () => void;
}) {
  const base = [
    "max-w-full overflow-hidden rounded-[20px] text-left transition-transform active:scale-[0.98]",
    m.propio
      ? "bg-gradient-to-br from-primary to-accent text-white"
      : "bg-surface-alt text-foreground",
    // Las esquinas por las que una burbuja toca a la de al lado se achican: es
    // lo que hace que una tanda se lea como un bloque y no como tres globos.
    m.propio && !inicio ? "rounded-tr-[7px]" : "",
    m.propio && !fin ? "rounded-br-[7px]" : "",
    !m.propio && !inicio ? "rounded-tl-[7px]" : "",
    !m.propio && !fin ? "rounded-bl-[7px]" : "",
    m.pendiente ? "opacity-60" : "",
  ];

  if (m.imagen) {
    const caja = medida(m.imagen.width, m.imagen.height);
    return (
      <button type="button" onClick={onTocar} className={base.join(" ")} style={{ width: caja.width }}>
        {/*  El alto sale de las medidas guardadas, no de la imagen: reservado
            desde el primer pintado, el hilo no salta cuando la foto carga.
            `bg-surface-alt` es el gris que se ve mientras tanto. */}
        {/* eslint-disable-next-line @next/next/no-img-element -- URL de Storage */}
        <img
          src={m.imagen.src}
          alt={m.texto || "Foto"}
          width={caja.width}
          height={caja.height}
          loading="lazy"
          className="block bg-surface-alt object-cover"
          style={{ width: caja.width, height: caja.height }}
        />
        {m.texto && (
          <span className="block px-3.5 py-2 text-[15px] leading-snug whitespace-pre-wrap break-words">
            {m.texto}
          </span>
        )}
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={onTocar}
      className={[...base, "px-3.5 py-2 text-[15px] leading-snug"].join(" ")}
    >
      <span className="block whitespace-pre-wrap break-words">{m.texto}</span>
    </button>
  );
}
