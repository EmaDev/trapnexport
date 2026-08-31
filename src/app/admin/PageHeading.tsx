/** Encabezado de una pantalla del panel.
 *
 *  El módulo privado no usa `AppHeader` ni `AppHeaderCardSlot`: esos son
 *  cabeceras de app mobile (safe areas, sticky, botón de volver) y acá la
 *  navegación la lleva el `SideBar`. Un título plano es lo correcto y no
 *  arrastra estado de cliente.
 */
export function PageHeading({
  title,
  description,
  actions,
}: {
  title: string;
  description?: string;
  actions?: React.ReactNode;
}) {
  return (
    <header className="mb-6 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
        {description && <p className="mt-1 text-sm text-muted">{description}</p>}
      </div>
      {actions}
    </header>
  );
}
