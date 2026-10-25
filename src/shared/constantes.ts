// Single source of truth for fixed enums (UI, zod schemas, dashboard). Codes: Spanish snake_case ASCII.
// Labels come from the PDF form / PROMPT. SMLMV income brackets live in smlmv.ts (they depend on the SMLMV value).

type Opciones<T extends string> = { readonly [K in T]: string };

export const TIPOS_DOCUMENTO = { cc: "C.C.", ce: "C.E.", otro: "Otro" } as const;
export type TipoDocumento = keyof typeof TIPOS_DOCUMENTO;

export const ESTADOS_CIVILES = {
  soltero: "Soltero/a",
  casado: "Casado/a",
  union_libre: "Unión Libre",
  viudo: "Viudo/a",
} as const;
export type EstadoCivil = keyof typeof ESTADOS_CIVILES;

export const DICTAMENES = {
  colapso_total: "Colapso Total (Destruido)",
  demolido: "Demolido",
  orden_demolicion: "Con orden de demolición",
  demolicion_en_proceso: "Demolición en proceso",
  arreglos_locativos: "Arreglos locativos",
  otro: "Otro",
} as const;
export type Dictamen = keyof typeof DICTAMENES;

/** Special constitutional protection (PDF section 5). `ninguna` is exclusive. */
export const CONDICIONES_ESPECIALES = {
  discapacidad: "Persona en situación de discapacidad",
  victima_conflicto: "Víctima del conflicto armado (RUV)",
  mujer_vbg: "Mujer víctima de violencia basada en género (VBG)",
  cuidador_discapacidad: "Cuidador/a de persona en situación de discapacidad",
  reincorporacion: "Persona en proceso de reincorporación / desmovilizado",
  mujer_cabeza_hogar: "Mujer cabeza de hogar",
  ninguna: "Ninguna",
} as const;
export type CondicionEspecial = keyof typeof CONDICIONES_ESPECIALES;

/** Financing sources (PDF section 8). `ninguna` is exclusive. */
export const FUENTES_FINANCIACION = {
  credito_hipotecario: "Crédito hipotecario / Leasing habitacional",
  subsidio_concurrente: "Subsidio concurrente",
  ahorro_cesantias: "Ahorro programado / Cesantías",
  indemnizacion_seguro: "Indemnización de seguro",
  recursos_propios: "Recursos propios",
  ninguna: "Ninguna",
} as const;
export type FuenteFinanciacion = keyof typeof FUENTES_FINANCIACION;

export const TITULARIDADES = {
  propietario_clt: "Propietario con título o Certificado de Libertad y Tradición (CLT)",
  poseedor_legitimo: "Poseedor legítimo acreditado",
} as const;
export type Titularidad = keyof typeof TITULARIDADES;

export const ESTADOS_SGOV = {
  habilitado: "Habilitado",
  no_habilitado: "No Habilitado",
  pendiente_subsanacion: "Pendiente Subsanación",
} as const;

/** Bands derived from the PDF (sections 6 and 7). */
export const BANDAS_ADULTO_MAYOR = {
  mayor_74: "Adulto mayor de más de 74 años",
  "65_73": "Adulto mayor entre 65 y 73 años",
  ninguno: "No registra adultos mayores de 65 años o más",
} as const satisfies Opciones<string>;
export type BandaAdultoMayor = keyof typeof BANDAS_ADULTO_MAYOR;

export const BANDAS_HOGAR = {
  "1": "Hogar unipersonal - 1 integrante",
  "2_3": "Hogar de dos (2) o tres (3) integrantes",
  "4_mas": "Hogar de cuatro (4) o más integrantes",
} as const satisfies Opciones<string>;
export type BandaHogar = keyof typeof BANDAS_HOGAR;
