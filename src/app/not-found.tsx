import Link from "next/link";
import { Button, Card } from "lib-kit-components";

/** 404 global. Trae su propio contenedor: el layout raíz ya no envuelve nada
 *  (cada módulo arma su shell), así que sin esto quedaría pegado al borde. */
export default function NotFound() {
  return (
    <main className="mx-auto w-full max-w-lg px-4 py-16">
      <Card variant="flat" padding="lg" className="text-center">
        <p className="text-sm font-semibold uppercase tracking-wide text-primary">Error 404</p>
        <h1 className="mt-2 text-2xl font-bold">No encontramos esta página</h1>
        <p className="mt-1 text-sm text-muted">
          Puede que el link esté mal escrito, o que la publicación se haya borrado.
        </p>
        <Link href="/" className="mt-5 inline-block">
          <Button>Volver al feed</Button>
        </Link>
      </Card>
    </main>
  );
}
