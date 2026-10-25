import { describe, expect, it } from "vitest";
import { clavesDocumento, coincidencia } from "./documento";
import { formatearRadicado, parsearRadicado } from "./radicado";

describe("clavesDocumento", () => {
  it("normalizes the number and derives a digits-only key without leading zeros", () => {
    expect(clavesDocumento("1.234.567-8 ")).toEqual({ documento_clave: "12345678", documento_digitos: "12345678" });
    expect(clavesDocumento("cc 0012345")).toEqual({ documento_clave: "CC0012345", documento_digitos: "12345" });
    expect(clavesDocumento("ab-é9")).toEqual({ documento_clave: "ABE9", documento_digitos: null });
  });

  it("short digit runs never get a similar key", () => {
    expect(clavesDocumento("1234").documento_digitos).toBeNull();
    expect(clavesDocumento("").documento_clave).toBe("");
  });
});

describe("coincidencia", () => {
  const buscado = clavesDocumento("CC1234567");
  it("exact on the normalized key, whatever the tipo", () => {
    expect(coincidencia(buscado, clavesDocumento("cc 1234567"))).toBe("exacta");
  });
  it("similar on digits when the prefix differs", () => {
    expect(coincidencia(buscado, clavesDocumento("1234567"))).toBe("similar");
    expect(coincidencia(clavesDocumento("1234567"), clavesDocumento("0001234567"))).toBe("similar");
  });
  it("no match otherwise, and nothing matches an empty key", () => {
    expect(coincidencia(buscado, clavesDocumento("7654321"))).toBeNull();
    expect(coincidencia(clavesDocumento(""), clavesDocumento(""))).toBeNull();
    expect(coincidencia(buscado, {})).toBeNull();
  });
});

describe("radicado", () => {
  it("formats with a 6-digit consecutive and lets it grow", () => {
    expect(formatearRadicado("FV", 123)).toBe("FV-000123");
    expect(formatearRadicado("FV", 1_000_000)).toBe("FV-1000000");
  });
  it("parses typed radicados but not bare numbers", () => {
    expect(parsearRadicado("fv-123", "FV")).toBe("FV-000123");
    expect(parsearRadicado(" FV000123 ", "FV")).toBe("FV-000123");
    expect(parsearRadicado("123", "FV")).toBeNull();
    expect(parsearRadicado("XY-123", "FV")).toBeNull();
  });
});
