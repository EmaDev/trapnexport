"use client";

import { signOut } from "firebase/auth";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { auth } from "@/lib/firebase/client";

/** Salir del panel.
 *
 *  Cierra **las dos** sesiones que hay abiertas, que son distintas y viven en
 *  lados distintos: la cookie del servidor (`DELETE /api/admin/session`, que
 *  además revoca los refresh tokens de la cuenta) y la de Firebase Auth en el
 *  navegador. Cerrar sólo una deja a la persona convencida de que salió cuando
 *  no salió.
 *
 *  `refresh()` antes de navegar: el layout del panel es un Server Component que
 *  lee la cookie, y sin eso Next serviría la copia que renderizó cuando todavía
 *  había sesión.
 */
export function SalirDelPanel() {
  const router = useRouter();
  const [saliendo, setSaliendo] = useState(false);

  const salir = async () => {
    setSaliendo(true);
    await fetch("/api/admin/session", { method: "DELETE" }).catch(() => {});
    await signOut(auth).catch(() => {});
    router.refresh();
    router.replace("/admin/login");
  };

  return (
    <button
      type="button"
      onClick={salir}
      disabled={saliendo}
      className="self-start font-medium text-danger disabled:opacity-60"
    >
      {saliendo ? "Saliendo…" : "Cerrar sesión"}
    </button>
  );
}
