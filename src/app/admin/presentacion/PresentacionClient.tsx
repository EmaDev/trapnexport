"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Button, Card, Checkbox, StatCard, Switch } from "lib-kit-components";

import {
  ArrowDownIcon,
  ArrowUpIcon,
  PlayIcon,
  PollIcon,
  PresentIcon,
  TrophyIcon,
} from "@/components/atoms/icons";
import {
  armarGuion,
  ganadoresDe,
  OPCIONES_POR_DEFECTO,
  type CategoriaVotacion,
} from "@/lib/presentacion/guion";
import { Presentador } from "./Presentador";

/** La pantalla de armado: qué se proyecta y en qué orden, y el botón que abre
 *  la presentación.
 *
 *  Es una pantalla de **preparación**, no un editor. No guarda nada: el orden y
 *  los interruptores viven en el estado de este componente y se pierden al
 *  recargar, a propósito. Persistirlos abriría la pregunta de qué pasa cuando
 *  se agrega una categoría después de guardar el orden —¿va al final, no va?— y
 *  la respuesta correcta para una gala que se arma diez minutos antes es que el
 *  orden por defecto sea siempre el de los premios y se toque en el momento.
 *
 *  El presentador **reemplaza** esta pantalla en vez de abrirse encima: monta
 *  `fixed inset-0`, y montarlo recién al apretar es lo que le da el gesto del
 *  usuario que el navegador exige para el audio y la pantalla completa.
 */

export function PresentacionClient({ categorias }: { categorias: CategoriaVotacion[] }) {
  const [presentando, setPresentando] = useState(false);

  // El orden arranca en el de los premios —el que viene del servidor— y las
  // categorías arrancan todas seleccionadas: la gala entrega todo lo que se
  // votó, y sacar es más raro que agregar.
  const [orden, setOrden] = useState(() => categorias.map((c) => c.id));
  const [elegidas, setElegidas] = useState(() => new Set(categorias.map((c) => c.id)));
  const [opciones, setOpciones] = useState(OPCIONES_POR_DEFECTO);

  const porId = useMemo(
    () => new Map(categorias.map((c) => [c.id, c])),
    [categorias],
  );

  const seleccionadas = useMemo(
    () => orden.filter((id) => elegidas.has(id)),
    [orden, elegidas],
  );

  const guion = useMemo(
    () => armarGuion(categorias, { ...opciones, orden: seleccionadas }),
    [categorias, opciones, seleccionadas],
  );

  const sinVotos = seleccionadas.filter((id) => (porId.get(id)?.totalVotos ?? 0) === 0);

  const alternar = (id: string) =>
    setElegidas((previas) => {
      const proximas = new Set(previas);
      if (proximas.has(id)) proximas.delete(id);
      else proximas.add(id);
      return proximas;
    });

  /** Mover una categoría dentro del orden. Sobre la lista **completa** y no
   *  sobre las seleccionadas: si una categoría apagada se saltea al mover, al
   *  volver a prenderla aparece en un lugar que nadie eligió. */
  const mover = (id: string, delta: number) =>
    setOrden((previo) => {
      const desde = previo.indexOf(id);
      const hasta = desde + delta;
      if (desde < 0 || hasta < 0 || hasta >= previo.length) return previo;
      const proximo = [...previo];
      [proximo[desde], proximo[hasta]] = [proximo[hasta], proximo[desde]];
      return proximo;
    });

  const todas = () => setElegidas(new Set(categorias.map((c) => c.id)));
  const ninguna = () => setElegidas(new Set());

  if (presentando) {
    return <Presentador guion={guion} onSalir={() => setPresentando(false)} />;
  }

  /* ── sin nada que proyectar ────────────────────────────────────────────── */

  if (categorias.length === 0) {
    return (
      <Card padding="lg" className="text-center">
        <PollIcon width={32} height={32} className="mx-auto text-muted" />
        <p className="mt-3 font-medium">No hay ninguna votación para proyectar</p>
        <p className="mx-auto mt-1 max-w-md text-sm text-muted">
          La presentación se arma con las encuestas abiertas y cerradas. Las que están
          en borrador no entran: sus opciones todavía se pueden cambiar.
        </p>
        <Link
          href="/admin/encuestas"
          className="mt-4 inline-block text-sm font-medium text-primary"
        >
          Ir a encuestas
        </Link>
      </Card>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      {/* ── el botón, arriba de todo ────────────────────────────────────── */}
      <Card variant="gradient" padding="lg">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="min-w-0">
            <p className="flex items-center gap-2 text-lg font-bold">
              <PresentIcon width={22} height={22} />
              Listo para proyectar
            </p>
            <p className="mt-1 text-sm opacity-80">
              {guion.length} viñetas · {seleccionadas.length}{" "}
              {seleccionadas.length === 1 ? "categoría" : "categorías"} · arranca en la
              placa de espera.
            </p>
          </div>

          <Button
            size="lg"
            leftIcon={<PlayIcon width={18} height={18} />}
            disabled={seleccionadas.length === 0}
            onClick={() => setPresentando(true)}
          >
            Presentar
          </Button>
        </div>
      </Card>

      {/* ── qué hay adentro ─────────────────────────────────────────────── */}
      <div className="grid gap-3 sm:grid-cols-3">
        <StatCard label="Categorías" value={String(seleccionadas.length)} icon={<TrophyIcon />} />
        <StatCard label="Viñetas" value={String(guion.length)} icon={<PresentIcon />} />
        <StatCard
          label="Votos contados"
          value={String(
            seleccionadas.reduce((n, id) => n + (porId.get(id)?.totalVotos ?? 0), 0),
          )}
          icon={<PollIcon />}
        />
      </div>

      {/* Sin votos no hay ganador, y la placa lo dice en la proyección. Avisarlo
          acá es lo que da tiempo a sacar la categoría antes de que el salón la
          vea. */}
      {sinVotos.length > 0 && (
        <p
          role="status"
          className="rounded-xl border border-danger/30 bg-danger/10 px-4 py-3 text-sm text-danger"
        >
          {sinVotos.length === 1
            ? "Una categoría seleccionada no tiene ningún voto"
            : `${sinVotos.length} categorías seleccionadas no tienen ningún voto`}{" "}
          y se van a proyectar sin ganador:{" "}
          <span className="font-medium">
            {sinVotos.map((id) => porId.get(id)?.nombre).join(", ")}
          </span>
          .
        </p>
      )}

      {/* ── el guion de cada categoría ──────────────────────────────────── */}
      <Card padding="md">
        <p className="text-sm font-semibold">Qué se muestra en cada categoría</p>
        <p className="mt-1 text-sm text-muted">
          La placa del premio y la del ganador van siempre. Lo demás se saca cuando la
          gala corre con el tiempo justo.
        </p>

        <div className="mt-4 flex flex-col gap-3">
          <Switch
            checked={opciones.nominados}
            onChange={(v) => setOpciones((o) => ({ ...o, nominados: v }))}
            label="Placa de nominados"
            description="Todas las opciones antes de abrir el sobre."
          />
          <Switch
            checked={opciones.suspenso}
            onChange={(v) => setOpciones((o) => ({ ...o, suspenso: v }))}
            label="Suspenso con redoble"
            description="«Y el ganador es…» con el redoble sonando hasta que avanzás."
          />
          <Switch
            checked={opciones.resultados}
            onChange={(v) => setOpciones((o) => ({ ...o, resultados: v }))}
            label="Tabla de resultados"
            description="Después de la revelación: todos los votos, ordenados."
          />
        </div>
      </Card>

      {/* ── el orden ────────────────────────────────────────────────────── */}
      <Card padding="md">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <p className="text-sm font-semibold">Orden de entrega</p>
            <p className="mt-1 text-sm text-muted">
              De arriba abajo, como se anuncian. El último es el cierre de la noche.
            </p>
          </div>
          <div className="flex gap-2">
            <Button size="sm" variant="ghost" onClick={todas}>
              Todas
            </Button>
            <Button size="sm" variant="ghost" onClick={ninguna}>
              Ninguna
            </Button>
          </div>
        </div>

        <ul className="mt-4 flex flex-col divide-y divide-border">
          {orden.map((id, i) => {
            const categoria = porId.get(id);
            if (!categoria) return null;

            const marcada = elegidas.has(id);
            const ganadores = ganadoresDe(categoria);
            // La posición que se muestra es la de la **entrega**, así que sólo
            // cuentan las prendidas: si mostrara el índice en la lista, apagar
            // la primera dejaría a la segunda anunciándose como la número 2.
            const puesto = marcada ? seleccionadas.indexOf(id) + 1 : null;

            return (
              <li key={id} className="flex items-center gap-3 py-2.5">
                <span className="w-[2.5ch] shrink-0 text-right text-sm tabular-nums text-muted">
                  {puesto ?? "—"}
                </span>

                <div className="min-w-0 flex-1">
                  <Checkbox
                    checked={marcada}
                    onChange={() => alternar(id)}
                    label={<span className="font-medium">{categoria.nombre}</span>}
                    description={
                      <span className="text-xs">
                        {categoria.totalVotos}{" "}
                        {categoria.totalVotos === 1 ? "voto" : "votos"}
                        {ganadores.length > 0 && (
                          <>
                            {" · "}
                            <span className="text-foreground">
                              {ganadores.length === 1
                                ? ganadores[0].texto
                                : `${ganadores.length} elegidos`}
                            </span>
                          </>
                        )}
                        {categoria.cupos > 1 && ` · ${categoria.cupos} cupos`}
                      </span>
                    }
                  />
                </div>

                <div className="flex shrink-0 gap-1">
                  <Button
                    size="icon"
                    variant="ghost"
                    aria-label={`Subir ${categoria.nombre}`}
                    disabled={i === 0}
                    onClick={() => mover(id, -1)}
                  >
                    <ArrowUpIcon width={16} height={16} />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    aria-label={`Bajar ${categoria.nombre}`}
                    disabled={i === orden.length - 1}
                    onClick={() => mover(id, 1)}
                  >
                    <ArrowDownIcon width={16} height={16} />
                  </Button>
                </div>
              </li>
            );
          })}
        </ul>
      </Card>

      {/* ── el manual del clicker ───────────────────────────────────────── */}
      <Card padding="md">
        <p className="text-sm font-semibold">Cómo se maneja</p>
        <dl className="mt-3 grid gap-x-8 gap-y-2 text-sm sm:grid-cols-2">
          {[
            ["→ · espacio · clicker", "Avanzar una viñeta"],
            ["←", "Volver una viñeta"],
            ["F", "Entrar o salir de pantalla completa"],
            ["M", "Silenciar el sonido"],
            ["S", "Abrir el índice y saltar a una viñeta"],
            ["Esc", "Salir de pantalla completa; otra vez, terminar"],
          ].map(([tecla, que]) => (
            <div key={tecla} className="flex items-baseline justify-between gap-4">
              <dt className="shrink-0 font-mono text-xs text-muted">{tecla}</dt>
              <dd className="text-right">{que}</dd>
            </div>
          ))}
        </dl>
      </Card>
    </div>
  );
}
