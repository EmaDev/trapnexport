"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import {
  AppHeader,
  BottomSheet,
  Button,
  FloatingButton,
  Input,
  SafeAreaSpacer,
  useSnackbar,
} from "lib-kit-components";

import { BellIcon, PlusIcon } from "@/components/atoms/icons";
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
 *  El FAB abre una hoja que hace las dos cosas —empezar una conversación con
 *  alguien y armar un grupo— porque son el mismo gesto con distinto número de
 *  elegidos: con uno seleccionado es una directa, con dos o más es un grupo. Dos
 *  botones separados obligarían a decidir antes de saber a quién se quiere
 *  escribir.
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

  const [nueva, setNueva] = useState(false);
  const [busca, setBusca] = useState("");
  const [elegidos, setElegidos] = useState<string[]>([]);
  const [nombreGrupo, setNombreGrupo] = useState("");
  const [creando, setCreando] = useState(false);

  const esGrupo = elegidos.length > 1;

  const filtrados = contactos.filter((c) => {
    const q = busca.trim().toLowerCase();
    if (!q) return true;
    return c.name.toLowerCase().includes(q) || c.handle.toLowerCase().includes(q);
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

  return (
    <>
      <AppHeader
        title="Mensajes"
        subtitle={`${conversations.length} conversaciones`}
        // Vuelve a la pantalla que la abrió —el sobre está en los cuatro
        // headers—, y al feed si se entró de una a `/chat`.
        onBack={() => backOr(router, "/")}
        largeTitle
        variant="blur"
        sticky
        actions={[
          {
            id: "notif",
            label: "Notificaciones",
            icon: <BellIcon />,
            badge: unread || false,
            onClick: open,
          },
        ]}
      />

      {conversations.length === 0 && (
        <p className="mx-auto w-full max-w-xl px-4 py-6 text-center text-sm text-muted">
          Todavía no tenés mensajes.
        </p>
      )}

      <ul className="mx-auto w-full max-w-xl divide-y divide-border px-2">
        {conversations.map((c) => (
          <li key={c.id}>
            <Link
              href={`/chat/${c.id}`}
              className="flex items-center gap-3 rounded-2xl px-2 py-3 transition-colors hover:bg-surface-alt"
            >
              {c.avatar ? (
                // eslint-disable-next-line @next/next/no-img-element -- URL de Storage
                <img
                  src={c.avatar}
                  alt=""
                  className="size-12 shrink-0 rounded-full object-cover"
                />
              ) : (
                /* Un grupo sin foto: la inicial del nombre sobre el color de
                   marca. Mejor que un hueco gris del tamaño de un avatar. */
                <span className="grid size-12 shrink-0 place-items-center rounded-full bg-primary text-lg font-bold text-white">
                  {c.titulo.charAt(0).toUpperCase()}
                </span>
              )}

              <div className="min-w-0 flex-1">
                <div className="flex items-baseline gap-2">
                  <span className="truncate font-semibold">{c.titulo}</span>
                  <span className="ml-auto shrink-0 text-xs text-muted">{c.time}</span>
                </div>
                <p
                  className={`truncate text-sm ${
                    c.unread ? "font-medium text-foreground" : "text-muted"
                  }`}
                >
                  {c.mine ? "Vos: " : ""}
                  {c.lastMessage}
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
      </ul>

      <SafeAreaSpacer edge="bottom" min={8} />

      <FloatingButton
        label="Nueva conversación"
        icon={<PlusIcon />}
        onClick={() => setNueva(true)}
        className="!bottom-[calc(var(--bottom-nav)+1rem)]"
      />

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

          <ul className="max-h-72 overflow-y-auto">
            {filtrados.map((c) => {
              const puesto = elegidos.includes(c.id);
              return (
                <li key={c.id}>
                  <button
                    type="button"
                    onClick={() => alternar(c.id)}
                    aria-pressed={puesto}
                    className={`flex w-full items-center gap-3 rounded-xl px-2 py-2 text-left transition-colors ${
                      puesto ? "bg-surface-alt" : "hover:bg-surface-alt"
                    }`}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element -- URL de Storage */}
                    <img
                      src={c.avatar}
                      alt=""
                      className="size-9 shrink-0 rounded-full object-cover"
                    />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{c.name}</p>
                      <p className="truncate text-xs text-muted">@{c.handle}</p>
                    </div>
                    {puesto && <span className="text-primary">✓</span>}
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
