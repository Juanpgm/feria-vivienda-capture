"use client";

import Link from "next/link";
import { useState } from "react";
import { fechaHoraBogota } from "@/shared/tiempo";
import type { FilaVisita } from "../server/visitas.repo";
import { formatoCop } from "./armado";
import { ETIQUETA_ESTADO, etiquetaCroquis, zonaDe } from "./informe";
import { ModalCroquis } from "./ModalCroquis";

const th = "py-2 pr-4 font-semibold";
// Below md each row becomes a stacked block (labels come from data-label); from md up it is a normal table row.
const td =
  "block py-0.5 md:table-cell md:py-2 md:pr-4 md:align-top [overflow-wrap:anywhere] before:mr-1 before:text-muted before:content-[attr(data-label)] md:before:content-none";

export function BadgeCroquis({ tiene }: { tiene: boolean }) {
  return (
    <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold whitespace-nowrap ${tiene ? "bg-success text-bg" : "border border-border bg-surface text-muted"}`}>
      {etiquetaCroquis(tiene)}
    </span>
  );
}

/** Visits table (S5): the croquis badge flips to "Croquis cargado" as soon as the upload is confirmed. */
export function ListadoVisitas({ filas, mostrarInspector }: { filas: FilaVisita[]; mostrarInspector: boolean }) {
  const [lista, setLista] = useState(filas);
  if (!lista.length) return <p className="text-sm text-muted">Aún no hay levantamientos registrados.</p>;
  const cargado = (id: string) => setLista((l) => l.map((f) => (f.id === id ? { ...f, tiene_croquis: true } : f)));
  return (
    <table className="w-full text-left text-sm">
      <thead className="max-md:sr-only">
        <tr className="border-b border-border">
          <th className={th}>Código</th>
          <th className={th}>Fecha</th>
          <th className={th}>Propietario</th>
          <th className={th}>Dirección / Barrio</th>
          {mostrarInspector && <th className={th}>Inspector</th>}
          <th className={th}>Costo directo</th>
          <th className={th}>Estado</th>
          <th className="py-2 font-semibold">Croquis</th>
        </tr>
      </thead>
      <tbody className="block md:table-row-group">
        {lista.map((f) => (
          <tr key={f.id} className="block border-b border-border py-2 last:border-0 md:table-row md:py-0">
            <td className={`${td} font-semibold`}>
              <Link href={`/mejoramiento/${f.id}`} className="text-primary-strong underline">
                {f.codigo}
              </Link>
              {f.prueba && <span className="ml-1 text-xs text-muted">(prueba)</span>}
            </td>
            <td className={`${td} md:whitespace-nowrap`} data-label="Fecha:">
              {fechaHoraBogota(f.fecha_visita)}
            </td>
            <td className={td} data-label="Propietario:">
              {f.propietario.nombre} <span className="text-muted">· {f.propietario.documento}</span>
            </td>
            <td className={td} data-label="Dirección:">
              {f.direccion} <span className="text-muted">· {zonaDe(f)}</span>
            </td>
            {mostrarInspector && (
              <td className={td} data-label="Inspector:">
                {f.inspector.nombre}
              </td>
            )}
            <td className={`${td} md:whitespace-nowrap`} data-label="Costo directo:">
              {formatoCop(f.costo_directo_total)}
            </td>
            <td className={`${td} md:whitespace-nowrap`} data-label="Estado:">
              {ETIQUETA_ESTADO[f.estado]}
            </td>
            <td className="block pt-2 pb-1 md:table-cell md:py-2 md:align-top">
              <div className="flex flex-wrap items-center gap-2">
                <BadgeCroquis tiene={f.tiene_croquis} />
                {!f.tiene_croquis && f.estado === "registrada" && <ModalCroquis id={f.id} codigo={f.codigo} onListo={() => cargado(f.id)} />}
              </div>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
