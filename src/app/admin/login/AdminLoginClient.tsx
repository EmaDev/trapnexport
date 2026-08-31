"use client";

import { signInWithEmailAndPassword, signOut } from "firebase/auth";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button, Card, Input } from "lib-kit-components";

import { EyeIcon, EyeOffIcon } from "@/components/atoms/icons";
import { authErrorMessage } from "@/lib/auth/errors";
import { auth } from "@/lib/firebase/client";

/** Login del panel.
 *
 *  Son dos pasos y no uno, y el segundo es el que importa:
 *
 *    1. Firebase Auth verifica email y contraseña, y devuelve un idToken. Eso
 *       prueba **quién sos**, nada más — cualquiera registrado en la app llega
 *       hasta acá.
 *    2. `POST /api/admin/session` mira el custom claim `admin` de ese token y,
 *       sólo si está, emite la cookie de sesión que el servidor va a leer.
 *
 *  El rechazo del paso 2 es lo que separa "tenés cuenta" de "podés moderar".
 *  Cuando pasa, se cierra la sesión del cliente antes de mostrar el error: si
 *  quedara abierta, la persona seguiría autenticada en la app pública sin
 *  haberlo pedido, y el próximo intento de entrar al panel fallaría igual sin
 *  que se entienda por qué.
 *
 *  Sin botón de Google a propósito: entrar al panel tiene que ser un acto
 *  explícito con credenciales, no un clic que reusa la sesión que ya había
 *  abierta en el navegador para leer el feed.
 */
export function AdminLoginClient({ next }: { next: string }) {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);

    try {
      const cred = await signInWithEmailAndPassword(auth, email.trim(), password);
      const idToken = await cred.user.getIdToken();

      const res = await fetch("/api/admin/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ idToken }),
      });

      if (!res.ok) {
        const { error: mensaje } = await res.json().catch(() => ({}));
        await signOut(auth).catch(() => {});
        setError(mensaje ?? "No pudimos iniciar la sesión del panel.");
        return;
      }

      // `refresh()` antes de navegar: el layout y las páginas del panel son
      // Server Components que leen la cookie, y sin esto Next serviría la
      // versión que renderizó cuando todavía no había sesión.
      router.refresh();
      router.replace(next);
    } catch (err) {
      setError(authErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Card variant="outline" padding="lg" className="max-w-md">
      <form className="flex flex-col gap-4" onSubmit={submit}>
        <Input
          label="Email"
          type="email"
          autoComplete="email"
          required
          value={email}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => setEmail(e.target.value)}
        />
        <Input
          label="Contraseña"
          type={showPassword ? "text" : "password"}
          autoComplete="current-password"
          required
          value={password}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => setPassword(e.target.value)}
          rightIcon={
            <button
              type="button"
              aria-label={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
              onClick={() => setShowPassword((v) => !v)}
              className="text-muted"
            >
              {showPassword ? <EyeOffIcon className="size-4" /> : <EyeIcon className="size-4" />}
            </button>
          }
        />

        {error && <p className="text-sm text-danger">{error}</p>}

        <Button type="submit" fullWidth loading={submitting}>
          Entrar al panel
        </Button>
      </form>

      <p className="mt-5 text-xs text-muted">
        El acceso se otorga por cuenta, con{" "}
        <code className="rounded bg-surface-alt px-1">npm run admin:grant</code>. Tener cuenta
        en la app no alcanza.
      </p>
    </Card>
  );
}
