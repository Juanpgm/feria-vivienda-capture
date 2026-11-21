// Catalogues of the field-visit format MMDS01.02.04.P003.F003 v004 ("Formato único de evaluación de vivienda
// para mejoramiento"). Keys are stable codes stored in Firestore; values are the labels shown in the UI.

export const FORMATO = { codigo: "MMDS01.02.04.P003.F003", version: "004" } as const;

/** Who receives the visit. `otro` requires free text. */
export const RELACIONES_ATIENDE = {
  propietario: "Propietario",
  arrendatario: "Arrendatario",
  familiar: "Familiar",
  otro: "Otro",
} as const;
export type RelacionAtiende = keyof typeof RELACIONES_ATIENDE;

export const TIPOS_DOCUMENTO = {
  cc: "Cédula de ciudadanía (C.C.)",
  ce: "Cédula de extranjería (C.E.)",
  ppt: "Permiso por protección temporal (PPT)",
  pa: "Pasaporte",
} as const;

/** "APLICA AL MEJORAMIENTO? Si, para:" */
export const APLICA_PARA = {
  piso: "Piso",
  bano: "Baño",
  cocina: "Cocina",
  acabado_muros: "Acabado muros",
  espacio_3x3: "Espacio 3x3",
  alcantarillado_piso: "Alcantarillado y piso",
  cubierta: "Cubierta",
} as const;

/** "APLICA AL MEJORAMIENTO? No, por:" */
export const NO_APLICA_POR = {
  sbc: "S.B.C.",
  alquilada: "Alquilada",
  subsidio: "Subsidio",
  ausencia: "Ausencia",
  fallecido: "Fallecido",
  desiste: "Desiste",
} as const;

export const ALCANCES = { tipo: "Tipo", adecuacion: "Adecuación" } as const;

export const SI_NO = { si: "Sí", no: "No" } as const;
export const ESTADOS = { b: "Bueno", r: "Regular", m: "Malo" } as const;

export type Pregunta =
  | { clave: string; etiqueta: string; tipo: "si_no" | "estado" | "texto" | "numero" }
  | { clave: string; etiqueta: string; tipo: "opcion"; opciones: Record<string, string> };

export type SeccionDiagnostico = { clave: string; titulo: string; preguntas: Pregunta[] };

const siNo = (clave: string, etiqueta: string): Pregunta => ({ clave, etiqueta, tipo: "si_no" });
const estado = (clave = "estado", etiqueta = "Estado"): Pregunta => ({ clave, etiqueta, tipo: "estado" });
const texto = (clave: string, etiqueta: string): Pregunta => ({ clave, etiqueta, tipo: "texto" });
const numero = (clave: string, etiqueta: string): Pregunta => ({ clave, etiqueta, tipo: "numero" });

export const MATERIALES_CUBIERTA = { losa: "Losa", eternit: "Eternit", zinc: "Zinc", teja_barro: "Teja de barro", pvc: "PVC", otro: "Otro" } as const;
export const MATERIALES_PISO = {
  tierra: "Tierra",
  baldosa: "Baldosa",
  concreto: "Concreto",
  ceramica: "Cerámica",
  concreto_pulido: "Concreto pulido",
  otro: "Otro",
} as const;

/** Diagnostic blocks of the format, in the order they appear on paper. Every answer is optional. */
export const SECCIONES: SeccionDiagnostico[] = [
  { clave: "repello", titulo: "Repello", preguntas: [siNo("existen", "¿Existen?"), estado()] },
  { clave: "estuco_pintura", titulo: "Estuco y pintura", preguntas: [siNo("existen", "¿Existen?"), estado()] },
  {
    clave: "sanitarias",
    titulo: "Instalaciones sanitarias",
    preguntas: [siNo("acometida", "¿Acometida?"), estado(), siNo("pozo_septico", "Pozo séptico / filtro anaeróbico"), siNo("trampa_grasas", "Trampa de grasas")],
  },
  { clave: "hidraulicas", titulo: "Instalaciones hidráulicas", preguntas: [siNo("acometida", "¿Acometida?"), estado(), siNo("tanque_agua", "Tanque de agua")] },
  { clave: "electricas", titulo: "Instalaciones eléctricas", preguntas: [siNo("acometida", "¿Acometida?"), estado()] },
  {
    clave: "desmonte",
    titulo: "Desmonte o demolición",
    preguntas: [siNo("contrapiso", "Contrapiso"), siNo("enchape", "Enchape"), siNo("muros", "Muros"), siNo("meson", "Mesón"), texto("otros", "Otros (cantidad o descripción)")],
  },
  { clave: "fachada", titulo: "Fachada", preguntas: [numero("niveles", "Niveles de la vivienda"), siNo("acabados", "Acabados"), estado()] },
  {
    clave: "escaleras",
    titulo: "Escaleras",
    preguntas: [
      siNo("existen", "¿Existen?"),
      { clave: "ubicacion", etiqueta: "Ubicación", tipo: "opcion", opciones: { internas: "Internas", externas: "Externas" } },
      texto("nivel_ejecucion", "Nivel de ejecución (piso)"),
    ],
  },
  {
    clave: "cubierta",
    titulo: "Cubierta",
    preguntas: [
      siNo("existen", "¿Existen?"),
      { clave: "material", etiqueta: "Tipo de material", tipo: "opcion", opciones: MATERIALES_CUBIERTA },
      texto("material_otro", "Otro material, ¿cuál?"),
      estado(),
    ],
  },
  {
    clave: "cocina",
    titulo: "Cocina",
    preguntas: [
      siNo("enchape", "Enchape"),
      estado("enchape_estado", "Estado del enchape"),
      siNo("meson", "Mesón"),
      estado("meson_estado", "Estado del mesón"),
      siNo("lavaplatos", "Lavaplatos"),
      estado("lavaplatos_estado", "Estado del lavaplatos"),
    ],
  },
  {
    clave: "acceso",
    titulo: "Acceso a la vivienda",
    preguntas: [siNo("peatonal", "Peatonal"), siNo("gradas", "Gradas"), siNo("via_vehicular", "Vía vehicular"), texto("acarreo", "¿Necesita acarreo?")],
  },
  { clave: "puertas", titulo: "Puertas internas", preguntas: [numero("cantidad", "¿Cuántas?")] },
  {
    clave: "bano",
    titulo: "Baño",
    preguntas: [
      siNo("enchape", "Enchape"),
      estado("enchape_estado", "Estado del enchape"),
      siNo("sanitario", "Sanitario"),
      estado("sanitario_estado", "Estado del sanitario"),
      siNo("lavamanos", "Lavamanos"),
      estado("lavamanos_estado", "Estado del lavamanos"),
    ],
  },
  {
    clave: "piso",
    titulo: "Piso",
    preguntas: [
      { clave: "material", etiqueta: "Tipo de material", tipo: "opcion", opciones: MATERIALES_PISO },
      texto("material_otro", "Otro material, ¿cuál?"),
      estado(),
    ],
  },
];

/** Chapter names offered when building the quantities list (free text is also allowed). */
export const CAPITULOS_SUGERIDOS = [
  "Preliminares",
  "Desmonte o demolición",
  "Piso",
  "Alcantarillado y piso",
  "Baño",
  "Cocina",
  "Acabado muros",
  "Repellos",
  "Estuco y pintura",
  "Espacio 3x3",
  "Cubierta",
  "Fachada",
  "Escaleras",
  "Acceso a la vivienda",
  "Instalaciones sanitarias",
  "Instalaciones hidráulicas",
  "Instalaciones eléctricas",
  "Puertas internas",
  "Limpieza",
] as const;

/** Preset text of "OBSERVACIONES" in the format; the inspector continues writing after it. */
export const OBSERVACIONES_PRESET =
  "Se explican los alcances del programa de mejoramiento de vivienda. Se aclara que la visita técnica No significa que la persona ya sea beneficiaria del subsidio.";
