"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/shared/ui/Button";
import { IconoMas } from "@/shared/ui/Iconos";
import type { Apu } from "../domain/apus";
import sugeridos from "../catalogo/sugeridos.json";
import { APLICA_PARA, type ClaveAplica } from "../domain/catalogos";
import { erroresFotos, MAX_FOTOS_VISITA } from "../domain/fotos";
import { armarPresupuesto, type Visita } from "../domain/visita";
import { AgregarActividad, NuevoCapitulo } from "./AgregarActividad";
import { arbolApus } from "./arbolApus";
import { actividadesFrecuentes, conteosFotos, opcionesApus, type Capitulo, type Fila, type FotosPorFila } from "./armado";
import { agregarCategoria, agregarExtra, idCategoria, quitarCapitulo, sincronizarCapitulos, type Presupuesto } from "./capitulosAuto";
import { EditorFila } from "./EditorFila";
import { quitarFotosVisita } from "./fotosVisita";
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
  /** diagnostico.aplica === "si": only then the chapters follow "Sí, para". */
  aplica: boolean;
  /** diagnostico.aplica_para, kept in two-way sync with the category chapters. */
  aplicaPara: string[];
  capitulos: Capitulo[];
  onChange: (p: Presupuesto) => void;
  fotos: FotosPorFila;
  onFotos: (f: FotosPorFila) => void;
  errores: Record<string, string>;
};

const igual = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);
const CLAVES = Object.keys(APLICA_PARA) as ClaveAplica[];

/** "Cantidades de obra": the visit budget as one table (TablaPresupuesto); "Agregar actividad" opens AgregarActividad,
 * a row opens its editor (EditorFila). Chapters: one per "Sí, para" category plus optional extra chapters. */
export function PasoCantidades({ visitaId, aplica, aplicaPara, capitulos, onChange, fotos, onFotos, errores }: Props) {
  const { apus, error, mapa } = useApus();
  const opciones = useMemo(() => opcionesApus(apus ?? []), [apus]);
  const arbol = useMemo(() => arbolApus(apus ?? []), [apus]);
  const p = presupuesto(capitulos, mapa);
  const conteos = conteosFotos(capitulos, fotos);
  const totalFotos = conteos.reduce((s, n) => s + n, 0);
  const avisosFotos = erroresFotos(conteos);
  const [editando, setEditando] = useState<string | null>(null);
  const [agregando, setAgregando] = useState(false);
  const [nuevoCapitulo, setNuevoCapitulo] = useState(false);
  const [aviso, setAviso] = useState("");
  const botones = useRef(new Map<string, HTMLButtonElement>());
  const disparador = useRef<HTMLButtonElement | null>(null);
  const primero = useRef<HTMLButtonElement>(null);
  const actual: Presupuesto = { aplicaPara, capitulos };
  const faltantes = aplica ? CLAVES.filter((k) => !aplicaPara.includes(k)) : [];

  // Drafts from before automatic chapters catch up when the step opens.
  useEffect(() => {
    if (!aplica) return;
    const c = sincronizarCapitulos(aplicaPara, capitulos);
    if (!igual(c, capitulos)) onChange({ aplicaPara, capitulos: c });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- once per step mount
  }, []);

  const cambiar = (i: number, c: Capitulo) => onChange({ aplicaPara, capitulos: capitulos.map((x, k) => (k === i ? c : x)) });
  function quitarFilas(filas: Fila[]) {
    const refs = filas.flatMap((f) => (fotos[f.id] ?? []).map((x) => x.ref));
    void quitarFotosVisita(visitaId, refs);
    const resto = { ...fotos };
    for (const f of filas) delete resto[f.id];
    onFotos(resto);
  }
  function categoria(k: ClaveAplica) {
    onChange(agregarCategoria(actual, k));
    setAviso("");
    return idCategoria(k);
  }
  function extra(nombre: string) {
    const { id, ...r } = agregarExtra(actual, nombre, crypto.randomUUID());
    onChange(r);
    setAviso("");
    return id;
  }

  const i = editando ? capitulos.findIndex((c) => c.filas.some((f) => f.id === editando)) : -1;
  const capitulo = capitulos[i];
  const j = capitulo ? capitulo.filas.findIndex((f) => f.id === editando) : -1;
  const fila = capitulo?.filas[j];
  function cerrarEditor() {
    const id = editando;
    setEditando(null);
    // Back to the row's edit button; after "Quitar actividad" the row is gone, so to "Agregar actividad".
    requestAnimationFrame(() => {
      const boton = id ? botones.current.get(id) : undefined;
      (boton?.isConnected ? boton : primero.current)?.focus();
    });
  }
  const botonAgregar = (ref?: typeof primero) => (
    <Button
      ref={ref}
      className="inline-flex min-h-12 w-full items-center justify-center gap-2 sm:w-auto sm:self-start"
      disabled={!apus}
      onClick={(e) => {
        disparador.current = e.currentTarget;
        setAgregando(true);
      }}
    >
      <IconoMas />
      Agregar actividad
    </Button>
  );

  return (
    <div className="flex flex-col gap-4">
      {error && <p role="alert" className="font-semibold text-danger">{error}</p>}
      {!apus && !error && <p role="status" className="text-muted">Cargando listado de precios…</p>}

      {botonAgregar(primero)}
      {capitulos.length > 0 ? (
        <TablaPresupuesto
          capitulos={capitulos}
          mapa={mapa}
          subtotales={p.capitulos.map((x) => x.subtotal)}
          total={p.costo_directo_total}
          fotos={fotos}
          errores={errores}
          aplicaPara={aplica ? aplicaPara : []}
          onCambiar={cambiar}
          onQuitarCapitulo={(k) => {
            const r = quitarCapitulo(actual, capitulos[k].id);
            if ("error" in r) return setAviso(r.error);
            setAviso("");
            quitarFilas(capitulos[k].filas);
            onChange(r);
            primero.current?.focus();
          }}
          onEditar={setEditando}
          refFila={(id, el) => {
            if (el) botones.current.set(id, el);
            else botones.current.delete(id);
          }}
        />
      ) : (
        <p className="rounded-lg border border-dashed border-border p-4 text-muted">
          Aún no hay capítulos. Marque las mejoras en «Sí, para» (Diagnóstico) o agregue un capítulo.
        </p>
      )}
      {aviso && <p role="alert" className="font-medium text-danger">{aviso}</p>}
      {capitulos.length > 0 && botonAgregar()}

      <div className="flex flex-col gap-2">
        <Button
          variant="secondary"
          className="inline-flex min-h-12 items-center justify-center gap-2 sm:self-start"
          aria-expanded={nuevoCapitulo}
          onClick={() => setNuevoCapitulo(!nuevoCapitulo)}
        >
          <IconoMas />
          Agregar capítulo
        </Button>
        {nuevoCapitulo && (
          <NuevoCapitulo
            faltantes={faltantes}
            onCategoria={(k) => {
              categoria(k);
              setNuevoCapitulo(false);
            }}
            onNombre={(n) => {
              extra(n);
              setNuevoCapitulo(false);
            }}
          />
        )}
      </div>
      {errores.capitulos && <p role="alert" className="font-medium text-danger">{errores.capitulos}</p>}

      <p className={avisosFotos.length ? "font-semibold text-warning-text" : "text-sm text-muted"}>
        Fotos (opcionales): {totalFotos} de {MAX_FOTOS_VISITA} como máximo
      </p>
      {errores.fotos && <p role="alert" className="font-medium text-danger">{errores.fotos}</p>}

      {agregando && (
        <AgregarActividad
          arbol={arbol}
          opciones={opciones}
          frecuentes={actividadesFrecuentes(aplicaPara, sugeridos, mapa)}
          capitulos={capitulos}
          faltantes={faltantes}
          onAgregar={(id, item, cantidad_expr) =>
            onChange({ aplicaPara, capitulos: capitulos.map((c) => (c.id === id ? { ...c, filas: [...c.filas, { id: crypto.randomUUID(), item, cantidad_expr }] } : c)) })
          }
          onCategoria={categoria}
          onNombre={extra}
          onCerrar={() => {
            setAgregando(false);
            requestAnimationFrame(() => disparador.current?.isConnected && disparador.current.focus());
          }}
        />
      )}

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
