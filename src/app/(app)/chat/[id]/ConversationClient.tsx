"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { BottomSheet } from "lib-kit-components";

import { Avatar } from "@/components/atoms/Avatar";
import { UsersIcon } from "@/components/atoms/icons";
import { Hilo } from "@/components/organisms/Hilo";
import { HiloHeader } from "@/components/organisms/HiloHeader";
import { marcarLeida, salirDelGrupo, sendImage, sendMessage } from "@/lib/chat/actions";
import type { ConversationHeadVM, MessageVM } from "@/lib/chat/queries";
import { escucharLectura, escucharMensajes } from "@/lib/chat/vivo";
import { backOr } from "@/lib/nav";
import type { AuthorVM } from "@/lib/social/queries";

/** Conversación abierta, en vivo.
 *
 *  Pantalla empujada: el `AppShell` esconde el `BottomNav` acá (patrón B de la
 *  guía) y además le da a esta ruta —y sólo a esta— el alto exacto del viewport,
 *  porque es la única pantalla de la app donde el scroll no es de la ventana
 *  sino de una fila de adentro. Sin eso el compositor queda abajo del último
 *  mensaje en vez de pegado al borde inferior.
 *
 *  Los mensajes llegan por `onSnapshot` directo desde el navegador, que es la
 *  primera lectura del cliente a Firestore en el módulo social. La primera tanda
 *  igual la trae el servidor por props: sin eso, abrir un chat muestra un hueco
 *  hasta que responde Firestore, y con conexión de celular eso se nota.
 *
 *  Escribir sigue yendo por Server Action. No es incoherente: un mensaje mueve
 *  también el `ultimoMensaje` de la conversación y dispara la campanita de cada
 *  participante, y eso no puede quedar en manos del cliente. Lo que sí se
 *  adelanta el cliente es la burbuja (ver `Hilo`), que es apariencia y no dato.
 *
 *  Las fotos parten el reparto en dos y a propósito: **el archivo** lo sube el
 *  navegador directo a Storage —comprimido, sin pasar por el servidor—, y por
 *  `sendImage` viaja sólo la URL, la ruta y las medidas. Mover megas de imagen
 *  dentro del body de una Server Action sería pagar dos veces el mismo tránsito.
 *  Es el mismo reparto que ya usa el compositor del feed.
 */
export function ConversationClient({
  head,
  viewerId,
  mensajes: iniciales,
}: {
  head: ConversationHeadVM;
  viewerId: string;
  mensajes: MessageVM[];
}) {
  const router = useRouter();
  const [mensajes, setMensajes] = useState<MessageVM[]>(iniciales);
  const [lecturas, setLecturas] = useState<Record<string, number>>({});
  const [verParticipantes, setVerParticipantes] = useState(false);
  const [saliendo, setSaliendo] = useState(false);

  const esGrupo = head.tipo === "grupo";
  const otro = head.participantes.find((p) => p.id !== viewerId) ?? null;

  /*  El mapa de autores se arma una vez con lo que trajo el servidor: el
   *  snapshot sólo devuelve uid, y resolver el nombre por mensaje sería una
   *  lectura de `trapnexport-user` por burbuja. */
  const autores: Record<string, AuthorVM> = Object.fromEntries(
    head.participantes.map((p) => [p.id, p as AuthorVM]),
  );

  useEffect(() => {
    const stop = escucharMensajes(head.id, viewerId, autores, setMensajes);
    return stop;
    // `autores` sale de `head` y se rearma en cada render; volver a suscribirse
    // por eso cortaría y recrearía la escucha sin motivo.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [head.id, viewerId]);

  useEffect(() => escucharLectura(head.id, setLecturas), [head.id]);

  /*  Marcar leída al abrir y cada vez que llega algo nuevo estando acá: si sólo
   *  se marcara al abrir, un mensaje que llega con la pantalla abierta quedaría
   *  contando como no leído para siempre. */
  useEffect(() => {
    void marcarLeida(head.id);
  }, [head.id, mensajes.length]);

  /** El "Visto" de abajo del último mensaje propio.
   *
   *  Sólo en directas: en un grupo la pregunta no es "¿lo leyó?" sino "¿quiénes
   *  lo leyeron?", y eso no es una palabra abajo de una burbuja. Se calcula
   *  contra el último mensaje **propio** porque es el único sobre el que la
   *  respuesta significa algo. */
  const leido = useMemo(() => {
    if (esGrupo || !otro) return false;
    const ultimoPropio = [...mensajes].reverse().find((m) => m.propio);
    if (!ultimoPropio) return false;
    return (lecturas[otro.id] ?? 0) >= ultimoPropio.at;
  }, [esGrupo, otro, mensajes, lecturas]);

  const salir = async () => {
    if (saliendo) return;
    setSaliendo(true);
    try {
      await salirDelGrupo(head.id);
      router.replace("/chat");
    } finally {
      setSaliendo(false);
    }
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <HiloHeader
        titulo={head.titulo}
        subtitulo={head.subtitulo}
        avatar={head.avatar}
        // `backOr` y no `push("/chat")`: empujar la bandeja deja esta pantalla
        // en el historial, y como la bandeja también retrocede, las dos se
        // apuntan entre sí y no se sale más (ver `lib/nav.ts`).
        onBack={() => backOr(router, "/chat")}
        // Tocar el nombre lleva a quién es: el perfil en una directa, la lista
        // de participantes en un grupo. Es el gesto que ya tiene aprendido
        // cualquiera que use una app de mensajes.
        onTitulo={
          esGrupo
            ? () => setVerParticipantes(true)
            : otro
              ? () => router.push(`/u/${otro.handle}`)
              : undefined
        }
        acciones={
          esGrupo ? (
            <button
              type="button"
              onClick={() => setVerParticipantes(true)}
              aria-label="Participantes"
              className="grid size-10 place-items-center rounded-xl text-foreground transition-all hover:bg-surface-alt active:scale-90"
            >
              <UsersIcon />
            </button>
          ) : undefined
        }
      />

      <Hilo
        mensajes={mensajes}
        viewerId={viewerId}
        esGrupo={esGrupo}
        leido={leido}
        onSend={(texto) => sendMessage(head.id, texto)}
        onSendImage={(imagen, pie) => sendImage(head.id, imagen, pie)}
        intro={
          <HiloIntro
            titulo={head.titulo}
            subtitulo={head.subtitulo}
            avatar={head.avatar}
            href={!esGrupo && otro ? `/u/${otro.handle}` : undefined}
            vacio={mensajes.length === 0}
          />
        }
      />

      <BottomSheet
        open={verParticipantes}
        onClose={() => setVerParticipantes(false)}
        title={head.titulo}
        description={`${head.participantes.length} participantes`}
        showClose
      >
        <ul className="flex flex-col gap-1">
          {head.participantes.map((p) => (
            <li key={p.id}>
              <Link
                href={`/u/${p.handle}`}
                onClick={() => setVerParticipantes(false)}
                className="flex items-center gap-3 rounded-xl px-2 py-2 transition-colors hover:bg-surface-alt"
              >
                <Avatar src={p.avatar} name={p.name} size={38} />
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">
                    {p.name}
                    {p.id === viewerId && <span className="text-muted"> · vos</span>}
                  </p>
                  <p className="truncate text-xs text-muted">@{p.handle}</p>
                </div>
              </Link>
            </li>
          ))}
        </ul>

        <button
          type="button"
          disabled={saliendo}
          className="mt-6 font-medium text-danger disabled:opacity-50"
          onClick={() => void salir()}
        >
          Salir del grupo
        </button>
      </BottomSheet>
    </div>
  );
}

/** El principio del hilo: con quién se está hablando.
 *
 *  Va arriba de todo, dentro del scroll, y no como una tarjeta fija: es el
 *  comienzo de la conversación, así que se lo lleva el scroll como se lleva a
 *  los mensajes. En un chat vacío queda centrado en pantalla y hace de estado
 *  vacío sin ser un cartel aparte.
 */
function HiloIntro({
  titulo,
  subtitulo,
  avatar,
  href,
  vacio,
}: {
  titulo: string;
  subtitulo: string;
  avatar?: string;
  href?: string;
  vacio: boolean;
}) {
  const contenido = (
    <>
      <Avatar src={avatar} name={titulo} size={88} />
      <p className="mt-3 text-lg font-semibold">{titulo}</p>
      <p className="text-sm text-muted">{subtitulo}</p>
      {href && (
        <span className="mt-3 inline-block rounded-lg bg-surface-alt px-3 py-1.5 text-sm font-medium">
          Ver perfil
        </span>
      )}
      {vacio && (
        <p className="mt-5 text-sm text-muted">
          No hay mensajes todavía. Escribí el primero.
        </p>
      )}
    </>
  );

  return (
    <div className={`flex flex-col items-center px-6 text-center ${vacio ? "pt-16" : "pt-8 pb-2"}`}>
      {href ? (
        <Link href={href} className="flex flex-col items-center">
          {contenido}
        </Link>
      ) : (
        contenido
      )}
    </div>
  );
}
