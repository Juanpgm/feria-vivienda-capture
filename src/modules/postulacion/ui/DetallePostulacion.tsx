// Unified per-person view (S19): the postulación, what is missing, the ID photos, its validation and its history.
import Link from "next/link";
import { formatoCop } from "@/modules/cierre-financiero/domain/smlmv";
import { fechaHoraBogota } from "@/shared/tiempo";
import {
  CONDICIONES_ESPECIALES, ENTIDADES_ACREEDORAS, ESTADOS_CIVILES, ESTADOS_OBLIGACION, ESTADOS_POSTULACION, FUENTES_RECURSOS, GENEROS_SOLICITANTE,
  IDENTIDADES_GENERO, MODALIDADES, OCUPACIONES_INTEGRANTE, OCUPACIONES_SOLICITANTE, PARENTESCOS, TIPOS_DOCUMENTO_INTEGRANTE, TIPOS_DOCUMENTO_SOLICITANTE,
  type FuenteRecurso,
} from "../domain/catalogos";
import type { PostulacionVista } from "../server/postulaciones.repo";
import { BotonBorrar } from "./BotonBorrar";
import { BotonValidar } from "./BotonValidar";
import { QrPostulacion } from "./QrPostulacion";

type Fila = [string, unknown];
const SIN = "Sin información";
const de = (o: Record<string, string>, v: unknown) => (typeof v === "string" && v in o ? o[v] : v);
const texto = (v: unknown): string =>
  v === null || v === undefined || v === "" ? SIN : typeof v === "boolean" ? (v ? "Sí" : "No") : Array.isArray(v) ? (v.length ? v.join(", ") : SIN) : String(v);
const dinero = (v: unknown) => (typeof v === "number" ? formatoCop(v) : SIN);

function Tabla({ titulo, filas, id }: { titulo: string; filas: Fila[]; id?: string }) {
  return (
    <section aria-labelledby={id} className="flex flex-col gap-2">
      <h3 id={id} className="text-lg font-bold text-primary-strong">{titulo}</h3>
      <dl className="grid gap-x-6 gap-y-1 rounded-lg border border-border p-4 sm:grid-cols-[16rem_minmax(0,1fr)]">
        {filas.map(([k, v]) => {
          const t = texto(v);
          return (
            <div key={k} className="contents">
              <dt className="text-sm text-muted sm:py-1">{k}</dt>
              <dd className={`pb-2 sm:py-1 ${t === SIN ? "font-medium text-warning-text" : "font-medium"}`}>{t}</dd>
            </div>
          );
        })}
      </dl>
    </section>
  );
}

export function EstadoBadge({ estado }: { estado: keyof typeof ESTADOS_POSTULACION }) {
  return (
    <span className={`inline-flex rounded-full px-3 py-1 text-sm font-bold ${estado === "valido" ? "bg-success text-bg" : "bg-warning-bg text-warning-text"}`}>
      {ESTADOS_POSTULACION[estado]}
    </span>
  );
}

export function DetallePostulacion({ p, esAdmin = false }: { p: PostulacionVista; esAdmin?: boolean }) {
  const s = p.solicitante;
  const po = p.postulacion;
  const condiciones = (s.condiciones_especiales as string[]).map((c) => de(CONDICIONES_ESPECIALES, c) as string);
  const foto = (tipo: string) => `/api/postulaciones/${p.id}/adjuntos/${tipo}`;

  return (
    <div className="flex flex-col gap-8">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-sm font-semibold text-muted">Postulación</p>
          <h1 className="text-3xl font-bold tabular-nums text-primary-strong">{p.radicado}</h1>
          <p className="mt-1 text-lg font-semibold">{s.nombre_completo}</p>
          <p className="text-sm text-muted">
            {de(TIPOS_DOCUMENTO_SOLICITANTE, s.tipo_documento) as string} {s.numero_documento} · Registrada {p.creado_en ? fechaHoraBogota(p.creado_en) : ""} ·{" "}
            {p.origen === "publico" ? "Formulario público" : `Por ${p.creado_por_nombre ?? "funcionario"}`}
          </p>
        </div>
        <div className="flex flex-col items-end gap-2">
          <EstadoBadge estado={p.estado} />
          {esAdmin && <BotonBorrar id={p.id} radicado={p.radicado} nombre={String(s.nombre_completo)} despues="listado" />}
          {p.estado === "sin_validar" && (
            <Link href={`/postulaciones/${p.id}/editar`} className="inline-flex min-h-11 items-center font-semibold text-primary underline underline-offset-2">
              Editar datos
            </Link>
          )}
        </div>
      </header>

      <QrPostulacion id={p.id} radicado={p.radicado} />

      {p.faltantes.length > 0 ? (
        <section aria-labelledby="faltantes" className="rounded-lg border-2 border-warning-text bg-warning-bg p-4 text-warning-text">
          <h2 id="faltantes" className="font-bold">Faltan {p.faltantes.length} dato(s) obligatorios para validar</h2>
          <ul className="mt-2 list-disc pl-5">
            {p.faltantes.map((f) => (
              <li key={f.ruta}>{f.etiqueta}</li>
            ))}
          </ul>
        </section>
      ) : (
        <p role="status" className="rounded-lg border border-success p-3 font-semibold text-success">Todos los datos obligatorios están completos.</p>
      )}

      <section aria-labelledby="fotos" className="flex flex-col gap-2">
        <h2 id="fotos" className="text-lg font-bold text-primary-strong">Documento de identidad</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          {(["documento_frente", "documento_reverso"] as const).map((t) => (
            <figure key={t} className="flex flex-col gap-1">
              <a href={foto(t)} target="_blank" rel="noreferrer" className="block overflow-hidden rounded-lg border border-border bg-surface">
                {/* eslint-disable-next-line @next/next/no-img-element -- private, uncached image behind the session */}
                <img src={foto(t)} alt={t === "documento_frente" ? "Frente del documento de identidad" : "Reverso del documento de identidad"} className="aspect-[1.586] w-full object-contain" />
              </a>
              <figcaption className="text-sm text-muted">{t === "documento_frente" ? "Frente" : "Reverso"} (clic para ampliar)</figcaption>
            </figure>
          ))}
        </div>
      </section>

      <Tabla
        id="sec-solicitante"
        titulo="1. Datos del solicitante (jefe del hogar)"
        filas={[
          ["Nombres", s.nombres], ["Apellidos", s.apellidos], ["Lugar de expedición", s.lugar_expedicion_nombre], ["Fecha de expedición", s.fecha_expedicion],
          ["Fecha de nacimiento", s.fecha_nacimiento], ["Lugar de nacimiento", s.lugar_nacimiento_nombre], ["Género", s.genero === "otro" ? `Otro: ${texto(s.genero_otro)}` : de(GENEROS_SOLICITANTE, s.genero)],
          ["Ocupación", de(OCUPACIONES_SOLICITANTE, s.ocupacion)], ["Ingreso mensual", dinero(s.ingreso_mensual)],
          ...(s.ocupacion === "empleado" ? ([["Empresa", s.empresa], ["Teléfono empresa", s.telefono_empresa]] as Fila[]) : []),
          ["Dirección", s.direccion], ["Dirección catastral", s.direccion_catastral ?? s.direccion_norm], ["Comuna / corregimiento", s.nombre_division], ["Barrio / vereda", s.nombre_barrio_vereda],
          ["Estrato", s.estrato],
          ["Coordenadas", s.latitud !== null && s.longitud !== null ? `${s.latitud}, ${s.longitud}` : null], ["Residencia en Cali (años)", s.anios_residencia], ["Teléfono", s.telefono], ["Correo", s.correo],
          ["Notificación electrónica (Ley 1437)", s.notificacion_electronica], ["Caja de compensación", s.caja_compensacion === true ? `Sí: ${texto(s.caja_cual)}` : s.caja_compensacion],
          ["Sisbén", s.sisben === true ? `Sí: ${texto(s.sisben_grupo)}${texto(s.sisben_subgrupo)}` : s.sisben], ["Condición especial", condiciones],
        ]}
      />

      <section aria-labelledby="sec-hogar" className="flex flex-col gap-2">
        <h3 id="sec-hogar" className="text-lg font-bold text-primary-strong">2. Grupo familiar ({p.hogar.personas} personas)</h3>
        {p.hogar.integrantes.length === 0 ? (
          <p className="rounded-lg border border-border p-4">El solicitante vive solo (no registró integrantes).</p>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-border">
            <table className="w-full text-left text-sm">
              <thead className="bg-surface">
                <tr>{["Nombre", "Nacimiento", "Documento", "Parentesco", "Estado civil", "Ocupación", "Género", "Condición", "Ingresos"].map((h) => <th key={h} className="p-2">{h}</th>)}</tr>
              </thead>
              <tbody>
                {p.hogar.integrantes.map((m, i) => (
                  <tr key={i} className="border-t border-border">
                    <td className="p-2 font-medium">{m.nombres_apellidos}</td>
                    <td className="p-2">{texto(m.fecha_nacimiento)}</td>
                    <td className="p-2">{m.tipo_documento ? `${TIPOS_DOCUMENTO_INTEGRANTE[m.tipo_documento].split(" ")[0]} ${texto(m.numero_documento)}` : SIN}</td>
                    <td className="p-2">{texto(de(PARENTESCOS, m.parentesco))}</td>
                    <td className="p-2">{texto(de(ESTADOS_CIVILES, m.estado_civil))}</td>
                    <td className="p-2">{texto(de(OCUPACIONES_INTEGRANTE, m.ocupacion))}</td>
                    <td className="p-2">{texto(de(IDENTIDADES_GENERO, m.identidad_genero))}</td>
                    <td className="p-2">{texto(de(CONDICIONES_ESPECIALES, m.condicion_especial))}</td>
                    <td className="p-2 tabular-nums">{dinero(m.ingresos)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <p className="font-semibold">Total ingresos del grupo familiar: {formatoCop(p.hogar.total_ingresos)} ({p.hogar.ingreso_en_smlmv} SMLMV)</p>
      </section>

      <Tabla
        id="sec-subsidio"
        titulo="3. Modalidad del subsidio"
        filas={[
          ["Modalidad", `${po.modalidad}. ${MODALIDADES[po.modalidad]}`], ["Observaciones", po.observaciones],
          ...(po.obligacion
            ? ([
                ["Entidad acreedora", de(ENTIDADES_ACREEDORAS, po.obligacion.entidad_acreedora)], ["No. de obligación", po.obligacion.numero_obligacion],
                ["Programa o proyecto", po.obligacion.programa], ["Saldo adeudado", dinero(po.obligacion.saldo_adeudado)],
                ["Estado de la obligación", de(ESTADOS_OBLIGACION, po.obligacion.estado)], ["Autoriza giro al acreedor", po.obligacion.autoriza_giro],
              ] as Fila[])
            : []),
          ...(po.proyecto
            ? ([["Proyecto habitacional", po.proyecto.nombre], ["Constructora", po.proyecto.constructora], ["Tipo de proyecto", po.proyecto.tipo_vivienda ? String(po.proyecto.tipo_vivienda).toUpperCase() : null], ["Valor VIS", dinero(po.proyecto.valor_vis)], ["Valor VIP", dinero(po.proyecto.valor_vip)]] as Fila[])
            : []),
        ]}
      />

      <Tabla
        id="sec-recursos"
        titulo="5.1 Recursos para el cierre financiero"
        filas={[
          ...po.fuentes.map((f): Fila => {
            const r = po.recursos[f as FuenteRecurso];
            return [FUENTES_RECURSOS[f as FuenteRecurso].etiqueta, `${dinero(r?.valor)} · ${texto(r?.entidad)}${r?.resolucion ? ` · ${r.resolucion}` : ""}`];
          }),
          ["Total aportes del hogar", dinero(po.total_aportes)],
        ]}
      />

      <section aria-labelledby="sec-validacion" className="flex flex-col gap-3">
        <h2 id="sec-validacion" className="text-lg font-bold text-primary-strong">Validación</h2>
        {p.validacion ? (
          <div className="grid gap-4 rounded-lg border-2 border-success p-4 sm:grid-cols-[1fr_auto]">
            <dl className="grid gap-x-6 gap-y-1 sm:grid-cols-[12rem_1fr]">
              <dt className="text-sm text-muted">Código de validación</dt>
              <dd data-testid="codigo-validacion" className="font-bold tabular-nums">{p.validacion.codigo_validacion}</dd>
              <dt className="text-sm text-muted">Validada por</dt>
              <dd className="font-medium">{p.validacion.funcionario_nombre} ({p.validacion.funcionario_correo})</dd>
              <dt className="text-sm text-muted">Fecha y hora</dt>
              <dd className="font-medium">{p.validacion.validado_en}</dd>
              <dt className="text-sm text-muted">Folios anexos</dt>
              <dd className="font-medium">{texto(p.validacion.folios_anexos)}</dd>
              <dt className="text-sm text-muted">Paquete de documentación</dt>
              <dd className="font-medium">Recepción completa confirmada</dd>
            </dl>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={`${foto("firma")}?validacion=${p.validacion.codigo_validacion}`} alt="Firma del funcionario que validó" className="h-24 w-48 rounded-lg border border-border bg-white object-contain" />
          </div>
        ) : (
          <BotonValidar id={p.id} radicado={p.radicado} faltantes={p.faltantes.length} />
        )}
      </section>

      <section aria-labelledby="sec-historial" className="flex flex-col gap-2">
        <h2 id="sec-historial" className="text-lg font-bold text-primary-strong">Historial</h2>
        <ol className="flex flex-col gap-1 text-sm">
          {p.historial.map((h) => (
            <li key={h.id}>
              <span className="font-semibold">{h.tipo === "creacion" ? "Creación" : h.tipo === "edicion" ? "Edición" : h.tipo === "validacion" ? "Validación" : h.tipo}</span> · {h.por_nombre} ·{" "}
              {h.en ? fechaHoraBogota(h.en) : ""}
              {typeof h.faltantes === "number" ? ` · ${h.faltantes} dato(s) faltante(s)` : ""}
            </li>
          ))}
        </ol>
      </section>
    </div>
  );
}
