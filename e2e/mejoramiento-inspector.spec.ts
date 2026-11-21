// REAL end-to-end of the mejoramiento inspector flow (real Firestore + S3, test inspector only).
// Needs .auth/inspector.json (node context/cuenta-inspector.mjs) and .auth/inspector-state.json (node context/login-inspector.mjs).
// Data created is removed in afterAll by context/limpiar-visitas-mejoramiento.mjs.
import { execFileSync } from "node:child_process";
import { expect, request as pwRequest, test, type Page } from "@playwright/test";
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
  // Wait for the save itself (the signature route compiles on first use on a cold dev server).
  const guardado = page.waitForResponse((r) => r.url().endsWith("/api/cuenta/firma") && r.request().method() === "POST", { timeout: 60_000 });
  await page.getByRole("button", { name: "Guardar firma" }).click();
  expect((await guardado).status()).toBe(200);
  await expect(page.getByRole("heading", { name: "Mis levantamientos" })).toBeVisible({ timeout: 30_000 });
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
  await page.getByLabel("Número de documento", { exact: true }).fill("1234567890");
  await expect(page.getByText("Quien atiende es el propietario: se usan su nombre y su documento.")).toBeVisible();
  await expect(page.getByLabel("Nombre del propietario")).toHaveCount(0);
  await expect(page.getByLabel("Tipo de documento del propietario")).toHaveCount(0); // read-only: taken from who attends
  await page.getByLabel("Teléfono de contacto").fill("3001234567");
  await page.getByLabel("Dirección del predio").fill("Plaza de Caicedo, prueba e2e");
  await page.getByLabel("Número de años habitando el predio").fill("10");
  await page.getByLabel("Personas que habitan el predio").fill("4");
  await sig();
  // 2 Diagnóstico
  await page.getByRole("radio", { name: "Sí" }).first().check({ force: true });
  await page.getByRole("group", { name: "Sí, para" }).getByText("Piso", { exact: true }).click();
  await page.getByRole("radio", { name: "Tipo" }).check({ force: true });
  await page.getByRole("radiogroup", { name: "Piso", exact: true }).getByText("Malo").click();
  await expect(page.getByText("1 de 15 elementos con estado.", { exact: false })).toBeVisible();
  await sig();
  // 3 Cantidades: one chapter, the same ITEM twice (memoria de cálculo), 4 + 3 photos
  await page.getByRole("button", { name: "Agregar capítulo" }).click();
  await page.getByPlaceholder("Nombre del capítulo").fill("PISOS");
  // The whole price list (~3.8k APUs) loads once; on a cold dev server the route compiles first.
  await expect(page.getByText("Cargando listado de precios…")).toHaveCount(0, { timeout: 45_000 });
  // The picker modal: its root starts with the chapter's frequent activities; first by search from the root,
  // then it reopens in the last subchapter (20 › 2001).
  const selector = page.getByRole("dialog", { name: "Elegir actividad" });
  await page.getByRole("button", { name: "Agregar actividad" }).click();
  await expect(selector.getByRole("heading", { name: "Frecuentes para PISOS" })).toBeVisible();
  await selector.getByRole("searchbox").fill(ITEM);
  await selector.getByRole("button", { name: new RegExp(`^${ITEM}`) }).click();
  await expect(selector).toBeHidden();
  await page.getByRole("button", { name: "Agregar actividad" }).click();
  await expect(selector.getByRole("navigation").getByText(/^2001 /)).toBeVisible();
  await selector.getByRole("button", { name: new RegExp(`^${ITEM}`) }).click();
  // The budget table: row 2 typed inline; row 1 through the row editor and its calculator (M2: Largo × Ancho).
  const cantidades = page.getByRole("table").getByLabel(`Cantidad de ${ITEM}`);
  await expect(cantidades).toHaveCount(2);
  await cantidades.nth(1).fill("2");
  const editores = page.getByRole("button", { name: new RegExp(`^Editar ${ITEM}`) });
  const editor = page.getByRole("dialog", { name: `Editar actividad ${ITEM}` });
  const fotos = async (n: number, desde: number) => {
    const archivos = [];
    for (let i = 0; i < n; i++) {
      const f = await imagenPequena(page, `foto-${desde + i}.jpg`, `hsl(${(desde + i) * 37} 60% 50%)`);
      archivos.push({ name: f.name, mimeType: f.mimeType, buffer: f.buffer });
    }
    await editor.locator('input[type="file"][capture]').setInputFiles(archivos);
  };
  await editores.nth(0).click();
  await editor.getByLabel("Largo, medida 1").fill("3,5");
  await editor.getByLabel("Ancho, medida 1").fill("4");
  await expect(editor.getByLabel(`Cantidad de ${ITEM}`)).toHaveValue("(3,5*4)");
  await fotos(4, 1);
  await expect(editor.getByText("4 de 6", { exact: true })).toBeVisible();
  await editor.getByRole("button", { name: "Listo" }).click();
  await expect(editor).toBeHidden();
  await expect(editores.nth(0)).toBeFocused(); // focus returns to the row
  await expect(cantidades.nth(0)).toHaveValue("(3,5*4)");
  await editores.nth(1).click();
  await fotos(3, 5);
  await expect(editor.getByText("3 de 6", { exact: true })).toBeVisible();
  await editor.getByRole("button", { name: "Listo" }).click();
  await expect(page.getByText("Fotos (opcionales): 7 de 30 como máximo")).toBeVisible();
  await expect(page.getByRole("table").getByText(/Costo directo del mejoramiento de vivienda/i).locator("..")).toContainText(/605\.712/);
  await sig();
  // 4 Cierre: review before signing
  await page.getByLabel("Observaciones").fill("Visita de prueba automatizada e2e (se borra).");
  const revision = page.getByRole("region", { name: "Revise antes de firmar" });
  await expect(revision.getByText("PISOS")).toBeVisible();
  await expect(revision.getByText(/^2 actividades · .*605\.712$/)).toBeVisible();
  await firmar(page);
  await page.getByRole("button", { name: "Enviar levantamiento" }).click();
  await expect(page.getByTestId("codigo-visita")).toHaveText(/MV-02\d{4}/, { timeout: 90_000 });
  await expect(page.getByText("Sin croquis.")).toBeVisible();
  codigo = (await page.getByTestId("codigo-visita").textContent())!;
  id = JSON.parse(cuerpoEnvio).visita.id;
  expect(JSON.parse(cuerpoEnvio).visita.diagnostico.estados).toEqual({ piso: "m" });

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

test("8. Mi cuenta: resumen de levantamientos, enlace al listado y PDF (sin repetir la lista)", async ({ page }) => {
  await page.goto("/cuenta");
  await expect(page.getByRole("heading", { name: "Mis levantamientos" })).toBeVisible();
  await expect(page.getByText(/1 levantamiento ·/)).toBeVisible();
  await expect(page.getByText(codigo)).toHaveCount(0); // the list lives in /mejoramiento only
  await expect(page.getByRole("link", { name: "Ver mis levantamientos" })).toHaveAttribute("href", "/mejoramiento");
  const [descarga] = await Promise.all([page.waitForEvent("download"), page.getByRole("button", { name: "Descargar informe PDF" }).click()]);
  expect(descarga.suggestedFilename()).toMatch(/^informe-visitas-.*\.pdf$/);
});
