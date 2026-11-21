"use client";

import { useState } from "react";
import { Button } from "@/shared/ui/Button";
import type { FilaVisita } from "../server/visitas.repo";
import { formatoCop } from "./armado";
import { descargarInforme, resumenInforme } from "./informe";
import { ListadoVisitas } from "./ListadoVisitas";

/** "Mis visitas" of Mi cuenta (S9 9.4): the inspector's visits and the PDF report of all of them. */
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
          {cantidad} {cantidad === 1 ? "visita" : "visitas"} · Costo directo total: <span className="font-semibold">{formatoCop(total)}</span>
        </p>
        <Button variant="secondary" onClick={descargar} disabled={ocupado || !cantidad}>
          Descargar informe PDF
        </Button>
      </div>
      <p role="alert" className="text-sm font-medium text-danger empty:hidden">
        {error}
      </p>
      <ListadoVisitas filas={filas} mostrarInspector={false} />
    </div>
  );
}
