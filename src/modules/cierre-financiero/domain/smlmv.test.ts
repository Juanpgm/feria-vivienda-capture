import { describe, expect, it } from "vitest";
import { derivarIngreso, SMLMV } from "./smlmv";

describe("derivarIngreso", () => {
  it("uses SMLMV 2026", () => expect(SMLMV).toBe(1750905));

  it.each([
    [0, "0_4"],
    [2_000_000, "0_4"],
    [4 * 1750905, "0_4"], // 4 SMLMV exactly: upper edge inclusive
    [4 * 1750905 + 1, "4_5_5"],
    [5.5 * 1750905, "4_5_5"], // 5.5 SMLMV exactly: inclusive
    [5.5 * 1750905 + 1, "mas_5_5"],
    [50_000_000, "mas_5_5"],
  ])("%d -> %s", (ingreso, rango) => {
    expect(derivarIngreso(ingreso).rango_ingresos_smlmv).toBe(rango);
  });

  it("reports the multiple and the value applied", () => {
    expect(derivarIngreso(2_000_000)).toMatchObject({
      ingreso_en_smlmv: 1.14,
      valor_smlmv_aplicado: 1750905,
      anio_smlmv: 2026,
    });
  });

  it("honors a different SMLMV (config, not hardcoded)", () => {
    expect(derivarIngreso(5_000_000, 1_000_000, 2030).rango_ingresos_smlmv).toBe("4_5_5");
  });
});
