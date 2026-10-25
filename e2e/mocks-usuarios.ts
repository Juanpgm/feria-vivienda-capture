// API doubles for /admin/usuarios (nothing here touches the real Firestore or Auth). Stateful: approving or
// rejecting moves the user between lists, so the page's reload after each action shows the new state.
import type { Page } from "@playwright/test";

export type UsuarioMock = {
  uid: string;
  nombre: string;
  correo: string;
  rol: "usuario" | "admin" | "superadmin";
  estado: "pendiente" | "aprobado" | "rechazado";
  rechazado_por_correo?: string | null;
  rechazado_en?: string | null;
  motivo?: string | null;
};

export const usuario = (n: number, extra: Partial<UsuarioMock> = {}): UsuarioMock => ({
  uid: `uid-${n}`,
  nombre: `Persona Prueba ${n}`,
  correo: `persona${n}@cali.gov.co`,
  rol: "usuario",
  estado: "pendiente",
  ...extra,
});

export type Llamada = { uid: string; accion: "aprobar" | "rechazar"; body: Record<string, unknown> };

export type Simulador = {
  usuarios: UsuarioMock[];
  llamadas: Llamada[];
  /** Next POST of an action answers with this status/error instead of applying it (one-shot). */
  fallar: { status: number; error: string } | null;
  /** While true, GET list answers 500 (the dev server runs effects twice, so a one-shot would be flaky). */
  fallarLista: boolean;
};

export async function simularUsuarios(page: Page, usuarios: UsuarioMock[]): Promise<Simulador> {
  const sim: Simulador = { usuarios: structuredClone(usuarios), llamadas: [], fallar: null, fallarLista: false };
  await page.route(/\/api\/usuarios(\/.*)?$/, async (route) => {
    const req = route.request();
    const url = new URL(req.url());
    if (req.method() === "GET" && url.pathname === "/api/usuarios") {
      if (sim.fallarLista) {
        return route.fulfill({ status: 500, json: { error: "Error interno" } });
      }
      return route.fulfill({ json: { usuarios: sim.usuarios } });
    }
    const m = url.pathname.match(/^\/api\/usuarios\/([^/]+)\/(aprobar|rechazar)$/);
    if (req.method() !== "POST" || !m) return route.fallback();
    const [, uid, accion] = m as unknown as [string, string, "aprobar" | "rechazar"];
    const body = (req.postDataJSON() ?? {}) as Record<string, unknown>;
    sim.llamadas.push({ uid, accion, body });
    if (sim.fallar) {
      const f = sim.fallar;
      sim.fallar = null;
      return route.fulfill({ status: f.status, json: { error: f.error } });
    }
    const u = sim.usuarios.find((x) => x.uid === uid);
    if (!u) return route.fulfill({ status: 404, json: { error: "Usuario no encontrado" } });
    if (accion === "aprobar") {
      Object.assign(u, { estado: "aprobado", rechazado_por_correo: null, rechazado_en: null, motivo: null });
    } else {
      Object.assign(u, {
        estado: "rechazado",
        rechazado_por_correo: "admin.prueba@cali.gov.co",
        rechazado_en: "2026-03-05T20:42:00.000Z", // 03:42 p. m. in Bogota
        motivo: (body.motivo as string | undefined) ?? null,
      });
    }
    return route.fulfill({ json: { ok: true } });
  });
  return sim;
}
