"use client";

import type { CSSProperties } from "react";
import { IconoCamara, IconoLapiz, IconoMasOpciones } from "@/shared/ui/Iconos";
import type { Apu } from "../domain/apus";
import { formatoCop, valorFila, type Capitulo, type FotosPorFila } from "./armado";
import { esCategoria, fueraDeAplica } from "./capitulosAuto";

type Props = {
  capitulos: Capitulo[];
  mapa: Map<string, Apu>;
  /** Subtotal per chapter (same order) and the direct cost, from armarPresupuesto. */
  subtotales: number[];
  total: number;
  fotos: FotosPorFila;
  errores: Record<string, string>;
  /** diagnostico.aplica_para: flags category chapters kept for their rows after leaving "Sí, para". */
  aplicaPara: string[];
  onCambiar: (i: number, c: Capitulo) => void;
  onQuitarCapitulo: (i: number) => void;
  onEditar: (filaId: string) => void;
  /** Edit button of each row, to give the focus back when the row editor closes. */
  refFila: (filaId: string, el: HTMLButtonElement | null) => void;
};

// One markup, two layouts. From md up: the budget sheet as a table. Below md each activity is a compact card
// (item and total, description, unit price and quantity) and chapters/subtotals are full-width bands, so nothing
// scrolls sideways. Changing `display` on table elements can drop their table semantics, hence the explicit roles.
const fila = "max-md:block";
const celda = "max-md:block md:border-b md:border-border md:px-3 md:py-2.5 md:align-top";
const num = `${celda} md:text-right md:tabular-nums md:whitespace-nowrap`;

/** "Cantidades de obra" as the budget sheet (PRESUPUESTO TOPOP): ÍTEM | ACTIVIDAD | UND | CANTIDAD | PRECIO UNITARIO | PRECIO TOTAL. */
export function TablaPresupuesto({ capitulos, mapa, subtotales, total, fotos, errores, aplicaPara, onCambiar, onQuitarCapitulo, onEditar, refFila }: Props) {
  return (
    <div className="-mx-4 border-y border-border md:mx-0 md:overflow-hidden md:rounded-lg md:border-x">
      <table role="table" className="w-full border-collapse text-sm max-md:block">
        <caption className="sr-only">Presupuesto de la visita: cantidades de obra por capítulo</caption>
        <thead role="rowgroup" className="max-md:hidden">
          <tr role="row" className="bg-primary-strong text-left text-xs font-bold uppercase tracking-wide text-bg">
            <th role="columnheader" scope="col" className="px-3 py-2.5">Ítem</th>
            <th role="columnheader" scope="col" className="px-3 py-2.5">Actividad</th>
            <th role="columnheader" scope="col" className="px-3 py-2.5">Und</th>
            <th role="columnheader" scope="col" className="px-3 py-2.5 text-right">Cantidad</th>
            <th role="columnheader" scope="col" className="px-3 py-2.5 text-right">Precio unitario</th>
            <th role="columnheader" scope="col" className="px-3 py-2.5 text-right">Precio total</th>
          </tr>
        </thead>
        {capitulos.map((c, i) => (
          <tbody key={c.id} role="rowgroup" className="max-md:block">
            <FilaCapitulo
              c={c}
              i={i}
              error={errores[`capitulos.${i}.nombre`]}
              fuera={fueraDeAplica(c, aplicaPara)}
              onCambiar={(nuevo) => onCambiar(i, nuevo)}
              onQuitar={() => onQuitarCapitulo(i)}
              nFotos={c.filas.reduce((s, f) => s + (fotos[f.id]?.length ?? 0), 0)}
            />
            {c.filas.length === 0 && (
              <tr role="row" className={fila}>
                <td role="cell" colSpan={6} className={`${celda} text-muted max-md:border-b max-md:border-border max-md:px-4 max-md:py-3`}>
                  Sin actividades
                </td>
              </tr>
            )}
            {c.filas.map((f, j) => {
              const apu = mapa.get(f.item);
              const v = valorFila(f.cantidad_expr, apu);
              const mensaje = errores[`capitulos.${i}.filas.${j}.cantidad_expr`] || v.error;
              const n = fotos[f.id]?.length ?? 0;
              return (
                <tr
                  key={f.id}
                  role="row"
                  className="group cursor-pointer hover:bg-surface max-md:grid max-md:grid-cols-[minmax(0,1fr)_auto] max-md:items-center max-md:gap-x-4 max-md:gap-y-1 max-md:border-b max-md:border-border max-md:px-4 max-md:py-3 max-md:[grid-template-areas:'item_total'_'desc_desc'_'pu_qty']"
                  onClick={(e) => !(e.target as HTMLElement).closest("input, button, label, a") && onEditar(f.id)}
                >
                  <th role="rowheader" scope="row" className={`${celda} text-left font-semibold [grid-area:item]`}>
                    <button
                      ref={(el) => refFila(f.id, el)}
                      type="button"
                      aria-label={`Editar ${f.item} ${apu?.descripcion ?? ""}`.trim()}
                      onClick={() => onEditar(f.id)}
                      className="inline-flex min-h-8 items-center gap-1.5 whitespace-nowrap text-left text-primary underline-offset-2 hover:underline md:min-h-11"
                    >
                      {f.item}
                      <IconoLapiz className="size-3.5 opacity-70" />
                    </button>
                  </th>
                  <td role="cell" className={`${celda} break-words [grid-area:desc] md:min-w-48`}>
                    {apu ? apu.descripcion : <span className="font-semibold text-danger">No está en el listado de precios</span>}
                    {n > 0 && (
                      <span className="mt-0.5 flex items-center gap-1 text-xs text-muted">
                        <IconoCamara className="size-4" />
                        {n}<span className="sr-only"> {n === 1 ? "foto" : "fotos"}</span>
                      </span>
                    )}
                  </td>
                  <td role="cell" className={`${celda} max-md:hidden`}>{apu?.und}</td>
                  <td role="cell" className={`${celda} [grid-area:qty] max-md:justify-self-end md:w-44 md:text-right`}>
                    <input
                      className="min-h-11 w-32 rounded-md border border-border bg-bg px-2 text-right text-base tabular-nums md:w-40 aria-[invalid=true]:border-danger"
                      inputMode="decimal"
                      autoComplete="off"
                      aria-label={`Cantidad de ${f.item}`}
                      aria-invalid={mensaje ? true : undefined}
                      aria-describedby={mensaje ? `cantidad-${f.id}` : undefined}
                      value={f.cantidad_expr}
                      onChange={(e) => onCambiar(i, { ...c, filas: c.filas.map((x) => (x.id === f.id ? { ...x, cantidad_expr: e.target.value } : x)) })}
                    />
                    {mensaje ? (
                      <p id={`cantidad-${f.id}`} role="alert" className="mt-0.5 max-w-32 text-left text-xs font-medium text-danger md:max-w-40">{mensaje}</p>
                    ) : (
                      v.cantidad !== null && f.cantidad_expr.trim() !== String(v.cantidad).replace(".", ",") && (
                        <p className="mt-0.5 text-right text-xs text-muted tabular-nums">= {v.cantidad.toLocaleString("es-CO")}</p>
                      )
                    )}
                  </td>
                  <td role="cell" className={`${num} [grid-area:pu] max-md:text-xs max-md:text-muted`}>
                    {apu && (
                      <>
                        {formatoCop(apu.costo_unitario)}
                        <span className="md:hidden"> / {apu.und}</span>
                      </>
                    )}
                  </td>
                  <td role="cell" className={`${num} font-semibold tabular-nums [grid-area:total] max-md:text-right`}>
                    {v.total !== null ? formatoCop(v.total) : <span className="font-normal text-muted md:hidden">Sin cantidad</span>}
                  </td>
                </tr>
              );
            })}
            <tr role="row" className={`${fila} bg-surface font-semibold`}>
              <td role="cell" colSpan={6} className="border-b border-border px-4 py-2.5 max-md:block md:px-3">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-muted [overflow-wrap:anywhere]">Subtotal {c.nombre.trim() || `capítulo ${i + 1}`}</span>
                  <span className="whitespace-nowrap tabular-nums">{formatoCop(subtotales[i] ?? 0)}</span>
                </div>
              </td>
            </tr>
          </tbody>
        ))}
        <tfoot role="rowgroup" className="max-md:block">
          <tr role="row" className={`${fila} bg-primary-strong font-bold text-bg`}>
            <td role="cell" colSpan={6} className="px-4 py-3 max-md:block md:px-3">
              <div className="flex items-center justify-between gap-3">
                <span className="text-xs uppercase tracking-wide sm:text-sm">Costo directo del mejoramiento de vivienda</span>
                <span className="whitespace-nowrap text-base tabular-nums">{formatoCop(total)}</span>
              </div>
            </td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}

function FilaCapitulo({ c, i, error, fuera, onCambiar, onQuitar, nFotos }: {
  c: Capitulo; i: number; error?: string; fuera: boolean; onCambiar: (c: Capitulo) => void; onQuitar: () => void; nFotos: number;
}) {
  const menu = `menu-capitulo-${c.id}`;
  const campo = `nombre-capitulo-${c.id}`;
  const nombre = c.nombre.trim() || `capítulo ${i + 1}`;
  const categoria = esCategoria(c);
  const cerrarMenu = () => document.getElementById(menu)?.hidePopover();
  function quitar() {
    const detalle = c.filas.length ? ` con ${c.filas.length} ${c.filas.length === 1 ? "actividad" : "actividades"}${nFotos ? ` y ${nFotos} fotos` : ""}` : "";
    const aviso = categoria && !fuera ? " También se desmarca en «Sí, para»." : "";
    if (!c.filas.length || window.confirm(`¿Quitar el capítulo ${nombre}${detalle}?${aviso}`)) onQuitar();
  }
  return (
    <tr role="row" className="bg-surface max-md:block">
      <th role="rowheader" scope="rowgroup" colSpan={6} className="border-b border-border p-0 text-left font-normal max-md:block">
        <div className="flex flex-col gap-1 py-2 pl-2 pr-4 md:px-1">
          <div className="flex flex-wrap items-center gap-2">
            {categoria ? (
              <span className="min-w-24 flex-1 px-2 text-base font-bold text-primary-strong">{c.nombre}</span>
            ) : (
              // Extra chapters keep an inline name field ("Cambiar nombre" focuses it).
              <input
                id={campo}
                className="min-h-11 min-w-24 flex-1 rounded-md border border-transparent bg-transparent px-2 text-base font-bold uppercase text-primary-strong placeholder:font-normal placeholder:normal-case placeholder:text-muted hover:border-border focus:border-border focus:bg-bg aria-[invalid=true]:border-danger"
                aria-label={`Nombre del capítulo ${i + 1}`}
                placeholder="Nombre del capítulo"
                value={c.nombre}
                aria-invalid={error ? true : undefined}
                onChange={(e) => onCambiar({ ...c, nombre: e.target.value })}
              />
            )}
            {fuera && (
              <>
                <span className="rounded-full bg-warning-bg px-2 py-1 text-xs font-semibold text-warning-text">No está en «Sí, para»</span>
                <button type="button" onClick={quitar} className="min-h-11 rounded-lg border border-border bg-bg px-3 text-sm font-semibold text-danger hover:bg-surface">
                  Quitar
                </button>
              </>
            )}
            <button
              type="button"
              popoverTarget={menu}
              aria-label={`Opciones del capítulo ${nombre}`}
              style={{ anchorName: `--${menu}` } as CSSProperties}
              className="grid size-11 shrink-0 place-items-center rounded-lg border border-border bg-bg text-text hover:bg-surface"
            >
              <IconoMasOpciones className="size-4" />
            </button>
            <div
              id={menu}
              popover="auto"
              style={{ positionAnchor: `--${menu}` } as CSSProperties}
              className="min-w-48 rounded-lg border border-border bg-bg p-1 text-text shadow-lg [position-area:bottom_span-left] supports-[position-area:bottom]:m-0 supports-[position-area:bottom]:mt-1"
            >
              {!categoria && (
                <button
                  type="button"
                  className="flex min-h-11 w-full items-center rounded-md px-3 text-left hover:bg-surface"
                  onClick={() => {
                    cerrarMenu();
                    const el = document.getElementById(campo) as HTMLInputElement | null;
                    el?.focus();
                    el?.select();
                  }}
                >
                  Cambiar nombre
                </button>
              )}
              <button
                type="button"
                className="flex min-h-11 w-full items-center rounded-md px-3 text-left font-semibold text-danger hover:bg-surface"
                onClick={() => {
                  cerrarMenu();
                  quitar();
                }}
              >
                Quitar capítulo
              </button>
            </div>
          </div>
          {error && <p role="alert" className="px-2 text-sm font-medium text-danger">{error}</p>}
        </div>
      </th>
    </tr>
  );
}
