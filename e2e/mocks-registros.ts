// Shared API doubles for the /registros e2e specs (nothing here touches the real Firestore).
import type { Page } from "@playwright/test";
import { valido } from "../src/modules/registro/domain/fixture";
import { registroSchema } from "../src/modules/registro/domain/schema";

export const uuid = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
export const fila = (n: number, extra: Record<string, unknown> = {}) => ({
  id: uuid(n),
  radicado: `FV-${String(n).padStart(6, "0")}`,
  nombre: `Persona Número${n} Apellido`,
  tipo_documento: "cc",
  numero_documento: `100000${n}`,
  barrio: "Aguacatal",
  comuna: "Comuna 1",
  estrato: 3,
  estado: "registrado",
  estado_revision: "pendiente_revision",
  adjuntos_completos: true,
  registrado_por_nombre: "Ana Funcionaria",
  registrado_en: "2026-03-05T20:42:00.000Z", // 15:42 in Bogota
  ...extra,
});

export const detalle = (n: number) => {
  const r = registroSchema.parse(valido());
  return {
    id: uuid(n),
    radicado: `FV-${String(n).padStart(6, "0")}`,
    estado: "registrado",
    estado_revision: "pendiente_revision",
    estado_revision_en: "2026-03-05T20:42:00.000Z",
    registrado_por_nombre: "Ana Funcionaria",
    registrado_por_correo: "ana.funcionaria@cali.gov.co",
    registrado_en: "2026-03-05T20:42:00.000Z",
    fecha_registro_bogota: "2026-03-05",
    version_esquema: 2,
    adjuntos_completos: true,
    adjuntos_requeridos: 3,
    adjuntos_presentes: 3,
    consentimiento: { version: "2026-10-v1", acepta_tratamiento: true, acepta_datos_sensibles: false, aceptado_en: "2026-03-05T20:42:00.000Z" },
    firma: { metodo_firma: "dibujada", firmado_en: "2026-03-05T20:42:00.000Z", metodo_verificacion: null, nota_verificacion: null, verificado_por_nombre: null },
    datos: {
      solicitante: { ...r.solicitante, edad: 36 },
      composicion: r.composicion,
      inmueble: r.inmueble,
      riesgo: r.riesgo,
      titularidad: r.titularidad,
      cierre_financiero: { ...r.cierre_financiero, observaciones: "Llegó con la hermana." },
    },
    historial: [
      { tipo: "creacion", estado_revision: "pendiente_revision", por_nombre: "Ana Funcionaria", por_correo: "ana.funcionaria@cali.gov.co", en: "2026-03-05T20:42:00.000Z" },
    ],
  };
};

/** Answers GET /api/registros with `responder(params)`; returns the list of query strings received. */
export async function simularLista(page: Page, responder: (p: URLSearchParams) => { status?: number; json: unknown }) {
  const recibidas: URLSearchParams[] = [];
  await page.route(
    (u) => u.pathname === "/api/registros",
    (route) => {
      const p = new URL(route.request().url()).searchParams;
      recibidas.push(p);
      const { status = 200, json } = responder(p);
      return route.fulfill({ status, json });
    },
  );
  return recibidas;
}

