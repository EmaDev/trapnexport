"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { Button, Card, DataTable, useSnackbar, type Column } from "lib-kit-components";

import { CheckIcon, CloseIcon, ShieldIcon, ShirtIcon } from "@/components/atoms/icons";
import {
  aprobarSolicitud,
  rechazarSolicitud,
  setCuentaSuspendida,
} from "@/lib/admin/acciones";
import type { CuentaRow, SolicitudRow } from "@/lib/admin/cuentas";
import { ConfirmDialog, RowMenu } from "../Dialogs";

/** Autorización de vínculos con el plantel.
 *
 *  Es el control que impide que cualquiera se quede con la cuenta de un
 *  jugador. Registrarse diciendo "soy Naza Maciel" **no** alcanza para serlo:
 *  la cuenta nace en `pending`, el jugador queda tomado pero sin confirmar, y
 *  hasta que alguien de acá diga que sí, esa persona no tiene la cuenta del
 *  jugador — tiene una solicitud.
 *
 *  No usa `DataTable` como el resto del panel: son pocas a la vez y cada una
 *  necesita mostrar entera la nota que escribió la persona, que es justamente
 *  lo que permite reconocerla. En una columna angosta se corta, y una nota
 *  cortada no sirve para decidir.
 */
function SolicitudesEquipo({ solicitudes }: { solicitudes: SolicitudRow[] }) {
  const { snack } = useSnackbar();
  const [pending, startTransition] = useTransition();
  const [rechazando, setRechazando] = useState<SolicitudRow | null>(null);

  const aprobar = (s: SolicitudRow) =>
    startTransition(async () => {
      const r = await aprobarSolicitud(s.uid);
      snack({
        message: r.ok ? `Confirmado: @${s.handle} es ${s.playerName}` : r.error,
        variant: r.ok ? "success" : "error",
      });
    });

  const rechazar = (s: SolicitudRow) => {
    setRechazando(null);
    startTransition(async () => {
      const r = await rechazarSolicitud(s.uid);
      snack({
        message: r.ok ? `Rechazado. ${s.playerName} vuelve a estar disponible.` : r.error,
        variant: r.ok ? "neutral" : "error",
      });
    });
  };

  if (solicitudes.length === 0) {
    return (
      <Card variant="outline" padding="md" className="flex flex-row items-center gap-3">
        <ShieldIcon className="size-5 shrink-0 text-muted" />
        <p className="text-sm text-muted">
          No hay solicitudes pendientes. Cuando alguien se registre diciendo que es del
          plantel, aparece acá para que lo confirmes.
        </p>
      </Card>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <h2 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-muted">
        <ShirtIcon className="size-4" />
        Vínculos con el plantel por autorizar · {solicitudes.length}
      </h2>

      <ul className="flex flex-col gap-2">
        {solicitudes.map((s) => (
          <li key={s.uid}>
            <Card
              variant="outline"
              padding="md"
              className="flex flex-row flex-wrap items-center gap-3 border-primary/30 bg-primary/5"
            >
              {/* eslint-disable-next-line @next/next/no-img-element -- data-URI o foto de Google */}
              <img src={s.avatar} alt="" className="size-9 shrink-0 rounded-full" />
              <div className="min-w-0 flex-1">
                <p className="text-sm">
                  <span className="font-medium">@{s.handle}</span> dice ser{" "}
                  <span className="font-medium">{s.playerName}</span>
                </p>
                {s.note && <p className="mt-0.5 text-xs text-muted">“{s.note}”</p>}
                <p className="mt-0.5 text-xs text-muted">Pedido el {s.pedidoEl}</p>
              </div>
              <div className="flex shrink-0 gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  disabled={pending}
                  leftIcon={<CloseIcon className="size-4" />}
                  onClick={() => setRechazando(s)}
                >
                  Rechazar
                </Button>
                <Button
                  size="sm"
                  disabled={pending}
                  leftIcon={<CheckIcon className="size-4" />}
                  onClick={() => aprobar(s)}
                >
                  Confirmar
                </Button>
              </div>
            </Card>
          </li>
        ))}
      </ul>

      {/* Rechazar sí pregunta y aprobar no: aprobar se deshace suspendiendo la
          cuenta, rechazar borra el perfil y no hay botón que lo traiga de
          vuelta. El diálogo dice exactamente qué se va y qué queda. */}
      <ConfirmDialog
        open={rechazando !== null}
        onClose={() => setRechazando(null)}
        onConfirm={() => rechazando && rechazar(rechazando)}
        title="¿Rechazar esta solicitud?"
        confirmLabel="Rechazar y borrar el perfil"
      >
        <p className="text-sm">
          Se borra el perfil de <strong>@{rechazando?.handle}</strong> y{" "}
          <strong>{rechazando?.playerName}</strong> vuelve a estar disponible para que lo
          reclame quien corresponda.
        </p>
        <p className="mt-2 text-sm text-muted">
          Hay que borrarlo: el nombre de usuario <strong>@{rechazando?.handle}</strong> es el
          del jugador, y si la cuenta quedara como hincha se lo quedaría para siempre.
        </p>
        <p className="mt-2 text-sm text-muted">
          El acceso de la persona no se toca — puede volver a entrar y registrarse como
          hincha con otro nombre de usuario.
        </p>
      </ConfirmDialog>
    </div>
  );
}

/** Tabla de cuentas reales.
 *
 *  Son las de `trapnexport-user`: quienes se registraron de verdad. Las cuentas
 *  que se ven en el feed son otra cosa —contenido semilla del store en
 *  memoria— y no aparecen acá hasta que el feed migre a Firestore.
 *
 *  Suspender no borra: la cuenta sale del feed público pero sigue en la tabla
 *  para poder revertirlo.
 */
export function UsuariosClient({
  cuentas,
  solicitudes,
}: {
  cuentas: CuentaRow[];
  solicitudes: SolicitudRow[];
}) {
  const { snack } = useSnackbar();
  const [pending, startTransition] = useTransition();

  const toggle = (row: CuentaRow) => {
    const suspender = row.estado !== "suspendida";
    startTransition(async () => {
      const r = await setCuentaSuspendida(row.uid, suspender);
      snack({
        message: r.ok
          ? suspender
            ? `@${row.handle} quedó suspendida`
            : `@${row.handle} vuelve a estar activa`
          : r.error,
        variant: r.ok ? (suspender ? "neutral" : "success") : "error",
      });
    });
  };

  const columns: Column<CuentaRow>[] = [
    {
      key: "name",
      header: "Cuenta",
      width: "2fr",
      render: (row: CuentaRow) => (
        <div className="flex items-center gap-2">
          {/* eslint-disable-next-line @next/next/no-img-element -- data-URI o foto de Google */}
          <img src={row.avatar} alt="" className="size-8 shrink-0 rounded-full" />
          <div className="min-w-0">
            <p className="flex items-center gap-1 truncate font-medium">
              {row.name}
              {row.verificado && (
                <ShieldIcon className="size-3.5 shrink-0 text-primary" aria-label="Verificado" />
              )}
            </p>
            <Link href={`/u/${row.handle}`} className="truncate text-xs text-primary">
              @{row.handle}
            </Link>
          </div>
        </div>
      ),
      sortValue: (row: CuentaRow) => row.name,
    },
    {
      key: "rol",
      header: "Tipo",
      width: "110px",
      render: (row: CuentaRow) => (row.rol === "player" ? "Plantel" : "Hincha"),
    },
    { key: "alta", header: "Alta", width: "130px", hideOnMobile: true },
    {
      key: "estado",
      header: "Estado",
      width: "140px",
      render: (row: CuentaRow) => (
        <span
          className={`rounded-full px-2 py-0.5 text-xs font-medium ${
            row.estado === "activa"
              ? "bg-success/10 text-success"
              : row.estado === "pendiente"
                ? "bg-primary/10 text-primary"
                : "bg-danger/10 text-danger"
          }`}
        >
          {row.estado}
        </span>
      ),
    },
  ];

  return (
    <div className="flex flex-col gap-6">
      <SolicitudesEquipo solicitudes={solicitudes} />

      {cuentas.length === 0 ? (
        <Card variant="outline" padding="lg">
          <p className="text-center text-sm text-muted">
            Todavía no se registró nadie.
          </p>
        </Card>
      ) : (
        <DataTable
          columns={columns}
          rows={cuentas}
          rowKey={(row: CuentaRow) => row.uid}
          searchable
          searchPlaceholder="Buscar por nombre o usuario…"
          pageSize={10}
          density="comfortable"
          stickyHeader
          caption="Cuentas registradas"
          rowActions={(row: CuentaRow) => (
            <RowMenu
              items={[
                {
                  label: row.estado === "suspendida" ? "Reactivar" : "Suspender",
                  disabled: pending,
                  onClick: () => toggle(row),
                },
              ]}
            />
          )}
        />
      )}
    </div>
  );
}
