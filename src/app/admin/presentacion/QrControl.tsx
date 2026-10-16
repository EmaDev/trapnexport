"use client";

import { useEffect, useRef, useState } from "react";

/** El QR que abre el control remoto en el celular.
 *
 *  La URL sale de `window.location` y no de `NEXT_PUBLIC_SITE_URL`: el día de
 *  la gala se puede estar proyectando desde la red local (`http://192.168…`)
 *  y el celular tiene que abrir esa misma, no la de producción.
 *
 *  `qr-code-styling` se importa adentro del efecto: toca `document` al
 *  cargarse, y en el servidor no hay.
 */
export function QrControl() {
  const caja = useRef<HTMLDivElement>(null);
  const [url, setUrl] = useState("");

  useEffect(() => {
    const destino = `${window.location.origin}/admin/control`;

    let cancelado = false;
    void import("qr-code-styling").then(({ default: QRCodeStyling }) => {
      if (cancelado || !caja.current) return;
      setUrl(destino);
      caja.current.innerHTML = "";
      new QRCodeStyling({
        width: 140,
        height: 140,
        data: destino,
        margin: 4,
        dotsOptions: { color: "#07030d", type: "rounded" },
        backgroundOptions: { color: "#ffffff" },
      }).append(caja.current);
    });

    return () => {
      cancelado = true;
    };
  }, []);

  return (
    <div className="flex flex-wrap items-center gap-4">
      <div
        ref={caja}
        className="h-[140px] w-[140px] shrink-0 overflow-hidden rounded-lg bg-white"
        aria-label="Código QR del control remoto"
        role="img"
      />
      <div className="min-w-0 flex-1 text-sm">
        <p className="font-semibold">Control remoto desde el celular</p>
        <p className="mt-1 text-muted">
          Escaneá el código con el celular, iniciá sesión en el panel y apretá Presentar
          en esta compu. Desde el celular avanzás, volvés, pausás el video y ves quién
          gana antes de revelarlo.
        </p>
        {url && <p className="mt-2 break-all font-mono text-xs text-muted">{url}</p>}
      </div>
    </div>
  );
}
