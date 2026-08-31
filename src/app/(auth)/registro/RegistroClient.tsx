"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
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
import { GoogleSignInButton, OSeparador } from "@/components/organisms/GoogleSignInButton";
import { useAuth } from "@/lib/auth/AuthContext";
import { claimPlayer, registerFan } from "@/lib/auth/register";
import { getClaimablePlayers, type ClaimablePlayerVM } from "@/lib/auth/roster";

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
      onChange={(e: React.ChangeEvent<HTMLInputElement>) => onChange(e.target.value)}
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

/** El alta, contra Firebase de verdad.
 *
 *  Las dos solapas terminan en una sola llamada —`registerFan` o
 *  `claimPlayer`— que crea la credencial en Auth y el perfil en Firestore en
 *  un solo paso, y limpia la credencial si el perfil no se pudo escribir. Esta
 *  pantalla no orquesta nada de eso: sólo valida lo que se puede validar
 *  mirando el formulario y muestra el error que le devuelven.
 *
 *  El plantel se lee acá y no en el server component: `trapnexport-jugador` se
 *  consulta con el SDK del navegador, que es el único configurado en el flujo
 *  público (el Admin SDK sólo se usa para el seed y para `/admin`).
 */
export function RegistroClient() {
  const router = useRouter();
  const { snack } = useSnackbar();

  const { user, account, loading } = useAuth();

  const [tab, setTab] = useState("hincha");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  /*  Una vez que el alta arrancó, esta pantalla deja de reaccionar a la sesión.
   *
   *  Sin esto hay una carrera con el guard de abajo: `createUserWithEmailAndPassword`
   *  ya dejó sesión iniciada y el perfil todavía se está escribiendo, así que
   *  durante ese instante la cuenta se ve como "credencial sin perfil" y el
   *  guard la mandaría a completar un perfil que se está creando solo. No se
   *  vuelve a bajar en el camino feliz: de ahí se sale navegando. */
  const [altaEnCurso, setAltaEnCurso] = useState(false);

  /*  Mismo criterio que en el login: con sesión no hay nada que registrar. Es
   *  también donde aterriza el redirect de Google cuando el popup no es
   *  viable. */
  useEffect(() => {
    if (loading || altaEnCurso || !user) return;
    router.replace(account ? "/" : "/completar-perfil");
  }, [loading, altaEnCurso, user, account, router]);

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
  const [players, setPlayers] = useState<ClaimablePlayerVM[] | null>(null);
  const [step, setStep] = useState<"elegir" | "form">("elegir");
  const [playerId, setPlayerId] = useState("");
  const [note, setNote] = useState("");
  const [teamEmail, setTeamEmail] = useState("");
  const [teamPassword, setTeamPassword] = useState("");
  const [teamConfirm, setTeamConfirm] = useState("");

  // El plantel se pide una sola vez, no al abrir la solapa: son dieciocho
  // documentos y pedirlos recién cuando la persona toca "Soy del equipo" le
  // pone un spinner delante del único paso que tiene que decidir.
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

  const submitHincha = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (password !== confirm) return setError("Las contraseñas no coinciden.");

    setAltaEnCurso(true);
    setSubmitting(true);
    const result = await registerFan({ name, handle, email, password });
    setSubmitting(false);

    if (!result.ok) {
      setAltaEnCurso(false);
      return setError(result.error);
    }

    snack({ message: "Cuenta creada. ¡Bienvenido!", variant: "success" });
    router.push("/");
  };

  const submitEquipo = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!selectedPlayer) return;

    if (teamPassword !== teamConfirm) return setError("Las contraseñas no coinciden.");

    setAltaEnCurso(true);
    setSubmitting(true);
    // El nombre y el handle salen del plantel, no de un formulario: quien
    // reclama la cuenta de un jugador no elige llamarse otra cosa.
    const result = await claimPlayer({
      playerId: selectedPlayer.id,
      name: selectedPlayer.name,
      handle: selectedPlayer.handle,
      email: teamEmail,
      password: teamPassword,
      note,
    });
    setSubmitting(false);

    if (!result.ok) {
      setAltaEnCurso(false);
      return setError(result.error);
    }

    snack({
      message: "Listo. Tu cuenta queda pendiente hasta que el admin confirme que sos vos.",
      variant: "success",
      duration: 6000,
    });
    router.push("/");
  };

  return (
    <Card variant="outline" padding="lg" className="shadow-xl shadow-black/10">
      <h1 className="text-xl font-bold">Crear cuenta</h1>
      <p className="mt-1 text-sm text-muted">Sumate para comentar, seguir cuentas y votar.</p>

      <Tabs items={TABS} value={tab} onChange={changeTab} variant="segmented" size="sm" fitted className="mt-5" />

      {tab === "hincha" ? (
        <form className="mt-5 flex flex-col gap-4" onSubmit={submitHincha}>
          <Input
            label="Nombre"
            required
            value={name}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setName(e.target.value)}
          />
          <Input
            label="Usuario"
            hint="Sin espacios: letras, números, punto o guion bajo."
            required
            value={handle}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setHandle(e.target.value)}
          />
          <Input
            label="Email"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setEmail(e.target.value)}
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
          {players !== null && players.length === 0 ? (
            // Sin plantel cargado no hay nada que elegir. Es un estado de
            // instalación (falta correr el seed), no un error de la persona.
            <p className="rounded-xl bg-surface-alt p-3 text-sm text-muted">
              El plantel todavía no está cargado. Registrate como hincha y avisale al admin.
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
          <Button type="button" fullWidth disabled={!selectedPlayer} onClick={() => setStep("form")}>
            Continuar
          </Button>
        </div>
      ) : (
        <form className="mt-5 flex flex-col gap-4" onSubmit={submitEquipo}>
          <p className="rounded-xl bg-surface-alt p-3 text-sm">
            Vas a registrar la cuenta de <strong>{selectedPlayer?.name}</strong>, como{" "}
            <strong>@{selectedPlayer?.handle}</strong>.{" "}
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
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setTeamEmail(e.target.value)}
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

      <OSeparador />

      {/* Entrar con Google no termina el alta: no trae handle, y sin handle no
          hay perfil. El botón deja sesión hecha y `/completar-perfil` pide lo
          que falta — incluido si sos del plantel. */}
      <GoogleSignInButton disabled={submitting} onError={(m) => setError(m || null)} />

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
