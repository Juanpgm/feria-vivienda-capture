// Helpers for the consent / signature / submit / confirmation e2e specs (PR 3b). NOTHING here reaches the real
// Firestore: every /api call of the submit is answered by `simularServidor` with an in-memory double.
import { expect, type Page, type Route } from "@playwright/test";
import { registroSchema } from "../src/modules/registro/domain/schema";
import { PASOS } from "../src/modules/registro/ui/pasos";
import { avanzarHasta, llenarFotos, nuevoRegistro, siguiente, tituloPaso } from "./ayudas";
import type { Caso } from "./datos-prueba";

const exacto = { exact: true } as const;
export const N_PASOS = PASOS.length;
/** 1-based number of each step of the 6-step form (derived from PASOS, so a reorder cannot desync the specs). */
export const PASO = Object.fromEntries(PASOS.map((p, i) => [p.id, i + 1])) as { solicitante: 1; hogar: 2; vivienda: 3; financiero: 4; autorizacion: 5; revision: 6 };

export const TEXTO_TRATAMIENTO = "El titular autoriza el tratamiento de sus datos personales";
export const TEXTO_SENSIBLES = "Autoriza el tratamiento de datos sensibles (opcional)";

// ---- server double ----

export type Subida = { id: string; tipo: string; bytes: number; mime: string };
export type OpcionesServidor = {
  /** ms to wait before answering the create (to overlap double clicks). */
  retardoCrear?: number;
  /** Status to answer the create with instead of creating (null: network failure). */
  crearFalla?: { status: number; json?: Record<string, unknown> } | "red" | null;
  /** Attachments (by tipo) answered with a 500. */
  adjuntosFallan?: Set<string>;
  /** Do not register an attachment as received even if answered 200 (makes `completar` report it missing). */
  perderAdjunto?: Set<string>;
};

/** In-memory server: validates the POST with the REAL registroSchema, hands out radicados, tracks uploads. */
export async function simularServidor(page: Page, opciones: OpcionesServidor = {}) {
  const estado = {
    opciones,
    posts: [] as Record<string, unknown>[],
    invalidos: [] as unknown[],
    registros: new Map<string, { radicado: string; cuerpo: Record<string, unknown> }>(),
    subidas: [] as Subida[],
    intentosAdjunto: [] as string[],
    completar: [] as string[],
    siguiente: 0,
  };
  const ahora = () => new Date().toISOString();

  await page.route(
    (u) => u.pathname === "/api/registros",
    async (route) => {
      if (route.request().method() !== "POST") return route.fallback();
      const cuerpo = route.request().postDataJSON() as Record<string, unknown>;
      estado.posts.push(cuerpo);
      if (opciones.retardoCrear) await new Promise((ok) => setTimeout(ok, opciones.retardoCrear));
      const f = opciones.crearFalla;
      if (f === "red") return route.abort("failed");
      if (f) return route.fulfill({ status: f.status, json: f.json ?? { error: "Error" } });
      const analisis = registroSchema.safeParse(cuerpo);
      if (!analisis.success) {
        estado.invalidos.push(analisis.error.issues.map((i) => i.path.join(".")));
        return route.fulfill({ status: 422, json: { error: "Datos inválidos", campos: {} } });
      }
      const id = String(cuerpo.id);
      const previo = estado.registros.get(id);
      if (previo) return route.fulfill({ status: 200, json: { id, radicado: previo.radicado, creado: false, registrado_en: ahora(), advertencias: [] } });
      const radicado = `FV-${String(++estado.siguiente + 122).padStart(6, "0")}`;
      estado.registros.set(id, { radicado, cuerpo });
      return route.fulfill({ status: 201, json: { id, radicado, creado: true, registrado_en: "2026-03-05T20:42:00.000Z", advertencias: [] } });
    },
  );

  await page.route(/\/api\/registros\/[^/]+\/adjuntos$/, async (route: Route) => {
    const id = route.request().url().split("/").at(-2)!;
    const { tipo, imagen } = route.request().postDataJSON() as { tipo: string; imagen: string };
    estado.intentosAdjunto.push(tipo);
    if (opciones.adjuntosFallan?.has(tipo)) return route.fulfill({ status: 500, json: { error: "Error interno" } });
    const bytes = Math.floor((imagen.length * 3) / 4);
    const mime = Buffer.from(imagen.slice(0, 16), "base64")[0] === 0x89 ? "image/png" : "otro";
    if (!opciones.perderAdjunto?.has(tipo)) estado.subidas.push({ id, tipo, bytes, mime });
    return route.fulfill({ json: { tipo, bytes, sin_cambios: false } });
  });

  await page.route(/\/api\/registros\/[^/]+\/completar$/, (route) => {
    const id = route.request().url().split("/").at(-2)!;
    estado.completar.push(id);
    const reg = estado.registros.get(id);
    const manual = (reg?.cuerpo.firma as { metodo_firma?: string } | undefined)?.metodo_firma === "verificacion_manual";
    const requeridos = manual ? ["documento_frente", "documento_reverso"] : ["documento_frente", "documento_reverso", "firma"];
    const presentes = new Set(estado.subidas.filter((s) => s.id === id).map((s) => s.tipo));
    const faltan = requeridos.filter((t) => !presentes.has(t));
    return route.fulfill({ json: { completo: faltan.length === 0, requeridos: requeridos.length, presentes: requeridos.length - faltan.length, faltan } });
  });

  return estado;
}
export type Servidor = Awaited<ReturnType<typeof simularServidor>>;

// ---- steps ----

/** Consent block of the authorization step. Treatment is always ticked unless `tratamiento: false`; sensitive data only on request. */
export async function llenarConsentimiento(page: Page, o: { tratamiento?: boolean; sensibles?: boolean } = {}) {
  await expect(tituloPaso(page, PASO.autorizacion)).toBeVisible();
  if (o.tratamiento !== false) await page.getByRole("checkbox", { name: TEXTO_TRATAMIENTO, ...exacto }).check();
  if (o.sensibles) await page.getByRole("checkbox", { name: TEXTO_SENSIBLES, ...exacto }).check();
}

/** Steps 1-4 with the dataset, then the authorization step (consent + photos) and the review: leaves the review step open. */
export async function llegarAlResumen(page: Page, c: Caso, o: { sensibles?: boolean } = {}) {
  await nuevoRegistro(page);
  await avanzarHasta(page, c, PASO.autorizacion);
  await llenarConsentimiento(page, { sensibles: o.sensibles ?? true });
  await llenarFotos(page);
  await siguiente(page);
  await expect(tituloPaso(page, PASO.revision)).toBeVisible();
}

/** The signature and the send action share the review step with the summary: scrolls to the signature block. */
export async function irAFirma(page: Page) {
  await expect(tituloPaso(page, PASO.revision)).toBeVisible();
  await page.getByRole("heading", { level: 3, name: "Firma del solicitante" }).scrollIntoViewIfNeeded();
}

export const pad = (page: Page) => page.getByTestId("pad-firma");

/** Draws a signature with the mouse: a loop and a flourish. */
export async function dibujarFirma(page: Page, trazos = 2) {
  // Centered: the sticky action bar must not cover the pad while the mouse draws.
  await pad(page).evaluate((el) => el.scrollIntoView({ block: "center" }));
  const caja = (await pad(page).boundingBox())!;
  const p = (fx: number, fy: number) => ({ x: caja.x + caja.width * fx, y: caja.y + caja.height * fy });
  for (let t = 0; t < trazos; t++) {
    const ini = p(0.15 + 0.1 * t, 0.5);
    await page.mouse.move(ini.x, ini.y);
    await page.mouse.down();
    for (let i = 1; i <= 24; i++) {
      const a = (i / 24) * Math.PI * 2;
      await page.mouse.move(ini.x + caja.width * 0.5 * (i / 24) + Math.cos(a) * caja.width * 0.05, ini.y + Math.sin(a * 2) * caja.height * 0.25, { steps: 2 });
    }
    await page.mouse.up();
  }
}

export const botonUsarFirma = (page: Page) => page.getByRole("button", { name: "Usar esta firma", ...exacto });
export const botonEnviar = (page: Page) => page.getByRole("button", { name: /^(Enviar registro|Enviando…|Reintentar)$/ });

export async function firmarEnPantalla(page: Page) {
  await dibujarFirma(page);
  await botonUsarFirma(page).click();
  await expect(page.getByText("Firma registrada.", exacto)).toBeVisible();
}

export async function verificacionManual(page: Page, metodo: "firma_papel" | "huella" | "otro", nota: string) {
  await page.getByRole("radio", { name: "No es posible firmar en pantalla (verificación manual)", ...exacto }).check();
  await page.getByLabel("Método de verificación", exacto).selectOption(metodo);
  await page.getByLabel("Nota de la verificación", exacto).fill(nota);
  await page.getByRole("button", { name: "Registrar verificación manual", ...exacto }).click();
  await expect(page.getByText("Verificación manual registrada.", exacto)).toBeVisible();
}

/** Raw IndexedDB keys of the draft store (drafts `borrador:` and photos `foto:`). */
export async function clavesIdb(page: Page): Promise<string[]> {
  return page.evaluate(
    () =>
      new Promise<string[]>((ok, mal) => {
        const r = indexedDB.open("keyval-store");
        r.onsuccess = () => {
          const db = r.result;
          if (!db.objectStoreNames.contains("keyval")) return ok([]);
          const q = db.transaction("keyval").objectStore("keyval").getAllKeys();
          q.onsuccess = () => (db.close(), ok(q.result.map(String)));
          q.onerror = () => mal(q.error);
        };
        r.onerror = () => mal(r.error);
      }),
  );
}
