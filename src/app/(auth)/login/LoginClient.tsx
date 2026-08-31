"use client";

import { signInWithEmailAndPassword } from "firebase/auth";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { Button, Card, Input, useSnackbar } from "lib-kit-components";

import { EyeIcon, EyeOffIcon } from "@/components/atoms/icons";
import { authErrorMessage } from "@/lib/auth/errors";
import { auth } from "@/lib/firebase/client";

export function LoginClient() {
  const router = useRouter();
  const { snack } = useSnackbar();
  const next = useSearchParams().get("next") || "/";

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
      await signInWithEmailAndPassword(auth, email.trim(), password);
      snack({ message: "Sesión iniciada", variant: "success" });
      router.push(next);
    } catch (err) {
      setError(authErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Card variant="outline" padding="lg" className="shadow-xl shadow-black/10">
      <h1 className="text-xl font-bold">Ingresar</h1>
      <p className="mt-1 text-sm text-muted">Entrá con tu cuenta para votar y participar.</p>

      <form className="mt-6 flex flex-col gap-4" onSubmit={submit}>
        <Input
          label="Email"
          type="email"
          autoComplete="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <Input
          label="Contraseña"
          type={showPassword ? "text" : "password"}
          autoComplete="current-password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
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
          error={error ?? undefined}
        />

        <Link href="/recuperar" className="-mt-2 self-end text-xs font-medium text-primary">
          ¿Olvidaste tu contraseña?
        </Link>

        <Button type="submit" fullWidth loading={submitting}>
          Ingresar
        </Button>
      </form>

      <p className="mt-6 text-center text-sm text-muted">
        ¿No tenés cuenta?{" "}
        <Link href="/registro" className="font-medium text-primary">
          Registrate
        </Link>
      </p>

      <Button variant="ghost" fullWidth className="mt-2" onClick={() => router.push("/")}>
        Ingresar sin registrarme
      </Button>
    </Card>
  );
}
