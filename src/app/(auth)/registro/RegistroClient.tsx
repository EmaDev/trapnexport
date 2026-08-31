"use client";

import { createUserWithEmailAndPassword } from "firebase/auth";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import {
  Button,
  Card,
  Input,
  Select,
  Tabs,
  Textarea,
  useSnackbar,
  type SelectOption,
  type TabItem,
} from "lib-kit-components";

import { EyeIcon, EyeOffIcon, ShirtIcon } from "@/components/atoms/icons";
import { authErrorMessage } from "@/lib/auth/errors";
import { auth } from "@/lib/firebase/client";
import { claimPlayerAccount, registerFan } from "@/lib/social/actions";
import type { ClaimablePlayerVM } from "@/lib/social/queries";

const TABS: TabItem[] = [
  { id: "hincha", label: "Soy hincha" },
  { id: "equipo", label: "Soy del equipo" },
];

/** `Input` con el mismo par contraseña/ojo repetido cuatro veces entre las
 *  dos solapas — se separa acá para no reescribir el `useState` del ojo cada
 *  vez, no porque haga falta una abstracción de formularios. */
function PasswordInput({
  label,
  autoComplete,
  value,
  onChange,
}: {
  label: string;
  autoComplete: string;
  value: string;
  onChange: (v: string) => void;
}) {
  const [show, setShow] = useState(false);
  return (
    <Input
      label={label}
      type={show ? "text" : "password"}
      autoComplete={autoComplete}
      required
      value={value}
      onChange={(e) => onChange(e.target.value)}
      rightIcon={
        <button
          type="button"
          aria-label={show ? "Ocultar contraseña" : "Mostrar contraseña"}
          onClick={() => setShow((v) => !v)}
          className="text-muted"
        >
          {show ? <EyeOffIcon className="size-4" /> : <EyeIcon className="size-4" />}
        </button>
      }
    />
  );
}

export function RegistroClient({ players }: { players: ClaimablePlayerVM[] }) {
  const router = useRouter();
  const { snack } = useSnackbar();

  const [tab, setTab] = useState("hincha");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const changeTab = (id: string) => {
    setTab(id);
    setError(null);
  };

  // Soy hincha
  const [name, setName] = useState("");
  const [handle, setHandle] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");

  // Soy del equipo: paso previo (elegir jugador) y luego el alta en sí
  const [step, setStep] = useState<"elegir" | "form">("elegir");
  const [playerId, setPlayerId] = useState("");
  const [note, setNote] = useState("");
  const [teamEmail, setTeamEmail] = useState("");
  const [teamPassword, setTeamPassword] = useState("");
  const [teamConfirm, setTeamConfirm] = useState("");

  const playerOptions: SelectOption[] = useMemo(
    () =>
      players.map((p) => ({
        value: p.id,
        label: p.claimed ? `${p.name} (ya registrado)` : p.name,
        disabled: p.claimed,
      })),
    [players],
  );
  const selectedPlayer = players.find((p) => p.id === playerId) ?? null;

  const submitHincha = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (name.trim().length < 2) return setError("Ingresá tu nombre.");
    if (!/^[a-zA-Z0-9._]{3,20}$/.test(handle.trim())) {
      return setError("El usuario va de 3 a 20 caracteres: letras, números, punto o guion bajo.");
    }
    if (password.length < 6) return setError("La contraseña necesita al menos 6 caracteres.");
    if (password !== confirm) return setError("Las contraseñas no coinciden.");

    setSubmitting(true);
    try {
      const cred = await createUserWithEmailAndPassword(auth, email.trim(), password);

      const result = await registerFan({ authUid: cred.user.uid, name, handle });
      if (!result.ok) {
        await cred.user.delete();
        setError(result.error);
        return;
      }

      snack({ message: "Cuenta creada. ¡Bienvenido!", variant: "success" });
      router.push("/");
    } catch (err) {
      setError(authErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  };

  const submitEquipo = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!selectedPlayer) return;

    if (teamPassword.length < 6) return setError("La contraseña necesita al menos 6 caracteres.");
    if (teamPassword !== teamConfirm) return setError("Las contraseñas no coinciden.");

    setSubmitting(true);
    try {
      const cred = await createUserWithEmailAndPassword(auth, teamEmail.trim(), teamPassword);

      const result = await claimPlayerAccount({
        playerId: selectedPlayer.id,
        authUid: cred.user.uid,
        note,
      });
      if (!result.ok) {
        await cred.user.delete();
        setError(result.error);
        return;
      }

      snack({
        message: "Listo. Tu cuenta queda pendiente hasta que el admin confirme que sos vos.",
        variant: "success",
        duration: 6000,
      });
      router.push("/");
    } catch (err) {
      setError(authErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Card variant="outline" padding="lg" className="shadow-xl shadow-black/10">
      <h1 className="text-xl font-bold">Crear cuenta</h1>
      <p className="mt-1 text-sm text-muted">Sumate para comentar, seguir cuentas y votar.</p>

      <Tabs items={TABS} value={tab} onChange={changeTab} variant="segmented" size="sm" fitted className="mt-5" />

      {tab === "hincha" ? (
        <form className="mt-5 flex flex-col gap-4" onSubmit={submitHincha}>
          <Input label="Nombre" required value={name} onChange={(e) => setName(e.target.value)} />
          <Input
            label="Usuario"
            hint="Sin espacios: letras, números, punto o guion bajo."
            required
            value={handle}
            onChange={(e) => setHandle(e.target.value)}
          />
          <Input
            label="Email"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <PasswordInput label="Contraseña" autoComplete="new-password" value={password} onChange={setPassword} />
          <PasswordInput
            label="Repetir contraseña"
            autoComplete="new-password"
            value={confirm}
            onChange={setConfirm}
          />
          {error && <p className="text-sm text-danger">{error}</p>}
          <Button type="submit" fullWidth loading={submitting}>
            Crear cuenta
          </Button>
        </form>
      ) : step === "elegir" ? (
        <div className="mt-5 flex flex-col gap-4">
          <p className="flex items-start gap-2 rounded-xl bg-surface-alt p-3 text-xs text-muted">
            <ShirtIcon className="size-4 shrink-0 text-primary" />
            Elegí quién sos del plantel. El admin va a confirmar tu identidad antes de que la
            cuenta quede activa.
          </p>
          <Select
            label="Sos…"
            placeholder="Elegí tu nombre"
            options={playerOptions}
            value={playerId}
            onChange={setPlayerId}
          />
          <Textarea
            label="Contale algo al admin (opcional)"
            hint="Algo que ayude a confirmar que sos vos."
            value={note}
            onChange={(e) => setNote(e.target.value)}
            maxLength={200}
          />
          <Button type="button" fullWidth disabled={!selectedPlayer} onClick={() => setStep("form")}>
            Continuar
          </Button>
        </div>
      ) : (
        <form className="mt-5 flex flex-col gap-4" onSubmit={submitEquipo}>
          <p className="rounded-xl bg-surface-alt p-3 text-sm">
            Vas a registrar la cuenta de <strong>{selectedPlayer?.name}</strong>.{" "}
            <button type="button" onClick={() => setStep("elegir")} className="font-medium text-primary">
              Cambiar
            </button>
          </p>
          <Input
            label="Email"
            type="email"
            autoComplete="email"
            required
            value={teamEmail}
            onChange={(e) => setTeamEmail(e.target.value)}
          />
          <PasswordInput label="Contraseña" autoComplete="new-password" value={teamPassword} onChange={setTeamPassword} />
          <PasswordInput
            label="Repetir contraseña"
            autoComplete="new-password"
            value={teamConfirm}
            onChange={setTeamConfirm}
          />
          {error && <p className="text-sm text-danger">{error}</p>}
          <Button type="submit" fullWidth loading={submitting}>
            Crear cuenta
          </Button>
        </form>
      )}

      <p className="mt-6 text-center text-sm text-muted">
        ¿Ya tenés cuenta?{" "}
        <Link href="/login" className="font-medium text-primary">
          Ingresá
        </Link>
      </p>

      <Button variant="ghost" fullWidth className="mt-2" onClick={() => router.push("/")}>
        Ingresar sin registrarme
      </Button>
    </Card>
  );
}
