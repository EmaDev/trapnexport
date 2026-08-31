import { RegistroClient } from "./RegistroClient";

export const metadata = { title: "Crear cuenta" };

/** El plantel ya no se inyecta desde acá: `trapnexport-jugador` se lee con el
 *  SDK del navegador, que es el único con credenciales en el flujo público.
 *  Esta página quedó como el server component mínimo que fija el `<title>`. */
export default function RegistroPage() {
  return <RegistroClient />;
}
