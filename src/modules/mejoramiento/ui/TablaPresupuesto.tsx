"use client";

import type { CSSProperties, ReactNode } from "react";
import { IconoCamara, IconoLapiz, IconoMasOpciones } from "@/shared/ui/Iconos";
import type { Apu } from "../domain/apus";
import { formatoCop, valorFila, type Capitulo, type FotosPorFila } from "./armado";

type Props = {
  capitulos: Capitulo[];
  mapa: Map<string, Apu>;
  /** Subtotal per chapter (same order) and the direct cost, from armarPresupuesto. */
  subtotales: number[];
  total: number;
  fotos: FotosPorFila;
  errores: Record<string, string>;
  /** Chapter whose name field takes the focus when it mounts (a chapter just added). */
  enfocar?: string;
  onCambiar: (i: number, c: Capitulo) => void;
  onQuitarCapitulo: (i: number) => void;
  onEditar: (filaId: string) => void;
  /** "Agregar actividad" of a chapter (SelectorApu). */
  agregar: (c: Capitulo, i: number) => ReactNode;
  /** Edit button of each row, to give the focus back when the row editor closes. */
  refFila: (filaId: string, el: HTMLButtonElement | null) => void;
};

// Phones: the table scrolls sideways inside its container; ÍTEM stays put and full-width rows keep their content in view.
const pegado = "sticky left-0 z-[1]";
const enVista = `${pegado} max-w-[calc(100vw-1.5rem)] md:static md:max-w-none`;
const celda = "border-b border-border px-2 py-2 align-top";
const num = `${celda} text-right tabular-nums whitespace-nowrap`;

/** "Cantidades de obra" as the budget sheet (PRESUPUESTO TOPOP): ÍTEM | ACTIVIDAD | UND | CANTIDAD | PRECIO UNITARIO DIRECTO | PRECIO TOTAL. */
export function TablaPresupuesto({ capitulos, mapa, subtotales, total, fotos, errores, enfocar, onCambiar, onQuitarCapitulo, onEditar, agregar, refFila }: Props) {
  // max-w in vw: a definite cap keeps the wide table from widening the page through ancestors sized by content;
  // relative: sr-only (absolute) labels inside the table must not escape the scroller.
  return (
    <div className="relative -mx-4 max-w-[100vw] overflow-x-auto border-y border-border md:mx-0 md:max-w-none md:rounded-lg md:border-x">
      <table className="w-full min-w-[34rem] border-collapse text-sm">
        <caption className="sr-only">Presupuesto de la visita: cantidades de obra por capítulo</caption>
        <thead>
          <tr className="bg-primary-strong text-left text-xs font-bold uppercase text-bg">
            <th scope="col" className={`${pegado} bg-primary-strong px-2 py-2`}>Ítem</th>
            <th scope="col" className="px-2 py-2">Actividad</th>
            <th scope="col" className="hidden px-2 py-2 sm:table-cell">Und</th>
            <th scope="col" className="px-2 py-2 text-right">Cantidad</th>
            <th scope="col" className="px-2 py-2 text-right">
              <span aria-hidden className="sm:hidden">P. unit.</span>
              <span className="sr-only sm:not-sr-only">Precio unitario directo</span>
            </th>
            <th scope="col" className="px-2 py-2 text-right">Precio total</th>
          </tr>
        </thead>
        {capitulos.map((c, i) => (
          <tbody key={c.id}>
            <FilaCapitulo
              c={c}
              i={i}
              error={errores[`capitulos.${i}.nombre`]}
              enfocar={enfocar === c.id}
              onCambiar={(nuevo) => onCambiar(i, nuevo)}
              onQuitar={() => onQuitarCapitulo(i)}
              agregar={agregar(c, i)}
              nFotos={c.filas.reduce((s, f) => s + (fotos[f.id]?.length ?? 0), 0)}
            />
            {c.filas.length === 0 && (
              <tr>
                <td colSpan={6} className={`${celda} text-muted`}>
                  <span className={`${enVista} block`}>Sin actividades. Use «Agregar actividad».</span>
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
                  className="group cursor-pointer hover:bg-surface"
                  onClick={(e) => !(e.target as HTMLElement).closest("input, button, label, a") && onEditar(f.id)}
                >
                  <th scope="row" className={`${pegado} border-b border-border bg-bg align-top text-left font-semibold group-hover:bg-surface`}>
                    <button
                      ref={(el) => refFila(f.id, el)}
                      type="button"
                      aria-label={`Editar ${f.item} ${apu?.descripcion ?? ""}`.trim()}
                      onClick={() => onEditar(f.id)}
                      className="flex min-h-11 w-full items-center gap-1.5 whitespace-nowrap px-2 py-2 text-left text-primary underline-offset-2 hover:underline"
                    >
                      {f.item}
                      <IconoLapiz className="size-3.5 opacity-70" />
                    </button>
                  </th>
                  <td className={`${celda} min-w-40 break-words`}>
                    {apu ? apu.descripcion : <span className="font-semibold text-danger">No está en el listado de precios</span>}
                    <span className="mt-0.5 flex flex-wrap items-center gap-x-3 text-xs text-muted">
                      {apu && <span className="sm:hidden">{apu.und}</span>}
                      {n > 0 && (
                        <span className="inline-flex items-center gap-1">
                          <IconoCamara className="size-4" />
                          {n}<span className="sr-only"> {n === 1 ? "foto" : "fotos"}</span>
                        </span>
                      )}
                    </span>
                  </td>
                  <td className={`${celda} hidden sm:table-cell`}>{apu?.und}</td>
                  <td className={`${celda} w-32 text-right md:w-44`}>
                    <input
                      className="min-h-11 w-28 rounded-md border border-border bg-bg px-2 text-right text-base tabular-nums md:w-40 aria-[invalid=true]:border-danger"
                      inputMode="decimal"
                      autoComplete="off"
                      aria-label={`Cantidad de ${f.item}`}
                      aria-invalid={mensaje ? true : undefined}
                      aria-describedby={mensaje ? `cantidad-${f.id}` : undefined}
                      value={f.cantidad_expr}
                      onChange={(e) => onCambiar(i, { ...c, filas: c.filas.map((x) => (x.id === f.id ? { ...x, cantidad_expr: e.target.value } : x)) })}
                    />
                    {mensaje ? (
                      <p id={`cantidad-${f.id}`} role="alert" className="mt-0.5 max-w-28 text-left text-xs font-medium text-danger">{mensaje}</p>
                    ) : (
                      v.cantidad !== null && f.cantidad_expr.trim() !== String(v.cantidad).replace(".", ",") && (
                        <p className="mt-0.5 text-xs text-muted tabular-nums">= {v.cantidad.toLocaleString("es-CO")}</p>
                      )
                    )}
                  </td>
                  <td className={num}>{apu && formatoCop(apu.costo_unitario)}</td>
                  <td className={`${num} font-semibold`}>{v.total !== null && formatoCop(v.total)}</td>
                </tr>
              );
            })}
            <tr className="bg-surface font-semibold">
              <td colSpan={6} className="border-b border-border">
                <div className={`${enVista} flex items-center justify-between gap-3 bg-surface px-2 py-2`}>
                  <span className="[overflow-wrap:anywhere]">Subtotal {c.nombre.trim() || `capítulo ${i + 1}`}</span>
                  <span className="whitespace-nowrap tabular-nums">{formatoCop(subtotales[i] ?? 0)}</span>
                </div>
              </td>
            </tr>
          </tbody>
        ))}
        <tfoot>
          <tr className="bg-primary-strong font-bold text-bg">
            <td colSpan={6} className="p-0">
              <div className={`${enVista} flex items-center justify-between gap-3 bg-primary-strong px-2 py-3`}>
                <span className="text-xs uppercase sm:text-sm">Costo directo del mejoramiento de vivienda</span>
                <span className="whitespace-nowrap text-base tabular-nums">{formatoCop(total)}</span>
              </div>
            </td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}

function FilaCapitulo({ c, i, error, enfocar, onCambiar, onQuitar, agregar, nFotos }: {
  c: Capitulo; i: number; error?: string; enfocar: boolean; onCambiar: (c: Capitulo) => void; onQuitar: () => void; agregar: ReactNode; nFotos: number;
}) {
  const menu = `menu-capitulo-${c.id}`;
  const campo = `nombre-capitulo-${c.id}`;
  const nombre = c.nombre.trim() || `capítulo ${i + 1}`;
  const cerrarMenu = () => document.getElementById(menu)?.hidePopover();
  return (
    <tr className="bg-surface">
      <th scope="rowgroup" colSpan={6} className="border-b border-border p-0 text-left font-normal">
        <div className={`${enVista} flex flex-col gap-1 bg-surface px-2 py-2`}>
          <div className="flex flex-wrap items-center gap-2">
            <input
              id={campo}
              className="min-h-11 min-w-24 flex-1 rounded-md border border-transparent bg-transparent px-2 text-base font-bold uppercase text-primary-strong placeholder:font-normal placeholder:normal-case placeholder:text-muted hover:border-border focus:border-border focus:bg-bg aria-[invalid=true]:border-danger"
              list="capitulos-sugeridos"
              aria-label={`Nombre del capítulo ${i + 1}`}
              placeholder="Nombre del capítulo"
              autoFocus={enfocar}
              value={c.nombre}
              aria-invalid={error ? true : undefined}
              onChange={(e) => onCambiar({ ...c, nombre: e.target.value })}
            />
            {agregar}
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
              <button
                type="button"
                className="flex min-h-11 w-full items-center rounded-md px-3 text-left font-semibold text-danger hover:bg-surface"
                onClick={() => {
                  cerrarMenu();
                  const detalle = c.filas.length ? ` con ${c.filas.length} ${c.filas.length === 1 ? "actividad" : "actividades"}${nFotos ? ` y ${nFotos} fotos` : ""}` : "";
                  if (window.confirm(`¿Quitar el capítulo ${nombre}${detalle}?`)) onQuitar();
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
