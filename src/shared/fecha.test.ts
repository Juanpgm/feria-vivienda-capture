import { describe, expect, it } from "vitest";
import { aMascara, isoAMascara, parseMascara } from "./fecha";

describe("fecha DD/MM/AAAA", () => {
  it.each([
    ["1", "1"],
    ["15", "15"],
    ["150", "15/0"],
    ["15032", "15/03/2"],
    ["15032020", "15/03/2020"],
    ["15/03/2020", "15/03/2020"],
    ["15-03-2020", "15/03/2020"],
    ["1503202099", "15/03/2020"],
    ["ab1c5", "15"],
    ["2020-03-15", "15/03/2020"],
    ["", ""],
  ])("masks %j as %j", (entrada, esperado) => expect(aMascara(entrada)).toBe(esperado));

  it("does not force a trailing slash, so Backspace can erase it", () => {
    expect(aMascara("15/")).toBe("15");
  });

  it("parses real dates to ISO", () => {
    expect(parseMascara("15/03/2020")).toEqual({ iso: "2020-03-15" });
    expect(parseMascara("29/02/2024")).toEqual({ iso: "2024-02-29" }); // leap year
    expect(parseMascara("31/12/1999")).toEqual({ iso: "1999-12-31" });
  });

  it.each([
    ["31/02/2020", /no tiene el día 31/],
    ["29/02/2023", /no tiene el día 29/],
    ["31/04/2020", /no tiene el día 31/],
    ["10/13/2020", /mes debe estar entre 01 y 12/],
    ["00/05/2020", /día debe estar entre 01 y 31/],
    ["15/03/1850", /1900 o posterior/],
  ])("explains impossible date %s", (texto, mensaje) => {
    const r = parseMascara(texto);
    expect("error" in r && r.error).toBe("inexistente");
    expect("mensaje" in r && r.mensaje).toMatch(mensaje);
  });

  it("flags partial input as incomplete", () => {
    expect(parseMascara("15/03/20")).toMatchObject({ error: "incompleta" });
    expect(parseMascara("")).toMatchObject({ error: "incompleta" });
  });

  it("round-trips ISO and leaves partial text alone", () => {
    expect(isoAMascara("2020-03-15")).toBe("15/03/2020");
    expect(isoAMascara("15/0")).toBe("15/0");
    expect(isoAMascara("2026-02-30")).toBe("2026-02-30");
  });
});
