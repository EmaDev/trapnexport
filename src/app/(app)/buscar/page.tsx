import type { Metadata } from "next";

import { getSearchIndex } from "@/lib/social/queries";
import { BuscarClient } from "./BuscarClient";

/** El buscador depende de quién mira (qué cuentas seguís) y no tiene nada que
 *  indexar: los indexables son /post/:id, /u/:handle y /historia. */
export const metadata: Metadata = {
  title: "Buscar",
  robots: { index: false, follow: false },
};

export default async function BuscarPage() {
  const index = await getSearchIndex();
  return <BuscarClient index={index} />;
}
