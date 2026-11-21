"use client";

import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { Button } from "@/shared/ui/Button";
import { controlClass } from "@/shared/ui/Field";
import { IconoCerrar, IconoChevronAbajo, IconoFlechaIzquierda, IconoMas } from "@/shared/ui/Iconos";
import type { Apu } from "../domain/apus";
import type { ClaveAplica } from "../domain/catalogos";
import { dimensionesDe, expresionMedidas, type Medida } from "../domain/medidas";
import { buscarEnArbol, rutaApu, type CapituloApu } from "./arbolApus";
import { formatoCop, valorFila, type Capitulo, type OpcionApu } from "./armado";
import { capituloPorDefecto, nombreCategoria } from "./capitulosAuto";
import { Calculadora } from "./EditorFila";

// Last budget chapter an activity went to, kept while the page is open (default chip fallback).
let ultimo: string | undefined;

// Phones get the title focused instead of the search field, so the keyboard does not cover the list.
const conTeclado = () => typeof window !== "undefined" && window.matchMedia("(pointer: fine)").matches;

const filaItem = "flex min-h-12 w-full flex-col gap-1 border-b border-border px-4 py-3 text-left hover:bg-surface";
const resumen = "flex min-h-12 cursor-pointer list-none items-center gap-3 border-b border-border px-4 py-3 hover:bg-surface [&::-webkit-details-marker]:hidden";

type Props = {
  arbol: CapituloApu[];
  opciones: OpcionApu[];
  frecuentes: Apu[];
  capitulos: Capitulo[];
  /** Categories of "Sí, para" without a chapter yet, offered by "Otro capítulo…". */
  faltantes: ClaveAplica[];
  onAgregar: (capituloId: string, item: string, cantidadExpr: string) => void;
  /** Create a chapter; each returns the id of the chapter to select. */
  onCategoria: (k: ClaveAplica) => string;
  onNombre: (nombre: string) => string;
  onCerrar: () => void;
};

/**
 * "Agregar actividad": native modal (full screen below sm). Step 1 "Elegir" searches the whole LISTADO DE PRECIOS or
 * browses it as an accordion (chapter > subchapter > items); step 2 "Cantidad" takes the quantity (with the measurement
 * calculator) and the target budget chapter. Mounted while open; closing calls `onCerrar`.
 */
export function AgregarActividad({ arbol, opciones, frecuentes, capitulos, faltantes, onAgregar, onCategoria, onNombre, onCerrar }: Props) {
  const dialogo = useRef<HTMLDialogElement>(null);
  const titulo = useRef<HTMLHeadingElement>(null);
  const busqueda = useRef<HTMLInputElement>(null);
  const titulo2 = useRef<HTMLHeadingElement>(null);
  const cantidad = useRef<HTMLInputElement>(null);
  const id = useId();
  const [q, setQ] = useState("");
  const [apu, setApu] = useState<Apu | null>(null);
  const [expr, setExpr] = useState("");
  const [medidas, setMedidas] = useState<Medida[]>([{}]);
  const [destino, setDestino] = useState<string>();
  const [otro, setOtro] = useState(false);
  const [estado, setEstado] = useState("");

  const enfocarLista = () => (conTeclado() ? busqueda : titulo).current?.focus();
  useEffect(() => {
    dialogo.current?.showModal();
    enfocarLista();
  }, []);

  function elegir(a: Apu) {
    setApu(a);
    setExpr("");
    setMedidas([{}]);
    setOtro(false);
    setDestino(capituloPorDefecto(a, capitulos, ultimo));
    requestAnimationFrame(() => (conTeclado() ? cantidad : titulo2).current?.focus());
  }
  function volver() {
    setApu(null);
    requestAnimationFrame(enfocarLista);
  }
  function agregar(seguir: boolean) {
    const c = capitulos.find((x) => x.id === destino);
    if (!apu || !c) return;
    onAgregar(c.id, apu.item, expr.trim());
    ultimo = c.id;
    if (!seguir) return dialogo.current?.close();
    setEstado(`Agregada ${apu.item} a ${c.nombre}`);
    volver();
  }

  const buscando = q.trim().length >= 2;
  const v = valorFila(expr, apu ?? undefined);
  const dims = dimensionesDe(apu?.und);

  return (
    <dialog
      ref={dialogo}
      aria-labelledby={`${id}-t`}
      onCancel={(e) => {
        // Escape on step 2 goes back to the list instead of closing.
        if (apu) {
          e.preventDefault();
          volver();
        }
      }}
      onClose={(e) => e.target === e.currentTarget && onCerrar()}
      className="m-0 h-dvh max-h-none w-full max-w-none flex-col bg-bg p-0 text-text backdrop:bg-black/50 open:flex sm:m-auto sm:h-[min(52rem,calc(100dvh-4rem))] sm:w-[min(52rem,calc(100%-2rem))] sm:rounded-xl sm:border sm:border-border"
    >
      <h2 id={`${id}-t`} className="sr-only">Agregar actividad</h2>
      <p role="status" aria-live="polite" className={estado ? "border-b border-border bg-surface px-4 py-2 text-sm font-semibold text-success" : "sr-only"}>{estado}</p>

      {/* Step 1 stays mounted while step 2 shows, so search text, open chapters and scroll survive the way back. */}
      <section hidden={!!apu} aria-labelledby={`${id}-1`} className="flex min-h-0 flex-1 flex-col">
        <header className="sticky top-0 flex flex-col gap-2 border-b border-border bg-bg p-3">
          <div className="flex items-center gap-2">
            <h3 id={`${id}-1`} ref={titulo} tabIndex={-1} className="min-w-0 flex-1 text-lg font-bold text-primary-strong outline-none">
              Elegir actividad
            </h3>
            <BotonCerrar onClick={() => dialogo.current?.close()} />
          </div>
          <label className="flex flex-col gap-1">
            <span className="sr-only">Buscar en el listado de precios</span>
            <input
              ref={busqueda}
              type="search"
              inputMode="search"
              enterKeyHint="search"
              className={controlClass}
              value={q}
              placeholder="Buscar por ITEM o descripción"
              onChange={(e) => setQ(e.target.value)}
            />
          </label>
        </header>
        <div className="min-h-0 flex-1 overflow-y-auto">
          {buscando ? (
            <Items apus={buscarEnArbol(opciones, q)} conRuta onElegir={elegir} vacio="Sin resultados. Pruebe con otra palabra o con el código ITEM." />
          ) : (
            <>
              {frecuentes.length > 0 && (
                <section aria-labelledby={`${id}-f`}>
                  <h4 id={`${id}-f`} className="bg-surface px-4 py-2 text-sm font-bold">Frecuentes</h4>
                  <Items apus={frecuentes} conRuta onElegir={elegir} vacio="" />
                </section>
              )}
              <h4 className="bg-surface px-4 py-2 text-sm font-bold">Listado de precios</h4>
              {arbol.map((c) => (
                <Pliegue key={c.codigo} titulo={<><span className="font-semibold">{c.codigo}</span>{c.nombre !== c.codigo && ` ${c.nombre}`}</>} n={c.cantidad}>
                  {c.subcapitulos.length === 1 ? (
                    <Items apus={c.subcapitulos[0].items} onElegir={elegir} vacio="" />
                  ) : (
                    c.subcapitulos.map((s) => (
                      <Pliegue key={s.codigo} sub titulo={<><span className="font-semibold">{s.codigo}</span> {s.nombre}</>} n={s.cantidad}>
                        <Items apus={s.items} onElegir={elegir} vacio="" />
                      </Pliegue>
                    ))
                  )}
                </Pliegue>
              ))}
            </>
          )}
        </div>
      </section>

      {apu && (
        <section aria-labelledby={`${id}-2`} className="flex min-h-0 flex-1 flex-col">
          <header className="flex items-center gap-2 border-b border-border p-3">
            <button type="button" aria-label="Volver a la lista" onClick={volver} className="grid size-12 shrink-0 place-items-center rounded-lg border border-border hover:bg-surface">
              <IconoFlechaIzquierda className="size-5" />
            </button>
            <h3 id={`${id}-2`} ref={titulo2} tabIndex={-1} className="min-w-0 flex-1 text-lg font-bold text-primary-strong outline-none">
              Cantidad
            </h3>
            <BotonCerrar onClick={() => dialogo.current?.close()} />
          </header>
          <div className="flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto p-4">
            <div className="flex flex-col gap-2">
              <p className="[overflow-wrap:anywhere]"><span className="font-bold">{apu.item}</span> {apu.descripcion}</p>
              <p className="text-xs text-muted [overflow-wrap:anywhere]">{rutaApu(apu)}</p>
              <dl className="grid grid-cols-3 gap-2 rounded-lg bg-surface p-3 text-sm">
                <div><dt className="text-muted">UND</dt><dd className="font-semibold">{apu.und}</dd></div>
                <div className="text-right"><dt className="text-muted">Precio unitario</dt><dd className="font-semibold tabular-nums">{formatoCop(apu.costo_unitario)}</dd></div>
                <div className="text-right"><dt className="text-muted">Precio total</dt><dd className="font-bold tabular-nums text-primary-strong">{v.total !== null && formatoCop(v.total)}</dd></div>
              </dl>
            </div>

            <div className="flex flex-col gap-1">
              <label className="flex flex-col gap-1">
                <span className="font-semibold">Cantidad de {apu.item} <span className="font-normal text-muted">({apu.und}, puede completarla después)</span></span>
                <input
                  ref={cantidad}
                  className={`${controlClass} tabular-nums`}
                  inputMode="decimal"
                  autoComplete="off"
                  value={expr}
                  placeholder="Ej.: (1,87+3,4)*2,7"
                  aria-invalid={v.error ? true : undefined}
                  aria-describedby={`${id}-c`}
                  onChange={(e) => setExpr(e.target.value)}
                />
              </label>
              <p id={`${id}-c`} aria-live="polite" className={v.error ? "text-sm font-medium text-danger" : "text-sm text-muted"}>
                {v.error || (v.cantidad !== null && `= ${v.cantidad.toLocaleString("es-CO")} ${apu.und}`)}
              </p>
            </div>

            {dims && (
              <details className="group rounded-lg border border-border">
                <summary className="flex min-h-12 cursor-pointer list-none items-center gap-2 px-3 font-semibold [&::-webkit-details-marker]:hidden">
                  <IconoChevronAbajo className="size-4 transition-transform group-open:rotate-180" />
                  Calcular con medidas ({apu.und}, en metros)
                </summary>
                <div className="p-3 pt-0">
                  <Calculadora
                    leyendaVisible={false}
                    und={apu.und}
                    dims={dims}
                    medidas={medidas}
                    onChange={(m) => {
                      setMedidas(m);
                      const e = expresionMedidas(apu.und, m);
                      if (e) setExpr(e);
                    }}
                  />
                </div>
              </details>
            )}

            <div className="flex flex-col gap-2">
              <span id={`${id}-cap`} className="font-semibold">Capítulo del presupuesto</span>
              <div role="radiogroup" aria-labelledby={`${id}-cap`} className="flex flex-wrap gap-2">
                {capitulos.map((c) => (
                  <label
                    key={c.id}
                    className="inline-flex min-h-12 cursor-pointer items-center rounded-full border border-border px-4 font-semibold has-checked:border-primary has-checked:bg-primary has-checked:text-on-primary has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-primary"
                  >
                    <input type="radio" name={`${id}-destino`} className="sr-only" checked={destino === c.id} onChange={() => setDestino(c.id)} />
                    {c.nombre.trim() || "Sin nombre"}
                  </label>
                ))}
                <button
                  type="button"
                  aria-expanded={otro}
                  onClick={() => setOtro(!otro)}
                  className="inline-flex min-h-12 items-center gap-1.5 rounded-full border border-dashed border-border px-4 font-semibold text-primary hover:bg-surface"
                >
                  <IconoMas className="size-4" />
                  Otro capítulo…
                </button>
              </div>
              {otro && (
                <NuevoCapitulo
                  faltantes={faltantes}
                  onCategoria={(k) => { setDestino(onCategoria(k)); setOtro(false); }}
                  onNombre={(n) => { setDestino(onNombre(n)); setOtro(false); }}
                />
              )}
            </div>
          </div>
          <footer className="flex flex-col-reverse gap-2 border-t border-border p-3 sm:flex-row sm:justify-end">
            <Button variant="secondary" className="min-h-12" disabled={!destino} onClick={() => agregar(true)}>Agregar y seguir</Button>
            <Button className="min-h-12 px-8" disabled={!destino} onClick={() => agregar(false)}>Agregar</Button>
          </footer>
        </section>
      )}
    </dialog>
  );
}

const BotonCerrar = ({ onClick }: { onClick: () => void }) => (
  <button type="button" aria-label="Cerrar" onClick={onClick} className="grid size-12 shrink-0 place-items-center rounded-lg border border-border hover:bg-surface">
    <IconoCerrar className="size-5" />
  </button>
);

/** <details> that renders its content only once opened (the price list has thousands of items). */
function Pliegue({ titulo, n, sub = false, children }: { titulo: ReactNode; n: number; sub?: boolean; children: ReactNode }) {
  const [visto, setVisto] = useState(false);
  return (
    <details className="group" onToggle={(e) => e.currentTarget.open && setVisto(true)}>
      <summary className={`${resumen} ${sub ? "bg-surface/50 pl-8" : ""}`}>
        <IconoChevronAbajo className="size-4 text-muted transition-transform group-open:rotate-180" />
        <span className="min-w-0 flex-1 [overflow-wrap:anywhere]">{titulo}</span>
        <span className="shrink-0 text-sm text-muted">{n}</span>
      </summary>
      <div className={sub ? "pl-4" : "pl-2"}>{visto && children}</div>
    </details>
  );
}

function Items({ apus, conRuta = false, onElegir, vacio }: { apus: Apu[]; conRuta?: boolean; onElegir: (a: Apu) => void; vacio: string }) {
  if (!apus.length) return vacio ? <p className="p-4 text-muted">{vacio}</p> : null;
  return (
    <ul>
      {apus.map((a, k) => (
        <li key={`${a.item}-${k}`}>
          <button type="button" className={filaItem} onClick={() => onElegir(a)}>
            <span className="[overflow-wrap:anywhere]"><span className="font-semibold">{a.item}</span> {a.descripcion}</span>
            <span className="flex flex-wrap justify-between gap-x-3 text-sm">
              <span className="text-muted">UND {a.und}</span>
              <span className="font-semibold tabular-nums">{formatoCop(a.costo_unitario)}</span>
            </span>
            {conRuta && <span className="text-xs text-muted [overflow-wrap:anywhere]">{rutaApu(a)}</span>}
          </button>
        </li>
      ))}
    </ul>
  );
}

/** "Agregar capítulo": first the "Sí, para" categories without a chapter, then a free name for an extra chapter. */
export function NuevoCapitulo({ faltantes, onCategoria, onNombre }: { faltantes: ClaveAplica[]; onCategoria: (k: ClaveAplica) => void; onNombre: (nombre: string) => void }) {
  const id = useId();
  const [nombre, setNombre] = useState("");
  function crear() {
    if (!nombre.trim()) return;
    onNombre(nombre);
    setNombre("");
  }
  return (
    <div className="flex flex-col gap-3 rounded-lg border border-border bg-surface p-3">
      {faltantes.length > 0 && (
        <div className="flex flex-col gap-2">
          <span id={`${id}-m`} className="text-sm font-semibold">Mejoras (se marcan también en «Sí, para»)</span>
          <ul aria-labelledby={`${id}-m`} className="flex flex-wrap gap-2">
            {faltantes.map((k) => (
              <li key={k}>
                <Button variant="secondary" className="min-h-12" onClick={() => onCategoria(k)}>{nombreCategoria(k)}</Button>
              </li>
            ))}
          </ul>
        </div>
      )}
      {/* Not a <form>: this sits inside the visit form. */}
      <div className="flex flex-wrap items-end gap-2">
        <label className="flex min-w-48 flex-1 flex-col gap-1">
          <span className="text-sm font-semibold">Otro capítulo</span>
          <input
            className={controlClass}
            value={nombre}
            placeholder="Nombre, por ejemplo Preliminares"
            enterKeyHint="done"
            onChange={(e) => setNombre(e.target.value)}
            onKeyDown={(e) => {
              if (e.key !== "Enter") return;
              e.preventDefault();
              crear();
            }}
          />
        </label>
        <Button variant="secondary" className="min-h-12" disabled={!nombre.trim()} onClick={crear}>Crear capítulo</Button>
      </div>
    </div>
  );
}
