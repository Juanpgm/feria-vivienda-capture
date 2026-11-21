"use client";

import { useEffect, useMemo, useState } from "react";
import { ErrorFoto, procesarArchivo } from "@/modules/documentos/ui/procesarImagen";
import { Button } from "@/shared/ui/Button";
import { controlClass } from "@/shared/ui/Field";
import type { Apu } from "../domain/apus";
import { evaluarCantidad } from "../domain/cantidad";
import sugeridos from "../catalogo/sugeridos.json";
import { CAPITULOS_SUGERIDOS } from "../domain/catalogos";
import { costoDirecto } from "../domain/costos";
import { erroresFotos, MAX_FOTOS_ITEM, MAX_FOTOS_VISITA } from "../domain/fotos";
import { dimensionesDe, expresionMedidas, type Dimension, type Medida } from "../domain/medidas";
import { armarPresupuesto, type Visita } from "../domain/visita";
import { actividadesFrecuentes, buscarApus, capitulosSugeridos, conteosFotos, formatoCop, opcionesApus, type Capitulo, type Fila, type FotoMeta, type FotosPorFila } from "./armado";
import { cargarFotoVisita, guardarFotoVisita, quitarFotosVisita } from "./fotosVisita";

// The catalogue is fetched once per page load and shared by every step that prices rows.
let catalogo: Promise<Apu[]> | null = null;
export function useApus() {
  const [estado, setEstado] = useState<{ apus: Apu[] | null; error: string }>({ apus: null, error: "" });
  useEffect(() => {
    catalogo ??= fetch("/api/apus").then(async (r) => {
      if (!r.ok) throw new Error();
      return ((await r.json()) as { apus: Apu[] }).apus;
    });
    catalogo.then(
      (apus) => setEstado({ apus, error: "" }),
      () => {
        catalogo = null;
        setEstado({ apus: null, error: "No se pudo cargar el listado de precios. Revise la conexión y vuelva a abrir este paso." });
      },
    );
  }, []);
  const mapa = useMemo(() => new Map((estado.apus ?? []).map((a) => [a.item, a])), [estado.apus]);
  return { ...estado, mapa };
}

export const presupuesto = (capitulos: Capitulo[], mapa: Map<string, Apu>) => armarPresupuesto(capitulos as Visita["capitulos"], mapa);

type Props = {
  visitaId: string;
  /** diagnostico.aplica_para: offers one chapter per selected improvement while there are none. */
  aplicaPara: string[];
  capitulos: Capitulo[];
  onChange: (c: Capitulo[]) => void;
  fotos: FotosPorFila;
  onFotos: (f: FotosPorFila) => void;
  errores: Record<string, string>;
};

export function PasoCantidades({ visitaId, aplicaPara, capitulos, onChange, fotos, onFotos, errores }: Props) {
  const { apus, error, mapa } = useApus();
  const opciones = useMemo(() => opcionesApus(apus ?? []), [apus]);
  const p = presupuesto(capitulos, mapa);
  const conteos = conteosFotos(capitulos, fotos);
  const totalFotos = conteos.reduce((s, n) => s + n, 0);
  const avisosFotos = erroresFotos(conteos);

  const nuevaFila = (item: string): Fila => ({ id: crypto.randomUUID(), item, cantidad_expr: "" });
  const cambiar = (i: number, c: Capitulo) => onChange(capitulos.map((x, k) => (k === i ? c : x)));
  function quitarFilas(filas: Fila[]) {
    const refs = filas.flatMap((f) => (fotos[f.id] ?? []).map((x) => x.ref));
    void quitarFotosVisita(visitaId, refs);
    const resto = { ...fotos };
    for (const f of filas) delete resto[f.id];
    onFotos(resto);
  }

  return (
    <div className="flex flex-col gap-6">
      {error && <p role="alert" className="font-semibold text-danger">{error}</p>}
      {!apus && !error && <p role="status" className="text-muted">Cargando listado de precios…</p>}
      <datalist id="capitulos-sugeridos">
        {CAPITULOS_SUGERIDOS.map((c) => <option key={c} value={c} />)}
      </datalist>

      {capitulos.map((c, i) => (
        <section key={c.id} className="flex flex-col gap-3 rounded-xl border border-border bg-surface p-3 md:p-4">
          <div className="flex flex-wrap items-end gap-2">
            <label className="flex min-w-0 flex-1 flex-col gap-1">
              <span className="text-sm font-semibold">Capítulo {i + 1}</span>
              <input
                className={controlClass}
                list="capitulos-sugeridos"
                value={c.nombre}
                placeholder="Nombre del capítulo"
                aria-invalid={errores[`capitulos.${i}.nombre`] ? true : undefined}
                onChange={(e) => cambiar(i, { ...c, nombre: e.target.value })}
              />
            </label>
            <Button
              variant="secondary"
              onClick={() => {
                quitarFilas(c.filas);
                onChange(capitulos.filter((_, k) => k !== i));
              }}
            >
              Quitar capítulo
            </Button>
          </div>
          {errores[`capitulos.${i}.nombre`] && <p role="alert" className="text-sm font-medium text-danger">{errores[`capitulos.${i}.nombre`]}</p>}

          <BuscadorApu disabled={!apus} buscar={(q) => buscarApus(opciones, q)} onAgregar={(a) => cambiar(i, { ...c, filas: [...c.filas, nuevaFila(a.item)] })} />
          <Frecuentes apus={actividadesFrecuentes(c.nombre, sugeridos, mapa, c.filas)} onAgregar={(a) => cambiar(i, { ...c, filas: [...c.filas, nuevaFila(a.item)] })} />

          {c.filas.length > 0 && (
            <table className="block w-full text-left md:table">
              <thead className="sr-only md:not-sr-only md:table-header-group">
                <tr className="text-sm text-muted">
                  <th className="py-2 pr-3 font-semibold">ITEM</th>
                  <th className="py-2 pr-3 font-semibold">Descripción</th>
                  <th className="py-2 pr-3 font-semibold">UND</th>
                  <th className="py-2 pr-3 text-right font-semibold">Costo unitario</th>
                  <th className="py-2 pr-3 font-semibold">Cantidad</th>
                  <th className="py-2 pr-3 text-right font-semibold">Costo directo</th>
                  <th className="py-2"><span className="sr-only">Acciones</span></th>
                </tr>
              </thead>
              {c.filas.map((f, j) => (
                <FilaCantidad
                  key={f.id}
                  f={f}
                  apu={mapa.get(f.item)}
                  error={errores[`capitulos.${i}.filas.${j}.cantidad_expr`]}
                  onChange={(nueva) => cambiar(i, { ...c, filas: c.filas.map((x) => (x.id === f.id ? nueva : x)) })}
                  onQuitar={() => {
                    quitarFilas([f]);
                    cambiar(i, { ...c, filas: c.filas.filter((x) => x.id !== f.id) });
                  }}
                  visitaId={visitaId}
                  fotos={fotos[f.id] ?? []}
                  onFotos={(lista) => onFotos({ ...fotos, [f.id]: lista })}
                  totalVisita={totalFotos}
                />
              ))}
            </table>
          )}
          <p className="text-right font-semibold">Subtotal del capítulo: {formatoCop(p.capitulos[i]?.subtotal ?? 0)}</p>
        </section>
      ))}

      <div className="flex flex-wrap gap-2">
        {!capitulos.length && aplicaPara.length > 0 && <Button onClick={() => onChange(capitulosSugeridos(aplicaPara))}>Crear capítulos sugeridos</Button>}
        <Button variant="secondary" onClick={() => onChange([...capitulos, { id: crypto.randomUUID(), nombre: "", filas: [] }])}>
          Agregar capítulo
        </Button>
      </div>
      {errores.capitulos && <p role="alert" className="font-medium text-danger">{errores.capitulos}</p>}

      <div className="flex flex-col gap-1 rounded-lg border-l-4 border-accent bg-surface p-3">
        <p className="text-lg font-bold text-primary-strong">Costo directo total: {formatoCop(p.costo_directo_total)}</p>
        <p className={avisosFotos.length ? "font-semibold text-warning-text" : "text-muted"}>
          Fotos (opcionales): {totalFotos} de {MAX_FOTOS_VISITA} como máximo
        </p>
        {errores.fotos && <p role="alert" className="font-medium text-danger">{errores.fotos}</p>}
      </div>
    </div>
  );
}

function BuscadorApu({ buscar, onAgregar, disabled }: { buscar: (q: string) => Apu[]; onAgregar: (a: Apu) => void; disabled: boolean }) {
  const [q, setQ] = useState("");
  const resultados = buscar(q);
  return (
    <div className="flex flex-col gap-2">
      <label className="flex flex-col gap-1">
        <span className="text-sm font-semibold">Buscar actividad por ITEM o descripción</span>
        <input type="search" className={controlClass} value={q} disabled={disabled} placeholder="Ej.: 240201 o excavación" onChange={(e) => setQ(e.target.value)} />
      </label>
      {q.trim().length >= 2 && (
        <ul className="max-h-72 overflow-auto rounded-lg border border-border bg-bg">
          {resultados.map((a) => (
            <li key={a.item} className="flex items-center gap-3 border-b border-border px-3 py-2 last:border-0">
              <span className="min-w-0 flex-1 text-sm">
                <span className="font-semibold">{a.item}</span> · {a.descripcion} <span className="text-muted">({a.und}, {formatoCop(a.costo_unitario)})</span>
              </span>
              <Button variant="secondary" aria-label={`Agregar ${a.item} ${a.descripcion}`} onClick={() => onAgregar(a)}>
                Agregar
              </Button>
            </li>
          ))}
          {!resultados.length && <li className="px-3 py-2 text-sm text-muted">Sin resultados</li>}
        </ul>
      )}
    </div>
  );
}

const FRECUENTES_VISIBLES = 8;

/** "Actividades frecuentes" of the example budgets (catalogo/sugeridos.json): one tap adds the row. */
function Frecuentes({ apus, onAgregar }: { apus: Apu[]; onAgregar: (a: Apu) => void }) {
  const [todas, setTodas] = useState(false);
  if (!apus.length) return null;
  const visibles = todas ? apus : apus.slice(0, FRECUENTES_VISIBLES);
  return (
    <div className="flex flex-col gap-2">
      <p className="text-sm font-semibold">Actividades frecuentes</p>
      <ul className="flex flex-wrap gap-2">
        {visibles.map((a) => (
          <li key={a.item} className="max-w-full">
            <button
              type="button"
              aria-label={`Agregar ${a.item} ${a.descripcion}`}
              onClick={() => onAgregar(a)}
              className="min-h-11 max-w-full rounded-full border border-primary bg-bg px-3 py-1 text-left text-sm text-primary hover:bg-surface"
            >
              + {a.descripcion} <span className="text-muted">({a.und})</span>
            </button>
          </li>
        ))}
      </ul>
      {apus.length > FRECUENTES_VISIBLES && (
        <Button variant="secondary" className="self-start" aria-expanded={todas} onClick={() => setTodas(!todas)}>
          {todas ? "Ver menos" : `Ver todas (${apus.length})`}
        </Button>
      )}
    </div>
  );
}

// Below md each row becomes a stacked block (labels from data-label), as in PanelUsuarios.
const td = "block py-0.5 md:table-cell md:py-2 md:pr-3 md:align-top [overflow-wrap:anywhere] before:mr-1 before:text-muted before:content-[attr(data-label)] md:before:content-none";

function FilaCantidad({ f, apu, error, onChange, onQuitar, visitaId, fotos, onFotos, totalVisita }: {
  f: Fila; apu?: Apu; error?: string; onChange: (f: Fila) => void; onQuitar: () => void;
  visitaId: string; fotos: FotoMeta[]; onFotos: (f: FotoMeta[]) => void; totalVisita: number;
}) {
  const r = evaluarCantidad(f.cantidad_expr);
  const dims = dimensionesDe(apu?.und);
  const [calcular, setCalcular] = useState(false);
  const [medidas, setMedidas] = useState<Medida[]>([{}]);
  // The lines only help to write cantidad_expr (the stored memoria de cálculo); they are not stored themselves.
  function medir(nuevas: Medida[]) {
    setMedidas(nuevas);
    const expr = expresionMedidas(apu?.und, nuevas);
    if (expr) onChange({ ...f, cantidad_expr: expr });
  }
  const mensaje = error ?? (f.cantidad_expr.trim() && !r.ok ? r.error : undefined);
  return (
    <tbody className="block border-b border-border py-2 last:border-0 md:table-row-group">
      <tr className="block md:table-row">
        <td className={`${td} font-semibold`} data-label="ITEM:">{f.item}</td>
        <td className={td} data-label="Descripción:">{apu?.descripcion ?? <span className="text-danger">No está en el listado de precios</span>}</td>
        <td className={td} data-label="UND:">{apu?.und}</td>
        <td className={`${td} md:text-right`} data-label="Costo unitario:">{apu && formatoCop(apu.costo_unitario)}</td>
        <td className={`${td} md:min-w-48`}>
          <label className="flex flex-col gap-1">
            <span className="text-sm text-muted md:sr-only">Cantidad</span>
            <input
              className={controlClass}
              inputMode="decimal"
              value={f.cantidad_expr}
              placeholder="Ej.: (1,87+3,4)*2,7"
              aria-invalid={mensaje ? true : undefined}
              onChange={(e) => onChange({ ...f, cantidad_expr: e.target.value })}
            />
          </label>
          {mensaje ? <p role="alert" className="text-sm font-medium text-danger">{mensaje}</p> : r.ok && <p className="text-sm text-muted">= {r.valor.toLocaleString("es-CO")} {apu?.und}</p>}
          {dims && (
            <Button variant="secondary" className="mt-1" aria-expanded={calcular} onClick={() => setCalcular(!calcular)}>
              {calcular ? "Ocultar cálculo" : "Calcular"}
            </Button>
          )}
        </td>
        <td className={`${td} font-semibold md:text-right`} data-label="Costo directo:">{apu && r.ok ? formatoCop(costoDirecto(r.valor, apu.costo_unitario)) : "—"}</td>
        <td className="block pt-2 md:table-cell md:py-2 md:align-top">
          <Button variant="secondary" aria-label={`Quitar ${f.item}`} onClick={onQuitar}>Quitar</Button>
        </td>
      </tr>
      <tr className="block md:table-row">
        <td colSpan={7} className="block pb-2 md:table-cell">
          {dims && calcular && <Calculadora item={f.item} und={apu!.und} dims={dims} medidas={medidas} onChange={medir} />}
          <FotosFila visitaId={visitaId} item={f.item} fotos={fotos} onFotos={onFotos} lleno={totalVisita >= MAX_FOTOS_VISITA} />
        </td>
      </tr>
    </tbody>
  );
}

const ETIQUETAS: Record<Dimension, string> = { largo: "Largo", ancho: "Ancho", alto: "Alto" };

/** "Calculadora de medidas": Largo × Ancho (M2), × Alto (M3) or Largo (M, ML); lines add up unless "Descontar". */
function Calculadora({ item, und, dims, medidas, onChange }: { item: string; und: string; dims: readonly Dimension[]; medidas: Medida[]; onChange: (m: Medida[]) => void }) {
  const cambiar = (n: number, m: Medida) => onChange(medidas.map((x, k) => (k === n ? m : x)));
  return (
    <fieldset className="mb-3 flex flex-col gap-3 rounded-lg border border-border bg-bg p-3">
      <legend className="px-1 text-sm font-semibold">Medidas de {item} ({und}), en metros</legend>
      {medidas.map((m, n) => (
        <div key={n} className="flex flex-wrap items-end gap-2">
          {dims.map((d, k) => (
            <label key={d} className="flex w-24 flex-col gap-1">
              <span className="text-sm text-muted">{k > 0 && "× "}{ETIQUETAS[d]}</span>
              <input className={controlClass} inputMode="decimal" aria-label={`${ETIQUETAS[d]}, medida ${n + 1}`} value={m[d] ?? ""} onChange={(e) => cambiar(n, { ...m, [d]: e.target.value })} />
            </label>
          ))}
          <label className="flex min-h-11 items-center gap-2 text-sm">
            <input type="checkbox" className="size-5" checked={!!m.descontar} onChange={(e) => cambiar(n, { ...m, descontar: e.target.checked })} />
            Descontar
          </label>
          {medidas.length > 1 && (
            <Button variant="secondary" aria-label={`Quitar medida ${n + 1}`} onClick={() => onChange(medidas.filter((_, k) => k !== n))}>
              Quitar
            </Button>
          )}
        </div>
      ))}
      <div className="flex flex-wrap items-center gap-3">
        <Button variant="secondary" onClick={() => onChange([...medidas, {}])}>Agregar medida</Button>
        <span className="text-sm text-muted">«Descontar» resta la medida, por ejemplo el vano de una puerta.</span>
      </div>
    </fieldset>
  );
}

function FotosFila({ visitaId, item, fotos, onFotos, lleno }: { visitaId: string; item: string; fotos: FotoMeta[]; onFotos: (f: FotoMeta[]) => void; lleno: boolean }) {
  const [urls, setUrls] = useState<Record<string, string>>({});
  const [aviso, setAviso] = useState("");
  const [procesando, setProcesando] = useState(false);
  const refs = fotos.map((x) => x.ref).join(",");

  useEffect(() => {
    let vivo = true;
    const creadas: string[] = [];
    void Promise.all(fotos.map(async (x) => [x.ref, await cargarFotoVisita(visitaId, x.ref)] as const)).then((pares) => {
      if (!vivo) return;
      const nuevas: Record<string, string> = {};
      for (const [ref, blob] of pares) if (blob) creadas.push((nuevas[ref] = URL.createObjectURL(blob)));
      setUrls(nuevas);
    });
    return () => {
      vivo = false;
      creadas.forEach((u) => URL.revokeObjectURL(u));
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `refs` is the identity of `fotos`
  }, [visitaId, refs]);

  async function agregar(archivos: FileList | null) {
    if (!archivos?.length) return;
    setAviso("");
    setProcesando(true);
    const nuevas: FotoMeta[] = [];
    try {
      for (const archivo of Array.from(archivos).slice(0, MAX_FOTOS_ITEM - fotos.length)) {
        const { blob } = await procesarArchivo(archivo);
        const ref = crypto.randomUUID();
        await guardarFotoVisita(visitaId, ref, blob);
        nuevas.push({ ref, mime: blob.type || "image/jpeg", bytes: blob.size });
      }
      if (archivos.length > MAX_FOTOS_ITEM - fotos.length) setAviso(`Máximo ${MAX_FOTOS_ITEM} fotos por actividad.`);
    } catch (e) {
      setAviso(e instanceof ErrorFoto ? e.message : "No se pudo guardar la foto. Intente de nuevo.");
    } finally {
      if (nuevas.length) onFotos([...fotos, ...nuevas]);
      setProcesando(false);
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-2">
        {fotos.map((x, n) => (
          <div key={x.ref} className="relative">
            {urls[x.ref] ? (
              // eslint-disable-next-line @next/next/no-img-element -- local blob URL
              <img src={urls[x.ref]} alt={`Foto ${n + 1} de ${item}`} className="size-20 rounded-md border border-border object-cover" />
            ) : (
              <div className="grid size-20 place-items-center rounded-md border border-border text-xs text-muted">Foto {n + 1}</div>
            )}
            <button
              type="button"
              aria-label={`Quitar foto ${n + 1} de ${item}`}
              onClick={() => {
                void quitarFotosVisita(visitaId, [x.ref]);
                onFotos(fotos.filter((y) => y.ref !== x.ref));
              }}
              className="absolute -right-2 -top-2 grid size-8 place-items-center rounded-full border border-border bg-bg text-lg leading-none"
            >
              ×
            </button>
          </div>
        ))}
        {fotos.length < MAX_FOTOS_ITEM && !lleno && (
          <label className="inline-flex min-h-12 min-w-36 cursor-pointer items-center justify-center rounded-lg bg-primary px-4 text-base font-semibold text-on-primary has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-primary has-disabled:opacity-50">
            {procesando ? "Procesando…" : "Tomar foto"}
            <input type="file" accept="image/*" capture="environment" multiple disabled={procesando} className="sr-only" onChange={(e) => { void agregar(e.target.files); e.target.value = ""; }} />
          </label>
        )}
        <span className="text-sm text-muted">{fotos.length} de {MAX_FOTOS_ITEM}</span>
      </div>
      {aviso && <p role="alert" className="text-sm font-medium text-danger">{aviso}</p>}
    </div>
  );
}
