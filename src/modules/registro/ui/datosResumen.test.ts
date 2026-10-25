import { describe, expect, it } from "vitest";
import { evaluarRegistro, filasDe, SECCIONES } from "./datosResumen";
import type { Valores } from "./pasos";

const valores = {
  solicitante: {
    nombre_completo: "ana maria perez", tipo_documento: "cc", tipo_documento_otro: "", codigo_pais_nacionalidad: "CO",
    numero_documento: "1.234.567", fecha_expedicion_documento: "2010-05-01", telefono_1: "3001234567", telefono_2: "",
    correo_solicitante: "a@b.co", anios_residencia: "2,5", fecha_nacimiento: "1990-01-02", estado_civil: "soltero",
  },
  composicion: {
    cantidad_personas_hogar: "5", tiene_adulto_mayor: "si", cantidad_adultos_mayores: "1", adultos_mayores: [{ edad: "74" }],
    condiciones_especiales: ["ninguna"], ingreso_hogar_cop: "7.003.621",
  },
  inmueble: { direccion: "Calle 5 # 10-20", codigo_division: "53", id_barrio_vereda: "V5306", barrio_no_listado: false, barrio_vereda_otro: "", estrato: "2" },
  riesgo: { esta_en_rud: "si", numero_rud: "", rud_no_sabe: true, dictamen: "otro", dictamen_otro: "Grietas" },
  titularidad: { tipo_titularidad: "poseedor_legitimo", numero_matricula_inmobiliaria: "" },
  cierre_financiero: { fuentes_financiacion: ["ninguna"], tiene_seguro: "si", codigo_aseguradora: "otra", aseguradora_otra: "Seguros X" },
} as unknown as Valores;

describe("resumen", () => {
  it("derives bands, sector and display rows from the real schemas", async () => {
    const ev = await evaluarRegistro(valores);
    for (const s of SECCIONES) expect(ev[s.id].ok, s.id).toBe(true);
    const fila = (id: string, etiqueta: string) => {
      const e = ev[id];
      if (!e.ok) throw new Error(id);
      return filasDe(id, e.datos, "2026-06-01").find((f) => f.etiqueta === etiqueta)?.valor;
    };
    expect(fila("composicion", "Ingreso mensual")).toContain("De >4 a 5.5 SMLMV");
    expect(fila("composicion", "Adultos mayores")).toContain("más de 74");
    expect(fila("inmueble", "Sector")).toBe("Rural");
    expect(fila("inmueble", "Vereda")).toBe("El Banqueo");
    expect(fila("riesgo", "Registrado en el RUD")).toBe("Sí, no sabe el número");
    expect(fila("cierre_financiero", "Seguro")).toBe("Sí, Seguros X");
    expect(fila("solicitante", "Fecha de nacimiento")).toBe("02/01/1990 (36 años)");
  });

  it("lists missing sections instead of rows", async () => {
    const ev = await evaluarRegistro({ ...valores, inmueble: {}, riesgo: undefined } as unknown as Valores);
    expect(ev.inmueble.ok).toBe(false);
    expect(ev.riesgo.ok).toBe(false);
    expect(ev.solicitante.ok).toBe(true);
  });
});
