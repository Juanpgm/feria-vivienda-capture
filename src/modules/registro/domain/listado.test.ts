import { describe, expect, it } from "vitest";
import { codificarCursor, construirConsulta, decodificarCursor, filtrosSchema, LIMITE_DEFECTO, LIMITE_MAX } from "./listado";

const parse = (p: Record<string, string>) => filtrosSchema("FV").safeParse(p);
const ok = (p: Record<string, string>) => {
  const r = parse(p);
  if (!r.success) throw new Error(JSON.stringify(r.error.issues));
  return r.data;
};
const campos = (p: Record<string, string>) => {
  const r = parse(p);
  return r.success ? [] : r.error.issues.map((i) => i.path.join("."));
};

describe("filtrosSchema", () => {
  it("defaults to 25 per page and ignores unknown/blank params", () => {
    expect(ok({})).toEqual({ limite: LIMITE_DEFECTO });
    expect(ok({ nombre: "  ", zzz: "1" })).toEqual({ limite: LIMITE_DEFECTO });
  });

  it("limit must be 1..100", () => {
    expect(ok({ limite: "100" }).limite).toBe(100);
    for (const l of ["0", "101", "abc", "2.5"]) expect(campos({ limite: l })).toEqual(["limite"]);
    expect(LIMITE_MAX).toBe(100);
  });

  it("q is a radicado when it looks like one, otherwise a normalized document", () => {
    expect(ok({ q: "fv-123" })).toMatchObject({ radicado: "FV-000123" });
    expect(ok({ q: "fv-123" }).documento).toBeUndefined();
    expect(ok({ q: "1.234.567" })).toMatchObject({ documento: "1234567" });
    expect(ok({ q: "123" }).radicado).toBeUndefined();
    expect(campos({ q: "---" })).toEqual(["q"]);
    expect(campos({ radicado: "ZZ-1" })).toEqual(["radicado"]);
  });

  it("validates review status, dates and name", () => {
    expect(ok({ estado_revision: "habilitado" }).estado_revision).toBe("habilitado");
    expect(campos({ estado_revision: "anulado" })).toEqual(["estado_revision"]);
    expect(campos({ desde: "2026-02-30" })).toEqual(["desde"]);
    expect(campos({ desde: "2026-03-05", hasta: "2026-03-01" })).toEqual(["hasta"]);
    expect(ok({ nombre: "  ÁNA  Pérez " }).nombre).toBe("ana perez");
    expect(campos({ nombre: "a" })).toEqual(["nombre"]);
  });

  it("a name search cannot be combined with dates (single range field)", () => {
    expect(campos({ nombre: "ana", desde: "2026-03-01" })).toEqual(["nombre"]);
  });

  it("rejects a malformed cursor", () => {
    expect(campos({ cursor: "no-es-cursor" })).toEqual(["cursor"]);
    expect(campos({ cursor: Buffer.from('{"v":1}').toString("base64url") })).toEqual(["cursor"]);
  });
});

describe("cursor", () => {
  it("round-trips both kinds", () => {
    for (const c of [{ v: [1700000000, 123456000] as [number, number], id: "abc" }, { v: "ana perez", id: "abc" }]) {
      expect(decodificarCursor(codificarCursor(c))).toEqual(c);
    }
  });
  it("garbage decodes to null", () => {
    expect(decodificarCursor("!!!")).toBeNull();
    expect(decodificarCursor(Buffer.from(JSON.stringify({ v: [1], id: "x" })).toString("base64url"))).toBeNull();
    expect(decodificarCursor(Buffer.from(JSON.stringify({ v: "a", id: "" })).toString("base64url"))).toBeNull();
  });
});

describe("construirConsulta (role scoping and mapping)", () => {
  const usuario = { uid: "u1", rol: "usuario" as const };
  const admin = { uid: "a1", rol: "admin" as const };

  it("a usuario is always scoped to their own uid, even when asking for someone else", () => {
    const c = construirConsulta(ok({ registrado_por: "otro" }), usuario);
    expect(c.igualdad).toEqual([["registrado_por_uid", "u1"]]);
    expect(construirConsulta(ok({}), usuario).igualdad).toEqual([["registrado_por_uid", "u1"]]);
  });

  it("admin sees all unless filtering by funcionario", () => {
    expect(construirConsulta(ok({}), admin).igualdad).toEqual([]);
    expect(construirConsulta(ok({ registrado_por: "u9" }), admin).igualdad).toEqual([["registrado_por_uid", "u9"]]);
    expect(construirConsulta(ok({}), { uid: "s", rol: "superadmin" }).igualdad).toEqual([]);
  });

  it("maps filters to equality fields, newest first", () => {
    const c = construirConsulta(ok({ q: "FV-7", estado_revision: "habilitado", comuna: "01", barrio: "0199" }), admin);
    expect(c).toMatchObject({ orden: "registrado_en", direccion: "desc", limite: 25 });
    expect(c.igualdad).toEqual([
      ["estado_revision", "habilitado"],
      ["inmueble.codigo_division", "01"],
      ["inmueble.id_barrio_vereda", "0199"],
      ["radicado", "FV-000007"],
    ]);
  });

  it("date range uses Bogota day boundaries, `hasta` inclusive of its whole day", () => {
    const c = construirConsulta(ok({ desde: "2026-03-05", hasta: "2026-03-05" }), admin);
    expect(c.rangoFecha).toEqual({ desde: Date.parse("2026-03-05T05:00:00Z"), hasta: Date.parse("2026-03-06T05:00:00Z") });
  });

  it("name search orders by name ascending with a prefix", () => {
    const c = construirConsulta(ok({ nombre: "Ana" }), admin);
    expect(c).toMatchObject({ orden: "nombre_busqueda", direccion: "asc", prefijoNombre: "ana" });
  });

  it("keeps a cursor only when it matches the ordering", () => {
    const fecha = { v: [1, 2] as [number, number], id: "x" };
    const nombre = { v: "ana", id: "x" };
    expect(construirConsulta({ limite: 5, cursor: fecha }, admin).cursor).toEqual(fecha);
    expect(construirConsulta({ limite: 5, cursor: nombre }, admin).cursor).toBeUndefined();
    expect(construirConsulta({ limite: 5, nombre: "ana", cursor: nombre }, admin).cursor).toEqual(nombre);
    expect(construirConsulta({ limite: 5, nombre: "ana", cursor: fecha }, admin).cursor).toBeUndefined();
  });
});
