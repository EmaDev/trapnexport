/** Traduce los códigos de error de Firebase Auth a mensajes en español, sin
 *  filtrar detalles internos (`auth/internal-error`, etc.) a la UI. */
export function authErrorMessage(err: unknown): string {
  const code = (err as { code?: string } | undefined)?.code ?? "";

  switch (code) {
    case "auth/email-already-in-use":
      return "Ese email ya tiene una cuenta.";
    case "auth/invalid-email":
      return "El email no es válido.";
    case "auth/weak-password":
      return "La contraseña necesita al menos 6 caracteres.";
    case "auth/user-not-found":
    case "auth/wrong-password":
    case "auth/invalid-credential":
      return "Email o contraseña incorrectos.";
    case "auth/too-many-requests":
      return "Demasiados intentos. Probá de nuevo en unos minutos.";
    case "auth/network-request-failed":
      return "Falla de red. Revisá tu conexión.";

    /* ── entrar con Google ─────────────────────────────────────────────── */

    // El proyecto está configurado con "una cuenta por email": ya existe una
    // cuenta con ese mismo mail creada con contraseña. Decirle "usá tu
    // contraseña" es accionable; "credencial existente" no.
    case "auth/account-exists-with-different-credential":
      return "Ese email ya tiene cuenta con contraseña. Entrá con tu contraseña.";
    case "auth/popup-blocked":
      return "El navegador bloqueó la ventana de Google. Permitila y probá de nuevo.";
    // Sale cuando el dominio desde el que se entra no está en Authentication →
    // Settings → Authorized domains. Es de configuración, no de la persona.
    case "auth/unauthorized-domain":
      return "Este dominio no está habilitado para entrar con Google.";
    case "auth/operation-not-allowed":
      return "Ese método de ingreso no está habilitado.";
    default:
      return "Algo salió mal. Probá de nuevo.";
  }
}
