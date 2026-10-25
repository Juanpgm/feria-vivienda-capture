import { beforeEach, describe, expect, it, vi } from "vitest";

// Mocked Admin SDK: nothing here touches a real project.
const select = vi.fn();
let docs: Record<string, unknown>[] = [];
const get = vi.fn(async () => ({ docs: docs.map((d) => ({ data: () => d })) }));
vi.mock("@/shared/firebase/admin", () => ({
  adminDb: () => ({ collection: () => ({ select: (...c: string[]) => (select(...c), { get }) }) }),
}));

import { INTERVALO_MIN_MS, TTL_CACHE_MS, obtenerDashboard, vaciarCache } from "./dashboard.repo";

const doc = (extra: Record<string, unknown> = {}) => ({
  fecha_registro_bogota: "2026-03-10",
  registrado_en: { toDate: () => new Date("2026-03-10T15:00:00Z") },
  registrado_por_uid: "u1",
  registrado_por_nombre: "Ana",
  inmueble: { nombre_division: "Comuna 1", nombre_barrio_vereda: "Aguacatal", sector: "urbano", estrato: 3 },
  ...extra,
});

describe("dashboard.repo (cache + projection)", () => {
  beforeEach(() => {
    vaciarCache();
    vi.clearAllMocks();
    docs = [doc()];
  });

  it("reads with a field projection that excludes PII fields", async () => {
    await obtenerDashboard({ alcance: "lectura" }, 1_000);
    const campos: string[] = select.mock.calls[0];
    expect(campos).toContain("inmueble.estrato");
    expect(campos.join(",")).not.toMatch(/nombre_completo|numero_documento|telefono|direccion|solicitante/);
  });

  it("serves from cache inside the TTL and re-reads after it", async () => {
    await obtenerDashboard({ alcance: "lectura" }, 1_000);
    await obtenerDashboard({ alcance: "lectura" }, 1_000 + TTL_CACHE_MS - 1);
    expect(get).toHaveBeenCalledTimes(1);
    await obtenerDashboard({ alcance: "lectura" }, 1_000 + TTL_CACHE_MS);
    expect(get).toHaveBeenCalledTimes(2);
  });

  it("'refrescar' bypasses the TTL but is rate-limited to one real read per interval", async () => {
    await obtenerDashboard({ alcance: "lectura" }, 1_000);
    docs = [doc(), doc()];
    const pronto = await obtenerDashboard({ alcance: "lectura", filtros: { refrescar: "1" } }, 1_000 + INTERVALO_MIN_MS - 1);
    expect(get).toHaveBeenCalledTimes(1);
    expect(pronto.resumen.total).toBe(1);
    const ok = await obtenerDashboard({ alcance: "lectura", filtros: { refrescar: "1" } }, 1_000 + INTERVALO_MIN_MS);
    expect(get).toHaveBeenCalledTimes(2);
    expect(ok.resumen.total).toBe(2);
  });

  it("concurrent callers share one read", async () => {
    await Promise.all([obtenerDashboard({ alcance: "lectura" }, 1), obtenerDashboard({ alcance: "lectura" }, 1), obtenerDashboard({ alcance: "usuario", uid: "u1" }, 1)]);
    expect(get).toHaveBeenCalledTimes(1);
  });

  it("flattens the nested projection and scopes by role", async () => {
    const u = await obtenerDashboard({ alcance: "usuario", uid: "u1" }, 1);
    expect(u).toMatchObject({ alcance: "usuario", resumen: { total: 1 }, propios: { total: 1 } });
    const a = await obtenerDashboard({ alcance: "completo", uid: "admin" }, 1);
    expect(a).toMatchObject({ alcance: "completo", por_comuna: [{ etiqueta: "Comuna 1", n: 1 }], por_funcionario: [{ uid: "u1", n: 1 }] });
  });
});
