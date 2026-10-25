import { describe, expect, it } from "vitest";
import { migrarBorrador, ordenarBorradores, partirNombre, resumenBorrador, sinBorrador, VERSION_BORRADOR, type Borrador } from "./borradores";

const base = (id: string, guardado_en: string, solicitante: Record<string, unknown> = {}, paso = "hogar"): Borrador => ({
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
    expect(m.marcas).toEqual({ hogar: "completo" }); // inmueble (free text) and titularidad (new required answer) re-validate
    expect(m.paso).toBe("inmueble");
  });

  it("current draft passes through untouched; garbage and unknown steps are handled without throwing", () => {
    const actual = base("u2", "2026-10-25T10:00:00.000Z", { primer_nombre: "Luis" });
    expect(migrarBorrador(actual)).toEqual(actual);
    for (const basura of [null, undefined, 3, "x", [], {}, { id: 1, valores: {} }, { id: "x" }]) expect(migrarBorrador(basura)).toBeNull();
    expect(migrarBorrador({ ...actual, paso: "no-existe" })!.paso).toBe("hogar");
  });
});

describe("lista de borradores", () => {
  it("orders by last save, newest first; never saved last", () => {
    const l = [base("a", "2026-10-25T09:00:00.000Z"), base("b", ""), base("c", "2026-10-25T11:00:00.000Z")];
    expect(ordenarBorradores(l).map((b) => b.id)).toEqual(["c", "a", "b"]);
  });

  it("names the row from primer_nombre + primer_apellido, 'Sin nombre' when empty, with the current step", () => {
    expect(resumenBorrador(base("a", "", { primer_nombre: " Ana ", segundo_nombre: "María", primer_apellido: "Pérez" }, "composicion"))).toMatchObject({
      nombre: "Ana Pérez", numeroPaso: 2, paso: "Composición familiar",
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
