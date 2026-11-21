import { beforeEach, describe, expect, it, vi } from "vitest";

const requireSesion = vi.fn();
vi.mock("next/headers", () => ({ cookies: vi.fn() }));
vi.mock("@/modules/auth/server/sesion", async (orig) => ({ ...(await orig<object>()), requireSesion: (r: string) => requireSesion(r) }));
const actualizarFirma = vi.fn();
vi.mock("@/modules/auth/server/usuarios.repo", () => ({ actualizarFirma: (...a: unknown[]) => actualizarFirma(...a) }));
const guardarObjeto = vi.fn();
vi.mock("@/shared/s3", () => ({ guardarObjeto: (...a: unknown[]) => guardarObjeto(...a) }));
vi.mock("@/shared/firebase/admin", () => ({ adminDb: vi.fn() }));

import { POST } from "./firma/route";

const png = `data:image/png;base64,${Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2]).toString("base64")}`;
const llamar = (firma: unknown) => POST(new Request("http://x", { method: "POST", body: JSON.stringify({ firma }) }));

describe("POST /api/cuenta/firma", () => {
  beforeEach(() => vi.clearAllMocks());

  it("stores the inspector's PNG under inspectores/{uid}/firma.png and records the key", async () => {
    requireSesion.mockResolvedValue({ uid: "ins1", rol: "inspector", correo: "i@x", aprobado: true });
    expect((await llamar(png)).status).toBe(200);
    expect(guardarObjeto).toHaveBeenCalledWith("inspectores/ins1/firma.png", expect.any(Uint8Array), "image/png");
    expect(actualizarFirma).toHaveBeenCalledWith("ins1", "inspectores/ins1/firma.png");
  });

  it("only inspectors; non-PNG content is refused before touching S3", async () => {
    requireSesion.mockResolvedValue({ uid: "a", rol: "admin", correo: "a@x", aprobado: true });
    expect((await llamar(png)).status).toBe(403);
    requireSesion.mockResolvedValue({ uid: "ins1", rol: "inspector", correo: "i@x", aprobado: true });
    expect((await llamar("data:image/svg+xml;base64,PHN2Zz4=")).status).toBe(422);
    expect(guardarObjeto).not.toHaveBeenCalled();
  });
});
