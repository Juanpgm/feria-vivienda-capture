// Pure logic of GET /api/registros: filter validation, role scoping, opaque cursor and the neutral query spec that the
// repo applies to Firestore. No firebase imports so it can be unit tested without mocks.
import { z } from "zod";
import type { Rol } from "@/modules/auth/domain/roles";
import { ESTADOS_REVISION } from "@/shared/constantes";
import { normalizarBusqueda } from "@/shared/busqueda";
import { normalizarDocumento } from "@/shared/normalizacion/texto";
import { esFechaIso } from "@/shared/validacion";
import { parsearRadicado } from "./radicado";

export const LIMITE_DEFECTO = 25;
export const LIMITE_MAX = 100;
export const MIN_NOMBRE = 2;

export type Orden = "registrado_en" | "nombre_busqueda";
/** Position after which the next page starts. `registrado_en`: [seconds, nanos]; `nombre_busqueda`: the text. */
export type Cursor = { v: [number, number] | string; id: string };

export type Filtros = {
  documento?: string;
  radicado?: string;
  nombre?: string;
  comuna?: string;
  barrio?: string;
  estado_revision?: keyof typeof ESTADOS_REVISION;
  registrado_por?: string;
  desde?: string;
  hasta?: string;
  limite: number;
  cursor?: Cursor;
};

export const codificarCursor = (c: Cursor) => Buffer.from(JSON.stringify(c)).toString("base64url");

export function decodificarCursor(texto: string): Cursor | null {
  try {
    const c = JSON.parse(Buffer.from(texto, "base64url").toString("utf8")) as Cursor;
    const vOk = typeof c.v === "string" || (Array.isArray(c.v) && c.v.length === 2 && c.v.every(Number.isInteger));
    return vOk && typeof c.id === "string" && c.id.length > 0 && c.id.length <= 128 ? { v: c.v, id: c.id } : null;
  } catch {
    return null;
  }
}

const opcional = z
  .string()
  .max(120, "Texto demasiado largo")
  .optional()
  .transform((v) => v?.trim() || undefined);

/** Query string -> normalized filters. Unknown params are ignored; every problem is a 422 with the field name. */
export const filtrosSchema = (prefijo: string) =>
  z
    .object({
      q: opcional,
      documento: opcional,
      radicado: opcional,
      nombre: opcional,
      comuna: opcional,
      barrio: opcional,
      estado_revision: opcional,
      registrado_por: opcional,
      desde: opcional,
      hasta: opcional,
      limite: opcional,
      cursor: opcional,
    })
    .transform((p, ctx): Filtros => {
      const err = (path: string, message: string) => ctx.addIssue({ code: "custom", path: [path], message });
      const f: Filtros = { limite: LIMITE_DEFECTO };

      // `q` is the single search box: a radicado when it looks like one, otherwise a document number.
      const rad = p.radicado ?? (p.q ? parsearRadicado(p.q, prefijo) ?? undefined : undefined);
      if (rad) {
        const canon = parsearRadicado(rad, prefijo);
        if (canon) f.radicado = canon;
        else err("radicado", `El radicado debe tener el formato ${prefijo}-000123`);
      }
      const doc = p.documento ?? (p.q && !rad ? p.q : undefined);
      if (doc) {
        const clave = normalizarDocumento(doc);
        if (clave) f.documento = clave;
        else err(p.documento ? "documento" : "q", "Ingrese un número de documento válido");
      }
      if (p.nombre) {
        const n = normalizarBusqueda(p.nombre);
        if (n.length >= MIN_NOMBRE) f.nombre = n;
        else err("nombre", `Escriba al menos ${MIN_NOMBRE} letras del nombre`);
      }
      if (p.comuna) f.comuna = p.comuna;
      if (p.barrio) f.barrio = p.barrio;
      if (p.estado_revision) {
        if (p.estado_revision in ESTADOS_REVISION) f.estado_revision = p.estado_revision as Filtros["estado_revision"];
        else err("estado_revision", "Estado de revisión inválido");
      }
      if (p.registrado_por) f.registrado_por = p.registrado_por;
      for (const k of ["desde", "hasta"] as const) {
        if (!p[k]) continue;
        if (esFechaIso(p[k])) f[k] = p[k];
        else err(k, "Fecha inválida (use AAAA-MM-DD)");
      }
      if (f.desde && f.hasta && f.desde > f.hasta) err("hasta", "La fecha final no puede ser anterior a la inicial");
      // Firestore cannot range on two fields: a name search is ordered by name, so it cannot also be bounded by date.
      if (f.nombre && (f.desde || f.hasta)) err("nombre", "La búsqueda por nombre no se puede combinar con fechas");
      if (p.limite) {
        const n = Number(p.limite);
        if (Number.isInteger(n) && n >= 1 && n <= LIMITE_MAX) f.limite = n;
        else err("limite", `El límite debe estar entre 1 y ${LIMITE_MAX}`);
      }
      if (p.cursor) {
        const c = decodificarCursor(p.cursor);
        if (c) f.cursor = c;
        else err("cursor", "Cursor inválido");
      }
      return f;
    });

export type Consulta = {
  /** Equality filters, in a stable order. */
  igualdad: [campo: string, valor: string][];
  orden: Orden;
  direccion: "asc" | "desc";
  /** registrado_en bounds in epoch millis (`hasta` exclusive), Bogota day boundaries. */
  rangoFecha?: { desde?: number; hasta?: number };
  /** Name prefix (`nombre_busqueda`). */
  prefijoNombre?: string;
  cursor?: Cursor;
  /** Page size requested by the client; the repo fetches one more to know if there is a next page. */
  limite: number;
};

const inicioDiaBogota = (iso: string) => Date.parse(`${iso}T00:00:00-05:00`);

/** Applies role scoping and maps filters to the neutral query. A `usuario` can only ever see their own registros. */
export function construirConsulta(f: Filtros, actor: { uid: string; rol: Rol }): Consulta {
  const igualdad: Consulta["igualdad"] = [];
  const propios = actor.rol === "usuario";
  const por = propios ? actor.uid : f.registrado_por;
  if (por) igualdad.push(["registrado_por_uid", por]);
  if (f.estado_revision) igualdad.push(["estado_revision", f.estado_revision]);
  if (f.comuna) igualdad.push(["inmueble.codigo_division", f.comuna]);
  if (f.barrio) igualdad.push(["inmueble.id_barrio_vereda", f.barrio]);
  if (f.documento) igualdad.push(["documento_clave", f.documento]);
  if (f.radicado) igualdad.push(["radicado", f.radicado]);

  const porNombre = f.nombre !== undefined;
  const c: Consulta = {
    igualdad,
    orden: porNombre ? "nombre_busqueda" : "registrado_en",
    direccion: porNombre ? "asc" : "desc",
    limite: f.limite,
  };
  if (porNombre) c.prefijoNombre = f.nombre;
  if (f.desde || f.hasta) {
    c.rangoFecha = {
      ...(f.desde ? { desde: inicioDiaBogota(f.desde) } : {}),
      ...(f.hasta ? { hasta: inicioDiaBogota(f.hasta) + 864e5 } : {}),
    };
  }
  // A cursor of the other kind (e.g. issued before adding a name filter) is ignored: start from the first page.
  if (f.cursor && (typeof f.cursor.v === "string") === porNombre) c.cursor = f.cursor;
  return c;
}
