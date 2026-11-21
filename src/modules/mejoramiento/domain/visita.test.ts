import { describe, expect, it } from "vitest";
import type { Apu } from "./apus";
import { armarPresupuesto, visitaSchema } from "./visita";

const base = {
  id: "0b6f1c2e-5d8a-4c1e-9f00-aaaaaaaaaaaa",
  atiende: { relacion: "propietario", nombre: "ana maría pérez", documento: "1.144.555", parentesco: "" },
  propietario: {
    nombre: "ana maría pérez",
    tipo_documento: "cc",
    documento: "1.144.555",
    telefono: "3001234567",
    correo: "",
    direccion: "cra 5 # 10-20",
    anios_habitando: "12",
    personas: "4",
  },
  diagnostico: { aplica: "si", aplica_para: ["piso"], alcance: "tipo", estados: { piso: "m", escaleras: "ne" }, detalles: { piso_material: "tierra" } },
  capitulos: [{ id: "c1", nombre: "Piso", filas: [{ id: "f1", item: "200101", cantidad_expr: "3,5*4" }] }],
  observaciones: "Se explican los alcances...",
};

describe("visitaSchema", () => {
  it("normalizes a complete visit", () => {
    const v = visitaSchema.parse(base);
    expect(v.propietario).toMatchObject({ nombre: "Ana María Pérez", documento: "1144555", telefono: "+573001234567", correo: null, anios_habitando: 12, personas: 4 });
    expect(v.atiende).toMatchObject({ nombre: "Ana María Pérez", parentesco: null });
  });

  it("when the owner attends, the owner's name, document type and number are the attendee's (server truth)", () => {
    const v = visitaSchema.parse({
      ...base,
      atiende: { relacion: "propietario", nombre: "ana maría pérez", tipo_documento: "ce", documento: "E-998877", parentesco: "" },
      propietario: { ...base.propietario, nombre: "Otro Nombre", tipo_documento: "cc", documento: "1111111" },
    });
    expect(v.propietario).toMatchObject({ nombre: "Ana María Pérez", tipo_documento: "ce", documento: "E998877" });
  });

  it("the attendee's document type defaults to C.C. and keeps its own value when not the owner", () => {
    expect(visitaSchema.parse(base).atiende.tipo_documento).toBe("cc");
    const v = visitaSchema.parse({ ...base, atiende: { relacion: "familiar", nombre: "Luis Gómez", tipo_documento: "pa", documento: "998877", parentesco: "Hijo" } });
    expect(v.atiende.tipo_documento).toBe("pa");
    expect(v.propietario).toMatchObject({ tipo_documento: "cc", documento: "1144555" });
  });

  it("someone other than the owner must give the relationship; 'otro' must say which", () => {
    const r = visitaSchema.safeParse({ ...base, atiende: { relacion: "otro", nombre: "Luis Gómez", documento: "998877", parentesco: "" } });
    expect(r.success).toBe(false);
    const campos = r.error!.issues.map((i) => i.path.join("."));
    expect(campos).toEqual(expect.arrayContaining(["atiende.relacion_otro", "atiende.parentesco"]));
  });

  it("an applicable visit needs what it applies to, its scope and at least one measured activity", () => {
    const r = visitaSchema.safeParse({ ...base, diagnostico: { aplica: "si", aplica_para: [] }, capitulos: [] });
    const campos = r.error!.issues.map((i) => i.path.join("."));
    expect(campos).toEqual(expect.arrayContaining(["diagnostico.aplica_para", "diagnostico.alcance", "capitulos"]));
  });

  it("a non-applicable visit needs the reason and drops any quantities", () => {
    expect(visitaSchema.safeParse({ ...base, diagnostico: { aplica: "no" } }).success).toBe(false);
    const v = visitaSchema.parse({ ...base, diagnostico: { aplica: "no", no_aplica_por: "alquilada", estados: { piso: "m" }, detalles: { piso_material: "tierra" } } });
    expect(v.capitulos).toEqual([]);
    expect(v.diagnostico).toMatchObject({ estados: {}, detalles: {}, alcance: null, aplica_para: [] });
  });

  it("rejects a bad quantity expression at its row", () => {
    const r = visitaSchema.safeParse({ ...base, capitulos: [{ id: "c1", nombre: "Piso", filas: [{ id: "f1", item: "200101", cantidad_expr: "3*" }] }] });
    expect(r.error!.issues[0]).toMatchObject({ path: ["capitulos", 0, "filas", 0, "cantidad_expr"], message: "Revise la operación: 3*" });
  });

  it("keeps one state per house element and the optional details", () => {
    const { diagnostico } = visitaSchema.parse(base);
    expect(diagnostico.estados).toEqual({ piso: "m", escaleras: "ne" });
    expect(diagnostico.detalles).toEqual({ piso_material: "tierra" });
    expect(diagnostico).not.toHaveProperty("secciones");
    expect(visitaSchema.parse({ ...base, diagnostico: { aplica: "no", no_aplica_por: "alquilada" } }).diagnostico).toMatchObject({ estados: {}, detalles: {} });
  });

  it("rejects unknown states, elements and details", () => {
    const con = (d: object) => visitaSchema.safeParse({ ...base, diagnostico: { ...base.diagnostico, ...d } });
    expect(con({ estados: { piso: "excelente" } }).error!.issues[0].path).toEqual(["diagnostico", "estados", "piso"]);
    expect(con({ estados: { jardin: "b" } }).success).toBe(false);
    expect(con({ detalles: { color: "azul" } }).success).toBe(false);
    expect(con({ detalles: { piso_material: "marmol" } }).success).toBe(false);
  });
});

describe("armarPresupuesto (server prices)", () => {
  const apus = new Map<string, Apu>([
    ["200101", { item: "200101", descripcion: "PLACA CONTRAPISO", und: "M2", costo_unitario: 41234, capitulo: "20", capitulo_nombre: "PISOS" }],
  ]);

  it("fills description, unit and price from the catalogue and computes the direct cost", () => {
    const v = visitaSchema.parse(base);
    const p = armarPresupuesto(v.capitulos, apus);
    expect(p.desconocidos).toEqual([]);
    expect(p.capitulos[0]).toEqual({
      id: "c1",
      nombre: "Piso",
      subtotal: 577276,
      filas: [{ id: "f1", item: "200101", descripcion: "PLACA CONTRAPISO", und: "M2", costo_unitario: 41234, cantidad_expr: "3,5*4", cantidad: 14, costo_directo: 577276 }],
    });
    expect(p.costo_directo_total).toBe(577276);
  });

  it("reports ITEMs missing from the catalogue", () => {
    const v = visitaSchema.parse({ ...base, capitulos: [{ id: "c1", nombre: "Piso", filas: [{ id: "f1", item: "999999", cantidad_expr: "1" }] }] });
    expect(armarPresupuesto(v.capitulos, apus).desconocidos).toEqual(["999999"]);
  });
});
