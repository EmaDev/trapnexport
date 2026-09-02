import type { Metadata } from "next";

import { requireAdmin } from "@/lib/admin/auth";
import { getBandejaDelClub, getContactosDelClub, getDifusiones } from "@/lib/chat/queries";
import { MensajesClient } from "./MensajesClient";

export const metadata: Metadata = {
  title: "Mensajes",
  robots: { index: false, follow: false, nocache: true },
};

export default async function MensajesPage() {
  await requireAdmin();

  const [bandeja, difusiones, cuentas] = await Promise.all([
    getBandejaDelClub(),
    getDifusiones(),
    getContactosDelClub(),
  ]);

  return <MensajesClient bandeja={bandeja} difusiones={difusiones} cuentas={cuentas} />;
}
