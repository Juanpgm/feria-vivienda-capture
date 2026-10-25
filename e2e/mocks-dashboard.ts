// API doubles for the /dashboard e2e specs. Payloads are built with the real reducer from synthetic minimal records,
// so shapes stay in sync with the app. Nothing here touches the real Firestore.
import type { Page } from "@playwright/test";
import { agregar, type Alcance, type OpcionesAgregacion, type RegistroMinimo } from "../src/modules/dashboard/domain/agregacion";

export const HOY = "2026-03-10";
const FUNCIONARIOS = [
  { uid: "f1", nombre: "Ana María Funcionaria", correo: "ana.funcionaria@cali.gov.co" },
  { uid: "f2", nombre: "Luis Fernando Gómez Restrepo", correo: "luis.gomez@cali.gov.co" },
  { uid: "f3", nombre: "Carolina Ramírez", correo: "carolina.ramirez@cali.gov.co" },
];
const BARRIOS = Array.from({ length: 18 }, (_, i) => `Barrio de prueba ${i + 1}`);
const REVISION = ["pendiente_revision", "pendiente_revision", "habilitado", "no_habilitado", "pendiente_subsanacion"];
const INGRESOS = ["0_4", "0_4", "0_4", "4_5_5", "mas_5_5"];
const DICTAMENES = ["colapso_total", "demolido", "orden_demolicion", "demolicion_en_proceso", "arreglos_locativos", "otro"];

/** `n` deterministic registros spread over the last 30 days. */
export function registrosSinteticos(n: number): RegistroMinimo[] {
  const base = Date.parse(`${HOY}T00:00:00Z`);
  return Array.from({ length: n }, (_, i) => {
    const f = FUNCIONARIOS[i % 3 === 2 ? 2 : i % 5 === 0 ? 1 : 0];
    const dia = new Date(base - ((i * 7) % 30) * 86_400_000).toISOString().slice(0, 10);
    const rural = i % 9 === 0;
    return {
      fecha_registro_bogota: dia,
      estado: "registrado",
      estado_revision: REVISION[i % REVISION.length],
      registrado_por_uid: f.uid,
      registrado_por_nombre: f.nombre,
      registrado_por_correo: f.correo,
      comuna: rural ? "Navarro" : `Comuna ${(i % 6) + 1}`,
      barrio: BARRIOS[i % 2 === 0 ? i % 18 : (i * 7) % 18],
      sector: rural ? "rural" : "urbano",
      estrato: (i % 6) + 1,
      rango_ingresos: INGRESOS[i % INGRESOS.length],
      rango_hogar: ["1", "2_3", "4_mas"][i % 3],
      rango_adulto_mayor: ["ninguno", "65_73", "mayor_74"][i % 3 === 0 ? 1 : 0],
      titularidad: i % 4 === 0 ? "poseedor_legitimo" : "propietario_clt",
      dictamen: DICTAMENES[i % DICTAMENES.length],
      en_rud: i % 7 !== 0,
      rud_no_sabe: i % 11 === 0,
      tiene_seguro: i % 5 === 0,
    };
  });
}

export const payload = (alcance: Alcance, registros: RegistroMinimo[], extra: Partial<OpcionesAgregacion> = {}) =>
  JSON.parse(JSON.stringify(agregar(registros, { alcance, uid: "f1", hoy: HOY, generadoEn: "2026-03-10T20:42:00.000Z", ...extra })));

/** Answers GET /api/dashboard with `responder(params)`; returns the query strings received. */
export async function simularDashboard(page: Page, responder: (p: URLSearchParams) => { status?: number; json: unknown }) {
  const recibidas: URLSearchParams[] = [];
  await page.route(
    (u) => u.pathname === "/api/dashboard",
    (route) => {
      const p = new URL(route.request().url()).searchParams;
      recibidas.push(p);
      const { status = 200, json } = responder(p);
      return route.fulfill({ status, json });
    },
  );
  return recibidas;
}
