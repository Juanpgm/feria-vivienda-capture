"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/shared/ui/Button";
import { IconoMas } from "@/shared/ui/Iconos";
import type { Apu } from "../domain/apus";
import sugeridos from "../catalogo/sugeridos.json";
import { CAPITULOS_SUGERIDOS } from "../domain/catalogos";
import { erroresFotos, MAX_FOTOS_VISITA } from "../domain/fotos";
import { armarPresupuesto, type Visita } from "../domain/visita";
import { actividadesFrecuentes, capitulosSugeridos, conteosFotos, opcionesApus, type Capitulo, type Fila, type FotosPorFila } from "./armado";
import { arbolApus } from "./arbolApus";
import { EditorFila } from "./EditorFila";
import { quitarFotosVisita } from "./fotosVisita";
import { SelectorApu } from "./SelectorApu";
import { TablaPresupuesto } from "./TablaPresupuesto";

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

/** "Cantidades de obra": the visit budget as one table (TablaPresupuesto); a row opens its editor (EditorFila). */
export function PasoCantidades({ visitaId, aplicaPara, capitulos, onChange, fotos, onFotos, errores }: Props) {
  const { apus, error, mapa } = useApus();
  const opciones = useMemo(() => opcionesApus(apus ?? []), [apus]);
  const arbol = useMemo(() => arbolApus(apus ?? []), [apus]);
  const p = presupuesto(capitulos, mapa);
  const conteos = conteosFotos(capitulos, fotos);
  const totalFotos = conteos.reduce((s, n) => s + n, 0);
  const avisosFotos = erroresFotos(conteos);
  const [editando, setEditando] = useState<string | null>(null);
  const [nuevoCapitulo, setNuevoCapitulo] = useState<string>();
  const botones = useRef(new Map<string, HTMLButtonElement>());
  const agregarCapitulo = useRef<HTMLButtonElement>(null);

  const nuevaFila = (item: string): Fila => ({ id: crypto.randomUUID(), item, cantidad_expr: "" });
  const cambiar = (i: number, c: Capitulo) => onChange(capitulos.map((x, k) => (k === i ? c : x)));
  function quitarFilas(filas: Fila[]) {
    const refs = filas.flatMap((f) => (fotos[f.id] ?? []).map((x) => x.ref));
    void quitarFotosVisita(visitaId, refs);
    const resto = { ...fotos };
    for (const f of filas) delete resto[f.id];
    onFotos(resto);
  }

  const i = editando ? capitulos.findIndex((c) => c.filas.some((f) => f.id === editando)) : -1;
  const capitulo = capitulos[i];
  const j = capitulo ? capitulo.filas.findIndex((f) => f.id === editando) : -1;
  const fila = capitulo?.filas[j];
  function cerrarEditor() {
    const id = editando;
    setEditando(null);
    // Back to the row's edit button; after "Quitar actividad" the row is gone, so to "Agregar capítulo".
    requestAnimationFrame(() => {
      const boton = id ? botones.current.get(id) : undefined;
      (boton?.isConnected ? boton : agregarCapitulo.current)?.focus();
    });
  }

  return (
    <div className="flex flex-col gap-4">
      {error && <p role="alert" className="font-semibold text-danger">{error}</p>}
      {!apus && !error && <p role="status" className="text-muted">Cargando listado de precios…</p>}
      <datalist id="capitulos-sugeridos">
        {CAPITULOS_SUGERIDOS.map((x) => <option key={x} value={x} />)}
      </datalist>

      {capitulos.length > 0 ? (
        <TablaPresupuesto
          capitulos={capitulos}
          mapa={mapa}
          subtotales={p.capitulos.map((x) => x.subtotal)}
          total={p.costo_directo_total}
          fotos={fotos}
          errores={errores}
          enfocar={nuevoCapitulo}
          onCambiar={cambiar}
          onQuitarCapitulo={(k) => {
            quitarFilas(capitulos[k].filas);
            onChange(capitulos.filter((_, n) => n !== k));
            agregarCapitulo.current?.focus();
          }}
          onEditar={setEditando}
          refFila={(id, el) => {
            if (el) botones.current.set(id, el);
            else botones.current.delete(id);
          }}
          agregar={(x, k) => (
            <SelectorApu
              clave={x.id}
              capitulo={x.nombre}
              arbol={arbol}
              opciones={opciones}
              frecuentes={actividadesFrecuentes(x.nombre, sugeridos, mapa, x.filas)}
              disabled={!apus}
              onElegir={(a) => cambiar(k, { ...x, filas: [...x.filas, nuevaFila(a.item)] })}
            />
          )}
        />
      ) : (
        <p className="rounded-lg border border-dashed border-border p-4 text-muted">
          Aún no hay capítulos. Agregue uno por cada tipo de mejoramiento (por ejemplo PISO, COCINA o BAÑO) y luego sus actividades.
        </p>
      )}

      <div className="flex flex-wrap gap-2">
        {!capitulos.length && aplicaPara.length > 0 && <Button onClick={() => onChange(capitulosSugeridos(aplicaPara))}>Crear capítulos sugeridos</Button>}
        <Button
          ref={agregarCapitulo}
          variant="secondary"
          className="inline-flex items-center gap-1.5"
          onClick={() => {
            const nuevo = { id: crypto.randomUUID(), nombre: "", filas: [] };
            setNuevoCapitulo(nuevo.id);
            onChange([...capitulos, nuevo]);
          }}
        >
          <IconoMas />
          Agregar capítulo
        </Button>
      </div>
      {errores.capitulos && <p role="alert" className="font-medium text-danger">{errores.capitulos}</p>}

      <p className={avisosFotos.length ? "font-semibold text-warning-text" : "text-sm text-muted"}>
        Fotos (opcionales): {totalFotos} de {MAX_FOTOS_VISITA} como máximo
      </p>
      {errores.fotos && <p role="alert" className="font-medium text-danger">{errores.fotos}</p>}

      {capitulo && fila && (
        <EditorFila
          key={fila.id}
          fila={fila}
          apu={mapa.get(fila.item)}
          error={errores[`capitulos.${i}.filas.${j}.cantidad_expr`]}
          onChange={(nueva) => cambiar(i, { ...capitulo, filas: capitulo.filas.map((x) => (x.id === nueva.id ? nueva : x)) })}
          onQuitar={() => {
            quitarFilas([fila]);
            cambiar(i, { ...capitulo, filas: capitulo.filas.filter((x) => x.id !== fila.id) });
            cerrarEditor();
          }}
          onCerrar={cerrarEditor}
          visitaId={visitaId}
          fotos={fotos[fila.id] ?? []}
          onFotos={(lista) => onFotos({ ...fotos, [fila.id]: lista })}
          totalVisita={totalFotos}
        />
      )}
    </div>
  );
}
