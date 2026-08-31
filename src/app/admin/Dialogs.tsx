"use client";

import { motion } from "framer-motion";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Button, Modal, type DropdownItem } from "lib-kit-components";

/** Los dos diálogos que repiten los cuatro ABM del panel: el del formulario y
 *  el de confirmación de borrado.
 *
 *  No es una abstracción de CRUD —cada sección arma su propio formulario, con
 *  sus campos y su validación— sino los dos envoltorios que, escritos cuatro
 *  veces, se desincronizan: el orden de los botones, el `size` del modal, qué
 *  botón queda deshabilitado mientras guarda y el texto de "no se puede
 *  deshacer". Eso sí conviene que sea el mismo en todas.
 */

/** Modal con un `<form>` adentro y el pie de Cancelar / Guardar.
 *
 *  El contenido va en un `<form>` de verdad y no en un `<div>`: así el Enter en
 *  cualquier input envía, que es lo que espera cualquiera que carga diez
 *  eventos seguidos sin soltar el teclado.
 */
export function FormModal({
  open,
  onClose,
  title,
  description,
  submitLabel = "Guardar",
  submitting,
  disabled,
  onSubmit,
  children,
  size = "md",
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  submitLabel?: string;
  submitting?: boolean;
  /** el formulario está incompleto: se apaga el botón, no se valida al enviar */
  disabled?: boolean;
  onSubmit: () => void;
  children: React.ReactNode;
  size?: "sm" | "md" | "lg" | "xl";
}) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      description={description}
      size={size}
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose} disabled={submitting}>
            Cancelar
          </Button>
          <Button
            // `form` + `type="submit"` en vez de `onClick`: el botón vive en el
            // pie del modal, fuera del `<form>`, y sin el atributo no lo envía.
            form="admin-form"
            type="submit"
            loading={submitting}
            disabled={disabled}
          >
            {submitLabel}
          </Button>
        </div>
      }
    >
      <form
        id="admin-form"
        className="flex flex-col gap-4"
        onSubmit={(e) => {
          e.preventDefault();
          if (!disabled) onSubmit();
        }}
      >
        {children}
      </form>
    </Modal>
  );
}

/** Confirmación de una acción destructiva. Borrar no es reversible en ninguna
 *  de las cuatro secciones, así que ninguna lo deja a un solo click. */
export function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title,
  description,
  confirmLabel = "Borrar definitivamente",
  children,
}: {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  description?: string;
  confirmLabel?: string;
  children?: React.ReactNode;
}) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      description={description}
      size="sm"
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
          <Button variant="danger" onClick={onConfirm}>
            {confirmLabel}
          </Button>
        </div>
      }
    >
      {children}
    </Modal>
  );
}

/** Etiqueta de estado: la misma pastilla para los estados de las cuatro
 *  secciones. `tone` sale del estado en cada pantalla, no de un `Record` acá:
 *  "abierta" es bueno en una encuesta y "activa" lo es en una invitación, pero
 *  no son el mismo conjunto de valores. */
export function EstadoPill({
  children,
  tone,
}: {
  children: React.ReactNode;
  tone: "success" | "danger" | "muted" | "primary";
}) {
  const tones = {
    success: "bg-success/10 text-success",
    danger: "bg-danger/10 text-danger",
    muted: "bg-surface-alt text-muted",
    primary: "bg-primary/10 text-primary",
  } as const;

  return (
    <span
      className={`whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium ${tones[tone]}`}
    >
      {children}
    </span>
  );
}

function menuItemCls(item: DropdownItem): string {
  return [
    "w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm text-left",
    "transition-colors duration-150",
    "disabled:opacity-40 disabled:pointer-events-none",
    item.destructive ? "text-danger hover:bg-danger/10" : "text-foreground hover:bg-surface-alt",
  ].join(" ");
}

function RowMenuContent({ item }: { item: DropdownItem }) {
  return (
    <>
      {item.icon && (
        <span className="inline-flex h-4 w-4 shrink-0 items-center justify-center opacity-80">
          {item.icon}
        </span>
      )}
      <span className="flex-1 truncate">{item.label}</span>
      {item.shortcut && (
        <span className="font-mono text-[11px] tracking-wide text-muted">{item.shortcut}</span>
      )}
    </>
  );
}

/** Menú de acciones de una fila del `DataTable`.
 *
 *  ⚠️ Existe por dos restricciones concretas de la librería:
 *
 *  1. `DataTable` arma su `gridTemplateColumns` con
 *
 *         [ selectable && "44px", ...columnas, rowActions && "56px" ]
 *
 *     es decir, reserva **56px fijos** para las acciones de fila. Dos botones
 *     de texto ya no entran: se desbordan sobre la columna anterior y el
 *     último queda cortado contra el borde de la tabla. 56px es el
 *     presupuesto de un solo botón ícono, y eso es lo que este componente
 *     pone: un `⋯` que abre un menú con todo lo demás.
 *
 *  2. El `Dropdown` de la librería posiciona su panel con `position: absolute`
 *     dentro del propio trigger, sin portal. `DataTable` envuelve las filas en
 *     un contenedor `overflow-x-auto` (para el scroll horizontal en mobile),
 *     así que un `Dropdown` abierto ahí queda recortado por ese overflow y
 *     empuja un scrollbar horizontal fantasma — el efecto roto de abrir el
 *     menú y ver la tabla "saltar". Por eso este componente arma su propio
 *     panel y lo monta con `createPortal` en `document.body`, posicionado con
 *     `position: fixed` a partir del `getBoundingClientRect` del trigger: así
 *     flota por encima de la tabla en vez de vivir adentro de su scroll.
 *
 *  El día que la librería acepte un ancho para `rowActions` y un portal para
 *  `Dropdown`, esto se puede volver a `<Dropdown items={items} trigger={…} />`.
 */
export function RowMenu({ items }: { items: DropdownItem[] }) {
  const [open, setOpen] = useState(false);
  const [style, setStyle] = useState<React.CSSProperties>({
    position: "fixed",
    top: 0,
    left: 0,
    visibility: "hidden",
  });
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  // Se posiciona en dos pasos: primero se monta invisible (position: fixed,
  // fuera del flujo) para poder medir su ancho/alto reales, y en el mismo
  // useLayoutEffect —antes del paint— se recalcula contra el trigger y los
  // bordes del viewport. Sin esto habría que adivinar el tamaño del menú
  // (varía con la cantidad de ítems y el largo de las etiquetas) o aceptar un
  // salto visible entre "aparece mal ubicado" y "se corrige".
  useLayoutEffect(() => {
    if (!open) return;
    const trigger = triggerRef.current;
    const menu = menuRef.current;
    if (!trigger || !menu) return;

    const gap = 6;
    const margin = 8;
    const t = trigger.getBoundingClientRect();
    const m = menu.getBoundingClientRect();

    let top = t.bottom + gap;
    if (top + m.height > window.innerHeight - margin) {
      top = t.top - gap - m.height;
    }
    top = Math.max(margin, Math.min(top, window.innerHeight - m.height - margin));

    let left = t.right - m.width;
    left = Math.max(margin, Math.min(left, window.innerWidth - m.width - margin));

    setStyle({ position: "fixed", top, left, visibility: "visible" });
  }, [open]);

  useEffect(() => {
    if (!open) return;

    const onPointerDown = (e: MouseEvent) => {
      const target = e.target as Node;
      if (triggerRef.current?.contains(target) || menuRef.current?.contains(target)) return;
      setOpen(false);
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    // Reposicionar en cada scroll (de la página o del contenedor de la
    // tabla) es más trabajo del que vale: la fila se movió, así que se
    // cierra el menú en vez de perseguirla por el viewport.
    const onScroll = () => setOpen(false);

    document.addEventListener("mousedown", onPointerDown);
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("scroll", onScroll, true);
    window.addEventListener("resize", onScroll);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("scroll", onScroll, true);
      window.removeEventListener("resize", onScroll);
    };
  }, [open]);

  return (
    <>
      <Button
        ref={triggerRef}
        size="icon"
        variant="ghost"
        aria-label="Acciones de la fila"
        onClick={() => setOpen((v) => !v)}
      >
        <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor" aria-hidden>
          <circle cx="12" cy="5" r="1.6" />
          <circle cx="12" cy="12" r="1.6" />
          <circle cx="12" cy="19" r="1.6" />
        </svg>
      </Button>

      {open &&
        createPortal(
          <motion.div
            ref={menuRef}
            initial={{ opacity: 0, y: -6, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ duration: 0.15, ease: "easeOut" }}
            style={{ ...style, zIndex: 100 }}
            className="min-w-[220px] rounded-xl border border-border bg-surface p-1.5 shadow-xl shadow-black/10"
          >
            {items.map((item, i) =>
              item.divider ? (
                <div key={`d-${i}`} className="my-1.5 h-px bg-border" />
              ) : item.href ? (
                <a
                  key={i}
                  href={item.href}
                  className={menuItemCls(item)}
                  onClick={() => setOpen(false)}
                >
                  <RowMenuContent item={item} />
                </a>
              ) : (
                <button
                  key={i}
                  type="button"
                  disabled={item.disabled}
                  className={menuItemCls(item)}
                  onClick={() => {
                    item.onClick?.();
                    setOpen(false);
                  }}
                >
                  <RowMenuContent item={item} />
                </button>
              ),
            )}
          </motion.div>,
          document.body,
        )}
    </>
  );
}
