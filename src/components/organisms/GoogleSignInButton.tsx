"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "lib-kit-components";

import { GoogleIcon } from "@/components/atoms/icons";
import { signInWithGoogle } from "@/lib/auth/google";

/** El botón de "Continuar con Google", con el ruteo de después incluido.
 *
 *  Es el mismo botón en login y en registro, y dice "continuar" y no "entrar"
 *  ni "registrarse" a propósito: Google ya sabe si la cuenta existe, así que
 *  preguntárselo a la persona sería pedirle un dato que el sistema tiene.
 *
 *  Hay tres finales posibles y los tres se resuelven acá, porque las dos
 *  pantallas que lo usan harían exactamente lo mismo:
 *
 *    - sesión con perfil  → sigue a donde iba
 *    - sesión sin perfil  → `/completar-perfil` a elegir handle
 *    - se fue por redirect → no se hace nada: la página se está descargando, y
 *      al volver entra por `onAuthStateChanged`. El spinner queda puesto para
 *      que no parezca que el botón no hizo nada.
 */
export function GoogleSignInButton({
  next = "/",
  onError,
  disabled,
}: {
  /** a dónde ir si ya tiene el perfil hecho */
  next?: string;
  onError: (mensaje: string) => void;
  disabled?: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  const click = async () => {
    onError("");
    setBusy(true);

    const result = await signInWithGoogle();

    if (result.status === "redirigiendo") return;
    if (result.status === "cancelado") return setBusy(false);
    if (result.status === "error") {
      setBusy(false);
      return onError(result.error);
    }

    router.replace(result.needsProfile ? "/completar-perfil" : next);
  };

  return (
    <Button
      type="button"
      variant="outline"
      fullWidth
      loading={busy}
      disabled={disabled}
      onClick={click}
      leftIcon={<GoogleIcon />}
    >
      Continuar con Google
    </Button>
  );
}

/** El separador entre el formulario y el botón de Google.
 *
 *  `aria-hidden`: para quien navega con lector de pantalla la palabra "o"
 *  suelta entre dos grupos de controles no aporta nada — la relación entre las
 *  dos formas de entrar ya la da el orden. */
export function OSeparador() {
  return (
    <div aria-hidden className="my-5 flex items-center gap-3 text-xs text-muted">
      <span className="h-px flex-1 bg-border" />o<span className="h-px flex-1 bg-border" />
    </div>
  );
}
