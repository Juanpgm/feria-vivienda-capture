"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import { fechaHoraBogota } from "@/shared/tiempo";
import { Button } from "@/shared/ui/Button";
import { Card } from "@/shared/ui/Card";
import { TextArea } from "@/shared/ui/Field";
import { MOTIVO_MAX } from "../domain/roles";
import { FormCrearUsuario } from "./FormCrearUsuario";
import { post } from "./post";

export type FilaUsuario = {
  uid: string;
  nombre: string;
  correo: string;
  rol: string;
  estado: "pendiente" | "aprobado" | "rechazado";
  rechazado_por_correo?: string | null;
  rechazado_en?: string | null;
  motivo?: string | null;
};

const ROL: Record<string, string> = {
  usuario: "Usuario",
  admin: "Administrador",
  superadmin: "Superadministrador",
};
const th = "py-2 pr-4 font-semibold";
// Below md each row becomes a stacked block (labels come from data-label); from md up it is a normal table row.
const td =
  "block py-0.5 md:table-cell md:py-2 md:pr-4 md:align-top [overflow-wrap:anywhere] before:mr-1 before:text-muted before:content-[attr(data-label)] md:before:content-none";
const tdAccion = "block pt-2 pb-3 md:table-cell md:py-2 md:align-top";
const grupo = "block border-b border-border py-2 last:border-0 md:table-row-group md:py-0";
const fila = "block md:table-row";

type Ejecutar = (accion: "aprobar" | "rechazar", u: FilaUsuario, body?: unknown) => Promise<string | null>;

const Dato = ({ u, rechazado }: { u: FilaUsuario; rechazado?: boolean }) => (
  <>
    <td className={`${td} font-semibold md:font-normal`}>{u.nombre}</td>
    <td className={td} data-label="Correo:">
      {u.correo}
    </td>
    <td className={`${td} md:whitespace-nowrap`} data-label="Rol:">
      {ROL[u.rol]}
    </td>
    {rechazado && (
      <td className={`${td} md:min-w-56`} data-label="Decisión:">
        <p>
          {u.rechazado_por_correo ?? "Sin dato"}
          {u.rechazado_en && <span className="text-muted"> · {fechaHoraBogota(u.rechazado_en)}</span>}
        </p>
        <p className="text-muted">{u.motivo ? `Motivo: ${u.motivo}` : "Sin motivo"}</p>
      </td>
    )}
  </>
);

/** Runs an action and keeps busy/error state; the row disappears on success (the list reloads). */
function useAccion(u: FilaUsuario, ejecutar: Ejecutar) {
  const [ocupado, setOcupado] = useState(false);
  const [error, setError] = useState("");
  async function lanzar(accion: "aprobar" | "rechazar", body?: unknown) {
    setOcupado(true);
    setError("");
    const e = await ejecutar(accion, u, body);
    if (e) {
      setError(e);
      setOcupado(false);
    }
  }
  return { ocupado, error, setError, lanzar };
}

/** "No aprobar" with an in-page confirmation row (no window.confirm) and an optional short reason. */
function FilaPendiente({ u, ejecutar }: { u: FilaUsuario; ejecutar: Ejecutar }) {
  const { ocupado, error, setError, lanzar } = useAccion(u, ejecutar);
  const [confirmando, setConfirmando] = useState(false);
  const [motivo, setMotivo] = useState("");
  const idMotivo = useId();
  const raiz = useRef<HTMLTableSectionElement>(null);

  useEffect(() => {
    if (confirmando) raiz.current?.querySelector("textarea")?.focus();
  }, [confirmando]);

  function cancelar() {
    setConfirmando(false);
    setMotivo("");
    setError("");
    requestAnimationFrame(() => raiz.current?.querySelector<HTMLButtonElement>("[data-no-aprobar]")?.focus());
  }

  return (
    <tbody ref={raiz} className={grupo}>
      <tr className={fila}>
        <Dato u={u} />
        <td className={tdAccion}>
          <div className="flex flex-wrap gap-2 md:flex-nowrap">
            <Button
              className="whitespace-nowrap"
              onClick={() => lanzar("aprobar")}
              disabled={ocupado}
              aria-label={`Aprobar a ${u.nombre}`}
            >
              Aprobar
            </Button>
            <Button
              data-no-aprobar
              variant="secondary"
              className="whitespace-nowrap"
              onClick={() => setConfirmando(true)}
              disabled={ocupado || confirmando}
              aria-label={`No aprobar a ${u.nombre}`}
            >
              No aprobar
            </Button>
          </div>
          {!confirmando && (
            <p role="alert" className="mt-1 text-sm text-danger empty:hidden">
              {error}
            </p>
          )}
        </td>
      </tr>
      {confirmando && (
        <tr className={fila}>
          <td colSpan={4} className="block pb-2 md:table-cell md:pb-4">
            <div
              role="group"
              aria-label={`Confirmar no aprobar a ${u.nombre}`}
              className="rounded-lg border border-border bg-bg p-4"
            >
              <p className="font-semibold">¿No aprobar la cuenta de {u.nombre}?</p>
              <p className="text-sm text-muted">
                La persona no podrá ingresar. Después se puede aprobar desde la sección No aprobados.
              </p>
              <div className="mt-3 flex max-w-xl flex-col gap-1">
                <label htmlFor={idMotivo} className="text-sm font-semibold">
                  Motivo (opcional)
                </label>
                <TextArea
                  id={idMotivo}
                  rows={2}
                  maxLength={MOTIVO_MAX}
                  value={motivo}
                  onChange={(ev) => setMotivo(ev.target.value)}
                  aria-describedby={`${idMotivo}-n`}
                />
                <p id={`${idMotivo}-n`} className="text-sm text-muted">
                  {motivo.length} de {MOTIVO_MAX} caracteres
                </p>
              </div>
              <p role="alert" className="mt-1 text-sm font-medium text-danger empty:hidden">
                {error}
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                <Button
                  variant="danger"
                  disabled={ocupado}
                  onClick={() => lanzar("rechazar", { motivo: motivo.trim() || undefined })}
                  aria-label={`Confirmar no aprobar a ${u.nombre}`}
                >
                  Confirmar
                </Button>
                <Button variant="secondary" onClick={cancelar} disabled={ocupado}>
                  Cancelar
                </Button>
              </div>
            </div>
          </td>
        </tr>
      )}
    </tbody>
  );
}

/** Reconsider: approves a rejected account through the normal approval flow. */
function FilaRechazada({ u, ejecutar }: { u: FilaUsuario; ejecutar: Ejecutar }) {
  const { ocupado, error, lanzar } = useAccion(u, ejecutar);
  return (
    <tbody className={grupo}>
      <tr className={fila}>
        <Dato u={u} rechazado />
        <td className={tdAccion}>
          <Button
            className="whitespace-nowrap"
            onClick={() => lanzar("aprobar")}
            disabled={ocupado}
            aria-label={`Aprobar a ${u.nombre}`}
          >
            Aprobar
          </Button>
          <p role="alert" className="mt-1 text-sm text-danger empty:hidden">
            {error}
          </p>
        </td>
      </tr>
    </tbody>
  );
}

type Tipo = FilaUsuario["estado"];

function Tabla({
  filas,
  vacio,
  tipo,
  ejecutar,
}: {
  filas: FilaUsuario[];
  vacio: string;
  tipo: Tipo;
  ejecutar: Ejecutar;
}) {
  if (!filas.length) return <p className="text-muted">{vacio}</p>;
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-sm">
        <thead className="max-md:sr-only">
          <tr className="border-b border-border">
            <th className={th}>Nombre</th>
            <th className={th}>Correo</th>
            <th className={th}>Rol</th>
            {tipo === "rechazado" && <th className={th}>Decisión</th>}
            {tipo !== "aprobado" && <th className="py-2 font-semibold">Acción</th>}
          </tr>
        </thead>
        {filas.map((u) =>
          tipo === "pendiente" ? (
            <FilaPendiente key={u.uid} u={u} ejecutar={ejecutar} />
          ) : tipo === "rechazado" ? (
            <FilaRechazada key={u.uid} u={u} ejecutar={ejecutar} />
          ) : (
            <tbody key={u.uid} className={grupo}>
              <tr className={fila}>
                <Dato u={u} />
              </tr>
            </tbody>
          ),
        )}
      </table>
    </div>
  );
}

async function pedirUsuarios(): Promise<FilaUsuario[]> {
  const falla = "No se pudieron cargar los usuarios. Revise su conexión e intente de nuevo.";
  const res = await fetch("/api/usuarios").catch(() => null);
  const data = (await res?.json().catch(() => ({}))) as { usuarios?: FilaUsuario[]; error?: string } | undefined;
  if (!res?.ok || !data?.usuarios) throw new Error(data?.error ?? falla);
  return data.usuarios;
}

export function PanelUsuarios({ puedeElegirRol }: { puedeElegirRol: boolean }) {
  const [filas, setFilas] = useState<FilaUsuario[] | null>(null);
  const [errorCarga, setErrorCarga] = useState("");
  const [mensaje, setMensaje] = useState("");
  const estado = useRef<HTMLParagraphElement>(null);

  const cargar = useCallback(
    () =>
      pedirUsuarios().then(
        (u) => {
          setFilas(u);
          setErrorCarga("");
        },
        (e: Error) => setErrorCarga(e.message),
      ),
    [],
  );

  useEffect(() => {
    // Initial load; the state updates happen asynchronously after the fetch resolves.
    cargar();
  }, [cargar]);

  const ejecutar: Ejecutar = async (accion, u, body) => {
    const r = await post(`/api/usuarios/${u.uid}/${accion}`, body);
    if (r.error) return r.error;
    setMensaje(accion === "aprobar" ? `Cuenta de ${u.nombre} aprobada.` : `Cuenta de ${u.nombre} no aprobada.`);
    await cargar();
    estado.current?.focus(); // the row that held focus is gone
    return null;
  };

  const pendientes = filas?.filter((u) => u.estado === "pendiente") ?? [];
  const rechazados = filas?.filter((u) => u.estado === "rechazado") ?? [];
  const aprobados = filas?.filter((u) => u.estado === "aprobado") ?? [];

  return (
    <div className="flex flex-col gap-6">
      <div aria-live="polite">
        <p ref={estado} tabIndex={-1} className="text-sm font-medium text-success empty:hidden">
          {mensaje}
        </p>
      </div>
      {errorCarga && (
        <div role="alert" className="flex flex-wrap items-center gap-3 text-danger">
          <p className="text-sm font-medium">{errorCarga}</p>
          <Button variant="secondary" onClick={() => void cargar()}>
            Reintentar
          </Button>
        </div>
      )}
      {!filas && !errorCarga && <p className="text-muted">Cargando usuarios…</p>}
      {filas && (
        <>
          <Card title="Pendientes de aprobación">
            <Tabla
              tipo="pendiente"
              ejecutar={ejecutar}
              filas={pendientes}
              vacio="No hay cuentas pendientes. Las cuentas nuevas aparecen aquí cuando alguien se registra."
            />
          </Card>
          <details className="rounded-xl border border-border bg-surface p-4 md:p-6">
            <summary className="flex min-h-11 cursor-pointer items-center text-lg font-bold text-primary-strong">
              No aprobados ({rechazados.length})
            </summary>
            <div className="mt-3">
              <Tabla
                tipo="rechazado"
                ejecutar={ejecutar}
                filas={rechazados}
                vacio="No hay cuentas no aprobadas. Cuando se use No aprobar en una cuenta pendiente, aparecerá aquí con la opción de aprobarla."
              />
            </div>
          </details>
          <Card title="Aprobados">
            <Tabla
              tipo="aprobado"
              ejecutar={ejecutar}
              filas={aprobados}
              vacio="Aún no hay usuarios aprobados. Apruebe una cuenta pendiente o cree un usuario abajo."
            />
          </Card>
        </>
      )}
      <Card title="Crear usuario">
        <FormCrearUsuario
          puedeElegirRol={puedeElegirRol}
          onCreado={() => {
            setMensaje("Usuario creado y aprobado.");
            void cargar();
          }}
        />
      </Card>
    </div>
  );
}
