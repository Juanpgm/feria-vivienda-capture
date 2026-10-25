import type { ReactNode } from "react";
import type { Item } from "../domain/agregacion";

export const entero = (n: number) => n.toLocaleString("es-CO");
const porcentaje = (n: number, total: number) => (total > 0 ? `${Math.round((n / total) * 100)} %` : "0 %");

/** 'YYYY-MM-DD' as '10 mar' / '10/03/2026' without any timezone shift (the string is already a Bogota calendar day). */
const fmt = (opts: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat("es-CO", { timeZone: "UTC", ...opts });
export const diaCorto = (f: string) => fmt({ day: "numeric", month: "short" }).format(new Date(`${f}T00:00:00Z`)).replace(".", "");
export const diaLargo = (f: string) => fmt({ day: "2-digit", month: "2-digit", year: "numeric" }).format(new Date(`${f}T00:00:00Z`));

export function Seccion({ titulo, nota, className = "", children }: { titulo: string; nota?: string; className?: string; children: ReactNode }) {
  return (
    <section className={`min-w-0 rounded-xl border border-border bg-surface p-4 md:p-6 ${className}`}>
      <h2 className="text-lg font-bold text-primary-strong">{titulo}</h2>
      {nota && <p className="mt-1 text-sm text-muted">{nota}</p>}
      <div className="mt-4">{children}</div>
    </section>
  );
}

/** Horizontal bars. The number and share are always printed; the bar is a visual aid only (aria-hidden). */
export function Barras({ items, colores = {} }: { items: Item[]; colores?: Record<string, string> }) {
  const max = Math.max(1, ...items.map((i) => i.n));
  const total = items.reduce((s, i) => s + i.n, 0);
  return (
    <ul className="flex flex-col gap-3">
      {items.map((i) => (
        <li key={i.clave}>
          <div className="flex items-baseline justify-between gap-3 text-sm">
            <span className="min-w-0">
              {i.etiqueta}
              {i.detalle && <span className="text-muted">, {i.detalle}</span>}
            </span>
            <span className="shrink-0 font-semibold tabular-nums">
              {entero(i.n)} <span className="font-normal text-muted">({porcentaje(i.n, total)})</span>
            </span>
          </div>
          <div aria-hidden className="mt-1 h-2.5 rounded-full bg-border">
            <div
              className={`h-2.5 rounded-full ${i.clave === "otros" || i.clave === "sin_dato" ? "bg-muted opacity-50" : (colores[i.clave] ?? "bg-primary")}`}
              style={{ width: `${(i.n / max) * 100}%` }}
            />
          </div>
        </li>
      ))}
    </ul>
  );
}

const celda = "px-2 py-2";

/** Table equivalent of any chart. `visible=false` keeps it for screen readers only. */
export function TablaDatos({ titulo, columnas, filas, visible = true }: { titulo: string; columnas: string[]; filas: (string | number)[][]; visible?: boolean }) {
  return (
    <div className={visible ? "overflow-x-auto" : "sr-only"}>
      <table className="w-full border-collapse text-left text-sm">
        <caption className="sr-only">{titulo}</caption>
        <thead>
          <tr className="border-b border-border text-muted">
            {columnas.map((c, i) => (
              <th key={c} scope="col" className={`${celda} font-semibold ${i > 0 ? "text-right" : ""}`}>
                {c}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {filas.map((f, i) => (
            <tr key={i} className="border-b border-border">
              {f.map((v, j) => (
                <td key={j} className={`${celda} ${j > 0 ? "text-right tabular-nums" : ""}`}>
                  {typeof v === "number" ? entero(v) : v}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function TablaItems({ titulo, items }: { titulo: string; items: Item[] }) {
  const total = items.reduce((s, i) => s + i.n, 0);
  return (
    <TablaDatos
      titulo={titulo}
      columnas={["Categoría", "Registros", "Porcentaje"]}
      filas={items.map((i) => [i.detalle ? `${i.etiqueta}, ${i.detalle}` : i.etiqueta, i.n, porcentaje(i.n, total)])}
    />
  );
}

/** Daily columns. Too many days to label each one: first/last day and the peak are printed, the table has the rest. */
export function SerieDiaria({ serie, tabla }: { serie: { fecha: string; n: number }[]; tabla: boolean }) {
  const max = Math.max(0, ...serie.map((s) => s.n));
  const pico = serie.find((s) => s.n === max);
  const total = serie.reduce((s, x) => s + x.n, 0);
  const primero = serie[0]?.fecha;
  const ultimo = serie.at(-1)?.fecha;
  const resumen = `Registros por día del ${primero ? diaLargo(primero) : ""} al ${ultimo ? diaLargo(ultimo) : ""}: ${entero(total)} en total${max > 0 && pico ? `, máximo ${entero(max)} el ${diaLargo(pico.fecha)}` : ""}`;
  const datos = (
    <TablaDatos titulo="Registros por día" columnas={["Día", "Registros"]} filas={serie.map((s) => [diaLargo(s.fecha), s.n])} visible={tabla} />
  );
  if (tabla) return <div className="max-h-96 overflow-y-auto">{datos}</div>;
  return (
    <div>
      <p className="mb-2 text-sm">
        <span className="font-semibold tabular-nums">{entero(total)}</span> en el período
        {max > 0 && pico && (
          <>
            , máximo en un día <span className="font-semibold tabular-nums">{entero(max)}</span> ({diaCorto(pico.fecha)})
          </>
        )}
      </p>
      <div role="img" aria-label={resumen}>
        <div className="flex h-36 items-end gap-px border-b border-border" aria-hidden>
          {serie.map((s) => (
            <div key={s.fecha} title={`${diaLargo(s.fecha)}: ${s.n}`} className="flex h-full flex-1 items-end">
              <div className={`w-full rounded-t-sm ${s.n > 0 ? "bg-primary" : "bg-border"}`} style={{ height: s.n > 0 ? `${Math.max(4, (s.n / max) * 100)}%` : "2px" }} />
            </div>
          ))}
        </div>
        <div className="mt-1 flex justify-between text-xs text-muted" aria-hidden>
          <span>{primero && diaCorto(primero)}</span>
          <span>{ultimo && diaCorto(ultimo)}</span>
        </div>
      </div>
      {datos}
    </div>
  );
}
