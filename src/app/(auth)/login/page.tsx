import { Suspense } from "react";

import { LoginClient } from "./LoginClient";

export const metadata = { title: "Ingresar" };

// `Suspense` es obligatorio: `LoginClient` lee `useSearchParams()` para el
// `?next=` al que volver después de loguearse, y sin límite de suspenso Next
// no puede prerenderizar esta ruta estática (falla el build). Mismo patrón
// que `/historia` con `?jugador=`.
export default function LoginPage() {
  return (
    <Suspense>
      <LoginClient />
    </Suspense>
  );
}
