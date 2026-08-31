import Link from "next/link";
import { SnackbarProvider } from "lib-kit-components";

import { APP_NAME } from "@/lib/site";

/** Shell de login / registro / recuperación.
 *
 *  No es `(app)`: no lleva `BottomNav`, splash ni instalador — nada de eso
 *  tiene sentido antes de tener sesión. Es una pantalla centrada, sola, con el
 *  escudo arriba y un link de vuelta al feed abajo (entrar sin cuenta sigue
 *  siendo válido: sólo votar la pide).
 *
 *  Lleva su propio `SnackbarProvider` — cada shell tiene el suyo (`AppShell`,
 *  `AdminShell`) y acá no hay `BottomNav` de 64px que tape la snackbar, así
 *  que va con el `gap` por defecto, como en `AdminShell`. */
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <SnackbarProvider position="bottom-center">
      <div className="flex min-h-app flex-col bg-surface text-foreground">
        <div className="!bg-[linear-gradient(135deg,#50108b,#752eb8)] px-4 pb-16 pt-[max(2.5rem,env(safe-area-inset-top))] text-white">
          <Link href="/" className="mx-auto flex w-full max-w-sm flex-col items-center gap-3">
            {/* eslint-disable-next-line @next/next/no-img-element -- SVG estático */}
            <img
              src="/escudo.svg"
              alt=""
              className="h-16 w-auto object-contain drop-shadow-[0_6px_20px_rgba(0,0,0,0.35)]"
            />
            <span className="text-lg font-black tracking-tight">{APP_NAME}</span>
          </Link>
        </div>

        <main className="mx-auto -mt-10 flex w-full max-w-sm flex-1 flex-col px-4 pb-[max(2rem,env(safe-area-inset-bottom))]">
          {children}
        </main>
      </div>
    </SnackbarProvider>
  );
}
