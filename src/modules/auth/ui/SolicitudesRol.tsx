"use client";

import { useCallback, useEffect, useState } from "react";
import { Button } from "@/shared/ui/Button";
import { Card } from "@/shared/ui/Card";
import { ETIQUETA_ROL, type Rol } from "../domain/roles";
import { post } from "./post";

type Solicitud = { uid: string; nombre: string; correo: string; rol_actual: Rol; rol_solicitado: Rol; motivo: string };

async function pedirSolicitudes(): Promise<Solicitud[]> {
  const res = await fetch("/api/usuarios/solicitudes").catch(() => null);
  const data = (await res?.json().catch(() => null)) as { solicitudes?: Solicitud[]; error?: string } | null;
  if (!res?.ok || !data?.solicitudes) throw new Error(data?.error ?? "No se pudieron cargar las solicitudes de cambio de rol.");
  return data.solicitudes;
}

/** Pending "Solicitar cambio de rol" requests from Mi cuenta. Approving changes the role and closes that session. */
export function SolicitudesRol({ onResuelta }: { onResuelta: (mensaje: string) => void }) {
  const [lista, setLista] = useState<Solicitud[] | null>(null);
  const [error, setError] = useState("");
  const [ocupado, setOcupado] = useState<string | null>(null);

  const cargar = useCallback(
    () =>
      pedirSolicitudes().then(
        (l) => {
          setLista(l);
          setError("");
        },
        (e: Error) => setError(e.message),
      ),
    [],
  );

  useEffect(() => {
    // Initial load; state updates happen after the fetch resolves.
    void cargar();
  }, [cargar]);

  async function resolver(s: Solicitud, aprobar: boolean) {
    setOcupado(s.uid);
    const r = await post(`/api/usuarios/solicitudes/${s.uid}`, { aprobar });
    setOcupado(null);
    if (r.error) return setError(r.error);
    onResuelta(
      aprobar
        ? `${s.nombre} ahora es ${ETIQUETA_ROL[s.rol_solicitado]}. Su sesión se cerró y verá el nuevo rol al volver a ingresar.`
        : `Solicitud de ${s.nombre} rechazada.`,
    );
    await cargar();
  }

  if (!lista?.length && !error) return null;
  return (
    <Card title={`Solicitudes de cambio de rol (${lista?.length ?? 0})`}>
      <p role="alert" className="mb-2 text-sm font-medium text-danger empty:hidden">
        {error}
      </p>
      <ul className="flex flex-col divide-y divide-border">
        {lista?.map((s) => (
          <li key={s.uid} className="flex flex-col gap-2 py-3 md:flex-row md:items-center md:justify-between">
            <div className="text-sm [overflow-wrap:anywhere]">
              <p className="font-semibold">
                {s.nombre} <span className="font-normal text-muted">· {s.correo}</span>
              </p>
              <p>
                {ETIQUETA_ROL[s.rol_actual]} → <span className="font-semibold">{ETIQUETA_ROL[s.rol_solicitado]}</span>
              </p>
              <p className="text-muted">Motivo: {s.motivo}</p>
            </div>
            <div className="flex shrink-0 gap-2">
              <Button onClick={() => resolver(s, true)} disabled={ocupado === s.uid} aria-label={`Aprobar solicitud de ${s.nombre}`}>
                Aprobar
              </Button>
              <Button variant="secondary" onClick={() => resolver(s, false)} disabled={ocupado === s.uid} aria-label={`Rechazar solicitud de ${s.nombre}`}>
                Rechazar
              </Button>
            </div>
          </li>
        ))}
      </ul>
    </Card>
  );
}
