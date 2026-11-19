// Option lists of the official format "Postulación Subsidio Distrital de Vivienda" (MMDS01.02.03.P001.F001 v010),
// taken from its "Tabla guía y convenciones". Keys are stable snake_case codes; labels are what the format prints.

export const FORMATO_CODIGO = "MMDS01.02.03.P001.F001";
export const FORMATO_VERSION = "010";

/** Section 1, applicant: "Tipo de documento". */
export const TIPOS_DOCUMENTO_SOLICITANTE = { cc: "Cédula de ciudadanía (C.C.)", ce: "Cédula de extranjería (C.E.)" } as const;

/** Section 2, household member: "TD". `me` = menor de 18 años (NUIP). */
export const TIPOS_DOCUMENTO_INTEGRANTE = {
  cc: "C.C. Cédula de ciudadanía",
  ce: "C.E. Cédula de extranjería",
  rc: "R.C. Registro civil",
  ti: "T.I. Tarjeta de identidad",
  me: "M.E. Menor de 18 años (NUIP)",
} as const;
/** Document types that only an adult (18+) can hold; the rest only a minor. */
export const DOCUMENTOS_ADULTO = ["cc", "ce"] as const;

export const GENEROS_SOLICITANTE = {
  cis_masculino: "Cisgénero masculino",
  cis_femenino: "Cisgénero femenino",
  transgenero: "Transgénero",
  otro: "Otro",
} as const;

/** The format offers three; "ninguna" covers applicants without an occupation (otherwise they could not answer). */
export const OCUPACIONES_SOLICITANTE = {
  empleado: "Empleado",
  independiente: "Independiente",
  pensionado: "Pensionado",
  ninguna: "Ninguna de las anteriores",
} as const;

export const GRUPOS_SISBEN = { A: "A", B: "B", C: "C", D: "D" } as const;
export const SUBGRUPO_MAX = 21;

export const CONDICIONES_ESPECIALES = {
  indigena: "Indígena",
  afrocolombiano: "Afrocolombiano",
  cabeza_hogar: "Mujer u hombre cabeza de hogar",
  victima_conflicto: "Víctima del conflicto",
  adulto_mayor: "Adulto mayor (mayor de 65 años)",
  desmovilizado: "Desmovilizado",
  reubicado_alto_riesgo: "Reubicado por alto riesgo",
  discapacidad: "Persona con discapacidad",
  lgbti: "LGBTI",
  reciclador: "Reciclador de oficio",
  rrom: "Rrom (población gitana)",
  mujer_victima_vbg: "Mujer víctima de violencia de género",
  poblacion_joven: "Población joven",
  docente_oficial: "Docente o directivo docente del sector oficial",
  empleado_publico: "Empleado público o trabajador oficial",
  miembro_jal: "Miembro de junta administradora local (JAL)",
  miembro_jac: "Miembro de junta de acción comunal (JAC)",
  sector_salud: "Persona vinculada al sector de la salud",
  fuerza_publica: "Miembro de la Fuerza Pública o personal civil del Ministerio de Defensa / Policía",
  deportista_alto_rendimiento: "Atleta o deportista de alto rendimiento",
  veterano_fuerza_publica: "Veterano de la Fuerza Pública",
  madre_padre_comunitario: "Madre o padre comunitario, o cuidador de persona con discapacidad",
  campesino: "Campesino",
  ninguna: "Ninguna",
} as const;

export const PARENTESCOS = {
  conyuge: "Cónyuge o compañero(a)",
  hijo: "Hijo(a)",
  hermano: "Hermano(a)",
  padre_madre: "Padre o madre",
  abuelo: "Abuelo(a)",
  nieto: "Nieto(a)",
  tio: "Tío(a)",
  sobrino: "Sobrino(a)",
  suegro: "Suegro(a)",
  cunado: "Cuñado(a)",
  padres_adoptantes: "Padres adoptantes",
  hijo_adoptivo: "Hijo(a) adoptivo(a)",
  nuera_yerno: "Nuera / yerno",
  ninguno: "Ninguno",
} as const;

export const ESTADOS_CIVILES = {
  soltero: "Soltero(a)",
  casado_union: "Casado(a) o unión marital de hecho",
  separado_viudo: "Separado(a) / viudo(a)",
  no_aplica: "No aplica",
} as const;

export const OCUPACIONES_INTEGRANTE = {
  hogar: "Hogar",
  empleado: "Empleado",
  pensionado: "Pensionado",
  estudiante: "Estudiante",
  independiente: "Independiente",
  desempleado: "Desempleado",
} as const;

export const IDENTIDADES_GENERO = {
  cis_masculino: "Cisgénero masculino",
  cis_femenino: "Cisgénero femenino",
  transgenero: "Transgénero",
  heterosexual: "Heterosexual",
  bisexual: "Bisexual",
  gay: "Gay",
  lesbiana: "Lesbiana",
  pansexual: "Pansexual",
  otro: "Otro",
} as const;

/** Section 3. Codes keep the format's number so printed forms and records can be cross-checked. */
export const MODALIDADES = {
  "1": "Adquisición de vivienda nueva",
  "2": "Adquisición de vivienda usada",
  "3": "Construcción en sitio propio",
  "4": "Arrendamiento",
  "5": "Mejoramiento de vivienda",
  "6": "Legalización de títulos",
  "7": "Inquilinato para adulto mayor",
  "8": "Leasing habitacional",
  "9": "Transferencia del derecho real de dominio (subsidio en especie)",
  "10": "Subsidio para adjudicatarios y/o deudores hipotecarios del FEV y/o de la SVSH",
} as const;
export type Modalidad = keyof typeof MODALIDADES;
/** Section 4 (obligación + autorización de giro) applies only to this modality. */
export const MODALIDAD_DEUDORES: Modalidad = "10";
/** Section 5 (proyecto de vivienda) applies only to these. */
export const MODALIDADES_CON_PROYECTO: readonly Modalidad[] = ["1", "2"];
/** Modalities where the financial closure (5.1) needs at least one source with a value. */
export const MODALIDADES_CON_CIERRE: readonly Modalidad[] = ["1", "2", "8"];

/** Section 5: the project the household applies to; only its value is asked, the other one is 0. */
export const TIPOS_VIVIENDA = { vis: "VIS (vivienda de interés social)", vip: "VIP (vivienda de interés prioritario)" } as const;

export const ENTIDADES_ACREEDORAS = { fev: "Fondo Especial de Vivienda (FEV)", svsh: "Secretaría de Vivienda Social y Hábitat (SVSH)" } as const;
export const ESTADOS_OBLIGACION = {
  al_dia: "Al día",
  en_mora: "En mora",
  cobro_persuasivo: "Cobro persuasivo",
  cobro_coactivo: "Cobro coactivo",
  cobro_juridico: "Cobro jurídico",
  facilidad_pago: "Facilidad de pago vigente",
} as const;

/** Kinds of entity in catalogo/entidades.json (Superfinanciera + Supersubsidio open data, scripts/build-catalogos-postulacion.mjs). */
export type TipoEntidad =
  | "banco" | "corporacion_financiera" | "compania_financiamiento" | "cooperativa_financiera" | "entidad_oficial" | "fondo_cesantias" | "caja_compensacion" | "entidad_publica";
const CREDITO: TipoEntidad[] = ["banco", "cooperativa_financiera", "compania_financiamiento", "corporacion_financiera", "entidad_oficial", "caja_compensacion"];

/**
 * Section 5.1 sources. `entidad` is the label of the entity field; `tipos` the kinds of entity offered in its list
 * (empty = free text, e.g. "Otros").
 */
export type FuenteRecurso = "subsidio_familiar" | "ahorro_programado" | "cesantias" | "creditos" | "aportes_gubernamentales" | "otros";
export const FUENTES_RECURSOS: Record<FuenteRecurso, { etiqueta: string; entidad: string; tipos: readonly TipoEntidad[] }> = {
  subsidio_familiar: { etiqueta: "Subsidio familiar de vivienda", entidad: "Entidad otorgante", tipos: ["caja_compensacion", "entidad_publica", "entidad_oficial"] },
  ahorro_programado: { etiqueta: "Ahorro programado", entidad: "Entidad financiera", tipos: ["banco", "cooperativa_financiera", "compania_financiamiento", "entidad_oficial"] },
  cesantias: { etiqueta: "Cesantías", entidad: "Fondo de cesantías", tipos: ["fondo_cesantias", "entidad_oficial"] },
  creditos: { etiqueta: "Créditos", entidad: "Entidad financiera", tipos: CREDITO },
  aportes_gubernamentales: { etiqueta: "Aportes gubernamentales", entidad: "Entidad", tipos: ["entidad_publica", "entidad_oficial"] },
  otros: { etiqueta: "Otros", entidad: "¿Cuál?", tipos: [] },
};
export const CODIGOS_FUENTES = Object.keys(FUENTES_RECURSOS) as FuenteRecurso[];

/** The format has 10 rows for household members. */
export const MAX_INTEGRANTES = 10;

export const ESTADOS_POSTULACION = { sin_validar: "Sin validar", valido: "Válido" } as const;
export type EstadoPostulacion = keyof typeof ESTADOS_POSTULACION;

export const opciones = (o: Record<string, string>) => Object.entries(o).map(([value, label]) => ({ value, label }));
