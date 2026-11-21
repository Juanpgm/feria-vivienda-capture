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
export type ClaveAplica = keyof typeof APLICA_PARA;

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
/** State of each house element; "No existe" replaces the format's separate "¿Existen?" question. */
export const ESTADOS_ELEMENTO = { b: "Bueno", r: "Regular", m: "Malo", ne: "No existe" } as const;

export type Pregunta =
  | { clave: string; etiqueta: string; tipo: "si_no" | "texto" | "numero" }
  | { clave: string; etiqueta: string; tipo: "opcion"; opciones: Record<string, string> };

export type ElementoVivienda = { clave: string; etiqueta: string; grupo: string };

const grupo = (nombre: string, elementos: [string, string][]): ElementoVivienda[] => elementos.map(([clave, etiqueta]) => ({ clave, etiqueta, grupo: nombre }));

/** House elements rated in "Estado de la vivienda", in display order. Keys are stored in Firestore. */
export const ELEMENTOS_VIVIENDA: readonly ElementoVivienda[] = [
  ...grupo("Acabados", [["repello", "Repello"], ["estuco_pintura", "Estuco y pintura"], ["fachada", "Fachada"]]),
  ...grupo("Instalaciones", [["sanitarias", "Instalaciones sanitarias"], ["hidraulicas", "Instalaciones hidráulicas"], ["electricas", "Instalaciones eléctricas"]]),
  ...grupo("Cocina", [["cocina_enchape", "Enchape"], ["cocina_meson", "Mesón"], ["cocina_lavaplatos", "Lavaplatos"]]),
  ...grupo("Baño", [["bano_enchape", "Enchape"], ["bano_sanitario", "Sanitario"], ["bano_lavamanos", "Lavamanos"]]),
  ...grupo("Estructura", [["cubierta", "Cubierta"], ["piso", "Piso"], ["escaleras", "Escaleras"]]),
];

const siNo = (clave: string, etiqueta: string): Pregunta => ({ clave, etiqueta, tipo: "si_no" });
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

/** Non-state fields kept from the format, all optional; keys are flat and unique across groups. */
export const DETALLES_OPCIONALES: readonly { titulo: string; preguntas: Pregunta[] }[] = [
  {
    titulo: "Materiales",
    preguntas: [
      { clave: "cubierta_material", etiqueta: "Material de la cubierta", tipo: "opcion", opciones: MATERIALES_CUBIERTA },
      texto("cubierta_material_otro", "Otro material de cubierta, ¿cuál?"),
      { clave: "piso_material", etiqueta: "Material del piso", tipo: "opcion", opciones: MATERIALES_PISO },
      texto("piso_material_otro", "Otro material de piso, ¿cuál?"),
    ],
  },
  {
    titulo: "Instalaciones",
    preguntas: [siNo("pozo_septico", "Pozo séptico / filtro anaeróbico"), siNo("trampa_grasas", "Trampa de grasas"), siNo("tanque_agua", "Tanque de agua")],
  },
  {
    titulo: "Vivienda",
    preguntas: [
      numero("niveles", "Niveles de la vivienda"),
      { clave: "escaleras_ubicacion", etiqueta: "Escaleras", tipo: "opcion", opciones: { internas: "Internas", externas: "Externas" } },
      texto("escaleras_nivel_ejecucion", "Nivel de ejecución (piso)"),
      numero("puertas_internas", "Puertas internas, ¿cuántas?"),
    ],
  },
  {
    titulo: "Acceso a la vivienda",
    preguntas: [siNo("acceso_peatonal", "Peatonal"), siNo("acceso_gradas", "Gradas"), siNo("acceso_via_vehicular", "Vía vehicular"), texto("acarreo", "¿Necesita acarreo?")],
  },
  {
    titulo: "Desmonte o demolición",
    preguntas: [
      siNo("desmonte_contrapiso", "Contrapiso"),
      siNo("desmonte_enchape", "Enchape"),
      siNo("desmonte_muros", "Muros"),
      siNo("desmonte_meson", "Mesón"),
      texto("desmonte_otros", "Otros (cantidad o descripción)"),
    ],
  },
];

/** House elements that matter for each improvement ("Estado enfocado"). */
export const ELEMENTOS_POR_APLICA: Record<ClaveAplica, readonly string[]> = {
  piso: ["piso"],
  bano: ["bano_enchape", "bano_sanitario", "bano_lavamanos", "sanitarias", "hidraulicas"],
  cocina: ["cocina_enchape", "cocina_meson", "cocina_lavaplatos", "hidraulicas", "sanitarias"],
  acabado_muros: ["repello", "estuco_pintura", "fachada"],
  espacio_3x3: ["piso", "repello", "cubierta", "electricas"],
  alcantarillado_piso: ["sanitarias", "piso"],
  cubierta: ["cubierta"],
};

/** Splits ELEMENTOS_VIVIENDA into the elements of the selected improvements and the rest, both in list order. */
export function elementosEnfocados(aplicaPara: readonly string[]): { relevantes: ElementoVivienda[]; otras: ElementoVivienda[] } {
  const claves = new Set(aplicaPara.flatMap((k) => ELEMENTOS_POR_APLICA[k as ClaveAplica] ?? []));
  return { relevantes: ELEMENTOS_VIVIENDA.filter((e) => claves.has(e.clave)), otras: ELEMENTOS_VIVIENDA.filter((e) => !claves.has(e.clave)) };
}

const normalizar = (s: string) => s.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase().replace(/\s+/g, " ").trim();
// Longest label first so "Alcantarillado y piso" never falls to a shorter label.
const ETIQUETAS_APLICA = (Object.entries(APLICA_PARA) as [ClaveAplica, string][]).map(([k, v]) => [k, normalizar(v)] as const).sort((a, b) => b[1].length - a[1].length);

/** Improvement a chapter belongs to, by its name ("Baño", "PISOS", "Baño principal"); undefined for any other chapter. */
export function aplicaDeCapitulo(nombre: string): ClaveAplica | undefined {
  const n = normalizar(nombre);
  return n ? ETIQUETAS_APLICA.find(([, e]) => n.startsWith(e))?.[0] : undefined;
}

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
