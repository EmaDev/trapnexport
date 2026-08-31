import { redirect } from "next/navigation";

import { getAdminSession } from "@/lib/admin/auth";
import { PageHeading } from "../PageHeading";
import { AdminLoginClient } from "./AdminLoginClient";

export const metadata = { title: "Ingresar" };

/** Destino del guard cuando falta la sesión — y la única ruta de `/admin` que
 *  el proxy deja pasar sin cookie. */
export default async function AdminLoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next } = await searchParams;

  // Con sesión válida no hay nada que hacer acá. Además evita el callejón de
  // quedar mirando un formulario que, al enviarlo, devuelve a la misma página.
  if (await getAdminSession()) redirect("/admin");

  /*  `next` viene de la URL, así que puede traer cualquier cosa: sin este
   *  filtro, un link a `/admin/login?next=https://otro-sitio` convierte el
   *  login en un redirector abierto — la clase de detalle que se usa para que
   *  un phishing arranque en un dominio de confianza. Sólo rutas internas del
   *  panel; `//host` empieza con `/` y por eso se descarta aparte. */
  const destino =
    next?.startsWith("/admin") && !next.startsWith("//") ? next : "/admin";

  return (
    <>
      <PageHeading title="Ingresar" description="Acceso al panel de administración." />
      <AdminLoginClient next={destino} />
    </>
  );
}
