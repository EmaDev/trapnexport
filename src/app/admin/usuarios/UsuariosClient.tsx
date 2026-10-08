"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { Button, Card, DataTable, Select, useSnackbar, type Column } from "lib-kit-components";

import { CheckIcon, CloseIcon, ShieldIcon, ShirtIcon } from "@/components/atoms/icons";
import {
  aprobarSolicitud,
  cambiarTipoDeCuenta,
  rechazarSolicitud,
  setCuentaSuspendida,
} from "@/lib/admin/acciones";
import type { CuentaRow, SolicitudRow } from "@/lib/admin/cuentas";
import type { ClaimablePlayerVM } from "@/lib/auth/roster";
import { ConfirmDialog, FormModal, RowMenu } from "../Dialogs";

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

/** Elegir con qué jugador del plantel se vincula una cuenta.
 *
 *  Es el paso "soy del equipo" del registro, pero del lado del panel: la misma
 *  lista, el mismo `claimedBy`. Va en un diálogo con un `Select` y no en el
 *  menú de la fila porque hay que elegir *a quién* —el rol no alcanza— y
 *  porque la decisión necesita ver qué jugadores quedan libres.
 *
 *  Los ya reclamados aparecen deshabilitados en vez de ocultos: que Naza
 *  Sochan no esté en la lista no se distingue de que no esté cargado en el
 *  plantel, y son dos problemas con soluciones distintas.
 */
function VincularDialog({
  cuenta,
  plantel,
  playerId,
  onPlayerId,
  onClose,
  onConfirm,
  pending,
}: {
  cuenta: CuentaRow | null;
  plantel: ClaimablePlayerVM[];
  /** El jugador elegido vive afuera: el diálogo se monta una sola vez y cambia
   *  de cuenta, así que quien abre la fila es el que tiene que dejarlo en el
   *  vínculo actual. Resetearlo acá sería un `setState` en un efecto, que
   *  encadena un render por cada apertura. */
  playerId: string;
  onPlayerId: (playerId: string) => void;
  onClose: () => void;
  onConfirm: (playerId: string) => void;
  pending: boolean;
}) {
  const options = plantel.map((j) => ({
    value: j.id,
    label: j.claimed && j.id !== cuenta?.playerId ? `${j.name} — ya vinculado` : j.name,
    disabled: j.claimed && j.id !== cuenta?.playerId,
  }));

  /*  Un jugador que no está en la lista: la ficha pasó a leyenda después de que
   *  se vinculó la cuenta y `getClaimablePlayers()` las esconde. Sin esta
   *  opción el `Select` abriría vacío y parecería que la cuenta no tiene
   *  vínculo, cuando lo que no tiene es una ficha en el plantel de hoy. */
  if (cuenta?.playerId && !plantel.some((j) => j.id === cuenta.playerId)) {
    options.unshift({
      value: cuenta.playerId,
      label: `${cuenta.playerId} (fuera del plantel actual)`,
      disabled: false,
    });
  }

  const esCambio = cuenta?.rol === "player";

  return (
    <FormModal
      open={cuenta !== null}
      onClose={onClose}
      title={esCambio ? "Cambiar el jugador vinculado" : "Pasar al plantel"}
      description={
        cuenta
          ? `@${cuenta.handle} va a quedar vinculada a la ficha del jugador que elijas.`
          : undefined
      }
      submitLabel={esCambio ? "Cambiar el vínculo" : "Pasar al plantel"}
      submitting={pending}
      disabled={!playerId || playerId === cuenta?.playerId}
      onSubmit={() => onConfirm(playerId)}
    >
      <Select
        label="Jugador del plantel"
        placeholder="Elegí quién es"
        options={options}
        value={playerId}
        onChange={onPlayerId}
      />
      <p className="text-xs text-muted">
        La cuenta queda verificada y con el tilde, sin pasar por la cola de
        solicitudes: el vínculo lo estás confirmando vos.
      </p>
      <p className="text-xs text-muted">
        El nombre de usuario <strong>@{cuenta?.handle}</strong> no cambia. La ficha
        deportiva que se muestra en la historia sale de este vínculo, y se carga desde
        Historia → Fichas.
      </p>
    </FormModal>
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
  plantel,
}: {
  cuentas: CuentaRow[];
  solicitudes: SolicitudRow[];
  plantel: ClaimablePlayerVM[];
}) {
  const { snack } = useSnackbar();
  const [pending, startTransition] = useTransition();
  const [vinculando, setVinculando] = useState<CuentaRow | null>(null);
  const [playerId, setPlayerId] = useState("");
  const [aHincha, setAHincha] = useState<CuentaRow | null>(null);

  const nombreDelJugador = new Map(plantel.map((j) => [j.id, j.name]));

  // Abrir el diálogo deja elegido el jugador que la cuenta ya tiene: para un
  // hincha es "ninguno", y para una del plantel es el vínculo actual, que es
  // contra lo que se compara para saber si hubo cambio.
  const abrirVinculo = (row: CuentaRow) => {
    setPlayerId(row.playerId ?? "");
    setVinculando(row);
  };

  const pasarAlPlantel = (row: CuentaRow, playerId: string) => {
    setVinculando(null);
    startTransition(async () => {
      const r = await cambiarTipoDeCuenta(row.uid, { rol: "player", playerId });
      snack({
        message: r.ok
          ? `@${row.handle} quedó vinculada a ${nombreDelJugador.get(playerId) ?? playerId}`
          : r.error,
        variant: r.ok ? "success" : "error",
      });
    });
  };

  const pasarAHincha = (row: CuentaRow) => {
    setAHincha(null);
    startTransition(async () => {
      const r = await cambiarTipoDeCuenta(row.uid, { rol: "fan" });
      snack({
        message: r.ok ? `@${row.handle} pasó a ser hincha` : r.error,
        variant: r.ok ? "neutral" : "error",
      });
    });
  };

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
      width: "150px",
      // El jugador vinculado va debajo del tipo y no en una columna aparte:
      // sólo lo tienen las filas del plantel, y una columna vacía en casi
      // todas las filas es ancho que le falta a las que importan.
      render: (row: CuentaRow) =>
        row.rol === "admin" ? (
          "Admin"
        ) : row.rol === "player" ? (
          <div className="min-w-0">
            <p>Plantel</p>
            {row.playerId && (
              <p className="truncate text-xs text-muted">
                {nombreDelJugador.get(row.playerId) ?? row.playerId}
              </p>
            )}
          </div>
        ) : (
          "Hincha"
        ),
      sortValue: (row: CuentaRow) => row.rol,
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
                /*  El tipo de cuenta de un admin no se toca desde acá: la
                 *  autoridad es el custom claim de Auth y el rol de Firestore
                 *  sólo lo acompaña. Un botón que cambia uno de los dos deja
                 *  los dos contradiciéndose, así que no está. */
                ...(row.rol === "admin" || row.rol === "club"
                  ? []
                  : [
                      // El separador es su propio ítem y lleva `label: ""`:
                      // `RowMenu` dibuja sólo la línea y descarta el resto del
                      // objeto, así que la acción que vaya junta no se dibuja.
                      { label: "", divider: true },
                      {
                        label:
                          row.rol === "player"
                            ? "Cambiar el jugador vinculado"
                            : "Pasar al plantel…",
                        disabled: pending,
                        onClick: () => abrirVinculo(row),
                      },
                      ...(row.rol === "player"
                        ? [
                            {
                              label: "Pasar a hincha",
                              disabled: pending,
                              onClick: () => setAHincha(row),
                            },
                          ]
                        : []),
                    ]),
              ]}
            />
          )}
        />
      )}

      <VincularDialog
        cuenta={vinculando}
        plantel={plantel}
        playerId={playerId}
        onPlayerId={setPlayerId}
        pending={pending}
        onClose={() => setVinculando(null)}
        onConfirm={(playerId) => vinculando && pasarAlPlantel(vinculando, playerId)}
      />

      {/* Pasar al plantel no pregunta y pasar a hincha sí: lo primero se
          deshace volviendo a elegir, y lo segundo deja el handle del jugador
          en una cuenta que ya no es la suya, que es lo único que no se puede
          arreglar desde esta pantalla. */}
      <ConfirmDialog
        open={aHincha !== null}
        onClose={() => setAHincha(null)}
        onConfirm={() => aHincha && pasarAHincha(aHincha)}
        title="¿Pasar esta cuenta a hincha?"
        confirmLabel="Pasar a hincha"
      >
        <p className="text-sm">
          <strong>@{aHincha?.handle}</strong> deja de estar vinculada al plantel: pierde
          el tilde de verificada y su ficha deja de verse en la historia.
        </p>
        <p className="mt-2 text-sm text-muted">
          {aHincha?.playerId && (
            <>
              <strong>
                {(aHincha.playerId && nombreDelJugador.get(aHincha.playerId)) ??
                  aHincha.playerId}
              </strong>{" "}
              vuelve a estar disponible para que lo reclame quien corresponda.{" "}
            </>
          )}
          La ficha cargada no se borra: si volvés a vincularla, está como estaba.
        </p>
        <p className="mt-2 text-sm text-muted">
          El nombre de usuario <strong>@{aHincha?.handle}</strong> queda en esta cuenta.
          Si es el del jugador, el jugador real va a tener que registrarse con otro.
        </p>
      </ConfirmDialog>
    </div>
  );
}
