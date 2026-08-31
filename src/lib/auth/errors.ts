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
    default:
      return "Algo salió mal. Probá de nuevo.";
  }
}
