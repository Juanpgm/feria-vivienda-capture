"use client";

import { useId } from "react";
import { MultiSelect } from "@/shared/ui/MultiSelect";
import {
  ALCANCES, APLICA_PARA, DETALLES_OPCIONALES, ELEMENTOS_VIVIENDA, elementosEnfocados, ESTADOS_ELEMENTO, NO_APLICA_POR, SI_NO, type ElementoVivienda, type Pregunta,
} from "../domain/catalogos";
import type { Valores } from "./armado";
import { CampoSelect, CampoTexto, opciones, Segmentos } from "./campos";

type D = Valores["diagnostico"];

/** Groups whose element labels repeat ("Enchape"): the group is added to the label where it is not obvious. */
const AMBIGUOS = new Set(["Cocina", "Baño"]);

export function PasoDiagnostico({ d, onChange, errores }: { d: D; onChange: (d: D) => void; errores: Record<string, string> }) {
  const e = (k: string) => errores[`diagnostico.${k}`];
  const marcarEstado = (clave: string, valor?: string) => onChange({ ...d, estados: { ...d.estados, [clave]: valor } });
  const marcarDetalle = (clave: string, valor?: string) => onChange({ ...d, detalles: { ...d.detalles, [clave]: valor || undefined } });
  // "Estado enfocado": the elements of the selected improvements first, the rest under their groups.
  const { relevantes, otras } = elementosEnfocados(d.aplica === "si" ? d.aplica_para : []);
  const conEstado = ELEMENTOS_VIVIENDA.filter((x) => d.estados[x.clave]).length;
  const grupos = [...new Set(otras.map((x) => x.grupo))].map((g) => [g, otras.filter((x) => x.grupo === g)] as const);

  return (
    <div className="flex flex-col gap-6">
      <Segmentos legend="¿Aplica al mejoramiento?" name="aplica" value={d.aplica} catalogo={SI_NO} error={e("aplica")} onChange={(aplica) => onChange({ ...d, aplica })} />
      {d.aplica === "si" && (
        <>
          <MultiSelect label="Sí, para" options={opciones(APLICA_PARA)} value={d.aplica_para} error={e("aplica_para")} onChange={(aplica_para) => onChange({ ...d, aplica_para })} />
          <Segmentos legend="Alcance" name="alcance" value={d.alcance} catalogo={ALCANCES} error={e("alcance")} onChange={(alcance) => onChange({ ...d, alcance })} />
        </>
      )}
      {d.aplica === "no" && (
        <>
          <CampoSelect label="No, por" catalogo={NO_APLICA_POR} value={d.no_aplica_por} error={e("no_aplica_por")} onChange={(no_aplica_por) => onChange({ ...d, no_aplica_por })} />
          <p className="rounded-lg border border-border bg-surface p-3 text-sm">La vivienda no aplica: se registran la visita, el motivo, las observaciones y la firma.</p>
        </>
      )}

      {d.aplica !== "no" && (
        <>
          <section aria-labelledby="titulo-estado" className="flex flex-col gap-4">
            <div>
              <h3 id="titulo-estado" className="text-lg font-bold text-primary-strong">Estado de la vivienda</h3>
              <p role="status" className="text-sm text-muted">
                {conEstado} de {ELEMENTOS_VIVIENDA.length} elementos con estado. Opcional; toque de nuevo una opción marcada para quitarla.
              </p>
            </div>
            {relevantes.length > 0 && <Grupo titulo="Lo que se va a mejorar" elementos={relevantes} estados={d.estados} onMarcar={marcarEstado} mezclado />}
            {grupos.map(([g, lista]) => (
              <Grupo key={g} titulo={g} elementos={lista} estados={d.estados} onMarcar={marcarEstado} />
            ))}
          </section>

          <details className="rounded-lg border border-border bg-surface">
            <summary className="flex min-h-11 cursor-pointer items-center px-3 font-semibold">Más detalles (opcional)</summary>
            <div className="flex flex-col gap-5 border-t border-border bg-bg p-3">
              {DETALLES_OPCIONALES.map((g) => (
                <div key={g.titulo} className="flex flex-col gap-3">
                  <h4 className="text-sm font-bold text-muted uppercase">{g.titulo}</h4>
                  <div className="grid gap-3 sm:grid-cols-2">
                    {g.preguntas.map((p) => (
                      <Detalle key={p.clave} p={p} value={d.detalles[p.clave]} error={e(`detalles.${p.clave}`)} onChange={(v) => marcarDetalle(p.clave, v)} />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </details>
        </>
      )}
    </div>
  );
}

/** `mezclado`: elements of several groups in one list, so repeated labels show their group. */
function Grupo({ titulo, elementos, estados, onMarcar, mezclado }: {
  titulo: string; elementos: ElementoVivienda[]; estados: D["estados"]; onMarcar: (clave: string, v?: string) => void; mezclado?: boolean;
}) {
  return (
    <div className="flex flex-col">
      <h4 className="text-sm font-bold text-muted uppercase">{titulo}</h4>
      <ul className="divide-y divide-border">
        {elementos.map((x) => (
          <li key={x.clave}>
            <EstadoElemento x={x} visibleGrupo={mezclado} value={estados[x.clave]} onChange={(v) => onMarcar(x.clave, v)} />
          </li>
        ))}
      </ul>
    </div>
  );
}

/** One element row: label + a 4-option segmented radio group; tapping the selected option again clears it. */
function EstadoElemento({ x, visibleGrupo, value, onChange }: { x: ElementoVivienda; visibleGrupo?: boolean; value?: string; onChange: (v?: string) => void }) {
  const id = useId();
  const sufijo = AMBIGUOS.has(x.grupo) ? ` (${x.grupo.toLowerCase()})` : "";
  return (
    <div className="flex flex-col gap-1 py-2 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
      <span id={id} className="font-medium">
        {x.etiqueta}
        {/* Screen readers always hear the group of a repeated label ("Enchape (baño)"). */}
        <span className={visibleGrupo ? "" : "sr-only"}>{sufijo}</span>
      </span>
      <div role="radiogroup" aria-labelledby={id} className="grid grid-cols-4 gap-1 rounded-lg border border-border bg-surface p-1 sm:w-96 sm:shrink-0">
        {opciones(ESTADOS_ELEMENTO).map((o) => (
          <label
            key={o.value}
            className={`relative flex min-h-11 cursor-pointer items-center justify-center rounded-md px-1 text-sm whitespace-nowrap text-text has-checked:font-semibold has-checked:text-on-primary has-focus-visible:outline-3 has-focus-visible:outline-offset-2 has-focus-visible:outline-primary ${o.value === "m" ? "has-checked:bg-danger" : "has-checked:bg-primary"}`}
          >
            <input
              type="radio"
              name={`estado-${x.clave}`}
              value={o.value}
              checked={value === o.value}
              onChange={() => onChange(o.value)}
              onClick={() => value === o.value && onChange(undefined)}
              className="absolute inset-0 size-full cursor-pointer opacity-0"
            />
            {o.label}
          </label>
        ))}
      </div>
    </div>
  );
}

function Detalle({ p, value, error, onChange }: { p: Pregunta; value?: string; error?: string; onChange: (v: string | undefined) => void }) {
  switch (p.tipo) {
    case "si_no":
      return <Segmentos legend={p.etiqueta} name={`detalle-${p.clave}`} value={value} catalogo={SI_NO} error={error} onChange={onChange} limpiable />;
    case "opcion":
      return <CampoSelect label={p.etiqueta} catalogo={p.opciones} value={value} error={error} onChange={onChange} />;
    case "numero":
      return <CampoTexto label={p.etiqueta} inputMode="numeric" value={value} error={error} onChange={onChange} />;
    case "texto":
      return <CampoTexto label={p.etiqueta} maxLength={200} value={value} error={error} onChange={onChange} />;
  }
}
