import { getClaimablePlayers } from "@/lib/social/queries";
import { RegistroClient } from "./RegistroClient";

export const metadata = { title: "Crear cuenta" };

export default async function RegistroPage() {
  const players = await getClaimablePlayers();
  return <RegistroClient players={players} />;
}
