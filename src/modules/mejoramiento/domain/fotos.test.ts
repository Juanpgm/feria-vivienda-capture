import { describe, expect, it } from "vitest";
import { claveCroquis, claveFirmaCiudadano, claveFoto, claveFirmaInspector, erroresFotos, extensionDe, nombresFotos } from "./fotos";

describe("photo names: visit code + ITEM + consecutive", () => {
  it("numbers consecutively per ITEM across repeated rows", () => {
    const n = nombresFotos("MV-000007", [
      { item: "290304", fotos: 2 },
      { item: "010101", fotos: 1 },
      { item: "290304", fotos: 1 },
      { item: "APU 01", fotos: 1 },
    ]);
    expect(n).toEqual([
      ["MV-000007_290304_01", "MV-000007_290304_02"],
      ["MV-000007_010101_01"],
      ["MV-000007_290304_03"],
      ["MV-000007_APU-01_01"],
    ]);
  });

  it("builds the S3 keys of the three visit folders and the inspector folder", () => {
    expect(claveFoto("MV-000007", "MV-000007_290304_01", "image/jpeg")).toBe(
      "visitas-profesionales/MV-000007/registro-fotografico/MV-000007_290304_01.jpg",
    );
    expect(claveFirmaCiudadano("MV-000007", "1.144.555-x")).toBe("visitas-profesionales/MV-000007/firma-ciudadano/MV-000007_1144555X_01.png");
    expect(claveCroquis("MV-000007", 3, "application/pdf")).toBe("visitas-profesionales/MV-000007/croquis-visita/MV-000007_03.pdf");
    expect(claveFirmaInspector("uid_123")).toBe("inspectores/uid_123/firma.png");
  });

  it("only allows the supported content types", () => {
    expect(extensionDe("image/webp")).toBe("webp");
    expect(extensionDe("text/html")).toBeNull();
    expect(extensionDe("image/svg+xml")).toBeNull();
  });
});

describe("erroresFotos: 6 to 30 per visit, at most 6 per item", () => {
  it("accepts a visit within the limits", () => {
    expect(erroresFotos([3, 3], true)).toEqual([]);
    expect(erroresFotos([6, 6, 6, 6, 6], true)).toEqual([]);
  });
  it("reports too few, too many and an overloaded row", () => {
    expect(erroresFotos([2, 3], true)).toEqual(["Se requieren al menos 6 fotos por visita (hay 5)"]);
    expect(erroresFotos([6, 6, 6, 6, 6, 1], true)).toEqual(["Máximo 30 fotos por visita (hay 31)"]);
    expect(erroresFotos([7], true)).toEqual(["Máximo 6 fotos por actividad (fila 1 tiene 7)"]);
  });
  it("a visit that does not apply needs no photos", () => {
    expect(erroresFotos([], false)).toEqual([]);
  });
});
