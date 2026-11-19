import { describe, expect, it } from "vitest";
import { construirEstratos, construirMunicipios } from "./build-catalogos-postulacion.mjs";

describe("catálogos de la postulación", () => {
  it("title-cases DIVIPOLA names and sorts them", () => {
    const m = construirMunicipios([
      { cod_mpio: "76001", nom_mpio: "CALI", dpto: "VALLE DEL CAUCA" },
      { cod_mpio: "05001", nom_mpio: "MEDELLÍN", dpto: "ANTIOQUIA" },
    ]);
    expect(m).toEqual([
      { codigo: "76001", nombre: "Cali", departamento: "Valle del Cauca" },
      { codigo: "05001", nombre: "Medellín", departamento: "Antioquia" },
    ]);
  });
  it("maps barrio codes to estrato 1-6 and drops invalid values", () => {
    const csv = "Id_barrio,Cod_barrio,Cod_comuna,Nombre,Area (ha),Perimetro (m),Estrato_moda\n206,206,2,Centenario,21,2200,5\n1,1600,16,X,1,1,10\n2,1997,19,Y,1,1,\n";
    expect(construirEstratos(csv)).toEqual({ "0206": 5 });
  });
});

describe("entidades financieras", () => {
  it("keeps the financial kinds, cleans legal names and adds the cajas with their short brand", async () => {
    const { construirEntidades } = await import("./build-catalogos-postulacion.mjs");
    const e = construirEntidades(
      [
        { tipo_entidad: "1", razon_social: "BANCOLOMBIA S.A. podrá girar también con la denominación social Banco", numeroidentificacion: "8909039388" },
        { tipo_entidad: "23", razon_social: "SOCIEDAD ADMINISTRADORA DE FONDOS DE PENSIONES, CESANTIAS", numeroidentificacion: "8001443313" },
        { tipo_entidad: "6", razon_social: "ALMACENES GENERALES DE DEPOSITO ALMAVIVA S.A.", numeroidentificacion: "1" },
      ],
      [{ ccf: "Caja de Compensación Familiar del Valle del Cauca COMFAMILIAR ANDI: COMFANDI" }],
    );
    expect(e.find((x) => x.nombre === "Bancolombia")?.tipo).toBe("banco");
    expect(e.find((x) => x.nombre.startsWith("Porvenir"))?.tipo).toBe("fondo_cesantias");
    expect(e.find((x) => x.nombre === "Comfandi")?.tipo).toBe("caja_compensacion");
    expect(e.some((x) => /Almaviva/i.test(x.nombre))).toBe(false);
    expect(e.some((x) => x.tipo === "entidad_publica")).toBe(true);
  });
});
