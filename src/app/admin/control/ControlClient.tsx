"use client";

import { useEffect, useState } from "react";

import {
  BackIcon,
  ChevronIcon,
  CloseIcon,
  MenuIcon,
  SoundOffIcon,
  SoundOnIcon,
  TrophyIcon,
  VideoIcon,
} from "@/components/atoms/icons";
import { useMantenerPantallaEncendida } from "@/lib/presentacion/pantalla";
import {
  alListoAdmin,
  enviarComando,
  escucharEstado,
  LATIDO_VENCIDO_MS,
  type Comando,
  type EstadoRemoto,
  type VinetaRemota,
} from "@/lib/presentacion/remoto";

/** El control remoto en el celular.
 *
 *  Pensado para usarse **sin mirarlo**: "siguiente" ocupa casi toda la
 *  pantalla y se acierta con el pulgar en la oscuridad del salón. Lo demás
 *  —volver, pausar el video, silenciar, saltar— es chico y va abajo, porque
 *  apretarlo sin querer en medio de la gala es peor que tener que buscarlo.
 *
 *  Muestra lo que la proyección no: quién gana la próxima categoría. Es para
 *  el que presenta, que tiene que saber qué viene antes de que el salón lo vea.
 *
 *  Usa los mismos colores fijos que la proyección y no los tokens de la app:
 *  se usa en un salón a oscuras, y una pantalla blanca en la mano del
 *  presentador se ve desde la última fila.
 */

const ORO = "#e8c46a";

type Conexion =
  | { tipo: "cargando" }
  | { tipo: "error"; mensaje: string }
  | { tipo: "listo" };

export function ControlClient() {
  useMantenerPantallaEncendida();

  const [conexion, setConexion] = useState<Conexion>({ tipo: "cargando" });
  const [estado, setEstado] = useState<EstadoRemoto | null>(null);
  const [indiceAbierto, setIndiceAbierto] = useState(false);
  const [aviso, setAviso] = useState<string | null>(null);
  const [ahora, setAhora] = useState(() => Date.now());

  useEffect(() => {
    let dejar: (() => void) | null = null;

    const soltar = alListoAdmin((usuario, esAdmin) => {
      dejar?.();
      dejar = null;
      if (!usuario || !esAdmin) {
        setConexion({
          tipo: "error",
          mensaje:
            "Este celular no tiene sesión de admin en Firebase. Salí del panel y volvé a entrar desde acá.",
        });
        return;
      }
      dejar = escucharEstado(
        (e) => {
          setEstado(e);
          setConexion({ tipo: "listo" });
        },
        (mensaje) => setConexion({ tipo: "error", mensaje }),
      );
    });

    return () => {
      soltar();
      dejar?.();
    };
  }, []);

  // El latido se evalúa contra el reloj: sin este tic, una proyección que se
  // cerró de golpe (se cortó la luz, se cerró la tapa) seguiría figurando
  // abierta hasta el próximo cambio del documento.
  useEffect(() => {
    const id = window.setInterval(() => setAhora(Date.now()), 5000);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    if (!aviso) return;
    const id = window.setTimeout(() => setAviso(null), 3000);
    return () => window.clearTimeout(id);
  }, [aviso]);

  const latido = estado?.latido?.toMillis?.() ?? 0;
  const enVivo = Boolean(estado?.activa) && ahora - latido < LATIDO_VENCIDO_MS;

  const mandar = (c: Comando) => {
    if (!estado || !enVivo) return;
    navigator.vibrate?.(12);
    enviarComando(estado.sesion, c).catch(() =>
      setAviso("No se pudo mandar. Revisá la conexión del celular."),
    );
  };

  /* ── sin conexión ──────────────────────────────────────────────────────── */

  if (conexion.tipo !== "listo" || !estado || !enVivo) {
    const mensaje =
      conexion.tipo === "cargando"
        ? "Conectando…"
        : conexion.tipo === "error"
          ? conexion.mensaje
          : "La proyección no está abierta. En la compu, entrá a Presentación y apretá Presentar.";

    return (
      <Marco>
        <div className="flex flex-1 flex-col items-center justify-center gap-4 px-6 text-center">
          <TrophyIcon width={40} height={40} style={{ color: ORO }} />
          <p className="max-w-[28ch] text-base text-white/75">{mensaje}</p>
          {conexion.tipo === "listo" && (
            <p className="text-xs text-white/40">Se conecta solo apenas se abra.</p>
          )}
        </div>
      </Marco>
    );
  }

  /* ── en vivo ───────────────────────────────────────────────────────────── */

  const { indice, vinetas, silencio } = estado;
  const actual = vinetas[indice];
  const siguiente = vinetas[indice + 1];
  const ultima = indice >= vinetas.length - 1;

  return (
    <Marco>
      <header className="flex items-center justify-between gap-3 px-4 pb-2 pt-4">
        <p className="flex items-center gap-2 text-xs uppercase text-white/55" style={{ letterSpacing: "0.2em" }}>
          <span className="h-2 w-2 rounded-full bg-emerald-400" aria-hidden />
          En vivo
        </p>
        <p className="text-xs tabular-nums text-white/45">
          {indice + 1} / {vinetas.length}
        </p>
      </header>

      {/* qué está y qué viene */}
      <section className="flex flex-col gap-2 px-4">
        <Ficha etiqueta="Proyectando" vineta={actual} destacada />
        {siguiente ? (
          <Ficha etiqueta="Sigue" vineta={siguiente} />
        ) : (
          <p className="px-1 text-sm text-white/40">Es la última placa.</p>
        )}
      </section>

      {/* el botón grande */}
      <div className="flex flex-1 flex-col gap-3 px-4 py-4">
        <button
          type="button"
          onClick={() => mandar({ accion: "siguiente" })}
          disabled={ultima}
          className="flex flex-1 flex-col items-center justify-center gap-2 rounded-3xl text-[#07030d] transition active:scale-[0.98] disabled:opacity-30"
          style={{ background: ORO, minHeight: "38vh" }}
          aria-label="Siguiente placa"
        >
          <ChevronIcon width={56} height={56} />
          <span className="text-2xl font-black uppercase" style={{ letterSpacing: "0.08em" }}>
            Siguiente
          </span>
        </button>

        <div className="grid grid-cols-4 gap-2">
          <BotonChico
            onClick={() => mandar({ accion: "anterior" })}
            disabled={indice === 0}
            label="Anterior"
          >
            <BackIcon width={22} height={22} />
          </BotonChico>
          <BotonChico
            onClick={() => mandar({ accion: "pausa" })}
            disabled={actual?.tipo !== "video"}
            label="Pausa"
          >
            <VideoIcon width={22} height={22} />
          </BotonChico>
          <BotonChico
            onClick={() => mandar({ accion: "silencio" })}
            label={silencio ? "Con sonido" : "Silenciar"}
            activo={silencio}
          >
            {silencio ? (
              <SoundOffIcon width={22} height={22} />
            ) : (
              <SoundOnIcon width={22} height={22} />
            )}
          </BotonChico>
          <BotonChico onClick={() => setIndiceAbierto(true)} label="Índice">
            <MenuIcon width={22} height={22} />
          </BotonChico>
        </div>
      </div>

      {aviso && (
        <p
          role="alert"
          className="mx-4 mb-4 rounded-xl border border-red-400/30 bg-red-500/15 px-3 py-2 text-sm text-red-200"
        >
          {aviso}
        </p>
      )}

      {/* saltar a cualquier placa */}
      {indiceAbierto && (
        <div className="fixed inset-0 z-10 flex flex-col bg-[#07030d]/95 backdrop-blur">
          <div className="flex items-center justify-between px-4 py-3">
            <p className="text-sm font-semibold text-white">Ir a una placa</p>
            <button
              type="button"
              onClick={() => setIndiceAbierto(false)}
              className="grid h-10 w-10 place-items-center rounded-full text-white/80 hover:bg-white/10"
              aria-label="Cerrar el índice"
            >
              <CloseIcon width={20} height={20} />
            </button>
          </div>
          <ul className="flex-1 overflow-y-auto px-2 pb-6">
            {vinetas.map((v, i) => (
              <li key={i}>
                <button
                  type="button"
                  onClick={() => {
                    mandar({ accion: "ir", indice: i });
                    setIndiceAbierto(false);
                  }}
                  className={`flex w-full items-baseline gap-3 rounded-lg px-3 py-3 text-left text-sm ${
                    i === indice ? "bg-white/15" : "active:bg-white/10"
                  }`}
                  style={i === indice ? { color: ORO } : undefined}
                  aria-current={i === indice ? "true" : undefined}
                >
                  <span className="w-[3ch] shrink-0 text-right tabular-nums text-white/35">
                    {i + 1}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className={i === indice ? "" : "text-white/80"}>{v.rotulo}</span>
                    {v.nota && (
                      <span className="mt-0.5 block text-xs text-white/45">{v.nota}</span>
                    )}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </Marco>
  );
}

/* ── piezas ──────────────────────────────────────────────────────────────── */

/** Tapa el panel entero: en el celular, el sidebar del admin sólo estorba. */
function Marco({ children }: { children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex select-none flex-col overflow-hidden bg-[#07030d] text-white">
      {children}
    </div>
  );
}

function Ficha({
  etiqueta,
  vineta,
  destacada = false,
}: {
  etiqueta: string;
  vineta: VinetaRemota | undefined;
  destacada?: boolean;
}) {
  if (!vineta) return null;
  return (
    <div
      className={`rounded-2xl border px-4 py-3 ${
        destacada ? "border-white/20 bg-white/10" : "border-white/10 bg-white/[0.04]"
      }`}
    >
      <p className="text-[0.65rem] uppercase text-white/45" style={{ letterSpacing: "0.2em" }}>
        {etiqueta}
      </p>
      <p className={`mt-0.5 truncate font-semibold ${destacada ? "text-lg text-white" : "text-white/80"}`}>
        {vineta.rotulo}
      </p>
      {/* El ganador, sólo acá: es lo que el que presenta necesita saber
          antes de apretar. */}
      {vineta.nota && (
        <p className="mt-1 flex items-center gap-1.5 text-sm font-semibold" style={{ color: ORO }}>
          <TrophyIcon width={14} height={14} />
          <span className="min-w-0 truncate">{vineta.nota}</span>
        </p>
      )}
    </div>
  );
}

function BotonChico({
  onClick,
  children,
  label,
  disabled,
  activo,
}: {
  onClick: () => void;
  children: React.ReactNode;
  label: string;
  disabled?: boolean;
  activo?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`flex h-16 flex-col items-center justify-center gap-1 rounded-2xl border text-[0.7rem] transition active:scale-95 disabled:opacity-25 ${
        activo ? "border-white/30 bg-white/20 text-white" : "border-white/10 bg-white/[0.06] text-white/80"
      }`}
      aria-label={label}
    >
      {children}
      <span>{label}</span>
    </button>
  );
}
