// Form values <-> stored record. The form holds strings ("si"/"no", digits) so drafts restore exactly what was on screen.
import { FIRMA_VACIA } from "@/modules/firma/domain/schema";
import { CODIGOS_FUENTES } from "./catalogos";
import type { Valores } from "./armar";

export const INTEGRANTE_VACIO = {
  nombres_apellidos: "", fecha_nacimiento: "", tipo_documento: "", numero_documento: "", condiciones_especiales: [] as string[],
  parentesco: "", estado_civil: "", ocupacion: "", identidad_genero: "", ingresos: "",
};

const recursosVacios = () => Object.fromEntries(CODIGOS_FUENTES.map((f) => [f, { valor: "", entidad: "", resolucion: "" }]));

export function valoresIniciales(documento: string, tipo = "cc"): Valores {
  return {
    solicitante: {
      nombres: "", apellidos: "", tipo_documento: tipo, numero_documento: documento, lugar_expedicion: "", fecha_expedicion: "",
      fecha_nacimiento: "", lugar_nacimiento: "", lugar_nacimiento_otro: "", ingreso_mensual: "", genero: "", genero_otro: "", ocupacion: "",
      direccion: "", direccion_catastral: "", codigo_division: "", id_barrio_vereda: "", estrato: "", latitud: "", longitud: "", anios_residencia: "",
      telefono: "", telefono_pais: "CO", correo: "", empresa: "", telefono_empresa: "", telefono_empresa_pais: "CO",
      notificacion_electronica: "", caja_compensacion: "", caja_cual: "", sisben: "", sisben_grupo: "", sisben_subgrupo: "",
      condiciones_especiales: [],
    },
    documentos: { documento_frente: "", documento_reverso: "" },
    hogar: { integrantes: [] },
    postulacion: {
      modalidad: "", entidad_acreedora: "", numero_obligacion: "", programa_obligacion: "", saldo_adeudado: "",
      estado_obligacion: "", autoriza_giro: false, proyecto_nombre: "", constructora: "", tipo_vivienda: "", valor_vis: "", valor_vip: "",
      fuentes: [], recursos: recursosVacios(),
    },
    consentimiento: { acepta_tratamiento: false, acepta_datos_sensibles: false, version: "" },
    declaracion: { acepta: false, version: "" },
    firma: { ...FIRMA_VACIA },
  };
}

const str = (v: unknown) => (v === null || v === undefined ? "" : typeof v === "boolean" ? (v ? "si" : "no") : String(v));
const strs = (o: Record<string, unknown> | null | undefined) => Object.fromEntries(Object.entries(o ?? {}).map(([k, v]) => [k, Array.isArray(v) ? v : str(v)]));

type Guardado = {
  solicitante: Record<string, unknown>;
  hogar: { integrantes: readonly Record<string, unknown>[] };
  postulacion: { modalidad: string; obligacion: Record<string, unknown> | null; proyecto: Record<string, unknown> | null; fuentes: readonly string[]; recursos: Record<string, unknown> };
};

/** Stored record -> form values, for the staff edit (S11). Inverse of armarDatos for every editable field. */
export function aValores(r: Guardado): Valores {
  const base = valoresIniciales(String(r.solicitante.numero_documento ?? ""));
  const o = r.postulacion.obligacion ?? {};
  const pr = r.postulacion.proyecto ?? {};
  const recursos = recursosVacios();
  for (const [f, v] of Object.entries(r.postulacion.recursos ?? {})) recursos[f] = { ...recursos[f], ...strs(v as Record<string, unknown>) };
  return {
    ...base,
    solicitante: { ...base.solicitante, ...strs(r.solicitante), condiciones_especiales: [...((r.solicitante.condiciones_especiales as string[]) ?? [])] },
    hogar: { integrantes: r.hogar.integrantes.map((m) => ({ ...INTEGRANTE_VACIO, ...strs(m) })) },
    postulacion: {
      ...base.postulacion,
      modalidad: r.postulacion.modalidad,
      entidad_acreedora: str(o.entidad_acreedora), numero_obligacion: str(o.numero_obligacion), programa_obligacion: str(o.programa),
      saldo_adeudado: str(o.saldo_adeudado), estado_obligacion: str(o.estado), autoriza_giro: o.autoriza_giro === true,
      proyecto_nombre: str(pr.nombre), constructora: str(pr.constructora), tipo_vivienda: str(pr.tipo_vivienda), valor_vis: str(pr.valor_vis), valor_vip: str(pr.valor_vip),
      fuentes: [...r.postulacion.fuentes],
      recursos,
    },
  };
}
