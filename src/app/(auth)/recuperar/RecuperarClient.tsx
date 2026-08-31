"use client";

import { sendPasswordResetEmail } from "firebase/auth";
import Link from "next/link";
import { useState } from "react";
import { Button, Card, Input } from "lib-kit-components";

import { CheckIcon } from "@/components/atoms/icons";
import { authErrorMessage } from "@/lib/auth/errors";
import { auth } from "@/lib/firebase/client";

export function RecuperarClient() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      // No revela si el email existe o no en la respuesta: `sendPasswordResetEmail`
      // no tira error por eso, y mostrar el mismo mensaje siempre evita que
      // alguien use este formulario para averiguar qué emails están registrados.
      await sendPasswordResetEmail(auth, email.trim());
      setSent(true);
    } catch (err) {
      setError(authErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  };

  if (sent) {
    return (
      <Card variant="outline" padding="lg" className="items-center text-center shadow-xl shadow-black/10">
        <span className="flex size-12 items-center justify-center rounded-full bg-success/10 text-success">
          <CheckIcon className="size-6" />
        </span>
        <h1 className="mt-4 text-xl font-bold">Revisá tu email</h1>
        <p className="mt-1 text-sm text-muted">
          Si <strong>{email.trim()}</strong> tiene una cuenta, te mandamos un link para elegir
          una contraseña nueva.
        </p>
        <Link href="/login" className="mt-6 text-sm font-medium text-primary">
          Volver a ingresar
        </Link>
      </Card>
    );
  }

  return (
    <Card variant="outline" padding="lg" className="shadow-xl shadow-black/10">
      <h1 className="text-xl font-bold">Recuperar cuenta</h1>
      <p className="mt-1 text-sm text-muted">
        Ingresá tu email y te mandamos un link para elegir una contraseña nueva.
      </p>

      <form className="mt-6 flex flex-col gap-4" onSubmit={submit}>
        <Input
          label="Email"
          type="email"
          autoComplete="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          error={error ?? undefined}
        />
        <Button type="submit" fullWidth loading={submitting}>
          Enviar instrucciones
        </Button>
      </form>

      <p className="mt-6 text-center text-sm text-muted">
        <Link href="/login" className="font-medium text-primary">
          Volver a ingresar
        </Link>
      </p>
    </Card>
  );
}
