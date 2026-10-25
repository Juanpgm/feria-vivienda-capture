import { describe, expect, it } from "vitest";
import { migrarBorrador, migrarPasos, ordenarBorradores, partirNombre, resumenBorrador, sinBorrador, VERSION_BORRADOR, type Borrador } from "./borradores";

const base = (id: string, guardado_en: string, solicitante: Record<string, unknown> = {}, paso = "solicitante"): Borrador => ({
  id, version: VERSION_BORRADOR, valores: { solicitante }, paso, maximo: 0, marcas: {}, guardado_en,
});

describe("partirNombre (legacy full name, best effort)", () => {
  it.each([
    ["Ana", { primer_nombre: "Ana", segundo_nombre: "", primer_apellido: "", segundo_apellido: "" }],
    ["Ana Pérez", { primer_nombre: "Ana", segundo_nombre: "", primer_apellido: "Pérez", segundo_apellido: "" }],
    ["Ana Pérez Gómez", { primer_nombre: "Ana", segundo_nombre: "", primer_apellido: "Pérez", segundo_apellido: "Gómez" }],
    ["  Ana  María Pérez   Gómez de la Cruz ", { primer_nombre: "Ana", segundo_nombre: "María", primer_apellido: "Pérez", segundo_apellido: "Gómez de la Cruz" }],
    ["", { primer_nombre: "", segundo_nombre: "", primer_apellido: "", segundo_apellido: "" }],
  ])("%j", (entrada, esperado) => expect(partirNombre(entrada)).toEqual(esperado));
});

describe("migrarBorrador", () => {
  const legado = {
    id: "u1", paso: "inmueble", maximo: 3, guardado_en: "2026-10-25T10:00:00.000Z",
    marcas: { hogar: "completo", inmueble: "completo", titularidad: "completo" },
    valores: {
      solicitante: { nombre_completo: "ana maría pérez", correo_solicitante: "a@b.co" },
      inmueble: { direccion: "Calle 5", barrio_no_listado: true, barrio_vereda_otro: "Mi barrio" },
    },
  };

  it("v1 draft: splits the name, drops the free-text barrio and stale marks, bumps the version", () => {
    const m = migrarBorrador(legado)!;
    expect(m.version).toBe(VERSION_BORRADOR);
    expect(m.valores.solicitante).toMatchObject({ primer_nombre: "ana", segundo_nombre: "", primer_apellido: "maría", segundo_apellido: "pérez", correo_solicitante: "a@b.co" });
    expect(m.valores.solicitante).not.toHaveProperty("nombre_completo");
    expect(m.valores.inmueble).toEqual({ direccion: "Calle 5" });
    // inmueble (free text) and titularidad (new required answer) re-validate, so the merged "vivienda" step is not complete
    expect(m.marcas).toEqual({ solicitante: "completo" });
    expect(m.paso).toBe("vivienda");
    expect(m.maximo).toBe(2);
  });

  it("current draft passes through untouched; garbage and unknown steps are handled without throwing", () => {
    const actual = base("u2", "2026-10-25T10:00:00.000Z", { primer_nombre: "Luis" });
    expect(migrarBorrador(actual)).toEqual(actual);
    for (const basura of [null, undefined, 3, "x", [], {}, { id: 1, valores: {} }, { id: "x" }]) expect(migrarBorrador(basura)).toBeNull();
    expect(migrarBorrador({ ...actual, paso: "no-existe" })!.paso).toBe("solicitante");
  });
});

describe("migrarPasos (11 steps -> 6)", () => {
  it("maps the current step and the furthest step reached", () => {
    const viejos = ["hogar", "composicion", "proteccion", "inmueble", "riesgo", "titularidad", "financiero", "consentimiento", "documentos", "resumen", "firma"];
    expect(viejos.map((p, i) => migrarPasos(p, i, {}).paso)).toEqual(["solicitante", "hogar", "hogar", "vivienda", "vivienda", "vivienda", "financiero", "autorizacion", "autorizacion", "revision", "revision"]);
    expect(viejos.map((_, i) => migrarPasos("hogar", i, {}).maximo)).toEqual([0, 1, 1, 2, 2, 2, 3, 4, 4, 5, 5]);
  });

  it("a merged step is complete only when all its old steps were; errors win; the review step has no mark", () => {
    const completos = { hogar: "completo", composicion: "completo", proteccion: "completo", inmueble: "completo", riesgo: "completo", titularidad: "completo", financiero: "completo", consentimiento: "completo", documentos: "completo", resumen: "completo" } as const;
    expect(migrarPasos("resumen", 9, completos).marcas).toEqual({ solicitante: "completo", hogar: "completo", vivienda: "completo", financiero: "completo", autorizacion: "completo" });
    const parcial = { ...completos, proteccion: undefined, riesgo: "errores", documentos: undefined } as unknown as Record<string, "completo" | "errores">;
    expect(migrarPasos("riesgo", 4, parcial).marcas).toEqual({ solicitante: "completo", vivienda: "errores", financiero: "completo" });
  });

  it("is safe with bad input", () => {
    expect(migrarPasos(undefined, "x", {})).toEqual({ paso: "solicitante", maximo: 0, marcas: {} });
    expect(migrarPasos("nada", 99, {}).maximo).toBe(5);
  });

  it("migrates a version 2 draft keeping every value", () => {
    const v2 = {
      id: "u3", version: 2, paso: "proteccion", maximo: 7, guardado_en: "2026-10-25T10:00:00.000Z",
      marcas: { hogar: "completo", composicion: "completo", proteccion: "completo", inmueble: "errores" },
      valores: { solicitante: { primer_nombre: "Ana" }, composicion: { cantidad_personas_hogar: "3" }, titularidad: { es_unica_propiedad: "si" } },
    };
    const m = migrarBorrador(v2)!;
    expect(m).toMatchObject({ version: VERSION_BORRADOR, paso: "hogar", maximo: 4, valores: v2.valores, marcas: { solicitante: "completo", hogar: "completo", vivienda: "errores" } });
    expect(migrarBorrador(m)).toEqual(m); // idempotent
  });
});

describe("lista de borradores", () => {
  it("orders by last save, newest first; never saved last", () => {
    const l = [base("a", "2026-10-25T09:00:00.000Z"), base("b", ""), base("c", "2026-10-25T11:00:00.000Z")];
    expect(ordenarBorradores(l).map((b) => b.id)).toEqual(["c", "a", "b"]);
  });

  it("names the row from primer_nombre + primer_apellido, 'Sin nombre' when empty, with the current step", () => {
    expect(resumenBorrador(base("a", "", { primer_nombre: " Ana ", segundo_nombre: "María", primer_apellido: "Pérez" }, "hogar"))).toMatchObject({
      nombre: "Ana Pérez", numeroPaso: 2, paso: "Hogar",
    });
    expect(resumenBorrador(base("b", "", { primer_nombre: "Ana" })).nombre).toBe("Ana");
    expect(resumenBorrador(base("c", "")).nombre).toBe("Sin nombre");
  });

  it("removes one draft without touching the others", () => {
    const l = [base("a", ""), base("b", "")];
    expect(sinBorrador(l, "a").map((b) => b.id)).toEqual(["b"]);
    expect(l).toHaveLength(2);
  });
});
