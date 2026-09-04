/** Avatar circular con respaldo.
 *
 *  Existe porque el chat lo dibuja en cuatro tamaños distintos y en tres
 *  pantallas, y en buena parte de los casos no hay foto: un grupo recién
 *  creado no tiene ninguna y una cuenta borrada tampoco. El respaldo es la
 *  inicial sobre el degradé de marca y no un cuadro gris, que se lee como una
 *  imagen que no cargó y no como "esta cuenta no tiene foto".
 *
 *  El tamaño va por `style` y no por clase: Tailwind genera las clases
 *  escaneando el código, así que un `size-${n}` armado en tiempo de ejecución
 *  no existiría en el CSS final.
 *
 *  Sin `"use client"`: es una función pura sin estado ni handlers, así que
 *  sirve igual dentro de un Server Component.
 */
export function Avatar({
  src,
  name,
  size = 40,
  className = "",
}: {
  src?: string | null;
  /** de dónde sale la inicial cuando no hay foto */
  name: string;
  /** lado del círculo en px. Default: 40 */
  size?: number;
  className?: string;
}) {
  const box = { width: size, height: size };

  if (src) {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- URL de Firebase Storage
      <img
        src={src}
        alt=""
        loading="lazy"
        style={box}
        className={`shrink-0 rounded-full bg-surface-alt object-cover ${className}`}
      />
    );
  }

  return (
    <span
      aria-hidden
      style={{ ...box, fontSize: Math.round(size * 0.4) }}
      className={`grid shrink-0 place-items-center rounded-full bg-gradient-to-br from-primary to-accent font-bold text-white ${className}`}
    >
      {name.trim().charAt(0).toUpperCase() || "?"}
    </span>
  );
}
