import { beforeEach, describe, expect, it, vi } from "vitest";

const requireSesion = vi.fn();
vi.mock("next/headers", () => ({ cookies: vi.fn() }));
vi.mock("@/modules/auth/server/sesion", async (orig) => ({
  ...(await orig<object>()),
  requireSesion: (r: string) => requireSesion(r),
}));
const docs = [
  { item: "290304", descripcion: "ESTUCO", und: "M2", costo_unitario: 21000, capitulo: "29", capitulo_nombre: "PINTURA" },
  { item: "010101", descripcion: "REPLANTEO", und: "M2", costo_unitario: 3500, capitulo: "01", capitulo_nombre: "OBRAS" },
];
const get = vi.fn(async () => ({ docs: docs.map((d) => ({ data: () => d })) }));
vi.mock("@/shared/firebase/admin", () => ({ adminDb: () => ({ collection: (c: string) => (c === "APUS" ? { get } : null) }) }));

import { SesionError } from "@/modules/auth/server/sesion";
import { limpiarCacheApus } from "@/modules/mejoramiento/server/apus.repo";
import { GET } from "./route";

describe("GET /api/apus", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    limpiarCacheApus();
  });

  it("returns the catalogue sorted by ITEM to inspectors, read once and cached", async () => {
    requireSesion.mockResolvedValue({ uid: "i", rol: "inspector", aprobado: true });
    const res = await GET();
    expect(res.status).toBe(200);
    expect(requireSesion).toHaveBeenCalledWith("inspector");
    expect((await res.json()).apus.map((a: { item: string }) => a.item)).toEqual(["010101", "290304"]);
    await GET();
    expect(get).toHaveBeenCalledTimes(1);
  });

  it("a plain usuario is refused", async () => {
    requireSesion.mockRejectedValue(new SesionError(403, "No tiene permisos"));
    expect((await GET()).status).toBe(403);
    expect(get).not.toHaveBeenCalled();
  });
});
