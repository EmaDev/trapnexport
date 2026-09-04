"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { AppHeader, BottomSheet, Button, Input, SafeAreaSpacer, useSnackbar } from "lib-kit-components";

import { Avatar } from "@/components/atoms/Avatar";
import { BellIcon, ChatIcon, CheckIcon, CloseIcon, PencilIcon } from "@/components/atoms/icons";
import { abrirDirecta, crearGrupo } from "@/lib/chat/actions";
import type { ConversationVM } from "@/lib/chat/queries";
import { backOr } from "@/lib/nav";
import type { AuthorVM } from "@/lib/social/queries";
import { useNotifications } from "../notifications-context";

/** Lista de conversaciones: directas y grupos.
 *
 *  Ya no es una pantalla raíz: los mensajes directos se levantan desde el
 *  header —el sobre del feed y el del foro— y su lugar en el `BottomNav` lo
 *  tomó el foro. Por eso lleva flecha de regreso y `AppShell` la esconde de la
 *  nav (`PUSHED`): es una pantalla empujada, como la conversación.
 *
 *  El buscador del `AppHeader` filtra lo que ya está en pantalla; no busca
 *  gente. Empezar una conversación es otra cosa y vive en el lápiz de la
 *  derecha, que abre una hoja que hace las dos cosas —escribirle a alguien y
 *  armar un grupo— porque son el mismo gesto con distinto número de elegidos:
 *  con uno es una directa, con dos o más es un grupo. Dos botones separados
 *  obligarían a decidir antes de saber a quién se le quiere escribir.
 *
 *  El lápiz reemplazó al `FloatingButton` que estaba antes: en una lista de
 *  filas altas, un botón flotante tapa justamente la última conversación.
 */
export function ChatListClient({
  conversations,
  contactos,
}: {
  conversations: ConversationVM[];
  contactos: (AuthorVM & { id: string })[];
}) {
  const router = useRouter();
  const { snack } = useSnackbar();
  const { unread, open } = useNotifications();

  const [filtro, setFiltro] = useState("");
  const [nueva, setNueva] = useState(false);
  const [busca, setBusca] = useState("");
  const [elegidos, setElegidos] = useState<string[]>([]);
  const [nombreGrupo, setNombreGrupo] = useState("");
  const [creando, setCreando] = useState(false);

  const esGrupo = elegidos.length > 1;

  const q = filtro.trim().toLowerCase();
  const visibles = q
    ? conversations.filter(
        (c) =>
          c.titulo.toLowerCase().includes(q) ||
          c.subtitulo.toLowerCase().includes(q) ||
          c.lastMessage.toLowerCase().includes(q),
      )
    : conversations;

  const filtrados = contactos.filter((c) => {
    const t = busca.trim().toLowerCase();
    if (!t) return true;
    return c.name.toLowerCase().includes(t) || c.handle.toLowerCase().includes(t);
  });

  const alternar = (id: string) =>
    setElegidos((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));

  const cerrar = () => {
    setNueva(false);
    setBusca("");
    setElegidos([]);
    setNombreGrupo("");
  };

  const crear = async () => {
    if (!elegidos.length || creando) return;
    setCreando(true);
    try {
      const id = esGrupo
        ? await crearGrupo(nombreGrupo, elegidos)
        : await abrirDirecta(elegidos[0]);

      if (!id) {
        snack({
          message: esGrupo
            ? "Poné un nombre al grupo y elegí al menos dos personas."
            : "No se pudo abrir la conversación.",
          variant: "error",
        });
        return;
      }
      cerrar();
      router.push(`/chat/${id}`);
    } finally {
      setCreando(false);
    }
  };

  const sinLeer = conversations.filter((c) => c.unread > 0).length;

  return (
    <>
      <AppHeader
        title="Mensajes"
        subtitle={
          conversations.length === 0
            ? "Sin conversaciones"
            : sinLeer > 0
              ? `${conversations.length} conversaciones · ${sinLeer} sin leer`
              : `${conversations.length} conversaciones`
        }
        // Vuelve a la pantalla que la abrió —el sobre está en los cuatro
        // headers—, y al feed si se entró de una a `/chat`.
        onBack={() => backOr(router, "/")}
        largeTitle
        variant="blur"
        sticky
        searchable
        searchPlaceholder="Buscar en tus mensajes"
        onSearch={setFiltro}
        actions={[
          {
            id: "nueva",
            label: "Nueva conversación",
            icon: <PencilIcon />,
            tone: "primary",
            onClick: () => setNueva(true),
          },
          {
            id: "notif",
            label: "Notificaciones",
            icon: <BellIcon />,
            badge: unread || false,
            onClick: open,
          },
        ]}
      />

      {conversations.length === 0 ? (
        <div className="mx-auto flex w-full max-w-xl flex-col items-center px-8 pt-20 text-center">
          <span className="grid size-16 place-items-center rounded-full bg-surface-alt text-muted">
            <ChatIcon width="2em" height="2em" />
          </span>
          <p className="mt-4 text-base font-semibold">Todavía no tenés mensajes</p>
          <p className="mt-1 text-sm text-muted">
            Escribile a alguien del club o armá un grupo.
          </p>
          <Button className="mt-6" onClick={() => setNueva(true)}>
            Empezar una conversación
          </Button>
        </div>
      ) : (
        /*  Sin líneas divisorias entre filas: con avatares de 56 y dos renglones
            de texto, el bloque ya se lee como una lista y las líneas sólo suman
            ruido horizontal. */
        <ul className="mx-auto w-full max-w-xl px-2 pt-1">
          {visibles.map((c) => (
            <li key={c.id}>
              <Link
                href={`/chat/${c.id}`}
                className="flex items-center gap-3 rounded-2xl px-2 py-2.5 transition-colors hover:bg-surface-alt active:bg-surface-alt"
              >
                <Avatar src={c.avatar} name={c.titulo} size={56} />

                <div className="min-w-0 flex-1">
                  <p
                    className={`truncate text-[15px] leading-tight ${
                      c.unread ? "font-bold" : "font-medium"
                    }`}
                  >
                    {c.titulo}
                  </p>
                  {/*  El "hace 2 h" va pegado al final del renglón y no en una
                      columna aparte: en una fila de dos líneas, una columna a la
                      derecha le come el ancho justo al texto que importa. */}
                  <p
                    className={`mt-0.5 truncate text-[13px] leading-tight ${
                      c.unread ? "font-medium text-foreground" : "text-muted"
                    }`}
                  >
                    {c.mine ? "Vos: " : ""}
                    {c.lastMessage || "Sin mensajes"}
                    {c.time && <span className="text-muted"> · {c.time}</span>}
                  </p>
                </div>

                {c.unread > 0 && (
                  <span
                    className="size-2.5 shrink-0 rounded-full bg-primary"
                    aria-label="Mensajes sin leer"
                  />
                )}
              </Link>
            </li>
          ))}

          {visibles.length === 0 && (
            <li className="px-2 py-10 text-center text-sm text-muted">
              Ninguna conversación coincide con “{filtro.trim()}”.
            </li>
          )}
        </ul>
      )}

      <SafeAreaSpacer edge="bottom" min={16} />

      <BottomSheet
        open={nueva}
        onClose={cerrar}
        title={esGrupo ? "Nuevo grupo" : "Nueva conversación"}
        description={
          esGrupo
            ? `${elegidos.length} participantes`
            : "Elegí una persona, o varias para armar un grupo"
        }
        showClose
      >
        <div className="flex flex-col gap-3">
          {/*  Los elegidos, arriba y sacables de a uno. Sin esto, con la lista
              scrolleada hay que volver a buscar a alguien para darse cuenta de
              que ya estaba puesto. */}
          {elegidos.length > 0 && (
            <ul className="flex flex-wrap gap-1.5">
              {elegidos.map((id) => {
                const c = contactos.find((x) => x.id === id);
                if (!c) return null;
                return (
                  <li key={id}>
                    <button
                      type="button"
                      onClick={() => alternar(id)}
                      aria-label={`Quitar a ${c.name}`}
                      className="flex items-center gap-1.5 rounded-full bg-surface-alt py-1 pr-2.5 pl-1 text-xs font-medium transition-colors hover:bg-border"
                    >
                      <Avatar src={c.avatar} name={c.name} size={22} />
                      <span className="max-w-28 truncate">{c.name}</span>
                      <CloseIcon width="0.9em" height="0.9em" className="text-muted" />
                    </button>
                  </li>
                );
              })}
            </ul>
          )}

          {/* El nombre aparece recién con dos elegidos: pedirlo antes es pedir
              un dato para algo que todavía no se sabe si va a ser un grupo. */}
          {esGrupo && (
            <Input
              label="Nombre del grupo"
              value={nombreGrupo}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                setNombreGrupo(e.target.value)
              }
              maxLength={60}
              required
            />
          )}

          <Input
            label="Buscar"
            value={busca}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setBusca(e.target.value)}
            placeholder="Nombre o @usuario"
          />

          <ul className="-mx-1 max-h-72 overflow-y-auto px-1">
            {filtrados.map((c) => {
              const puesto = elegidos.includes(c.id);
              return (
                <li key={c.id}>
                  <button
                    type="button"
                    onClick={() => alternar(c.id)}
                    aria-pressed={puesto}
                    className="flex w-full items-center gap-3 rounded-xl px-2 py-2 text-left transition-colors hover:bg-surface-alt"
                  >
                    <Avatar src={c.avatar} name={c.name} size={38} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{c.name}</p>
                      <p className="truncate text-xs text-muted">@{c.handle}</p>
                    </div>
                    {/*  El círculo está siempre, vacío o lleno: es lo que dice
                        que la fila se puede elegir antes de tocarla. */}
                    <span
                      aria-hidden
                      className={`grid size-6 shrink-0 place-items-center rounded-full border-2 transition-colors ${
                        puesto
                          ? "border-primary bg-primary text-white"
                          : "border-border text-transparent"
                      }`}
                    >
                      <CheckIcon width="0.9em" height="0.9em" />
                    </span>
                  </button>
                </li>
              );
            })}
            {filtrados.length === 0 && (
              <li className="px-2 py-6 text-center text-sm text-muted">
                No hay cuentas que coincidan.
              </li>
            )}
          </ul>

          <Button
            fullWidth
            onClick={() => void crear()}
            disabled={!elegidos.length || creando || (esGrupo && !nombreGrupo.trim())}
          >
            {esGrupo ? "Crear grupo" : "Abrir conversación"}
          </Button>
        </div>
      </BottomSheet>
    </>
  );
}
