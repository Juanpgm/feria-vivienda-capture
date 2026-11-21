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

describe("erroresFotos: optional photos, at most 6 per activity and 30 per visit", () => {
  it("accepts a visit without photos and one within the limits", () => {
    expect(erroresFotos([])).toEqual([]);
    expect(erroresFotos([0, 0])).toEqual([]);
    expect(erroresFotos([2, 3])).toEqual([]);
    expect(erroresFotos([6, 6, 6, 6, 6])).toEqual([]);
  });
  it("reports too many per visit and an overloaded activity", () => {
    expect(erroresFotos([6, 6, 6, 6, 6, 1])).toEqual(["Máximo 30 fotos por visita (hay 31)"]);
    expect(erroresFotos([7])).toEqual(["Máximo 6 fotos por actividad (fila 1 tiene 7)"]);
  });
});
