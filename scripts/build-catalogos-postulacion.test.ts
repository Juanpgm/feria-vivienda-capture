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
