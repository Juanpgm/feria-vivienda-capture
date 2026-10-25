import { describe, expect, it } from "vitest";
import { firmaFormSchema, firmaParaEnviar, firmaSchema, firmaVigente, selloDeDatos } from "./schema";

const campos = (schema: typeof firmaSchema | typeof firmaFormSchema, v: unknown) => {
  const r = schema.safeParse(v);
  return r.success ? [] : r.error.issues.map((i) => i.path.join("."));
};
const manual = { metodo_firma: "verificacion_manual", metodo_verificacion: "huella", nota_verificacion: "Huella en la planilla 12" };

describe("firmaSchema (server input, discriminated union)", () => {
  it("accepts a drawn signature (the image travels apart) and a complete manual verification", () => {
    expect(firmaSchema.parse({ metodo_firma: "dibujada" })).toEqual({ metodo_firma: "dibujada" });
    expect(firmaSchema.parse(manual)).toEqual(manual);
  });

  it("rejects a missing or unknown method", () => {
    expect(campos(firmaSchema, undefined)).toHaveLength(1);
    expect(campos(firmaSchema, { metodo_firma: "otra" })).toEqual(["metodo_firma"]);
    expect(campos(firmaSchema, {})).toEqual(["metodo_firma"]);
  });

  it("manual verification needs a valid method and a note of at least 10 characters (trimmed)", () => {
    expect(campos(firmaSchema, { ...manual, metodo_verificacion: undefined })).toEqual(["metodo_verificacion"]);
    expect(campos(firmaSchema, { ...manual, metodo_verificacion: "dedo" })).toEqual(["metodo_verificacion"]);
    expect(campos(firmaSchema, { ...manual, nota_verificacion: "corta" })).toEqual(["nota_verificacion"]);
    expect(campos(firmaSchema, { ...manual, nota_verificacion: "         x         " })).toEqual(["nota_verificacion"]);
    expect(campos(firmaSchema, { ...manual, nota_verificacion: "x".repeat(501) })).toEqual(["nota_verificacion"]);
    expect(firmaSchema.parse({ ...manual, nota_verificacion: "  Firma en papel archivada  " })).toMatchObject({ nota_verificacion: "Firma en papel archivada" });
  });

  it("never lets a drawn signature carry manual fields, nor the manual one an image", () => {
    expect(firmaSchema.parse({ metodo_firma: "dibujada", metodo_verificacion: "huella", nota_verificacion: "x".repeat(20) })).toEqual({ metodo_firma: "dibujada" });
    expect(firmaSchema.parse({ ...manual, imagen: "data:image/png;base64,AA==" })).toEqual(manual);
  });
});

describe("firmaFormSchema (form section)", () => {
  it("a drawn signature needs the image", () => {
    expect(campos(firmaFormSchema, { metodo_firma: "dibujada", imagen: "" })).toEqual(["imagen"]);
    expect(campos(firmaFormSchema, { metodo_firma: "dibujada", imagen: "data:image/png;base64,AA==" })).toEqual([]);
  });
  it("an unset method asks to sign or verify", () => {
    expect(campos(firmaFormSchema, { metodo_firma: "", imagen: "" })).toEqual(["metodo_firma"]);
  });
  it("manual verification without note fails on the note", () => {
    expect(campos(firmaFormSchema, { ...manual, nota_verificacion: "" })).toEqual(["nota_verificacion"]);
  });
});

describe("firmaParaEnviar", () => {
  it("strips the image and the seal; keeps the manual fields only for the manual method", () => {
    expect(firmaParaEnviar({ metodo_firma: "dibujada", imagen: "data:...", sello: "ab", nota_verificacion: "x" })).toEqual({ metodo_firma: "dibujada" });
    expect(firmaParaEnviar({ ...manual, imagen: "", sello: "ab" })).toEqual(manual);
  });
});

describe("sello y vigencia de la firma (editar datos después de firmar la invalida)", () => {
  const datos = { solicitante: { primer_nombre: "Ana", direccion: "Calle 1" }, inmueble: { direccion: "Calle 1" } };

  it("the seal ignores the signature section and the key order", () => {
    const base = selloDeDatos(datos);
    expect(selloDeDatos({ ...datos, firma: { imagen: "zzz", sello: "q" } })).toBe(base);
    expect(selloDeDatos({ inmueble: { direccion: "Calle 1" }, solicitante: { direccion: "Calle 1", primer_nombre: "Ana" } })).toBe(base);
    expect(base).toMatch(/^[0-9a-f]{8}$/);
  });

  it("a signature is valid only while the data keeps producing its seal", () => {
    const firmada = { ...datos, firma: { metodo_firma: "dibujada", imagen: "x", sello: selloDeDatos(datos) } };
    expect(firmaVigente(firmada)).toBe(true);
    const editada = { ...firmada, inmueble: { direccion: "Calle 2" } };
    expect(firmaVigente(editada)).toBe(false);
  });

  it("no method or no seal means not signed", () => {
    expect(firmaVigente({ ...datos, firma: { metodo_firma: "", sello: selloDeDatos(datos) } })).toBe(false);
    expect(firmaVigente({ ...datos, firma: { metodo_firma: "dibujada", sello: "" } })).toBe(false);
    expect(firmaVigente(datos)).toBe(false);
  });

  it("works for the manual verification too", () => {
    const v = { ...datos, firma: { ...manual, sello: selloDeDatos(datos) } };
    expect(firmaVigente(v)).toBe(true);
    expect(firmaVigente({ ...v, solicitante: { primer_nombre: "Ana", direccion: "Otra" } })).toBe(false);
  });
});
