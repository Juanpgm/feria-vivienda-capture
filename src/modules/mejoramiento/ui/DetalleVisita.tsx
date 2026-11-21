// Read-only view of everything captured in a visit. Server component: file URLs are presigned GETs (10 min)
// generated for this render, never public links.
import type { ReactNode } from "react";
import { fechaHoraBogota } from "@/shared/tiempo";
import { Card } from "@/shared/ui/Card";
import { ALCANCES, APLICA_PARA, ESTADOS, NO_APLICA_POR, RELACIONES_ATIENDE, SECCIONES, SI_NO, TIPOS_DOCUMENTO, type Pregunta } from "../domain/catalogos";
import type { VisitaDoc } from "../server/visitas.repo";
import { formatoCop } from "./armado";
import { GaleriaFotos } from "./GaleriaFotos";
import { ETIQUETA_ESTADO } from "./informe";
import { BadgeCroquis } from "./ListadoVisitas";
import { ModalCroquis } from "./ModalCroquis";

const etiqueta = (mapa: Record<string, string>, v: string | null | undefined) => (v ? (mapa[v] ?? v) : "Sin dato");

function respuesta(p: Pregunta, v: unknown): string {
  if (v === null || v === undefined || v === "") return "Sin dato";
  if (p.tipo === "si_no") return etiqueta(SI_NO, String(v));
  if (p.tipo === "estado") return etiqueta(ESTADOS, String(v));
  if (p.tipo === "opcion") return etiqueta(p.opciones, String(v));
  return String(v);
}

function Datos({ items }: { items: [string, ReactNode][] }) {
  return (
    <dl className="grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
      {items.map(([k, v]) => (
        <div key={k}>
          <dt className="text-muted">{k}</dt>
          <dd className="font-medium [overflow-wrap:anywhere]">{v}</dd>
        </div>
      ))}
    </dl>
  );
}

function Imagen({ url, alt, className = "h-32 w-32" }: { url?: string; alt: string; className?: string }) {
  if (!url) return <span className="text-sm text-muted">No disponible</span>;
  return (
    <a href={url} target="_blank" rel="noreferrer" className="block">
      {/* eslint-disable-next-line @next/next/no-img-element -- short-lived presigned S3 URL */}
      <img src={url} alt={alt} className={`${className} rounded-lg border border-border bg-white object-contain`} />
    </a>
  );
}

export function DetalleVisita({ v, id, urls }: { v: VisitaDoc; id: string; urls: Record<string, string> }) {
  const { atiende, propietario, diagnostico, ubicacion, inspector } = v;
  const fotos = (filaId: string) => v.archivos.filter((a) => a.tipo === "foto" && a.fila_id === filaId);
  const firma = v.archivos.find((a) => a.tipo === "firma_ciudadano");
  const secciones = SECCIONES.filter((s) => diagnostico.secciones?.[s.clave as keyof typeof diagnostico.secciones]);
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-3 text-sm">
        <span>{fechaHoraBogota(v.fecha_visita)}</span>
        <span>· {ETIQUETA_ESTADO[v.estado]}</span>
        <BadgeCroquis tiene={v.tiene_croquis} />
        {!v.tiene_croquis && v.estado === "registrada" && <ModalCroquis id={id} codigo={v.codigo} />}
      </div>

      <Card title="Quién atiende la visita">
        <Datos
          items={[
            ["Relación", atiende.relacion === "otro" ? `Otro: ${atiende.relacion_otro ?? ""}` : etiqueta(RELACIONES_ATIENDE, atiende.relacion)],
            ["Nombre completo", atiende.nombre],
            ["Documento", atiende.documento],
            ...(atiende.parentesco ? ([["Parentesco", atiende.parentesco]] as [string, ReactNode][]) : []),
          ]}
        />
      </Card>

      <Card title="Propietario">
        <Datos
          items={[
            ["Nombre del propietario", propietario.nombre],
            ["Tipo de documento", etiqueta(TIPOS_DOCUMENTO, propietario.tipo_documento)],
            ["Número de documento", propietario.documento],
            ["Teléfono de contacto", propietario.telefono],
            ["Correo electrónico", propietario.correo ?? "Sin dato"],
            ["Dirección del predio", propietario.direccion],
            ["Años habitando el predio", propietario.anios_habitando],
            ["Personas que habitan", propietario.personas],
          ]}
        />
      </Card>

      <Card title="Ubicación">
        <Datos
          items={[
            ["Comuna / corregimiento", ubicacion.comuna_corregimiento?.nombre ?? "Sin ubicar"],
            ["Barrio / vereda", ubicacion.barrio_vereda?.nombre ?? "Sin ubicar"],
            ["Latitud", ubicacion.lat],
            ["Longitud", ubicacion.lon],
            ...(ubicacion.precision_m !== null ? ([["Precisión", `${Math.round(ubicacion.precision_m)} m`]] as [string, ReactNode][]) : []),
          ]}
        />
      </Card>

      <Card title="Diagnóstico">
        <Datos
          items={[
            ["¿Aplica al mejoramiento?", etiqueta(SI_NO, diagnostico.aplica)],
            ...((diagnostico.aplica === "si"
              ? [
                  ["Aplica para", diagnostico.aplica_para.map((a) => etiqueta(APLICA_PARA, a)).join(", ")],
                  ["Alcance", etiqueta(ALCANCES, diagnostico.alcance)],
                ]
              : [["No aplica por", etiqueta(NO_APLICA_POR, diagnostico.no_aplica_por)]]) as [string, ReactNode][]),
          ]}
        />
        {secciones.map((s) => {
          const r = diagnostico.secciones[s.clave as keyof typeof diagnostico.secciones] as Record<string, unknown>;
          return (
            <div key={s.clave} className="mt-4">
              <h3 className="mb-1 font-semibold">{s.titulo}</h3>
              <Datos items={s.preguntas.map((p) => [p.etiqueta, respuesta(p, r[p.clave])])} />
            </div>
          );
        })}
      </Card>

      <Card title="Presupuesto">
        {!v.capitulos.length && <p className="text-sm text-muted">Sin actividades.</p>}
        {v.capitulos.map((c) => (
          <div key={c.id} className="mb-6 overflow-x-auto">
            <h3 className="mb-2 font-semibold">{c.nombre}</h3>
            <table className="w-full min-w-[44rem] text-left text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="py-2 pr-3">ITEM</th>
                  <th className="py-2 pr-3">DESCRIPCIÓN</th>
                  <th className="py-2 pr-3">UND</th>
                  <th className="py-2 pr-3 text-right">CANTIDAD</th>
                  <th className="py-2 pr-3 text-right">COSTO UNITARIO</th>
                  <th className="py-2 text-right">COSTO DIRECTO</th>
                </tr>
              </thead>
              <tbody>
                {c.filas.map((f) => (
                  <tr key={f.id} className="border-b border-border align-top">
                    <td className="py-2 pr-3">{f.item}</td>
                    <td className="py-2 pr-3">
                      {f.descripcion}
                      <div className="mt-1">
                        <GaleriaFotos item={f.item} titulo={f.descripcion} fotos={fotos(f.id).map((a, i) => ({ src: urls[a.key], alt: `Foto ${i + 1} de ${f.item} ${f.descripcion}` }))} />
                      </div>
                    </td>
                    <td className="py-2 pr-3">{f.und}</td>
                    <td className="py-2 pr-3 text-right">
                      {f.cantidad.toLocaleString("es-CO")}
                      <div className="text-xs text-muted">{f.cantidad_expr}</div>
                    </td>
                    <td className="py-2 pr-3 text-right whitespace-nowrap">{formatoCop(f.costo_unitario)}</td>
                    <td className="py-2 text-right whitespace-nowrap">{formatoCop(f.costo_directo)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <td colSpan={5} className="py-2 pr-3 text-right font-semibold">
                    Subtotal
                  </td>
                  <td className="py-2 text-right font-semibold whitespace-nowrap">{formatoCop(c.subtotal)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        ))}
        <p className="text-right text-base font-bold">Costo directo total: {formatoCop(v.costo_directo_total)}</p>
      </Card>

      <Card title="Observaciones">
        <p className="text-sm whitespace-pre-wrap">{v.observaciones || "Sin observaciones."}</p>
      </Card>

      <Card title="Firmas">
        <div className="grid gap-6 sm:grid-cols-2">
          <div className="flex flex-col gap-2">
            <Imagen url={firma && urls[firma.key]} alt={`Firma de ${atiende.nombre}`} className="h-28 w-56" />
            <p className="text-sm">
              {atiende.nombre} <span className="text-muted">· quien atiende</span>
            </p>
          </div>
          <div className="flex flex-col gap-2">
            <Imagen url={urls[inspector.firma_key]} alt={`Firma de ${inspector.nombre}`} className="h-28 w-56" />
            <p className="text-sm">
              {inspector.nombre}
              {inspector.cargo && <span className="text-muted"> · {inspector.cargo}</span>}
            </p>
          </div>
        </div>
      </Card>

      <Card title="Croquis">
        {v.croquis.length ? (
          <ul className="flex flex-wrap gap-3">
            {v.croquis.map((c, i) => (
              <li key={c.key}>
                {c.content_type === "application/pdf" ? (
                  <a href={urls[c.key]} target="_blank" rel="noreferrer" className="text-primary-strong underline">
                    Croquis {i + 1} (PDF)
                  </a>
                ) : (
                  <Imagen url={urls[c.key]} alt={`Croquis ${i + 1}`} />
                )}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted">Sin croquis.</p>
        )}
      </Card>
    </div>
  );
}
