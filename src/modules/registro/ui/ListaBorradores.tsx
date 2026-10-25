"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Button } from "@/shared/ui/Button";
import { descartarBorrador, listarBorradores, resumenBorrador, sinBorrador, type Borrador } from "./borradores";

const linkBoton = "inline-flex min-h-11 items-center justify-center rounded-lg px-4 text-base font-semibold";

/** Last save as "hoy 10:32" or "25/10/2026 10:32" (es-CO). */
function cuando(iso: string): string {
  if (!iso) return "sin guardar";
  const d = new Date(iso);
  const hora = d.toLocaleTimeString("es-CO", { hour: "2-digit", minute: "2-digit" });
  return d.toDateString() === new Date().toDateString() ? `hoy ${hora}` : `${d.toLocaleDateString("es-CO")} ${hora}`;
}

/** Entry of /registros/nuevo: the drafts in progress on this device (for this user) and a button to start a new one. */
export function ListaBorradores({ uid }: { uid: string }) {
  const router = useRouter();
  const [borradores, setBorradores] = useState<Borrador[] | null>(null);
  const [error, setError] = useState(false);
  const [confirmando, setConfirmando] = useState<string | null>(null);

  useEffect(() => {
    listarBorradores(uid)
      .then(setBorradores)
      .catch(() => (setError(true), setBorradores([])));
  }, [uid]);

  async function descartar(id: string) {
    await descartarBorrador(uid, id).catch(() => undefined);
    setBorradores((l) => (l ? sinBorrador(l, id) : l));
    setConfirmando(null);
  }

  return (
    <div className="max-w-[44rem]">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-2xl font-bold text-primary-strong">Borradores en curso</h2>
        <Button onClick={() => router.push(`/registros/nuevo?borrador=${crypto.randomUUID()}`)}>Nuevo registro</Button>
      </div>

      {error && (
        <p role="alert" className="mb-3 text-sm font-medium text-danger">
          No se pudieron leer los borradores de este equipo.
        </p>
      )}
      {!borradores ? (
        <p role="status">Cargando borradores…</p>
      ) : borradores.length === 0 ? (
        <p className="text-muted">No hay borradores. Inicie un registro nuevo.</p>
      ) : (
        <ul className="divide-y divide-border border-y border-border">
          {borradores.map((b) => {
            const r = resumenBorrador(b);
            return (
              <li key={r.id} className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center sm:justify-between sm:gap-6">
                <div className="min-w-0 sm:flex-1">
                  <p className="font-semibold">{r.nombre}</p>
                  <p className="text-sm text-muted">
                    Paso {r.numeroPaso} de {r.totalPasos}: {r.paso}. Guardado {cuando(r.guardado_en)}
                  </p>
                </div>
                {confirmando === r.id ? (
                  <div role="group" aria-label={`Confirmar descarte de ${r.nombre}`} className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-medium">¿Descartar este borrador?</span>
                    <Button variant="danger" onClick={() => descartar(r.id)}>
                      Sí, descartar
                    </Button>
                    <Button variant="secondary" onClick={() => setConfirmando(null)}>
                      Conservar
                    </Button>
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <Link
                      href={`/registros/nuevo?borrador=${r.id}`}
                      aria-label={`Continuar borrador de ${r.nombre}`}
                      className={`${linkBoton} bg-primary text-on-primary hover:opacity-90`}
                    >
                      Continuar
                    </Link>
                    <Button variant="secondary" aria-label={`Descartar borrador de ${r.nombre}`} onClick={() => setConfirmando(r.id)}>
                      Descartar
                    </Button>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
