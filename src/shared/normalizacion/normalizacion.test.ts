import { describe, expect, it } from "vitest";
import { normalizarDireccion } from "./direccion";
import { normalizarTelefono } from "./telefono";
import { normalizarDocumento, normalizarNombre, parsearIngresoCop } from "./texto";

describe("normalizarNombre", () => {
  it.each([
    ["  ana MARÍA  pérez ", "Ana María Pérez"],
    ["jUAN pablo GÓMEZ", "Juan Pablo Gómez"],
    ["MARIA  DE LA  CRUZ", "Maria De La Cruz"],
    ["peña-o'brien", "Peña-O'Brien"],
  ])("%j -> %j", (i, o) => {
    expect(normalizarNombre(i)).toBe(o);
    expect(normalizarNombre(o)).toBe(o);
  });
});

describe("normalizarDocumento", () => {
  it.each([
    ["1.234.567-8 ", "12345678"],
    ["001.020", "001020"],
    ["ab-12 ñ", "AB12N"],
    ["---", ""],
  ])("%j -> %j", (i, o) => {
    expect(normalizarDocumento(i)).toBe(o);
    expect(normalizarDocumento(o)).toBe(o);
  });
});

describe("normalizarTelefono", () => {
  it.each([
    ["300 123 4567", "+573001234567"],
    ["+57 300 123 4567", "+573001234567"],
    ["+1 415 555 2671", "+14155552671"],
    ["12345", null],
    ["", null],
  ])("%j -> %j", (i, o) => {
    expect(normalizarTelefono(i)).toBe(o);
    if (o) expect(normalizarTelefono(o)).toBe(o);
  });
});

describe("parsearIngresoCop", () => {
  it.each([
    ["1.500.000", 1500000],
    ["1500000 COP", 1500000],
    ["$1,500,000", 1500000],
    ["0", 0],
    ["1.5", null],
    ["abc", null],
    ["-100", null],
    ["", null],
  ])("%j -> %j", (i, o) => expect(parsearIngresoCop(i)).toBe(o));
});

describe("normalizarDireccion", () => {
  it.each([
    ["cra 12 No 5-20", "KR 12 # 5-20", true],
    ["Calle 5 # 38 - 20 apto 301", "CL 5 # 38-20 APTO 301", true],
    ["Avenida Carrera 15A Bis N° 20-10", "AK 15A BIS # 20-10", true],
    ["Carrera 12 A #5-20", "KR 12A # 5-20", true],
    ["Diagonal 23 Numero 4 B 10", "DG 23 # 4B 10", false],
    ["barrio el rosario, casa azul", "BARRIO EL ROSARIO CASA AZUL", false],
  ])("%j -> %j", (i, norm, completa) => {
    const r = normalizarDireccion(i);
    expect(r).toEqual({ norm, es_completa: completa });
    expect(normalizarDireccion(r.norm).norm).toBe(r.norm);
  });
});
