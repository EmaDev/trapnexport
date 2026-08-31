"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import {
  Button,
  Card,
  Input,
  Select,
  Spinner,
  Tabs,
  Textarea,
  useSnackbar,
  type SelectOption,
  type TabItem,
} from "lib-kit-components";

import { ShirtIcon } from "@/components/atoms/icons";
import { useAuth } from "@/lib/auth/AuthContext";
import { completeProfile, suggestHandle } from "@/lib/auth/register";
import { getClaimablePlayers, type ClaimablePlayerVM } from "@/lib/auth/roster";

const TABS: TabItem[] = [
  { id: "hincha", label: "Soy hincha" },
  { id: "equipo", label: "Soy del equipo" },
];

/** El segundo paso del alta con Google.
 *
 *  Google entrega email, nombre y foto, pero no un handle — y el handle no es
 *  opcional: es la URL del perfil y lo que se escribe para mencionar a alguien.
 *  Tampoco sabe si quien entra es del plantel. Esas dos cosas se preguntan acá,
 *  una sola vez, y recién entonces existe la cuenta.
 *
 *  Entre que Google devuelve la sesión y que esta pantalla se envía, hay una
 *  credencial **sin perfil**. `AuthContext` lo modela como `user` presente con
 *  `account` en `null`, y esta pantalla es la salida de ese estado: si alguien
 *  la abandona a la mitad, vuelve acá la próxima vez que entre.
 */
export function CompletarPerfilClient() {
  const router = useRouter();
  const { snack } = useSnackbar();
  const { user, account, loading } = useAuth();

  const [tab, setTab] = useState("hincha");
  /*  `null` = todavía no lo tocó, y entonces vale lo que dio Google.
   *
   *  Los campos se derivan en el render en vez de precargarse con un efecto: la
   *  sesión llega después del primer render —Google resuelve asincrónico— así
   *  que un `useState(user.displayName)` arrancaría vacío para siempre, y
   *  rellenarlo desde un `useEffect` es una cascada de renders. Con esto el
   *  campo muestra lo de Google hasta que la persona escribe, y desde ahí manda
   *  lo que escribió — incluso si lo borra entero. */
  const [nameEdit, setNameEdit] = useState<string | null>(null);
  const [handleEdit, setHandleEdit] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const name = nameEdit ?? user?.displayName ?? "";
  const handle = handleEdit ?? suggestHandle(user?.email ?? null, user?.displayName);
  const [submitting, setSubmitting] = useState(false);

  const [players, setPlayers] = useState<ClaimablePlayerVM[] | null>(null);
  const [playerId, setPlayerId] = useState("");
  const [note, setNote] = useState("");

  // Las dos salidas de esta pantalla, y las dos son "no tenés nada que hacer
  // acá": sin sesión no hay perfil que completar, y con perfil ya está hecho.
  useEffect(() => {
    if (loading) return;
    if (!user) router.replace("/login");
    else if (account) router.replace("/");
  }, [loading, user, account, router]);

  useEffect(() => {
    getClaimablePlayers()
      .then(setPlayers)
      .catch(() => setPlayers([]));
  }, []);

  const playerOptions: SelectOption[] = useMemo(
    () =>
      (players ?? []).map((p) => ({
        value: p.id,
        label: p.claimed ? `${p.name} (ya registrado)` : p.name,
        disabled: p.claimed,
      })),
    [players],
  );
  const selectedPlayer = players?.find((p) => p.id === playerId) ?? null;

  const changeTab = (id: string) => {
    setTab(id);
    setError(null);
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const esEquipo = tab === "equipo";
    if (esEquipo && !selectedPlayer) return setError("Elegí quién sos del plantel.");

    setSubmitting(true);
    const result = await completeProfile({
      // Del lado del plantel el nombre y el handle salen del jugador: quien
      // reclama la cuenta de Naza Sochan no elige llamarse otra cosa.
      name: esEquipo ? selectedPlayer!.name : name,
      handle: esEquipo ? selectedPlayer!.handle : handle,
      // La foto de Google, si la hay. Es una URL de su CDN, no un archivo
      // nuestro: el día que haya Storage, se copia ahí al crearse la cuenta.
      avatar: user?.photoURL ?? undefined,
      ...(esEquipo ? { playerId: selectedPlayer!.id, note } : {}),
    });
    setSubmitting(false);

    if (!result.ok) return setError(result.error);

    snack({
      message: esEquipo
        ? "Listo. Tu cuenta queda pendiente hasta que el admin confirme que sos vos."
        : "¡Listo! Ya tenés cuenta.",
      variant: "success",
      duration: esEquipo ? 6000 : 4000,
    });
    router.replace("/");
  };

  if (loading || !user || account) {
    return (
      <Card variant="outline" padding="lg" className="shadow-xl shadow-black/10">
        <div className="flex justify-center py-8">
          <Spinner />
        </div>
      </Card>
    );
  }

  return (
    <Card variant="outline" padding="lg" className="shadow-xl shadow-black/10">
      <h1 className="text-xl font-bold">Falta un paso</h1>
      <p className="mt-1 text-sm text-muted">
        Entraste como <strong>{user.email}</strong>. Elegí cómo te va a ver el resto.
      </p>

      <Tabs items={TABS} value={tab} onChange={changeTab} variant="segmented" size="sm" fitted className="mt-5" />

      <form className="mt-5 flex flex-col gap-4" onSubmit={submit}>
        {tab === "hincha" ? (
          <>
            <Input
              label="Nombre"
              required
              value={name}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNameEdit(e.target.value)}
            />
            <Input
              label="Usuario"
              hint="Sin espacios: letras, números, punto o guion bajo."
              required
              value={handle}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setHandleEdit(e.target.value)}
            />
          </>
        ) : (
          <>
            <p className="flex items-start gap-2 rounded-xl bg-surface-alt p-3 text-xs text-muted">
              <ShirtIcon className="size-4 shrink-0 text-primary" />
              Elegí quién sos del plantel. El admin va a confirmar tu identidad antes de que la
              cuenta quede activa.
            </p>
            {players !== null && players.length === 0 ? (
              <p className="rounded-xl bg-surface-alt p-3 text-sm text-muted">
                El plantel todavía no está cargado. Completá como hincha y avisale al admin.
              </p>
            ) : (
              <Select
                label="Sos…"
                placeholder={players === null ? "Cargando el plantel…" : "Elegí tu nombre"}
                options={playerOptions}
                value={playerId}
                onChange={setPlayerId}
                disabled={players === null}
              />
            )}
            <Textarea
              label="Contale algo al admin (opcional)"
              hint="Algo que ayude a confirmar que sos vos."
              value={note}
              onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setNote(e.target.value)}
              maxLength={200}
            />
          </>
        )}

        {error && <p className="text-sm text-danger">{error}</p>}

        <Button type="submit" fullWidth loading={submitting}>
          Crear mi cuenta
        </Button>
      </form>
    </Card>
  );
}
