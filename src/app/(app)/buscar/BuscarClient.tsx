"use client";

import { useRouter } from "next/navigation";
import { AppHeader, SafeAreaSpacer, SearchFilters, type SearchResult } from "lib-kit-components";

import { PostsIcon, UserIcon } from "@/components/atoms/icons";
import type { SearchIndex } from "@/lib/social/queries";

/** Búsqueda global: cuentas y publicaciones.
 *
 *  Vive en su propia ruta y se llega por la lupa del header del feed, no por
 *  el `BottomNav` — la nav tiene sus cuatro rutas y buscar no es un destino
 *  donde uno se queda.
 *
 *  ⚠️ `SearchFilters` va **sin** `filters` a propósito. Los chips de filtro que
 *  dibuja no llegan a filtrar nada: su predicado interno termina en `|| true`.
 *  Una fila de controles que no hace nada es peor que no tenerla, así que queda
 *  sólo la búsqueda por texto, que sí funciona (filtra `title` y `subtitle` del
 *  lado del cliente).
 */
export function BuscarClient({ index }: { index: SearchIndex }) {
  const router = useRouter();

  const results: SearchResult[] = [
    ...index.accounts.map((a) => ({
      // el prefijo sobrevive al filtrado del componente y dice a dónde navegar
      id: `u:${a.handle}`,
      group: "cuentas",
      title: a.name,
      subtitle: `@${a.handle}`,
      icon: <UserIcon className="text-primary" />,
    })),
    ...index.posts.map((p) => ({
      id: `p:${p.id}`,
      group: "publicaciones",
      title: p.text.slice(0, 70),
      subtitle: `${p.author} · ${p.time}`,
      icon: <PostsIcon className="text-accent" />,
    })),
  ];

  return (
    <>
      <AppHeader
        title="Buscar"
        subtitle={`${index.accounts.length} cuentas · ${index.posts.length} publicaciones`}
        onBack={() => router.back()}
        variant="blur"
        sticky
      />

      <div className="mx-auto flex w-full max-w-xl flex-col gap-4 px-4 py-4">
        <SearchFilters
          placeholder="Buscar cuentas o publicaciones…"
          results={results}
          groupLabels={{ cuentas: "Cuentas", publicaciones: "Publicaciones" }}
          emptyLabel="No encontramos nada con ese texto."
          onSelect={(r) => {
            const [kind, id] = r.id.split(":");
            router.push(kind === "u" ? `/u/${id}` : `/post/${id}`);
          }}
        />

        <SafeAreaSpacer edge="bottom" min={8} />
      </div>
    </>
  );
}
