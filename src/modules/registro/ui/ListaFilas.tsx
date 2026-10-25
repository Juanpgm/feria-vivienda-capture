import type { Fila } from "./datosResumen";

/** Label/value rows of a section (shared by the form summary and the registro detail). */
export function ListaFilas({ filas }: { filas: Fila[] }) {
  return (
    <dl className="grid gap-x-6 gap-y-1 sm:grid-cols-[13rem_minmax(0,1fr)]">
      {filas.map((f) => (
        <div key={f.etiqueta} className="contents">
          <dt className="text-sm text-muted sm:py-1">{f.etiqueta}</dt>
          <dd className="mb-2 sm:mb-0 sm:py-1">{f.valor}</dd>
        </div>
      ))}
    </dl>
  );
}
