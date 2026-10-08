"use client";

import Link from "next/link";
import { BottomSheet } from "lib-kit-components";

import { Avatar } from "@/components/atoms/Avatar";
import type { LikerVM } from "@/lib/social/queries";

/** Quiénes le dieron "me gusta" a una publicación.
 *
 *  La abre `PostCard` al tocar los likes de la tarjeta. Antes ese renglón era
 *  texto muerto —"Naza y 11 más" sin forma de saber quiénes eran los once—; el
 *  cómo se engancha el click está explicado arriba de `PostCard`.
 *
 *  Es un `BottomSheet` y no un `Modal` porque es la forma que ya tienen las
 *  listas de personas de la app (el "nuevo chat" de `/chat`): en el teléfono
 *  entra desde abajo, se arrastra para cerrar y la lista scrollea adentro.
 *
 *  La lista llega entera y ya armada desde el servidor (`PostVM.likers`), así
 *  que la hoja abre sin spinner y sin pedir nada. No pagina: si algún día un
 *  posteo junta cientos de likes, lo que cambia es de dónde sale `likers` —ver
 *  la nota en ese campo—, no esta hoja.
 */
export function LikesSheet({
  open,
  likers,
  meId,
  onClose,
}: {
  open: boolean;
  /** en el orden en que dieron like, del primero al último */
  likers: LikerVM[];
  /** uid de quien mira, para marcar su propia fila; ausente sin sesión */
  meId?: string;
  onClose: () => void;
}) {
  return (
    <BottomSheet
      open={open}
      onClose={onClose}
      title="Me gusta"
      description={likers.length === 1 ? "1 persona" : `${likers.length} personas`}
      showClose
    >
      {/*  El tope de alto es de la lista y no del sheet (`size="auto"`): con
          tres likes la hoja es chica, con treinta scrollea adentro en vez de
          tapar la pantalla entera. */}
      <ul className="-mx-1 max-h-[22rem] overflow-y-auto overscroll-contain px-1">
        {likers.map((l) => {
          const yo = !!meId && l.id === meId;
          /*  Sin handle la cuenta ya no existe: el nombre se muestra igual
              —el like pasó— pero la fila no lleva a ningún lado, porque el
              `/u/` que armaríamos apuntaría a un perfil que no está. */
          const href = yo ? "/perfil" : l.handle ? `/u/${l.handle}` : null;

          const fila = (
            <>
              <Avatar src={l.avatar} name={l.name} size={38} />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium">
                  {l.name}
                  {yo && <span className="ml-1.5 text-xs font-normal text-muted">· Vos</span>}
                </span>
                {l.handle && (
                  <span className="block truncate text-xs text-muted">@{l.handle}</span>
                )}
              </span>
            </>
          );

          return (
            <li key={l.id}>
              {href ? (
                <Link
                  href={href}
                  // Navegar deja la hoja abierta detrás de la pantalla nueva.
                  onClick={onClose}
                  className="flex w-full items-center gap-3 rounded-xl px-2 py-2 transition-colors hover:bg-surface-alt"
                >
                  {fila}
                </Link>
              ) : (
                <div className="flex w-full items-center gap-3 rounded-xl px-2 py-2 opacity-60">
                  {fila}
                </div>
              )}
            </li>
          );
        })}

        {/*  No debería pasar —el renglón no abre nada con cero likes— pero una
            hoja vacía y muda sería peor que una hoja que lo dice. */}
        {likers.length === 0 && (
          <li className="px-2 py-6 text-center text-sm text-muted">
            Todavía nadie le dio me gusta.
          </li>
        )}
      </ul>
    </BottomSheet>
  );
}
