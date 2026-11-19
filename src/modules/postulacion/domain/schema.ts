// Zod schemas of the postulación (client step validation AND server re-validation).
// Rule of thumb: a record can be CREATED with only the essential fields (see faltantes.ts for what validation needs);
// every other field is optional, but when it is filled it must be well-formed. Empty values are stored as null.
import { z } from "zod";
import { calcularEdad } from "@/modules/composicion/domain/derivaciones";
import { consentimientoSchema } from "@/modules/consentimiento/domain/schema";
import { documentosSchema } from "@/modules/documentos/domain/schema";
import { firmaFormSchema } from "@/modules/firma/domain/schema";
import barrios from "@/modules/inmueble/catalogo/barrios.json";
import divisiones from "@/modules/inmueble/catalogo/divisiones.json";
import { estratoDeBarrio } from "@/modules/inmueble/domain/ubicacion";
import municipios from "@/shared/catalogo/municipios.json";
import { EDAD_MINIMA } from "@/shared/constantes";
import { normalizarDireccion } from "@/shared/normalizacion/direccion";
import { normalizarDocumento, normalizarNombre, parsearIngresoCop } from "@/shared/normalizacion/texto";
import { fechaBogota } from "@/shared/tiempo";
import { enumDe, esFechaIso, telefono, telefonoOpcional } from "@/shared/validacion";
import {
  CODIGOS_FUENTES, CONDICIONES_ESPECIALES, DOCUMENTOS_ADULTO, ENTIDADES_ACREEDORAS, ESTADOS_CIVILES, ESTADOS_OBLIGACION,
  FUENTES_RECURSOS, GENEROS_SOLICITANTE, GRUPOS_SISBEN, IDENTIDADES_GENERO, MAX_INTEGRANTES, MODALIDAD_DEUDORES,
  MODALIDADES, MODALIDADES_CON_PROYECTO, OCUPACIONES_INTEGRANTE, OCUPACIONES_SOLICITANTE, PARENTESCOS, SUBGRUPO_MAX,
  TIPOS_DOCUMENTO_INTEGRANTE, TIPOS_DOCUMENTO_SOLICITANTE, type FuenteRecurso,
} from "./catalogos";
import { DECLARACION_VERSION } from "./texto";

const DIVISION = new Map(divisiones.map((d) => [d.codigo, d]));
const BARRIO = new Map(barrios.map((b) => [b.id, b]));
// ponytail: the municipios catalog (75 KB) is imported statically, like the barrios; lazy-load the schema if the bundle matters.
const MUNICIPIO = new Map(municipios.map((m) => [m.codigo, `${m.nombre} (${m.departamento})`]));
/** Birth place outside Colombia (then `lugar_nacimiento_otro` says where). */
export const EXTERIOR = "exterior";
const municipio = (msg: string) => z.string().refine((c) => MUNICIPIO.has(c), msg);
/** Cali, generous: a point outside means a wrong geocoding, not an address elsewhere. */
const CALI = { latMin: 2.9, latMax: 4.1, lonMin: -77.0, lonMax: -76.0 };

const vacio = (v: unknown) => v === undefined || v === null || (typeof v === "string" && v.trim() === "");
/** Empty -> null; anything else must pass `s`. */
const opcional = <T extends z.ZodType>(s: T) => z.unknown().optional().transform((v, ctx): z.output<T> | null => {
  if (vacio(v)) return null;
  const r = s.safeParse(typeof v === "string" ? v.trim() : v);
  if (r.success) return r.data;
  for (const i of r.error.issues) ctx.addIssue({ code: "custom", message: i.message });
  return z.NEVER;
});

const texto = (max = 120) => z.string().max(max, `Máximo ${max} caracteres`);
const nombre = (msg: string) => z.string({ error: msg }).trim().min(1, msg).max(120, "Máximo 120 caracteres").transform(normalizarNombre);
const fecha = z.string().refine(esFechaIso, "Fecha inválida (DD/MM/AAAA)");
const siNo = z.enum(["si", "no"], { error: "Seleccione Sí o No" }).transform((v) => v === "si");

/** Money typed as "1.500.000", "$1,500,000" or a plain number -> integer pesos (S5: numbers without commas or symbols). */
export const moneda = z
  .union([z.number(), z.string()])
  .transform((v, ctx) => {
    const n = typeof v === "number" ? v : parsearIngresoCop(v);
    if (n === null || !Number.isInteger(n) || n < 0) {
      ctx.addIssue({ code: "custom", message: "Escriba solo el valor en pesos, sin decimales. Ejemplo: 1500000" });
      return z.NEVER;
    }
    return n;
  })
  .pipe(z.number().max(100_000_000_000, "Valor demasiado alto"));

const entero = (min: number, max: number, msg: string) =>
  z.union([z.number(), z.string()]).transform((v) => Number(v)).pipe(z.number({ error: msg }).int(msg).min(min, msg).max(max, msg));

const documento = z.string().transform(normalizarDocumento).refine((d) => /^[A-Z0-9]{4,20}$/.test(d), "Número de documento inválido");

// ---------------------------------------------------------------- section 1: solicitante

export const solicitanteSchema = z
  .object({
    nombres: nombre("Ingrese los nombres"),
    apellidos: nombre("Ingrese los apellidos"),
    tipo_documento: enumDe(TIPOS_DOCUMENTO_SOLICITANTE),
    numero_documento: documento,
    lugar_expedicion: opcional(municipio("Elija el municipio de la lista")),
    fecha_expedicion: opcional(fecha),
    fecha_nacimiento: fecha,
    lugar_nacimiento: opcional(z.string().refine((c) => c === EXTERIOR || MUNICIPIO.has(c), "Elija el municipio de la lista o «Fuera de Colombia»")),
    lugar_nacimiento_otro: opcional(texto(120).transform(normalizarNombre)),
    ingreso_mensual: opcional(moneda),
    genero: opcional(enumDe(GENEROS_SOLICITANTE)),
    genero_otro: opcional(texto(60)),
    ocupacion: opcional(enumDe(OCUPACIONES_SOLICITANTE)),
    direccion: opcional(texto(200)),
    /** Cadastral address as returned by the geocoder of the Alcaldía (empty when it could not standardize it). */
    direccion_catastral: opcional(texto(200)),
    codigo_division: opcional(z.string()),
    id_barrio_vereda: opcional(z.string()),
    estrato: opcional(entero(1, 6, "Seleccione un estrato del 1 al 6")),
    latitud: opcional(z.coerce.number().min(CALI.latMin).max(CALI.latMax)),
    longitud: opcional(z.coerce.number().min(CALI.lonMin).max(CALI.lonMax)),
    anios_residencia: opcional(entero(0, 120, "Escriba los años completos (0 a 120)")),
    telefono,
    correo: opcional(z.string().toLowerCase().pipe(z.email("Correo inválido"))),
    empresa: opcional(texto()),
    telefono_empresa: telefonoOpcional,
    notificacion_electronica: opcional(siNo),
    caja_compensacion: opcional(siNo),
    caja_cual: opcional(texto(80)),
    sisben: opcional(siNo),
    sisben_grupo: opcional(enumDe(GRUPOS_SISBEN)),
    sisben_subgrupo: opcional(entero(1, SUBGRUPO_MAX, `El subgrupo va de 1 a ${SUBGRUPO_MAX}`)),
    condiciones_especiales: z
      .array(enumDe(CONDICIONES_ESPECIALES))
      .default([])
      .refine((l) => !l.includes("ninguna") || l.length === 1, "«Ninguna» no se puede combinar con otras opciones"),
  })
  .superRefine((v, ctx) => {
    const err = (path: string, message: string) => ctx.addIssue({ code: "custom", path: [path], message });
    const hoy = fechaBogota();
    if (v.fecha_nacimiento >= hoy) err("fecha_nacimiento", "La fecha de nacimiento debe ser anterior a hoy");
    else if (calcularEdad(v.fecha_nacimiento, hoy) < EDAD_MINIMA) err("fecha_nacimiento", `Solo pueden postularse personas de ${EDAD_MINIMA} años o más`);
    if (v.fecha_expedicion && v.fecha_expedicion > hoy) err("fecha_expedicion", "La fecha de expedición no puede ser futura");
    else if (v.fecha_expedicion && v.fecha_expedicion < v.fecha_nacimiento) err("fecha_expedicion", "La expedición no puede ser anterior al nacimiento");
    if (v.codigo_division && !DIVISION.has(v.codigo_division)) err("codigo_division", "Seleccione comuna o corregimiento de la lista");
    if (v.id_barrio_vereda) {
      const b = BARRIO.get(v.id_barrio_vereda);
      if (!b) err("id_barrio_vereda", "Seleccione un barrio o vereda de la lista");
      else if (b.codigo_division !== v.codigo_division) err("id_barrio_vereda", "El barrio no pertenece a la comuna o corregimiento");
    }
  })
  .transform((v) => {
    const div = v.codigo_division ? DIVISION.get(v.codigo_division) : undefined;
    const dir = v.direccion ? normalizarDireccion(v.direccion) : null;
    const empleado = v.ocupacion === "empleado";
    const sisben = v.sisben === true;
    return {
      ...v,
      nombre_completo: `${v.nombres} ${v.apellidos}`,
      genero_otro: v.genero === "otro" ? v.genero_otro : null,
      lugar_expedicion_nombre: v.lugar_expedicion ? MUNICIPIO.get(v.lugar_expedicion)! : null,
      lugar_nacimiento_nombre: v.lugar_nacimiento === EXTERIOR ? (v.lugar_nacimiento_otro ? `${v.lugar_nacimiento_otro} (fuera de Colombia)` : "Fuera de Colombia") : v.lugar_nacimiento ? MUNICIPIO.get(v.lugar_nacimiento)! : null,
      lugar_nacimiento_otro: v.lugar_nacimiento === EXTERIOR ? v.lugar_nacimiento_otro : null,
      // The estrato is the barrio's estrato moda when it is known (it is not asked then); typed only for veredas.
      estrato: estratoDeBarrio(v.id_barrio_vereda) ?? v.estrato,
      // Coordinates only make sense together and with a barrio.
      latitud: v.latitud !== null && v.longitud !== null && v.id_barrio_vereda ? v.latitud : null,
      longitud: v.latitud !== null && v.longitud !== null && v.id_barrio_vereda ? v.longitud : null,
      // Derived from the typed address and the catalogs; never sent by the client.
      direccion_norm: dir?.norm ?? null,
      es_direccion_norm_completa: dir?.es_completa ?? false,
      nombre_division: div?.nombre ?? null,
      tipo_division: div?.tipo ?? null,
      nombre_barrio_vereda: v.id_barrio_vereda ? (BARRIO.get(v.id_barrio_vereda)?.nombre ?? null) : null,
      sector: div?.sector ?? null,
      empresa: empleado ? v.empresa : null,
      telefono_empresa: empleado ? v.telefono_empresa : null,
      caja_cual: v.caja_compensacion === true ? v.caja_cual : null,
      sisben_grupo: sisben ? v.sisben_grupo : null,
      sisben_subgrupo: sisben ? v.sisben_subgrupo : null,
    };
  });
export type Solicitante = z.output<typeof solicitanteSchema>;

// ---------------------------------------------------------------- section 2: grupo familiar

export const integranteSchema = z
  .object({
    nombres_apellidos: nombre("Ingrese el nombre completo del integrante"),
    fecha_nacimiento: opcional(fecha),
    tipo_documento: opcional(enumDe(TIPOS_DOCUMENTO_INTEGRANTE)),
    numero_documento: opcional(documento),
    condicion_especial: opcional(enumDe(CONDICIONES_ESPECIALES)),
    parentesco: opcional(enumDe(PARENTESCOS)),
    estado_civil: opcional(enumDe(ESTADOS_CIVILES)),
    ocupacion: opcional(enumDe(OCUPACIONES_INTEGRANTE)),
    identidad_genero: opcional(enumDe(IDENTIDADES_GENERO)),
    ingresos: opcional(moneda),
  })
  .superRefine((v, ctx) => {
    const err = (path: string, message: string) => ctx.addIssue({ code: "custom", path: [path], message });
    const hoy = fechaBogota();
    if (v.fecha_nacimiento && v.fecha_nacimiento > hoy) return err("fecha_nacimiento", "La fecha de nacimiento no puede ser futura");
    if (v.fecha_nacimiento && v.tipo_documento) {
      const adulto = calcularEdad(v.fecha_nacimiento, hoy) >= EDAD_MINIMA;
      const deAdulto = (DOCUMENTOS_ADULTO as readonly string[]).includes(v.tipo_documento);
      if (adulto !== deAdulto)
        err("tipo_documento", adulto ? "Una persona de 18 años o más se identifica con C.C. o C.E." : "Un menor de 18 años se identifica con R.C., T.I. o NUIP (M.E.)");
    }
  });
export type Integrante = z.output<typeof integranteSchema>;

export const hogarSchema = z.object({
  integrantes: z.array(integranteSchema).max(MAX_INTEGRANTES, `Máximo ${MAX_INTEGRANTES} integrantes`).default([]),
});

/** `{ "integrantes.N.numero_documento": msg }` for repeated documents (inside the household or equal to the applicant). */
export function documentosRepetidos(docSolicitante: string, integrantes: readonly { numero_documento?: unknown }[]): Record<string, string> {
  const vistos = new Set([normalizarDocumento(docSolicitante)]);
  const errores: Record<string, string> = {};
  integrantes.forEach((m, i) => {
    const d = typeof m.numero_documento === "string" ? normalizarDocumento(m.numero_documento) : "";
    if (!d) return;
    if (vistos.has(d)) errores[`integrantes.${i}.numero_documento`] = "Este número de documento ya está en la postulación";
    vistos.add(d);
  });
  return errores;
}

// ---------------------------------------------------------------- section 3-5.1: subsidio y cierre financiero

const recursoSchema = z.object({ valor: opcional(moneda), entidad: opcional(texto()), resolucion: opcional(texto()) });

export const postulacionSchema = z
  .object({
    modalidad: enumDe(MODALIDADES),
    observaciones: opcional(texto(1000)),
    entidad_acreedora: opcional(enumDe(ENTIDADES_ACREEDORAS)),
    numero_obligacion: opcional(texto(60)),
    programa_obligacion: opcional(texto()),
    saldo_adeudado: opcional(moneda),
    estado_obligacion: opcional(enumDe(ESTADOS_OBLIGACION)),
    autoriza_giro: z.boolean().default(false),
    proyecto_nombre: opcional(texto()),
    constructora: opcional(texto()),
    valor_vis: opcional(moneda),
    valor_vip: opcional(moneda),
    fuentes: z.array(z.enum(CODIGOS_FUENTES as [FuenteRecurso, ...FuenteRecurso[]])).default([]),
    recursos: z.record(z.string(), z.unknown()).default({}),
  })
  .transform((v, ctx) => {
    const deudores = v.modalidad === MODALIDAD_DEUDORES;
    const proyecto = MODALIDADES_CON_PROYECTO.includes(v.modalidad);
    // Only the selected sources are kept; each one validated on its own path so the error lands under its field.
    const recursos: Partial<Record<FuenteRecurso, z.output<typeof recursoSchema>>> = {};
    for (const f of new Set(v.fuentes)) {
      const r = recursoSchema.safeParse(v.recursos[f] ?? {});
      if (!r.success) {
        for (const i of r.error.issues) ctx.addIssue({ code: "custom", path: ["recursos", f, ...i.path], message: i.message });
        continue;
      }
      recursos[f] = { ...r.data, resolucion: f === "subsidio_familiar" ? r.data.resolucion : null };
    }
    return {
      modalidad: v.modalidad,
      observaciones: v.observaciones,
      obligacion: deudores
        ? { entidad_acreedora: v.entidad_acreedora, numero_obligacion: v.numero_obligacion, programa: v.programa_obligacion, saldo_adeudado: v.saldo_adeudado, estado: v.estado_obligacion, autoriza_giro: v.autoriza_giro }
        : null,
      proyecto: proyecto ? { nombre: v.proyecto_nombre, constructora: v.constructora, valor_vis: v.valor_vis, valor_vip: v.valor_vip } : null,
      fuentes: Object.keys(recursos) as FuenteRecurso[],
      recursos,
      total_aportes: totalAportes(recursos),
    };
  });
export type Postulacion = z.output<typeof postulacionSchema>;

export const totalAportes = (recursos: Partial<Record<string, { valor: number | null } | undefined>>) =>
  Object.values(recursos).reduce((s, r) => s + (r?.valor ?? 0), 0);

/** Section 6: sworn declaration. Must be accepted to send. */
export const declaracionSchema = z
  .object({ acepta: z.boolean().optional(), version: z.string().optional() })
  .superRefine((v, ctx) => {
    if (v.acepta !== true) ctx.addIssue({ code: "custom", path: ["acepta"], message: "Debe aceptar la declaración bajo juramento para enviar la postulación" });
    else if (v.version !== DECLARACION_VERSION) ctx.addIssue({ code: "custom", path: ["acepta"], message: "El texto de la declaración cambió. Léalo y acéptelo de nuevo." });
  })
  .transform(() => ({ acepta: true as const, version: DECLARACION_VERSION }));

/** Section key -> schema. The form values hold one object per key. */
export const SECCIONES = {
  solicitante: solicitanteSchema,
  documentos: documentosSchema,
  hogar: hogarSchema,
  postulacion: postulacionSchema,
  consentimiento: consentimientoSchema,
  declaracion: declaracionSchema,
  firma: firmaFormSchema,
} as const;
export type Seccion = keyof typeof SECCIONES;

export const totalIngresos = (s: { ingreso_mensual: number | null }, integrantes: readonly { ingresos: number | null }[]) =>
  (s.ingreso_mensual ?? 0) + integrantes.reduce((t, m) => t + (m.ingresos ?? 0), 0);

export const etiquetaFuente = (f: FuenteRecurso) => FUENTES_RECURSOS[f].etiqueta;
