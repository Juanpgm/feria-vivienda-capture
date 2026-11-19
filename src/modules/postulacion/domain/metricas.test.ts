import { describe, expect, it } from "vitest";
import { agregarPostulaciones } from "./metricas";

describe("agregarPostulaciones", () => {
  const filas = [
    { estado: "valido", fecha_bogota: "2026-11-18", origen: "publico", faltantes: [], solicitante: { estrato: 2, condiciones_especiales: ["indigena", "campesino"], sisben: true, sisben_grupo: "A" }, hogar: { personas: 3, rango_ingresos_smlmv: "0_4" }, postulacion: { modalidad: "1", recursos: { cesantias: { valor: 1000 } }, total_aportes: 1000 }, validado_por_nombre: "Ana" },
    { estado: "sin_validar", fecha_bogota: "2026-11-17", origen: "funcionario", faltantes: [{ etiqueta: "Estrato" }, { etiqueta: "Integrante 2: parentesco" }], solicitante: { estrato: null, condiciones_especiales: [], sisben: false }, hogar: { personas: 6 }, postulacion: { modalidad: "1", recursos: {}, total_aportes: 0 } },
  ];
  const m = agregarPostulaciones(filas, "2026-11-18", 7);

  it("counts totals by state, completeness and origin", () => {
    expect([m.total, m.validas, m.sin_validar, m.completas, m.publicas, m.personas]).toEqual([2, 1, 1, 1, 1, 9]);
  });
  it("builds a zero-filled daily series ending today", () => {
    expect(m.serie).toHaveLength(7);
    expect(m.serie.at(-1)).toEqual({ fecha: "2026-11-18", n: 1 });
    expect(m.serie.at(-2)).toEqual({ fecha: "2026-11-17", n: 1 });
  });
  it("groups categories, keeping missing data visible", () => {
    expect(m.por_modalidad[0]).toMatchObject({ clave: "1", n: 2 });
    expect(m.por_estrato.find((i) => i.clave === "sin_dato")?.n).toBe(1);
    expect(m.por_hogar.find((i) => i.clave === "5+")?.n).toBe(1);
    expect(m.por_condicion.map((i) => i.clave).sort()).toEqual(["campesino", "indigena"]);
    expect(m.por_sisben.map((i) => i.etiqueta).sort()).toEqual(["Grupo A", "No afiliado"]);
  });
  it("sums resources by source and ranks missing fields (members merged)", () => {
    expect(m.recursos.find((r) => r.clave === "cesantias")).toMatchObject({ n: 1, monto: 1000 });
    expect(m.top_faltantes.map((f) => f.etiqueta)).toContain("Integrante: parentesco");
    expect(m.por_validador).toEqual([{ clave: "Ana", etiqueta: "Ana", n: 1 }]);
  });
});
