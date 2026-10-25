import { describe, expect, it } from "vitest";
import { agregar, diaDe, sumarDias, type DashboardCompleto, type DashboardLectura, type DashboardUsuario, type RegistroMinimo } from "./agregacion";
import { filtrosSchema } from "./filtros";

const HOY = "2026-03-10";
const r = (extra: RegistroMinimo = {}): RegistroMinimo => ({
  fecha_registro_bogota: HOY,
  estado: "registrado",
  estado_revision: "pendiente_revision",
  registrado_por_uid: "u1",
  registrado_por_nombre: "Ana Funcionaria",
  registrado_por_correo: "ana@cali.gov.co",
  comuna: "Comuna 1",
  barrio: "Aguacatal",
  sector: "urbano",
  estrato: 3,
  rango_ingresos: "0_4",
  rango_hogar: "2_3",
  rango_adulto_mayor: "ninguno",
  titularidad: "propietario_clt",
  dictamen: "colapso_total",
  en_rud: true,
  rud_no_sabe: false,
  tiene_seguro: false,
  ...extra,
});
const completo = (rs: RegistroMinimo[], o: Partial<Parameters<typeof agregar>[1]> = {}) =>
  agregar(rs, { alcance: "completo", hoy: HOY, generadoEn: "t", ...o }) as DashboardCompleto;
const n = (items: { clave: string; n: number }[], k: string) => items.find((i) => i.clave === k)?.n;

describe("dias en America/Bogota", () => {
  it("derives the Bogota day from the instant (UTC 03:00 is still the previous day)", () => {
    expect(diaDe({ registrado_en: "2026-03-10T03:00:00.000Z" })).toBe("2026-03-09");
    expect(diaDe({ registrado_en: "2026-03-10T05:00:00.000Z" })).toBe("2026-03-10");
    expect(diaDe({ fecha_registro_bogota: "2026-01-01", registrado_en: "2026-03-10T05:00:00.000Z" })).toBe("2026-01-01");
    expect(diaDe({})).toBeNull();
  });
  it("adds days across month and year edges", () => {
    expect(sumarDias("2026-03-01", -1)).toBe("2026-02-28");
    expect(sumarDias("2026-01-01", -1)).toBe("2025-12-31");
  });
});

describe("agregar (alcance completo)", () => {
  const datos = [
    r(),
    r({ fecha_registro_bogota: "2026-03-08", estrato: 1, sector: "rural", estado_revision: "habilitado", registrado_por_uid: "u2", registrado_por_nombre: "Luis", registrado_por_correo: "luis@cali.gov.co" }),
    r({ fecha_registro_bogota: "2026-03-01", estrato: 3, tiene_seguro: true, en_rud: true, rud_no_sabe: true, dictamen: "demolido" }),
    r({ fecha_registro_bogota: "2026-01-15", en_rud: false, rango_ingresos: "mas_5_5" }),
    r({ estado: "anulado" }), // not counted
  ];

  it("headline numbers: total, today, last 7 and 30 days; annulled excluded", () => {
    expect(completo(datos).resumen).toEqual({ total: 4, hoy: 1, ultimos_7: 2, ultimos_30: 3 });
  });

  it("zero-fills fixed categories and counts the rest", () => {
    const d = completo(datos);
    expect(d.por_estrato.map((i) => i.n)).toEqual([1, 0, 3, 0, 0, 0]);
    expect(n(d.por_sector, "rural")).toBe(1);
    expect(n(d.por_revision, "habilitado")).toBe(1);
    expect(n(d.por_revision, "no_habilitado")).toBe(0);
    expect(d.por_revision).toHaveLength(4);
    expect(n(d.por_rud, "si")).toBe(2);
    expect(n(d.por_rud, "no_sabe")).toBe(1);
    expect(n(d.por_rud, "no")).toBe(1);
    expect(n(d.por_seguro, "si")).toBe(1);
    expect(n(d.por_ingresos, "mas_5_5")).toBe(1);
    expect(n(d.por_dictamen, "demolido")).toBe(1);
  });

  it("unknown or missing values land in 'Sin dato' only when present", () => {
    const d = completo([r({ sector: "marte", titularidad: null })]);
    expect(n(d.por_sector, "sin_dato")).toBe(1);
    expect(n(d.por_titularidad, "sin_dato")).toBe(1);
    expect(d.por_estrato.some((i) => i.clave === "sin_dato")).toBe(false);
  });

  it("daily series: last 30 days zero-filled by default, ends today", () => {
    const s = completo(datos).serie_diaria;
    expect(s).toHaveLength(30);
    expect(s.at(-1)).toEqual({ fecha: HOY, n: 1 });
    expect(s.find((x) => x.fecha === "2026-03-08")?.n).toBe(1);
    expect(s.reduce((a, x) => a + x.n, 0)).toBe(3); // the January record is outside the window
  });

  it("date range filter applies to every metric and sets the series window (capped at 90 days)", () => {
    const d = completo(datos, { desde: "2026-03-01", hasta: "2026-03-08" });
    expect(d.resumen.total).toBe(2);
    expect(d.serie_diaria[0].fecha).toBe("2026-03-01");
    expect(d.serie_diaria.at(-1)?.fecha).toBe("2026-03-08");
    expect(d.filtros).toEqual({ desde: "2026-03-01", hasta: "2026-03-08", funcionario: null });
    expect(completo(datos, { desde: "2025-01-01" }).serie_diaria).toHaveLength(90);
  });

  it("funcionario filter narrows metrics but the funcionario table keeps everybody in range", () => {
    const d = completo(datos, { funcionario: "u2" });
    expect(d.resumen.total).toBe(1);
    expect(d.por_funcionario.map((f) => f.uid)).toEqual(["u1", "u2"]);
    expect(completo(datos, { funcionario: "nadie" }).resumen.total).toBe(0);
  });

  it("per funcionario: count, last registration, sorted by count", () => {
    const f = completo(datos).por_funcionario;
    expect(f[0]).toEqual({ uid: "u1", nombre: "Ana Funcionaria", correo: "ana@cali.gov.co", n: 3, ultimo_registro: HOY });
    expect(f[1]).toMatchObject({ uid: "u2", n: 1, ultimo_registro: "2026-03-08" });
  });

  it("top-N barrios plus 'Otros' (sum preserved); same barrio name in two comunas stays separate", () => {
    const rs = [
      ...Array.from({ length: 3 }, () => r({ barrio: "A" })),
      ...Array.from({ length: 2 }, () => r({ barrio: "B" })),
      r({ barrio: "C" }),
      r({ barrio: "D" }),
      r({ barrio: "A", comuna: "Comuna 2" }),
    ];
    const b = agregar(rs, { alcance: "completo", hoy: HOY, topBarrios: 2 }) as DashboardCompleto;
    expect(b.por_barrio.map((i) => [i.etiqueta, i.n])).toEqual([["A", 3], ["B", 2], ["Otros", 3]]);
    expect(b.por_barrio.reduce((s, i) => s + i.n, 0)).toBe(8);
    expect(completo(rs).por_barrio.filter((i) => i.etiqueta === "A")).toHaveLength(2);
  });

  it("empty input gives zeros and an all-zero series", () => {
    const d = completo([]);
    expect(d.resumen).toEqual({ total: 0, hoy: 0, ultimos_7: 0, ultimos_30: 0 });
    expect(d.por_funcionario).toEqual([]);
    expect(d.serie_diaria.every((x) => x.n === 0)).toBe(true);
  });
});

describe("role scoping of the output shape", () => {
  const datos = [r(), r({ registrado_por_uid: "u2" }), r({ registrado_por_uid: "u2", fecha_registro_bogota: "2026-03-09" })];

  it("usuario: global totals and their own count only", () => {
    const d = agregar(datos, { alcance: "usuario", uid: "u1", hoy: HOY }) as DashboardUsuario;
    expect(d.resumen.total).toBe(3);
    expect(d.propios).toEqual({ total: 1, hoy: 1, ultimos_7: 1, ultimos_30: 1 });
    expect(Object.keys(d).sort()).toEqual(["alcance", "generado_en", "propios", "resumen"]);
  });

  it("usuario filters are ignored (no breakdowns even if asked)", () => {
    const d = agregar(datos, { alcance: "usuario", uid: "u1", hoy: HOY, desde: "2030-01-01", funcionario: "u2" }) as DashboardUsuario;
    expect(d.resumen.total).toBe(3);
  });

  it("lectura (unapproved): global totals only, no personal data", () => {
    const d = agregar(datos, { alcance: "lectura", uid: "u1", hoy: HOY }) as DashboardLectura;
    expect(Object.keys(d).sort()).toEqual(["alcance", "generado_en", "resumen"]);
    expect(JSON.stringify(d)).not.toMatch(/Ana|cali\.gov\.co|u1|u2/);
  });
});

describe("filtrosSchema", () => {
  it("accepts empty strings, valid dates and the refresh flag", () => {
    expect(filtrosSchema.parse({ desde: "", hasta: "", funcionario: "" })).toEqual({});
    expect(filtrosSchema.parse({ desde: "2026-03-01", refrescar: "1" })).toMatchObject({ desde: "2026-03-01", refrescar: "1" });
  });
  it("rejects impossible dates, inverted ranges and other refresh values", () => {
    expect(filtrosSchema.safeParse({ desde: "2026-02-30" }).success).toBe(false);
    expect(filtrosSchema.safeParse({ desde: "2026-03-05", hasta: "2026-03-01" }).success).toBe(false);
    expect(filtrosSchema.safeParse({ refrescar: "si" }).success).toBe(false);
  });
});
