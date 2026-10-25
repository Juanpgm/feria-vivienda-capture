// Deterministic, clearly fake applicants for the e2e specs ("PRUEBA E2E ...", documents 9xxxxxx, +57 300 555 xxxx
// phones, @example.test emails). Nothing here is real personal data.
//
// The same cases can later drive a full submit test (steps 8-10 + POST /api/registros): `Caso` carries everything
// the steps 1-7 UI needs (`extra` holds steps 4-7).
import { DICTAMENES, TITULARIDADES } from "../src/shared/constantes";

/** Fixed SMLMV 2026 used as an independent oracle (the app reads it from src/modules/cierre-financiero/domain/smlmv.ts). */
export const SMLMV_ORACULO = 1_750_905;

export const ETIQUETA_RANGO = {
  "0_4": "De 0 a 4 SMLMV",
  "4_5_5": "De >4 a 5.5 SMLMV",
  mas_5_5: "Superior a 5.5 SMLMV",
} as const;
export type CodigoRango = keyof typeof ETIQUETA_RANGO;

export type Nacionalidad = { codigo: string; nombre: string };

/** Values exactly as a person would type them (before blur normalization). */
export type Solicitante = {
  nombre: string;
  tipoDocumento: "cc" | "ce" | "otro";
  tipoDocumentoOtro?: string;
  /** CC forces Colombiana (the combobox is disabled); CE / Otro pick from the catalog. */
  nacionalidad: Nacionalidad;
  documento: string;
  expedicion: string;
  telefono1: string;
  telefono2?: string;
  correo: string;
  aniosResidencia: string;
  nacimiento: string;
  estadoCivil: "soltero" | "casado" | "union_libre" | "viudo";
};

export type Composicion = {
  personas: string;
  adultoMayor?: "si" | "no";
  /** One age per older adult, typed as strings. */
  edades: string[];
  /** Checkbox clicks in order (exclusivity of "ninguna" is applied by the UI). */
  condiciones: string[];
  ingreso: string;
};

/** Steps 4-7. Empty / undefined values are simply not filled (negative cases). */
export type Vivienda = {
  direccion: string;
  /** Code and label as the combobox shows it. */
  division?: { codigo: string; etiqueta: string; sector: "Urbano" | "Rural" };
  /** Catalog barrio/vereda; mutually exclusive with `barrioOtro` (the "not listed" free text). */
  lugar?: { id: string; nombre: string };
  barrioOtro?: string;
  estrato?: number;
};
export type RiesgoDatos = {
  rud?: "si" | "no";
  numero?: string;
  /** RUD "si" with the explicit "No lo sabe" checkbox. */
  noSabe?: boolean;
  dictamen?: keyof typeof DICTAMENES;
  dictamenOtro?: string;
};
export type TitularidadDatos = { tipo?: keyof typeof TITULARIDADES; matricula?: string };
export type FinancieroDatos = {
  /** Checkbox clicks in order (exclusivity of "ninguna" is applied by the UI). */
  fuentes: string[];
  seguro?: "si" | "no";
  aseguradora?: { codigo: string; nombre: string };
  aseguradoraOtra?: string;
};
export type Extra = { vivienda: Vivienda; riesgo: RiesgoDatos; titularidad: TitularidadDatos; financiero: FinancieroDatos };

/** What the UI must show after blur / what the domain must derive. */
export type Esperado = {
  nombre: string;
  documento: string;
  telefono1: string;
  telefono2: string | null;
  correo: string;
  anios: string;
  nacionalidad: string;
  edad: number;
  ingresoCop: number;
  rango: CodigoRango;
  bandaHogar: "1" | "2_3" | "4_mas";
  bandaAdultoMayor: "mayor_74" | "65_73" | "ninguno";
  condicionesFinales: string[];
  menorDeEdad: boolean;
};

export type Caso = {
  clave: string;
  descripcion: string;
  solicitante: Solicitante;
  composicion: Composicion;
  extra: Extra;
  esperado: Esperado;
};

/** Negative case: the first `paso` - 1 steps are valid, step `paso` must refuse to advance and show `mensajes`. */
export type CasoInvalido = Omit<Caso, "esperado"> & { paso: 1 | 2 | 3 | 4 | 5 | 6 | 7; mensajes: string[]; mensajesUi?: string[] };

// ---- date helpers (ISO yyyy-mm-dd, UTC arithmetic) ----
const iso = (d: Date) => d.toISOString().slice(0, 10);
const aFecha = (s: string) => new Date(`${s}T00:00:00Z`);
export function sumarDias(fecha: string, dias: number): string {
  const d = aFecha(fecha);
  d.setUTCDate(d.getUTCDate() + dias);
  return iso(d);
}
export function restarAnios(fecha: string, anios: number): string {
  const d = aFecha(fecha);
  d.setUTCFullYear(d.getUTCFullYear() - anios);
  return iso(d);
}
export function edadEn(nacimiento: string, hoy: string): number {
  const [ny, nm, nd] = nacimiento.split("-").map(Number);
  const [hy, hm, hd] = hoy.split("-").map(Number);
  return hy - ny - (hm < nm || (hm === nm && hd < nd) ? 1 : 0);
}

const COLOMBIANA: Nacionalidad = { codigo: "CO", nombre: "Colombiana" };

/** Mirrors the exclusivity rule of step 3 so the expected final state is independent of the UI code. */
export function condicionesFinales(clicks: readonly string[]): string[] {
  let sel: string[] = [];
  for (const c of clicks) {
    if (c === "ninguna") sel = sel.includes("ninguna") ? [] : ["ninguna"];
    else sel = sel.includes(c) ? sel.filter((x) => x !== c) : [...sel.filter((x) => x !== "ninguna"), c];
  }
  return sel;
}

function rangoDe(ingreso: number): CodigoRango {
  return ingreso <= 4 * SMLMV_ORACULO ? "0_4" : ingreso <= 5.5 * SMLMV_ORACULO ? "4_5_5" : "mas_5_5";
}

const CALLES = ["CALLE 5 # 10-20", "cra 12 No 5-20", "Avenida 3 Norte 45-12", "CL 25 # 100-33 Apto 201", "Diagonal 26 #  72 - 15", "Vereda sin nomenclatura casa 4"];

/** Eight variants rotated over the valid cases: together they cover every option of steps 4-7. */
const VARIANTES: Extra[] = [
  {
    vivienda: { direccion: CALLES[0], division: { codigo: "01", etiqueta: "Comuna 1", sector: "Urbano" }, lugar: { id: "0199", nombre: "Aguacatal" }, estrato: 1 },
    riesgo: { rud: "si", numero: "RUD-12345", dictamen: "colapso_total" },
    titularidad: { tipo: "propietario_clt", matricula: "370-123456" },
    financiero: { fuentes: ["credito_hipotecario", "subsidio_concurrente"], seguro: "si", aseguradora: { codigo: "allianz_seguros", nombre: "Allianz Seguros" } },
  },
  {
    vivienda: { direccion: CALLES[1], division: { codigo: "03", etiqueta: "Comuna 3", sector: "Urbano" }, lugar: { id: "0310", nombre: "El Calvario" }, estrato: 2 },
    riesgo: { rud: "no", dictamen: "demolido" },
    titularidad: { tipo: "poseedor_legitimo" },
    financiero: { fuentes: ["ninguna"], seguro: "no" },
  },
  {
    vivienda: { direccion: CALLES[2], division: { codigo: "19", etiqueta: "Comuna 19", sector: "Urbano" }, barrioOtro: "Sector Los Pinos", estrato: 3 },
    riesgo: { rud: "si", noSabe: true, dictamen: "orden_demolicion" },
    titularidad: { tipo: "propietario_clt", matricula: "50C-1234567" },
    financiero: { fuentes: ["ahorro_cesantias", "indemnizacion_seguro", "recursos_propios"], seguro: "si", aseguradora: { codigo: "otra", nombre: "Otra" }, aseguradoraOtra: "Seguros Prueba S.A." },
  },
  {
    vivienda: { direccion: CALLES[3], division: { codigo: "12", etiqueta: "Comuna 12", sector: "Urbano" }, lugar: { id: "1202", nombre: "Asturias" }, estrato: 4 },
    riesgo: { rud: "no", dictamen: "demolicion_en_proceso" },
    titularidad: { tipo: "poseedor_legitimo", matricula: "" },
    financiero: { fuentes: ["recursos_propios", "ninguna"], seguro: "no" },
  },
  {
    vivienda: { direccion: CALLES[4], division: { codigo: "53", etiqueta: "Corregimiento Pance", sector: "Rural" }, lugar: { id: "V5306", nombre: "El Banqueo" }, estrato: 5 },
    riesgo: { rud: "si", numero: "98765", dictamen: "arreglos_locativos" },
    titularidad: { tipo: "propietario_clt" },
    financiero: { fuentes: ["credito_hipotecario"], seguro: "si", aseguradora: { codigo: "axa_colpatria_seguros", nombre: "AXA Colpatria Seguros" } },
  },
  {
    vivienda: { direccion: CALLES[5], division: { codigo: "55", etiqueta: "Corregimiento Villacarmelo", sector: "Rural" }, barrioOtro: "Vereda La Esperanza", estrato: 6 },
    riesgo: { rud: "no", dictamen: "otro", dictamenOtro: "Grietas en vigas y columnas" },
    titularidad: { tipo: "poseedor_legitimo", matricula: "370-999" },
    financiero: { fuentes: ["subsidio_concurrente", "indemnizacion_seguro"], seguro: "no" },
  },
  {
    vivienda: { direccion: CALLES[0], division: { codigo: "01", etiqueta: "Comuna 1", sector: "Urbano" }, lugar: { id: "0101", nombre: "Terron Colorado" }, estrato: 3 },
    riesgo: { rud: "si", numero: "5", dictamen: "otro", dictamenOtro: "Deslizamiento" },
    titularidad: { tipo: "propietario_clt", matricula: "" },
    financiero: { fuentes: ["ahorro_cesantias"], seguro: "si", aseguradora: { codigo: "hdi_seguros", nombre: "HDI Seguros" } },
  },
  {
    vivienda: { direccion: CALLES[2], division: { codigo: "55", etiqueta: "Corregimiento Villacarmelo", sector: "Rural" }, lugar: { id: "V5505", nombre: "El Carmen" }, estrato: 2 },
    riesgo: { rud: "si", noSabe: true, dictamen: "colapso_total" },
    titularidad: { tipo: "poseedor_legitimo" },
    financiero: { fuentes: ["credito_hipotecario", "ninguna"], seguro: "no" },
  },
];

type Cambios = {
  s?: Partial<Solicitante>;
  c?: Partial<Composicion>;
  e?: Partial<Esperado>;
};

export function generarCasos(hoy: string): Caso[] {
  const baseS = (): Solicitante => ({
    nombre: "PRUEBA E2E BASE UNO",
    tipoDocumento: "cc",
    nacionalidad: COLOMBIANA,
    documento: "9000000",
    expedicion: restarAnios(hoy, 5),
    telefono1: "300 555 0100",
    correo: "base@example.test",
    aniosResidencia: "3",
    nacimiento: sumarDias(restarAnios(hoy, 40), -1),
    estadoCivil: "soltero",
  });
  const baseC = (): Composicion => ({ personas: "1", adultoMayor: "no", edades: [], condiciones: ["ninguna"], ingreso: "1500000" });

  let rotacion = 0;
  const caso = (clave: string, descripcion: string, x: Cambios): Caso => {
    const extra = VARIANTES[rotacion++ % VARIANTES.length];
    const solicitante = { ...baseS(), ...x.s };
    const composicion = { ...baseC(), ...x.c };
    const ingresoCop = Number(composicion.ingreso.replace(/\D/g, "")) || 0;
    const personas = Number(composicion.personas);
    const maxEdad = composicion.adultoMayor === "si" ? Math.max(0, ...composicion.edades.map(Number)) : 0;
    const edad = edadEn(solicitante.nacimiento, hoy);
    return {
      clave,
      descripcion,
      solicitante,
      composicion,
      extra,
      esperado: {
        nombre: "Prueba E2e Base Uno",
        documento: "9000000",
        telefono1: "+573005550100",
        telefono2: null,
        correo: "base@example.test",
        anios: "3",
        nacionalidad: solicitante.nacionalidad.nombre,
        edad,
        ingresoCop,
        rango: rangoDe(ingresoCop),
        bandaHogar: personas <= 1 ? "1" : personas <= 3 ? "2_3" : "4_mas",
        bandaAdultoMayor: maxEdad >= 74 ? "mayor_74" : maxEdad >= 65 ? "65_73" : "ninguno",
        condicionesFinales: condicionesFinales(composicion.condiciones),
        menorDeEdad: edad < 18,
        ...x.e,
      },
    };
  };

  const ven: Nacionalidad = { codigo: "VE", nombre: "Venezolana" };
  const ecu: Nacionalidad = { codigo: "EC", nombre: "Ecuatoriana" };
  const per: Nacionalidad = { codigo: "PE", nombre: "Peruana" };
  const hai: Nacionalidad = { codigo: "HT", nombre: "Haitiana" };
  const esp: Nacionalidad = { codigo: "ES", nombre: "Española" };
  const todas = ["discapacidad", "victima_conflicto", "mujer_vbg", "cuidador_discapacidad", "reincorporacion", "mujer_cabeza_hogar"];

  return [
    // --- names typed in UPPER / lower / mixed, documents with separators, phones in several formats ---
    caso("cc-nombre-mayusculas", "CC, nombre en MAYUSCULAS con tildes, documento con puntos", {
      s: { nombre: "PRUEBA E2E ANA MARÍA PÉREZ", documento: "9.000.001", telefono1: "300 555 0101", correo: "Prueba.E2E.01@Example.test" },
      e: { nombre: "Prueba E2e Ana María Pérez", documento: "9000001", telefono1: "+573005550101", correo: "prueba.e2e.01@example.test" },
    }),
    caso("cc-nombre-minusculas", "CC, nombre en minusculas, documento con comas, telefono pegado", {
      s: { nombre: "prueba e2e luis fernando gómez", documento: "9,000,002", telefono1: "3015550102" },
      e: { nombre: "Prueba E2e Luis Fernando Gómez", documento: "9000002", telefono1: "+573015550102" },
    }),
    caso("cc-nombre-mixto", "CC, nombre en mayusculas/minusculas mezcladas, documento con espacios, +57", {
      s: { nombre: "pRUEBA e2E mAría jOSÉ", documento: "9 000 003", telefono1: "+57 302 555 0103" },
      e: { nombre: "Prueba E2e María José", documento: "9000003", telefono1: "+573025550103" },
    }),
    caso("cc-nombre-compuesto", "CC, espacios sobrantes, guion y apostrofe, documento con guion", {
      s: { nombre: "  PRUEBA   E2E   CARLOS-ANDRÉS  O'BRIEN ", documento: "9000004-5", telefono1: "(+57) 304-555-0104" },
      e: { nombre: "Prueba E2e Carlos-Andrés O'Brien", documento: "90000045", telefono1: "+573045550104" },
    }),
    // --- CE / Otro with nationality from the catalog ---
    caso("ce-venezolana", "CE con nacionalidad Venezolana, prefijo 57 sin signo", {
      s: { nombre: "PRUEBA E2E JOSÉ GREGORIO", tipoDocumento: "ce", nacionalidad: ven, documento: "ce-9000005", telefono1: "57 310 555 0105" },
      e: { nombre: "Prueba E2e José Gregorio", documento: "CE9000005", telefono1: "+573105550105" },
    }),
    caso("ce-ecuatoriana", "CE con nacionalidad Ecuatoriana, telefono alterno", {
      s: { nombre: "prueba e2e maría belén", tipoDocumento: "ce", nacionalidad: ecu, documento: "9.000.006", telefono1: "311 555 0106", telefono2: "312-555-0107" },
      e: { nombre: "Prueba E2e María Belén", documento: "9000006", telefono1: "+573115550106", telefono2: "+573125550107" },
    }),
    caso("otro-ppt-peruana", "Otro con texto libre (PPT), nacionalidad Peruana", {
      s: {
        nombre: "PRUEBA E2E ROSA ELENA", tipoDocumento: "otro", tipoDocumentoOtro: "Permiso por Protección Temporal (PPT)",
        nacionalidad: per, documento: "ppt-9000.07", telefono1: "313 555 0108",
      },
      e: { nombre: "Prueba E2e Rosa Elena", documento: "PPT900007", telefono1: "+573135550108" },
    }),
    caso("otro-haitiana", "Otro con texto libre, nacionalidad Haitiana", {
      s: {
        nombre: "PRUEBA E2E JEAN PIERRE", tipoDocumento: "otro", tipoDocumentoOtro: "Salvoconducto de permanencia",
        nacionalidad: hai, documento: "SC 9000 08", telefono1: "314 555 0109",
      },
      e: { nombre: "Prueba E2e Jean Pierre", documento: "SC900008", telefono1: "+573145550109" },
    }),
    caso("ce-espanola", "CE con nacionalidad Española, correo con espacios y mayusculas", {
      s: { nombre: "PRUEBA E2E LUCÍA MARTÍN", tipoDocumento: "ce", nacionalidad: esp, documento: "9000009", correo: "  LUCIA.E2E@EXAMPLE.TEST " },
      e: { nombre: "Prueba E2e Lucía Martín", documento: "9000009", correo: "lucia.e2e@example.test" },
    }),
    // --- years of residence with comma decimals ---
    caso("anios-coma", "Años de residencia con coma decimal", {
      s: { documento: "9000010", aniosResidencia: "2,5" },
      e: { documento: "9000010", anios: "2.5" },
    }),
    caso("anios-cero", "Años de residencia cero", {
      s: { documento: "9000011", aniosResidencia: "0" },
      e: { documento: "9000011", anios: "0" },
    }),
    caso("anios-fraccion", "Años de residencia 0,5", {
      s: { documento: "9000012", aniosResidencia: "0,5" },
      e: { documento: "9000012", anios: "0.5" },
    }),
    caso("anios-largo", "Años de residencia 35,75", {
      s: { documento: "9000013", aniosResidencia: "35,75" },
      e: { documento: "9000013", anios: "35.75" },
    }),
    // --- older adults and boundaries ---
    caso("am-74", "Adulto mayor de 74 (limite: mayor_74)", {
      s: { documento: "9000014" }, e: { documento: "9000014" },
      c: { personas: "3", adultoMayor: "si", edades: ["74"] },
    }),
    caso("am-73", "Adulto mayor de 73 (limite: 65_73)", {
      s: { documento: "9000015" }, e: { documento: "9000015" },
      c: { personas: "2", adultoMayor: "si", edades: ["73"] },
    }),
    caso("am-75", "Adulto mayor de 75 (mayor_74)", {
      s: { documento: "9000016" }, e: { documento: "9000016" },
      c: { personas: "2", adultoMayor: "si", edades: ["75"] },
    }),
    caso("am-dos", "Dos adultos mayores (66 y 80): gana el de mayor edad", {
      s: { documento: "9000017" }, e: { documento: "9000017" },
      c: { personas: "4", adultoMayor: "si", edades: ["66", "80"] },
    }),
    caso("am-62", "Adulto mayor de 62 (por debajo de 65: sin banda)", {
      s: { documento: "9000018" }, e: { documento: "9000018" },
      c: { personas: "2", adultoMayor: "si", edades: ["62"] },
    }),
    caso("am-65", "Adulto mayor de 65 (limite inferior de 65_73)", {
      s: { documento: "9000019" }, e: { documento: "9000019" },
      c: { personas: "2", adultoMayor: "si", edades: ["65"] },
    }),
    // --- household sizes ---
    caso("hogar-1", "Hogar de 1 persona, sin adulto mayor", { s: { documento: "9000020" }, e: { documento: "9000020" }, c: { personas: "1" } }),
    caso("hogar-2", "Hogar de 2 personas", { s: { documento: "9000021" }, e: { documento: "9000021" }, c: { personas: "2" } }),
    caso("hogar-3", "Hogar de 3 personas", { s: { documento: "9000022" }, e: { documento: "9000022" }, c: { personas: "3" } }),
    caso("hogar-4", "Hogar de 4 personas", { s: { documento: "9000023" }, e: { documento: "9000023" }, c: { personas: "4" } }),
    caso("hogar-7", "Hogar de 7 personas", { s: { documento: "9000024" }, e: { documento: "9000024" }, c: { personas: "7" } }),
    // --- special protection ---
    caso("prot-multiple", "Proteccion: varias condiciones", {
      s: { documento: "9000025" }, e: { documento: "9000025" },
      c: { condiciones: ["discapacidad", "victima_conflicto", "mujer_cabeza_hogar"] },
    }),
    caso("prot-ninguna-gana", "Proteccion: marcar Ninguna despues desmarca las demas", {
      s: { documento: "9000026" }, e: { documento: "9000026" },
      c: { condiciones: ["discapacidad", "mujer_vbg", "ninguna"] },
    }),
    caso("prot-condicion-quita-ninguna", "Proteccion: marcar una condicion despues desmarca Ninguna", {
      s: { documento: "9000027" }, e: { documento: "9000027" },
      c: { condiciones: ["ninguna", "reincorporacion"] },
    }),
    caso("prot-todas", "Proteccion: todas las condiciones excepto Ninguna", {
      s: { documento: "9000028" }, e: { documento: "9000028" },
      c: { condiciones: todas },
    }),
    // --- income at SMLMV bracket edges (4x = 7.003.620; 5.5x = 9.629.977,5) ---
    caso("ingreso-4x", "Ingreso exactamente 4 SMLMV (rango inferior, inclusivo)", {
      s: { documento: "9000029" }, e: { documento: "9000029" }, c: { ingreso: "7.003.620" },
    }),
    caso("ingreso-4x-mas-1", "Ingreso 4 SMLMV + 1 peso (rango >4 a 5.5)", {
      s: { documento: "9000030" }, e: { documento: "9000030" }, c: { ingreso: "7003621" },
    }),
    caso("ingreso-5-5x-piso", "Ingreso 9.629.977 (justo bajo 5.5 SMLMV)", {
      s: { documento: "9000031" }, e: { documento: "9000031" }, c: { ingreso: "9.629.977" },
    }),
    caso("ingreso-5-5x-techo", "Ingreso 9.629.978 (justo sobre 5.5 SMLMV)", {
      s: { documento: "9000032" }, e: { documento: "9000032" }, c: { ingreso: "9.629.978" },
    }),
    caso("ingreso-alto", "Ingreso muy superior con signo $ y comas", {
      s: { documento: "9000033" }, e: { documento: "9000033" }, c: { ingreso: "$15,000,000" },
    }),
    caso("ingreso-cop-sufijo", "Ingreso escrito con sufijo COP", {
      s: { documento: "9000034" }, e: { documento: "9000034" }, c: { ingreso: "2500000 COP" },
    }),
    caso("ingreso-cero", "Ingreso cero", {
      s: { documento: "9000035" }, e: { documento: "9000035" }, c: { ingreso: "0" },
    }),
    // --- under 18: warning, never a block ---
    caso("menor-de-edad", "Solicitante menor de edad (advertencia, no bloquea)", {
      s: {
        nombre: "PRUEBA E2E MENOR QUINCE", tipoDocumento: "ce", nacionalidad: ven, documento: "9000036",
        nacimiento: sumarDias(restarAnios(hoy, 15), -1), expedicion: sumarDias(hoy, -30),
      },
      e: { nombre: "Prueba E2e Menor Quince", documento: "9000036" },
    }),
  ];
}

export function generarCasosInvalidos(hoy: string): CasoInvalido[] {
  const base = generarCasos(hoy)[0];
  const inv = (
    clave: string,
    descripcion: string,
    paso: CasoInvalido["paso"],
    mensajes: string[],
    x: { s?: Partial<Solicitante>; c?: Partial<Composicion>; e?: Partial<Extra>; ui?: string[] },
  ): CasoInvalido => ({
    clave,
    descripcion,
    paso,
    mensajes,
    mensajesUi: x.ui,
    solicitante: { ...base.solicitante, ...x.s },
    composicion: { ...base.composicion, ...x.c },
    extra: { ...base.extra, ...x.e },
  });
  const vivienda = (v: Partial<Vivienda>): Partial<Extra> => ({ vivienda: { ...base.extra.vivienda, ...v } });
  const vacioS: Partial<Solicitante> = {
    nombre: "", documento: "", expedicion: "", telefono1: "", correo: "", aniosResidencia: "", nacimiento: "",
  };

  return [
    inv("paso1-vacio", "Paso 1 sin ningun dato", 1, ["Ingrese el nombre completo", "Teléfono inválido", "Ingrese los años de residencia"], { s: vacioS }),
    inv("correo-sin-formato", "Correo sin arroba", 1, ["Correo inválido"], { s: { correo: "no-es-un-correo" } }),
    inv("correo-sin-dominio", "Correo incompleto", 1, ["Correo inválido"], { s: { correo: "persona@" } }),
    inv("telefono-corto", "Telefono demasiado corto", 1, ["Teléfono inválido"], { s: { telefono1: "12345" } }),
    inv("telefono-letras", "Telefono con letras", 1, ["Teléfono inválido"], { s: { telefono1: "abc def" } }),
    inv("telefono-alterno-invalido", "Telefono alterno invalido", 1, ["Teléfono inválido"], { s: { telefono2: "999" } }),
    inv("expedicion-futura", "Fecha de expedicion futura", 1, ["La fecha de expedición no puede ser futura"], { s: { expedicion: sumarDias(hoy, 5) } }),
    inv("expedicion-antes-nacimiento", "Expedicion anterior al nacimiento", 1, ["La expedición no puede ser anterior al nacimiento"], {
      s: { nacimiento: restarAnios(hoy, 30), expedicion: restarAnios(hoy, 31) },
    }),
    inv("nacimiento-hoy", "Nacimiento hoy (debe ser anterior)", 1, ["La fecha de nacimiento debe ser anterior a hoy"], { s: { nacimiento: hoy } }),
    inv("otro-sin-descripcion", "Documento Otro sin indicar cual", 1, ["Indique el tipo de documento"], {
      s: { tipoDocumento: "otro", tipoDocumentoOtro: "", nacionalidad: { codigo: "VE", nombre: "Venezolana" } },
    }),
    inv("anios-negativos", "Años de residencia negativos", 1, ["No puede ser negativo"], { s: { aniosResidencia: "-1" } }),
    inv("paso2-vacio", "Paso 2 sin ningun dato", 2, ["Debe ser un número entero", "Seleccione Sí o No", "Ingrese un valor numérico en pesos"], {
      c: { personas: "", adultoMayor: undefined, ingreso: "" },
    }),
    inv("personas-decimal", "Integrantes no entero (2.5)", 2, ["Debe ser un número entero"], { c: { personas: "2.5" } }),
    inv("personas-cero", "Integrantes igual a cero", 2, ["Debe ser al menos 1"], { c: { personas: "0" } }),
    inv("am-sin-cantidad", "Hay adultos mayores pero sin cantidad", 2, ["Indique cuántos adultos mayores hay (mínimo 1)"], {
      c: { adultoMayor: "si", edades: [] },
    }),
    inv("am-edad-menor-60", "Edad de adulto mayor menor a 60", 2, ["Edad mínima 60"], { c: { adultoMayor: "si", edades: ["50"] } }),
    inv("ingreso-texto", "Ingreso no numerico", 2, ["Ingrese un valor numérico en pesos"], { c: { ingreso: "mucho dinero" } }),
    inv("ingreso-decimal", "Ingreso con decimales", 2, ["Ingrese un valor numérico en pesos"], { c: { ingreso: "1500000,50" } }),
    inv("proteccion-vacia", "Proteccion sin seleccionar nada", 3, ["Seleccione al menos una opción"], { c: { condiciones: [] } }),
    // --- steps 4-7 ---
    inv("paso4-vacio", "Paso 4 sin ningun dato", 4, ["Ingrese la dirección", "Seleccione comuna o corregimiento", "Seleccione un estrato del 1 al 6"], {
      e: { vivienda: { direccion: "" } },
    }),
    inv("direccion-corta", "Direccion demasiado corta", 4, ["Ingrese la dirección"], { e: vivienda({ direccion: "Cl 1" }) }),
    inv("barrio-sin-elegir", "Comuna elegida pero sin barrio", 4, ["Seleccione un barrio o vereda"], {
      e: vivienda({ lugar: undefined, barrioOtro: undefined }),
    }),
    inv("barrio-no-listado-sin-texto", "Barrio no aparece en la lista pero sin escribirlo", 4, ["Seleccione un barrio o vereda"], {
      e: vivienda({ lugar: undefined, barrioOtro: "" }),
      ui: ["Escriba el nombre del barrio"],
    }),
    inv("estrato-sin-elegir", "Estrato sin elegir", 4, ["Seleccione un estrato del 1 al 6"], { e: vivienda({ estrato: undefined }) }),
    inv("paso5-vacio", "Paso 5 sin ningun dato", 5, ["Seleccione Sí o No", "Seleccione una opción"], { e: { riesgo: {} } }),
    inv("rud-sin-numero", "RUD si sin numero ni No lo sabe", 5, ["Ingrese el número de RUD o marque «No lo sabe»"], {
      e: { riesgo: { rud: "si", dictamen: "demolido" } },
    }),
    inv("dictamen-otro-sin-texto", "Dictamen Otro sin indicar cual", 5, ["Indique cuál es el dictamen"], {
      e: { riesgo: { rud: "no", dictamen: "otro", dictamenOtro: "" } },
    }),
    inv("titularidad-vacia", "Titularidad sin elegir", 6, ["Seleccione una opción"], { e: { titularidad: {} } }),
    inv("matricula-invalida", "Matricula con simbolos", 6, ["Solo letras, números y guiones"], {
      e: { titularidad: { tipo: "propietario_clt", matricula: "370 123/45" } },
    }),
    inv("paso7-vacio", "Paso 7 sin ningun dato", 7, ["Seleccione al menos una opción", "Seleccione Sí o No"], { e: { financiero: { fuentes: [] } } }),
    inv("seguro-sin-aseguradora", "Seguro si sin aseguradora", 7, ["Seleccione la aseguradora"], {
      e: { financiero: { fuentes: ["recursos_propios"], seguro: "si" } },
    }),
    inv("aseguradora-otra-sin-nombre", "Aseguradora Otra sin nombre", 7, ["Indique el nombre de la aseguradora"], {
      e: { financiero: { fuentes: ["recursos_propios"], seguro: "si", aseguradora: { codigo: "otra", nombre: "Otra" }, aseguradoraOtra: "" } },
    }),
  ];
}

/** Raw form values (what the stepper holds in RHF) for a case, with the final protection selection applied. */
export function aValores(c: Pick<Caso, "solicitante" | "composicion" | "extra">) {
  const { solicitante: s, composicion: k, extra: x } = c;
  return {
    solicitante: {
      nombre_completo: s.nombre,
      tipo_documento: s.tipoDocumento,
      tipo_documento_otro: s.tipoDocumentoOtro ?? "",
      codigo_pais_nacionalidad: s.nacionalidad.codigo,
      numero_documento: s.documento,
      fecha_expedicion_documento: s.expedicion,
      telefono_1: s.telefono1,
      telefono_2: s.telefono2 ?? "",
      correo_solicitante: s.correo,
      anios_residencia: s.aniosResidencia,
      fecha_nacimiento: s.nacimiento,
      estado_civil: s.estadoCivil,
    },
    composicion: {
      cantidad_personas_hogar: k.personas,
      tiene_adulto_mayor: k.adultoMayor ?? "",
      cantidad_adultos_mayores: k.edades.length ? String(k.edades.length) : "",
      adultos_mayores: k.edades.map((edad) => ({ edad })),
      condiciones_especiales: condicionesFinales(k.condiciones),
      ingreso_hogar_cop: k.ingreso,
    },
    inmueble: {
      direccion: x.vivienda.direccion,
      codigo_division: x.vivienda.division?.codigo ?? "",
      id_barrio_vereda: x.vivienda.lugar?.id ?? "",
      barrio_no_listado: x.vivienda.barrioOtro !== undefined,
      barrio_vereda_otro: x.vivienda.barrioOtro ?? "",
      estrato: x.vivienda.estrato === undefined ? "" : String(x.vivienda.estrato),
    },
    riesgo: {
      esta_en_rud: x.riesgo.rud ?? "",
      numero_rud: x.riesgo.numero ?? "",
      rud_no_sabe: !!x.riesgo.noSabe,
      dictamen: x.riesgo.dictamen ?? "",
      dictamen_otro: x.riesgo.dictamenOtro ?? "",
    },
    titularidad: { tipo_titularidad: x.titularidad.tipo ?? "", numero_matricula_inmobiliaria: x.titularidad.matricula ?? "" },
    cierre_financiero: {
      fuentes_financiacion: condicionesFinales(x.financiero.fuentes),
      tiene_seguro: x.financiero.seguro ?? "",
      codigo_aseguradora: x.financiero.aseguradora?.codigo ?? "",
      aseguradora_otra: x.financiero.aseguradoraOtra ?? "",
    },
  };
}
