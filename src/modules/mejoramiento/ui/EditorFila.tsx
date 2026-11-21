"use client";

import { useEffect, useId, useRef, useState } from "react";
import { ErrorFoto, procesarArchivo } from "@/modules/documentos/ui/procesarImagen";
import { Button } from "@/shared/ui/Button";
import { controlClass } from "@/shared/ui/Field";
import { IconoCamara } from "@/shared/ui/Iconos";
import type { Apu } from "../domain/apus";
import { MAX_FOTOS_ITEM, MAX_FOTOS_VISITA } from "../domain/fotos";
import { dimensionesDe, expresionMedidas, type Dimension, type Medida } from "../domain/medidas";
import { formatoCop, valorFila, type Fila, type FotoMeta } from "./armado";
import { cargarFotoVisita, guardarFotoVisita, quitarFotosVisita } from "./fotosVisita";
import { GaleriaFotos } from "./GaleriaFotos";

type Props = {
  fila: Fila;
  apu?: Apu;
  /** Server-side validation message of cantidad_expr, if any. */
  error?: string;
  onChange: (f: Fila) => void;
  onQuitar: () => void;
  onCerrar: () => void;
  visitaId: string;
  fotos: FotoMeta[];
  onFotos: (f: FotoMeta[]) => void;
  totalVisita: number;
};

/**
 * Row editor of the budget table: native modal (full screen below sm, centered above) with the quantity, the
 * measurement calculator, the row photos and "Quitar actividad". Mounted while open; closing calls `onCerrar`.
 */
export function EditorFila({ fila, apu, error, onChange, onQuitar, onCerrar, visitaId, fotos, onFotos, totalVisita }: Props) {
  const dialogo = useRef<HTMLDialogElement>(null);
  const titulo = useRef<HTMLHeadingElement>(null);
  const tituloId = useId();
  const v = valorFila(fila.cantidad_expr, apu);
  const mensaje = error || v.error;
  const dims = dimensionesDe(apu?.und);
  const [medidas, setMedidas] = useState<Medida[]>([{}]);

  useEffect(() => {
    dialogo.current?.showModal();
    titulo.current?.focus(); // not the quantity field: a phone keyboard would cover the editor
  }, []);

  // The lines only help to write cantidad_expr (the stored memoria de cálculo); they are not stored themselves.
  function medir(nuevas: Medida[]) {
    setMedidas(nuevas);
    const expr = expresionMedidas(apu?.und, nuevas);
    if (expr) onChange({ ...fila, cantidad_expr: expr });
  }

  return (
    <dialog
      ref={dialogo}
      aria-labelledby={tituloId}
      onClose={(e) => e.target === e.currentTarget && onCerrar()} // not when the nested photo viewer closes
      className="m-0 h-dvh max-h-none w-full max-w-none flex-col bg-bg p-0 text-text backdrop:bg-black/50 open:flex sm:m-auto sm:h-auto sm:max-h-[calc(100dvh-4rem)] sm:w-[min(44rem,calc(100%-2rem))] sm:rounded-xl sm:border sm:border-border"
    >
      <header className="flex items-center gap-2 border-b border-border p-3">
        <h2 id={tituloId} ref={titulo} tabIndex={-1} className="min-w-0 flex-1 text-lg font-bold text-primary-strong outline-none">
          Editar actividad {fila.item}
        </h2>
        <Button variant="secondary" className="min-h-12" onClick={() => dialogo.current?.close()}>Cerrar</Button>
      </header>

      <div className="flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto p-4">
        <section className="flex flex-col gap-2">
          <p className="[overflow-wrap:anywhere]">
            {apu ? apu.descripcion : <span className="font-semibold text-danger">No está en el listado de precios</span>}
          </p>
          <dl className="grid grid-cols-3 gap-2 rounded-lg bg-surface p-3 text-sm">
            <div><dt className="text-muted">UND</dt><dd className="font-semibold">{apu?.und}</dd></div>
            <div className="text-right"><dt className="text-muted">Precio unitario</dt><dd className="font-semibold tabular-nums">{apu && formatoCop(apu.costo_unitario)}</dd></div>
            <div className="text-right"><dt className="text-muted">Precio total</dt><dd className="font-bold tabular-nums text-primary-strong">{v.total !== null && formatoCop(v.total)}</dd></div>
          </dl>
        </section>

        <div className="flex flex-col gap-1">
          <label className="flex flex-col gap-1">
            <span className="font-semibold">Cantidad de {fila.item}</span>
            <input
              className={`${controlClass} tabular-nums`}
              inputMode="decimal"
              autoComplete="off"
              value={fila.cantidad_expr}
              placeholder="Ej.: (1,87+3,4)*2,7"
              aria-invalid={mensaje ? true : undefined}
              onChange={(e) => onChange({ ...fila, cantidad_expr: e.target.value })}
            />
          </label>
          {mensaje ? <p role="alert" className="text-sm font-medium text-danger">{mensaje}</p> : v.cantidad !== null && <p className="text-sm text-muted">= {v.cantidad.toLocaleString("es-CO")} {apu?.und}</p>}
        </div>

        {dims && apu && <Calculadora und={apu.und} dims={dims} medidas={medidas} onChange={medir} />}

        <FotosFila visitaId={visitaId} item={fila.item} descripcion={apu?.descripcion ?? ""} fotos={fotos} onFotos={onFotos} lleno={totalVisita >= MAX_FOTOS_VISITA} />
      </div>

      <footer className="flex flex-wrap gap-2 border-t border-border p-3">
        <Button
          variant="danger"
          className="min-h-12"
          onClick={() => {
            if (!window.confirm(`¿Quitar la actividad ${fila.item}${fotos.length ? ` y sus ${fotos.length} fotos` : ""}?`)) return;
            onQuitar();
          }}
        >
          Quitar actividad
        </Button>
        <Button className="ml-auto min-h-12 px-6" onClick={() => dialogo.current?.close()}>Listo</Button>
      </footer>
    </dialog>
  );
}

const ETIQUETAS: Record<Dimension, string> = { largo: "Largo", ancho: "Ancho", alto: "Alto" };

/** "Calculadora de medidas": Largo × Ancho (M2), × Alto (M3) or Largo (M, ML); lines add up unless "Descontar". */
/** `leyendaVisible={false}` when a visible heading right above already names the calculator (kept for screen readers). */
export function Calculadora({
  und,
  dims,
  medidas,
  onChange,
  leyendaVisible = true,
}: {
  und: string;
  dims: readonly Dimension[];
  medidas: Medida[];
  onChange: (m: Medida[]) => void;
  leyendaVisible?: boolean;
}) {
  const cambiar = (n: number, m: Medida) => onChange(medidas.map((x, k) => (k === n ? m : x)));
  return (
    <fieldset className="flex flex-col gap-3 rounded-lg border border-border p-3">
      <legend className={leyendaVisible ? "px-1 font-semibold" : "sr-only"}>Calcular por medidas ({und}), en metros</legend>
      {medidas.map((m, n) => (
        <div key={n} className="flex flex-wrap items-end gap-2">
          {dims.map((d, k) => (
            <label key={d} className="flex w-24 flex-col gap-1">
              <span className="text-sm text-muted">{k > 0 && "× "}{ETIQUETAS[d]}</span>
              <input className={`${controlClass} tabular-nums`} inputMode="decimal" aria-label={`${ETIQUETAS[d]}, medida ${n + 1}`} value={m[d] ?? ""} onChange={(e) => cambiar(n, { ...m, [d]: e.target.value })} />
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

function FotosFila({ visitaId, item, descripcion, fotos, onFotos, lleno }: { visitaId: string; item: string; descripcion: string; fotos: FotoMeta[]; onFotos: (f: FotoMeta[]) => void; lleno: boolean }) {
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
    <section className="flex flex-col gap-2">
      <h3 className="font-semibold">Fotos de la actividad <span className="font-normal text-muted">(opcionales)</span></h3>
      <div className="flex flex-wrap items-center gap-3">
        <GaleriaFotos
          item={item}
          titulo={descripcion}
          fotos={fotos.map((x, n) => ({ src: urls[x.ref], alt: `Foto ${n + 1} de ${item} ${descripcion}` }))}
          onQuitar={(n) => {
            const x = fotos[n];
            void quitarFotosVisita(visitaId, [x.ref]);
            onFotos(fotos.filter((y) => y.ref !== x.ref));
          }}
        />
        <span className="text-sm text-muted">{fotos.length} de {MAX_FOTOS_ITEM}</span>
        {fotos.length < MAX_FOTOS_ITEM && !lleno && (
          <label className="inline-flex min-h-12 cursor-pointer items-center justify-center gap-2 rounded-lg bg-primary px-4 text-base font-semibold text-on-primary has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-primary has-disabled:opacity-50 sm:ml-auto">
            <IconoCamara className="size-5" />
            {procesando ? "Procesando…" : "Tomar foto"}
            <input type="file" accept="image/*" capture="environment" multiple disabled={procesando} className="sr-only" onChange={(e) => { void agregar(e.target.files); e.target.value = ""; }} />
          </label>
        )}
      </div>
      {lleno && fotos.length < MAX_FOTOS_ITEM && <p className="text-sm text-muted">La visita ya tiene {MAX_FOTOS_VISITA} fotos, el máximo permitido.</p>}
      {aviso && <p role="alert" className="text-sm font-medium text-danger">{aviso}</p>}
    </section>
  );
}
