import { describe, expect, it } from "vitest";
import { costoDirecto } from "./costos";

describe("costoDirecto = ROUNDUP(CANTIDAD × COSTO UNITARIO, 0)", () => {
  it("rounds up to whole pesos like the sheet", () => {
    expect(costoDirecto(75.51, 21000)).toBe(1585710);
    expect(costoDirecto(0.3333, 100)).toBe(34);
    expect(costoDirecto(2.5, 1000)).toBe(2500); // no float drift: 2500.0000001 must not become 2501
    expect(costoDirecto(1.1, 3)).toBe(4);
  });
});
