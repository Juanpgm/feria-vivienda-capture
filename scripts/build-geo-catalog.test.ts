import { describe, expect, it } from "vitest";
import { construirCatalogo } from "./build-geo-catalog.mjs";

const f = (properties: Record<string, unknown>) => ({ properties });
const comunas = {
  features: [
    f({ COMUNA: 1, NOMBRE: "Comuna 1", ID_CORREG: null, CORREGIMIE: "" }),
    f({ COMUNA: 22, NOMBRE: "Comuna 22", ID_CORREG: null, CORREGIMIE: "" }),
    f({ COMUNA: null, NOMBRE: "", ID_CORREG: 56, CORREGIMIE: "Los Andes" }),
    f({ COMUNA: null, NOMBRE: "", ID_CORREG: 99, CORREGIMIE: "Sin Veredas" }),
  ],
};
const barrios = {
  features: [
    f({ ID_BARRIO: "0102", BARRIO: "Vista Hermosa", COMUNA: "01", VEREDA: "Pilas", ID_VEREDA: 5611, ID_CORREG: 56 }),
    f({ ID_BARRIO: "0102", BARRIO: "Vista Hermosa", COMUNA: "01", VEREDA: "Pilas", ID_VEREDA: 5611, ID_CORREG: 56 }),
    f({ ID_BARRIO: "2201", BARRIO: "Ciudad Jardín", COMUNA: "22" }),
    f({ ID_BARRIO: "", BARRIO: "", COMUNA: "", VEREDA: "El Cabuyal", ID_VEREDA: 5612, ID_CORREG: 56 }),
    f({ ID_BARRIO: "9901", BARRIO: "Perdido", COMUNA: "99" }),
  ],
};

describe("construirCatalogo", () => {
  const r = construirCatalogo(comunas, barrios);

  it("matches int COMUNA to zero-padded string keys", () => {
    expect(r.divisiones.filter((d) => d.tipo === "comuna").map((d) => d.codigo)).toEqual(["01", "22"]);
    expect(r.barrios.find((b) => b.id === "0102")?.codigo_division).toBe("01");
    expect(r.barrios.find((b) => b.id === "2201")?.sector).toBe("urbano");
  });

  it("dedupes barrios and veredas, links veredas to their corregimiento", () => {
    expect(r.barrios.filter((b) => b.id === "0102")).toHaveLength(1);
    const veredas = r.barrios.filter((b) => b.sector === "rural");
    expect(veredas.map((v) => v.id).sort()).toEqual(["V5611", "V5612"]);
    expect(veredas.every((v) => v.codigo_division === "56")).toBe(true);
  });

  it("reports orphans and corregimientos without veredas, and keeps no geometry", () => {
    expect(r.reporte.huerfanos).toEqual(["barrio 9901 comuna 99"]);
    expect(r.reporte.corregimientosSinVeredas).toEqual(["Sin Veredas"]);
    expect(JSON.stringify(r)).not.toContain("geometry");
  });
});
