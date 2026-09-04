"use client";

import { Avatar } from "@/components/atoms/Avatar";
import { BackIcon } from "@/components/atoms/icons";

/** El header de una conversación abierta.
 *
 *  Es la única pantalla de la app que no usa `AppHeader`, y el motivo es
 *  concreto: `AppHeader` acepta `leading` **o** `onBack`, nunca los dos, y acá
 *  hacen falta juntos —la flecha y, pegada a ella, la foto de con quién se está
 *  hablando—. Esa foto no es decoración: en una bandeja de veinte chats abiertos
 *  es lo primero que confirma que se está escribiendo en el correcto.
 *
 *  Tampoco es `sticky`. El scroll de esta pantalla es del hilo, no de la
 *  ventana (ver `Hilo`), así que el header es simplemente la primera fila de
 *  una columna que no se mueve: nada que pegar. Por lo mismo no lleva el
 *  `padding-top` de la safe area —el `<body>` ya lo aplica y acá no hay un
 *  segundo scroller que lo tape.
 *
 *  Las medidas y los gestos son los de `AppHeader` a propósito —alto 14, botones
 *  de 40 con `rounded-xl` y `active:scale-90`— para que pasar de la bandeja a la
 *  conversación no se sienta como cambiar de app.
 */
export function HiloHeader({
  titulo,
  subtitulo,
  avatar,
  onBack,
  onTitulo,
  acciones,
}: {
  titulo: string;
  subtitulo: string;
  avatar?: string;
  onBack: () => void;
  /** tocar el nombre: el perfil del otro, o la lista del grupo */
  onTitulo?: () => void;
  acciones?: React.ReactNode;
}) {
  return (
    <header className="flex h-14 shrink-0 items-center gap-1 border-b border-border bg-surface px-2">
      <button
        type="button"
        onClick={onBack}
        aria-label="Volver a los chats"
        className="grid size-10 shrink-0 place-items-center rounded-xl text-foreground transition-all hover:bg-surface-alt active:scale-90"
      >
        <BackIcon width="1.4em" height="1.4em" />
      </button>

      <button
        type="button"
        onClick={onTitulo}
        disabled={!onTitulo}
        className="flex min-w-0 flex-1 items-center gap-2.5 rounded-xl px-1 py-1 text-left transition-colors hover:bg-surface-alt active:scale-[0.99] disabled:hover:bg-transparent"
      >
        <Avatar src={avatar} name={titulo} size={34} />
        <span className="min-w-0">
          <span className="block truncate text-[15px] leading-tight font-semibold text-foreground">
            {titulo}
          </span>
          <span className="block truncate text-[11px] leading-tight text-muted">{subtitulo}</span>
        </span>
      </button>

      {acciones && <div className="flex shrink-0 items-center gap-0.5 pr-0.5">{acciones}</div>}
    </header>
  );
}
