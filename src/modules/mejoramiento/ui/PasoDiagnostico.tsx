"use client";

import { MultiSelect } from "@/shared/ui/MultiSelect";
import { ALCANCES, APLICA_PARA, ESTADOS, NO_APLICA_POR, SECCIONES, seccionesEnfocadas, SI_NO, type Pregunta, type SeccionDiagnostico } from "../domain/catalogos";
import type { Valores } from "./armado";
import { CampoSelect, CampoTexto, opciones, Segmentos } from "./campos";

type D = Valores["diagnostico"];

export function PasoDiagnostico({ d, onChange, errores }: { d: D; onChange: (d: D) => void; errores: Record<string, string> }) {
  const e = (k: string) => errores[`diagnostico.${k}`];
  const responder = (seccion: string, clave: string, valor: string | undefined) =>
    onChange({ ...d, secciones: { ...d.secciones, [seccion]: { ...d.secciones[seccion], [clave]: valor || undefined } } });
  // "Estado enfocado": the blocks of the selected improvements open first, the rest collapsed below.
  const { relevantes, otras } = seccionesEnfocadas(d.aplica_para);
  const revisados = SECCIONES.filter((s) => revisada(d.secciones[s.clave])).length;
  const comunes = { respuestas: d.secciones, responder, e };

  return (
    <div className="flex flex-col gap-6">
      <Segmentos legend="¿Aplica al mejoramiento?" name="aplica" value={d.aplica} catalogo={SI_NO} error={e("aplica")} onChange={(aplica) => onChange({ ...d, aplica })} />
      {d.aplica === "si" && (
        <>
          <MultiSelect label="Sí, para" options={opciones(APLICA_PARA)} value={d.aplica_para} error={e("aplica_para")} onChange={(aplica_para) => onChange({ ...d, aplica_para })} />
          <Segmentos legend="Alcance" name="alcance" value={d.alcance} catalogo={ALCANCES} error={e("alcance")} onChange={(alcance) => onChange({ ...d, alcance })} />
        </>
      )}
      {d.aplica === "no" && <CampoSelect label="No, por" catalogo={NO_APLICA_POR} value={d.no_aplica_por} error={e("no_aplica_por")} onChange={(no_aplica_por) => onChange({ ...d, no_aplica_por })} />}

      <p role="status" className="text-sm text-muted">
        {revisados} de {SECCIONES.length} elementos revisados. Todas las respuestas son opcionales; toque de nuevo una opción marcada para quitarla.
      </p>
      {d.aplica === "si" && relevantes.length > 0 ? (
        <>
          <Bloques titulo="Estado de la vivienda: lo que se va a mejorar" secciones={relevantes} abiertas {...comunes} />
          <Bloques titulo="Otros elementos de la vivienda" secciones={otras} {...comunes} />
        </>
      ) : (
        <Bloques titulo="Estado de la vivienda" secciones={SECCIONES} {...comunes} />
      )}
    </div>
  );
}

type Respuestas = D["secciones"];
const revisada = (r?: Record<string, string | undefined>) => Object.values(r ?? {}).some(Boolean);

function Bloques({ titulo, secciones, abiertas, respuestas, responder, e }: {
  titulo: string; secciones: SeccionDiagnostico[]; abiertas?: boolean; respuestas: Respuestas;
  responder: (seccion: string, clave: string, valor: string | undefined) => void; e: (k: string) => string | undefined;
}) {
  return (
    <section className="flex flex-col gap-2">
      <h3 className="text-lg font-bold text-primary-strong">{titulo}</h3>
      {secciones.map((s) => {
        const r = respuestas[s.clave] ?? {};
        const respondidas = Object.values(r).filter(Boolean).length;
        return (
          <details key={s.clave} open={abiertas} className="rounded-lg border border-border bg-surface">
            <summary className="flex min-h-11 cursor-pointer items-center justify-between gap-2 px-3 font-semibold">
              {s.titulo}
              <span className="text-sm font-normal text-muted">{respondidas ? `${respondidas} de ${s.preguntas.length}` : "Sin respuestas"}</span>
            </summary>
            <div className="flex flex-col gap-4 border-t border-border bg-bg p-3">
              {s.preguntas.map((p) => (
                <Respuesta key={p.clave} p={p} name={`${s.clave}-${p.clave}`} value={r[p.clave]} error={e(`secciones.${s.clave}.${p.clave}`)} onChange={(v) => responder(s.clave, p.clave, v)} />
              ))}
            </div>
          </details>
        );
      })}
    </section>
  );
}

function Respuesta({ p, name, value, error, onChange }: { p: Pregunta; name: string; value?: string; error?: string; onChange: (v: string | undefined) => void }) {
  switch (p.tipo) {
    case "si_no":
      return <Segmentos legend={p.etiqueta} name={name} value={value} catalogo={SI_NO} error={error} onChange={onChange} limpiable />;
    case "estado":
      return <Segmentos legend={p.etiqueta} name={name} value={value} catalogo={ESTADOS} error={error} onChange={onChange} limpiable />;
    case "opcion":
      return <CampoSelect label={p.etiqueta} catalogo={p.opciones} value={value} error={error} onChange={onChange} />;
    case "numero":
      return <CampoTexto label={p.etiqueta} inputMode="numeric" value={value} error={error} onChange={onChange} />;
    case "texto":
      return <CampoTexto label={p.etiqueta} maxLength={200} value={value} error={error} onChange={onChange} />;
  }
}
