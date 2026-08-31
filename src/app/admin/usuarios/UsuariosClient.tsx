"use client";

import Link from "next/link";
import { useTransition } from "react";
import { Button, Card, DataTable, useSnackbar, type Column } from "lib-kit-components";

import { CheckIcon, CloseIcon, ShieldIcon } from "@/components/atoms/icons";
import { reviewClaim, setUserSuspended } from "@/lib/social/actions";
import type { AdminClaimRow, AdminUserRow } from "@/lib/social/queries";
import { RowMenu } from "../Dialogs";

/** Las solicitudes de "soy este jugador del plantel", pendientes de que el
 *  admin confirme que la persona es quien dice ser. No usan `DataTable` como
 *  el resto del panel: son pocas a la vez y cada una necesita ver la nota
 *  completa, que en una columna angosta se corta. */
function SolicitudesEquipo({ claims }: { claims: AdminClaimRow[] }) {
  const { snack } = useSnackbar();
  const [pending, startTransition] = useTransition();

  const review = (claim: AdminClaimRow, decision: "approved" | "rejected") => {
    startTransition(async () => {
      await reviewClaim(claim.userId, decision);
      snack({
        message:
          decision === "approved"
            ? `Confirmado: @${claim.handle} es ${claim.playerName}`
            : `Rechazado el reclamo de @${claim.handle}`,
        variant: decision === "approved" ? "success" : "neutral",
      });
    });
  };

  if (claims.length === 0) return null;

  return (
    <div className="flex flex-col gap-3">
      <h2 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-muted">
        <ShieldIcon className="size-4" />
        Solicitudes del plantel · {claims.length}
      </h2>

      <ul className="flex flex-col gap-2">
        {claims.map((claim) => (
          <li key={claim.userId}>
            <Card
              variant="outline"
              padding="md"
              className="flex flex-row flex-wrap items-center gap-3"
            >
              {/* eslint-disable-next-line @next/next/no-img-element -- data-URI */}
              <img src={claim.avatar} alt="" className="size-9 shrink-0 rounded-full" />
              <div className="min-w-0 flex-1">
                <p className="text-sm">
                  <span className="font-medium">@{claim.handle}</span> dice ser{" "}
                  <span className="font-medium">{claim.playerName}</span>
                </p>
                {claim.note && <p className="mt-0.5 text-xs text-muted">“{claim.note}”</p>}
                <p className="mt-0.5 text-xs text-muted">Pedido el {claim.requestedAt}</p>
              </div>
              <div className="flex shrink-0 gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  disabled={pending}
                  leftIcon={<CloseIcon className="size-4" />}
                  onClick={() => review(claim, "rejected")}
                >
                  Rechazar
                </Button>
                <Button
                  size="sm"
                  disabled={pending}
                  leftIcon={<CheckIcon className="size-4" />}
                  onClick={() => review(claim, "approved")}
                >
                  Confirmar
                </Button>
              </div>
            </Card>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Tabla de cuentas.
 *
 *  Suspender no borra: la cuenta y sus posts desaparecen del feed público
 *  (`getFeed` filtra por autor suspendido) pero siguen acá para poder revertir.
 *  La acción es un Server Action que revalida `/` y `/admin`, así que el efecto
 *  se ve en las dos puntas sin refrescar a mano.
 */
export function UsuariosClient({
  users,
  claims,
}: {
  users: AdminUserRow[];
  claims: AdminClaimRow[];
}) {
  const { snack } = useSnackbar();
  const [pending, startTransition] = useTransition();

  const toggle = (row: AdminUserRow) => {
    const suspend = row.estado === "activa";
    startTransition(async () => {
      await setUserSuspended(row.id, suspend);
      snack({
        message: suspend
          ? `@${row.handle} quedó suspendida`
          : `@${row.handle} vuelve a estar activa`,
        variant: suspend ? "neutral" : "success",
      });
    });
  };

  const columns: Column<AdminUserRow>[] = [
    {
      key: "name",
      header: "Cuenta",
      width: "2fr",
      render: (row) => (
        <div className="flex items-center gap-2">
          {/* eslint-disable-next-line @next/next/no-img-element -- data-URI */}
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
      sortValue: (row) => row.name,
    },
    { key: "posts", header: "Posts", align: "right", width: "90px" },
    { key: "alta", header: "Alta", width: "130px", hideOnMobile: true },
    {
      key: "estado",
      header: "Estado",
      width: "150px",
      render: (row) => (
        <div className="flex flex-wrap gap-1">
          <span
            className={`rounded-full px-2 py-0.5 text-xs font-medium ${
              row.estado === "activa"
                ? "bg-success/10 text-success"
                : "bg-danger/10 text-danger"
            }`}
          >
            {row.estado}
          </span>
          {row.pendiente && (
            <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
              pendiente
            </span>
          )}
        </div>
      ),
    },
  ];

  return (
    <div className="flex flex-col gap-6">
      <SolicitudesEquipo claims={claims} />

      <DataTable
        columns={columns}
        rows={users}
        rowKey={(row) => row.id}
        searchable
        searchPlaceholder="Buscar por nombre o usuario…"
        pageSize={10}
        density="comfortable"
        stickyHeader
        caption="Cuentas registradas"
        rowActions={(row) => (
          <RowMenu
            items={[
              {
                label: row.estado === "activa" ? "Suspender" : "Reactivar",
                disabled: pending,
                onClick: () => toggle(row),
              },
            ]}
          />
        )}
      />
    </div>
  );
}
