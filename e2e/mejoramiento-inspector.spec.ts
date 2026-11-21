// REAL end-to-end of the mejoramiento inspector flow (real Firestore + S3, test inspector only).
// Needs .auth/inspector.json (node context/cuenta-inspector.mjs) and .auth/inspector-state.json (node context/login-inspector.mjs).
// Data created is removed in afterAll by context/limpiar-visitas-mejoramiento.mjs.
import { execFileSync } from "node:child_process";
import { expect, request as pwRequest, test, type Locator, type Page } from "@playwright/test";
import { imagenPequena } from "./imagenes";

const SCRIPT = "context/limpiar-visitas-mejoramiento.mjs";
const ITEM = "200101"; // ALISTADO PISO 4 CM, 37.857 COP/M2 (read from APUS)
const COSTO_UNITARIO = 37857;
const BASE = process.env.E2E_BASE_URL ?? "http://localhost:3000";

const script = (cmd: string, ...args: string[]) => {
  const out = execFileSync("node", ["--env-file=.env", SCRIPT, cmd, ...args], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] });
  return JSON.parse(out.slice(out.indexOf("{")));
};

test.use({
  storageState: ".auth/inspector-state.json",
  permissions: ["geolocation"],
  geolocation: { latitude: 3.45163, longitude: -76.53237 },
});
test.describe.configure({ mode: "serial" });
test.setTimeout(180_000);

async function firmar(page: Page) {
  const lienzo = page.locator("canvas").first();
  await lienzo.scrollIntoViewIfNeeded();
  const caja = (await lienzo.boundingBox())!;
  await page.mouse.move(caja.x + caja.width * 0.2, caja.y + caja.height * 0.5);
  await page.mouse.down();
  for (let i = 1; i <= 20; i++) await page.mouse.move(caja.x + caja.width * (0.2 + i * 0.03), caja.y + caja.height * (0.5 + 0.2 * Math.sin(i / 2)));
  await page.mouse.up();
  await page.getByRole("button", { name: "Usar esta firma" }).click();
}

const vigilar = (page: Page) => {
  page.on("console", (m) => m.type() === "error" && consola.push(`console.error: ${m.text()}`));
  page.on("pageerror", (e) => consola.push(`pageerror: ${e.message}`));
  page.on("requestfailed", (q) => consola.push(`requestfailed: ${q.method()} ${q.url().split("?")[0]} ${q.failure()?.errorText}`));
};

const consola: string[] = [];
let id = "";
let codigo = "";
let cuerpoEnvio = "";

test.beforeAll(() => {
  expect(script("prep").firma_en_s3.existe).toBe(false);
});
test.afterAll(() => {
  // Mandatory cleanup, even when a step failed.
  console.log("CLEANUP", JSON.stringify(script("cleanup")));
  if (consola.length) console.log("CONSOLA DEL NAVEGADOR\n" + consola.join("\n"));
});

test("1. sin firma registrada: puerta de firma, guardar, S3 y Firestore", async ({ page }) => {
  vigilar(page);
  await page.goto("/mejoramiento");
  await expect(page.getByText("Registre su firma de inspector")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Mis levantamientos" })).toHaveCount(0);
  await firmar(page);
  await page.getByRole("button", { name: "Guardar firma" }).click();
  await expect(page.getByRole("heading", { name: "Mis levantamientos" })).toBeVisible();
  const r = script("inspect");
  expect(r.firma_key).toMatch(/^inspectores\/.+\/firma\.png$/);
  expect(r.firma_en_s3).toMatchObject({ existe: true, content_type: "image/png" });
});

test("2. nueva visita: 4 pasos (Anfitrión), 7 fotos opcionales, envío", async ({ page }) => {
  vigilar(page);
  page.on("request", (q) => q.method() === "POST" && new URL(q.url()).pathname === "/api/visitas" && (cuerpoEnvio = q.postData() ?? ""));
  await page.goto("/mejoramiento/nueva");
  const empezar = page.getByRole("button", { name: "Empezar de cero" });
  if (await empezar.isVisible().catch(() => false)) {
    page.once("dialog", (d) => void d.accept());
    await empezar.click();
  }
  const sig = () => page.getByRole("button", { name: "Siguiente" }).click();

  // 1 Anfitrión: who attends + owner in one step; the owner attends, so name/document are typed once
  await page.getByRole("radio", { name: "Propietario" }).check({ force: true });
  await page.getByLabel("Nombre completo").fill("PRUEBA E2E Propietario");
  await page.getByLabel("Número de documento (C.C.)").fill("1234567890");
  await expect(page.getByText("Quien atiende es el propietario: se usan su nombre y documento.")).toBeVisible();
  await expect(page.getByLabel("Nombre del propietario")).toHaveCount(0);
  await page.getByLabel("Teléfono de contacto").fill("3001234567");
  await page.getByLabel("Dirección del predio").fill("Plaza de Caicedo, prueba e2e");
  await page.getByLabel("Número de años habitando el predio").fill("10");
  await page.getByLabel("Personas que habitan el predio").fill("4");
  await sig();
  // 2 Diagnóstico
  await page.getByRole("radio", { name: "Sí" }).first().check({ force: true });
  await page.getByRole("group", { name: "Sí, para" }).getByText("Piso", { exact: true }).click();
  await page.getByRole("radio", { name: "Tipo" }).check({ force: true });
  await sig();
  // 3 Cantidades: one chapter, the same ITEM twice (memoria de cálculo), 4 + 3 photos
  await page.getByRole("button", { name: "Agregar capítulo" }).click();
  await page.getByPlaceholder("Nombre del capítulo").fill("PISOS");
  for (const [k, cantidad] of ["3,5*4", "2"].entries()) {
    await page.getByLabel("Buscar actividad por ITEM o descripción").fill(ITEM);
    await page.getByRole("button", { name: new RegExp(`^Agregar ${ITEM}`) }).click();
    await page.getByPlaceholder("Ej.: (1,87+3,4)*2,7").nth(k).fill(cantidad);
  }
  const entradas = page.locator('input[type="file"][capture]');
  await expect(entradas).toHaveCount(2);
  const fotos = async (campo: Locator, desde: number, n: number) => {
    const archivos = [];
    for (let i = 0; i < n; i++) {
      const f = await imagenPequena(page, `foto-${desde + i}.jpg`, `hsl(${(desde + i) * 37} 60% 50%)`);
      archivos.push({ name: f.name, mimeType: f.mimeType, buffer: f.buffer });
    }
    await campo.setInputFiles(archivos);
  };
  await fotos(entradas.nth(0), 1, 4);
  await expect(page.getByText("4 de 6", { exact: true })).toBeVisible();
  await fotos(entradas.nth(1), 5, 3);
  await expect(page.getByText("Fotos (opcionales): 7 de 30 como máximo")).toBeVisible();
  await expect(page.getByText(/Costo directo total:.*605\.712/)).toBeVisible();
  await sig();
  // 4 Cierre
  await page.getByLabel("Observaciones").fill("Visita de prueba automatizada e2e (se borra).");
  await firmar(page);
  await page.getByRole("button", { name: "Enviar visita" }).click();
  await expect(page.getByTestId("codigo-visita")).toHaveText(/MV-02\d{4}/, { timeout: 90_000 });
  await expect(page.getByText("Sin croquis")).toBeVisible();
  codigo = (await page.getByTestId("codigo-visita").textContent())!;
  id = JSON.parse(cuerpoEnvio).visita.id;

  await page.goto("/mejoramiento");
  await expect(page.getByRole("row").filter({ hasText: codigo }).getByText("Sin croquis")).toBeVisible();
});

test("3. Firestore y S3 verificados por script", () => {
  const r = script("inspect");
  const v = r.visitas.find((x: { id: string }) => x.id === id);
  expect(v.estado).toBe("registrada");
  expect(v.tiene_croquis).toBe(false);
  expect(v.ubicacion.barrio_vereda.id).toBe("0311");
  expect(v.ubicacion.comuna_corregimiento.codigo).toBe("03");
  expect(v.fecha_visita).toMatch(/-05:00$/);
  expect(v.costo_directo_total).toBe(Math.ceil(14 * COSTO_UNITARIO) + 2 * COSTO_UNITARIO);
  const dir = `visitas-profesionales/${codigo}/`;
  const fotos = v.archivos.filter((a: { tipo: string }) => a.tipo === "foto");
  expect(fotos).toHaveLength(7);
  for (const a of fotos) expect(a.key).toMatch(new RegExp(`^${dir}registro-fotografico/${codigo}_${ITEM}_\\d{2}\\.jpg$`));
  const firma = v.archivos.find((a: { tipo: string }) => a.tipo === "firma_ciudadano");
  expect(firma.key).toBe(`${dir}firma-ciudadano/${codigo}_1234567890_01.png`);
  for (const a of v.archivos) {
    expect(v.objetos[a.key]).toMatchObject({ existe: true, bytes: a.bytes, content_type: a.content_type });
    expect(cuerpoEnvio).not.toContain(a.key); // no key came from the client
  }
});

test("4. croquis: cargar, badge verde, S3", async ({ page }) => {
  vigilar(page);
  await page.goto("/mejoramiento");
  const fila = page.getByRole("row").filter({ hasText: codigo });
  await fila.getByRole("button", { name: /Cargar croquis/ }).click();
  const dlg = page.getByRole("dialog");
  const f1 = await imagenPequena(page, "croquis1.jpg", "#808080");
  const f2 = await imagenPequena(page, "croquis2.jpg", "#a0a060");
  await dlg.getByLabel("Elegir archivos de croquis").setInputFiles([f1, f2].map((f) => ({ name: f.name, mimeType: f.mimeType, buffer: f.buffer })));
  await dlg.getByRole("button", { name: "Guardar croquis" }).click();
  await expect(fila.getByText("Croquis cargado")).toBeVisible({ timeout: 60_000 });
  const v = script("inspect").visitas.find((x: { id: string }) => x.id === id);
  expect(v.tiene_croquis).toBe(true);
  expect(v.croquis).toHaveLength(2);
  for (const [i, c] of v.croquis.entries()) {
    expect(c.key).toBe(`visitas-profesionales/${codigo}/croquis-visita/${codigo}_0${i + 1}.jpg`);
    expect(v.objetos[c.key].existe).toBe(true);
  }
});

test("5. detalle: imágenes con URL prefirmada", async ({ page }) => {
  const resp = await page.goto(`/mejoramiento/${id}`);
  expect(resp!.status()).toBe(200);
  await expect(page.getByText(codigo).first()).toBeVisible();
  await page.waitForLoadState("networkidle");
  const urls = await page.evaluate(() => [...document.querySelectorAll("img[src^='http'], a[href^='http']")].map((e) => (e as HTMLImageElement).src || (e as HTMLAnchorElement).href));
  const s3 = urls.filter((u) => /amazonaws\.com/.test(u));
  expect(s3.length).toBeGreaterThanOrEqual(8);
  for (const u of s3) expect(u).toContain("X-Amz-Signature=");
  expect(urls.filter((u) => /amazonaws\.com/.test(u) && !u.includes("X-Amz-Signature="))).toEqual([]);
  expect((await page.request.get(s3[0])).status()).toBe(200);
  const anon = await pwRequest.newContext({ storageState: { cookies: [], origins: [] } });
  expect([403, 404]).toContain((await anon.get(s3[0].split("?")[0])).status());
});

test("6-7. acceso ajeno y reintento idempotente (API)", async ({ page }) => {
  const ajeno = crypto.randomUUID();
  const opts = { headers: { origin: BASE }, data: {}, failOnStatusCode: false };
  expect((await page.request.post(`/api/visitas/${ajeno}/confirmar`, opts)).status()).toBe(404);
  expect((await page.request.post(`/api/visitas/${ajeno}/croquis`, { ...opts, data: { archivos: [{ ref: "x", content_type: "image/jpeg", bytes: 1000 }] } })).status()).toBe(404);
  expect((await page.goto(`/mejoramiento/${ajeno}`))!.status()).toBe(404);
  const anon = await pwRequest.newContext({ baseURL: BASE, storageState: { cookies: [], origins: [] } });
  expect((await anon.post(`/api/visitas/${id}/confirmar`, opts)).status()).toBe(401);
  const sinSesion = await anon.get(`/mejoramiento/${id}`, { maxRedirects: 0, failOnStatusCode: false });
  expect([301, 302, 303, 307, 308, 401]).toContain(sinSesion.status());
  // Retry of the same id answers the same code, already registered.
  const r = await page.request.post("/api/visitas", { headers: { origin: BASE, "content-type": "application/json" }, data: cuerpoEnvio, failOnStatusCode: false });
  const j = await r.json();
  expect({ status: r.status(), codigo: j.codigo, registrada: j.registrada }).toEqual({ status: 200, codigo, registrada: true });
});

test("8. Mi cuenta: Mis visitas y PDF", async ({ page }) => {
  await page.goto("/cuenta");
  await expect(page.getByText("Mis visitas").first()).toBeVisible();
  await expect(page.getByText(codigo).first()).toBeVisible();
  const [descarga] = await Promise.all([page.waitForEvent("download"), page.getByRole("button", { name: "Descargar informe PDF" }).click()]);
  expect(descarga.suggestedFilename()).toMatch(/^informe-visitas-.*\.pdf$/);
});
