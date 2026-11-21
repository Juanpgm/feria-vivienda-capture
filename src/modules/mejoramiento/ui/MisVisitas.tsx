"use client";

import Link from "next/link";
import { useState } from "react";
import { Button } from "@/shared/ui/Button";
import type { FilaVisita } from "../server/visitas.repo";
import { formatoCop } from "./armado";
import { descargarInforme, resumenInforme } from "./informe";

/**
 * "Mis levantamientos" of Mi cuenta (S9 9.4): summary + PDF report of all of them. The list itself lives in
 * /mejoramiento (not repeated here).
 */
export function MisVisitas({ filas, inspector }: { filas: FilaVisita[]; inspector: { nombre: string; cargo: string | null } }) {
  const [ocupado, setOcupado] = useState(false);
  const [error, setError] = useState("");
  const { cantidad, total } = resumenInforme(filas);

  async function descargar() {
    setOcupado(true);
    setError("");
    try {
      await descargarInforme(inspector, filas);
    } catch {
      setError("No se pudo generar el informe. Intente de nuevo.");
    }
    setOcupado(false);
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm">
          {cantidad} {cantidad === 1 ? "levantamiento" : "levantamientos"} · Costo directo total: <span className="font-semibold">{formatoCop(total)}</span>
        </p>
        <div className="flex flex-wrap gap-2">
          <Link href="/mejoramiento" className="inline-flex min-h-11 items-center rounded-lg border border-border px-4 font-semibold text-primary-strong hover:bg-bg">
            Ver mis levantamientos
          </Link>
          <Button variant="secondary" onClick={descargar} disabled={ocupado || !cantidad}>
            Descargar informe PDF
          </Button>
        </div>
      </div>
      <p role="alert" className="text-sm font-medium text-danger empty:hidden">
        {error}
      </p>
    </div>
  );
}
