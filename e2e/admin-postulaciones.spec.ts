// Staff flow of the postulaciones against the REAL backend (authorized 2026-11-18): create -> missing data -> edit ->
// signed validation -> list, public status and metrics. Test data: documents 99900001xx, names "PRUEBA E2E"; it is
// deleted afterwards with context/limpiar-postulaciones.mjs. Needs .auth/state.json of an approved admin.
import { expect, test, type Page } from "@playwright/test";
import { hayEstadoAuth, MENSAJE_SIN_SESION } from "./auth";
import { dibujarFirma } from "./ayudas-envio";
import { autorizar, fotos, llenarIntegrante, llenarTitular } from "./ayudas-postulacion";

const ex = { exact: true } as const;
const DOC = `99900001${String(Date.now() % 100).padStart(2, "0")}`;
const MIEMBRO = `11000001${String(Date.now() % 100).padStart(2, "0")}`;
let detalle = "";

test.describe.configure({ mode: "serial" });
test.beforeAll(() => {
  if (!hayEstadoAuth()) throw new Error(MENSAJE_SIN_SESION);
});

async function firmar(page: Page) {
  await dibujarFirma(page);
  await page.getByRole("button", { name: "Usar esta firma", ...ex }).click();
}

test("the form switch turns the public form on and off (left off)", async ({ page }) => {
  await page.goto("/admin/postulaciones");
  const boton = page.getByRole("button", { name: /^(Habilitar|Deshabilitar) formulario$/ });
  if ((await boton.textContent()) === "Habilitar formulario") await boton.click();
  await expect(page.getByText("Habilitado", ex)).toBeVisible();
  await page.getByRole("button", { name: "Deshabilitar formulario" }).click();
  await expect(page.getByText("Deshabilitado", ex)).toBeVisible();
  await expect(page.getByRole("link", { name: "Descargar QR en PDF" })).toBeVisible();
});

test("a staff member creates an incomplete postulación: it cannot be validated yet", async ({ page }) => {
  await page.goto("/postulaciones/nueva");
  const modal = page.getByRole("dialog", { name: "Nueva postulación" });
  await modal.getByLabel("Número de documento", ex).fill(DOC);
  await modal.getByRole("button", { name: "Continuar" }).click();
  await autorizar(page);
  // All titular data is required; the REAL geocoder of the Alcaldía locates the address (barrio, estrato, coordinates).
  await llenarTitular(page, { nombres: "PRUEBA E2E", apellidos: "Postulación Uno" });
  await expect(page.getByText("Ubicamos la dirección en el barrio Santa Isabel (geocodificador de la Alcaldía)", { exact: false })).toBeVisible();
  await fotos(page);
  await page.getByRole("button", { name: "Siguiente", ...ex }).click();
  // One member: every field is required (no phone or email).
  await page.getByRole("button", { name: "+ Agregar integrante" }).click();
  await llenarIntegrante(page, 0, { documento: MIEMBRO });
  await page.getByRole("button", { name: "Siguiente", ...ex }).click();
  // Modality 1 without its project and resources: the record is created but cannot be validated yet.
  await page.getByRole("radio", { name: "Adquisición de vivienda nueva" }).check();
  await page.getByRole("checkbox", { name: /Declaro bajo la gravedad de juramento/ }).check();
  // Signed on screen (the other way is uploading an image of a valid signature; no manual verification).
  await expect(page.getByRole("radio", { name: "Subir imagen de la firma" })).toBeVisible();
  await expect(page.getByText("verificación manual", { exact: false })).toHaveCount(0);
  await firmar(page);
  await page.getByRole("button", { name: "Enviar postulación" }).click();
  await expect(page.getByTestId("radicado")).toHaveText(/^PSE-\d{6}$/);

  await page.getByRole("link", { name: "Ver la postulación" }).click();
  await page.waitForURL(/\/postulaciones\/[0-9a-f-]{36}$/);
  detalle = new URL(page.url()).pathname;
  await expect(page.getByText("Sin validar", ex)).toBeVisible();
  await expect(page.getByRole("heading", { name: /Faltan \d+ dato\(s\) obligatorios para validar/ })).toBeVisible();
  await expect(page.getByRole("button", { name: "Validar registro" })).toBeDisabled();
  // Both photos are served to the official.
  for (const alt of ["Frente del documento de identidad", "Reverso del documento de identidad"])
    await expect.poll(() => page.getByRole("img", { name: alt }).evaluate((i: HTMLImageElement) => i.naturalWidth), { timeout: 30_000 }).toBeGreaterThan(0);
});

test("the same document cannot start a second postulación", async ({ page }) => {
  await page.goto("/postulaciones/nueva");
  const modal = page.getByRole("dialog", { name: "Nueva postulación" });
  await modal.getByLabel("Número de documento", ex).fill(DOC);
  await modal.getByRole("button", { name: "Continuar" }).click();
  await expect(page.getByRole("dialog", { name: "Ya existe una postulación" })).toBeVisible({ timeout: 20_000 });
  await expect(page.getByRole("link", { name: "Ver la postulación" })).toHaveAttribute("href", detalle);
});

test("a member of this household cannot start a postulación of their own", async ({ page }) => {
  await page.goto("/postulaciones/nueva");
  const modal = page.getByRole("dialog", { name: "Nueva postulación" });
  await modal.getByLabel("Número de documento", ex).fill(MIEMBRO);
  await modal.getByRole("button", { name: "Continuar" }).click();
  const aviso = page.getByRole("dialog", { name: "Ya hace parte de otra postulación" });
  await expect(aviso).toBeVisible({ timeout: 20_000 });
  await expect(aviso.getByRole("link", { name: /^Ver la postulación PSE-/ })).toHaveAttribute("href", detalle);
});

test("Completar opens the edit on the missing field; the panel jumps between fields", async ({ page }) => {
  await page.goto(detalle);
  await page.getByRole("link", { name: "Completar: Nombre del proyecto de vivienda" }).click();
  await page.waitForURL((u) => u.pathname.endsWith("/editar") && u.searchParams.get("campo") === "postulacion.proyecto_nombre");
  await expect(page.getByLabel("Nombre del proyecto habitacional", ex)).toBeFocused({ timeout: 10_000 });
  const panel = page.getByRole("region", { name: /Por completar/ });
  await expect(panel).toBeVisible();
  // From another step, the panel opens the step of the field and focuses it.
  await page.getByRole("button", { name: "Atrás", ...ex }).click();
  await panel.getByRole("button", { name: "Nombre de la constructora" }).click();
  await expect(page.getByLabel("Nombre de la constructora", ex)).toBeFocused({ timeout: 10_000 });
});

test("Subsanar fills the missing data; saving updates the same record (no duplicate)", async ({ page }) => {
  await page.goto(detalle);
  await page.getByRole("link", { name: "Subsanar datos faltantes" }).click();
  await page.waitForURL((u) => u.pathname.endsWith("/editar"));
  await page.waitForLoadState("networkidle"); // typing before hydration would be overwritten
  await page.getByLabel("Nombre del proyecto habitacional", ex).fill("Altos de Prueba");
  await page.getByLabel("Nombre de la constructora", ex).fill("Constructora E2E");
  await page.getByText("VIS (vivienda de interés social)", ex).click();
  await page.getByLabel("Valor de la solución de vivienda VIS", ex).fill("150000000");
  await page.getByRole("checkbox", { name: "Ahorro programado" }).check();
  await page.getByLabel("Valor de ahorro programado", ex).fill("5000000");
  await expect(page.getByText("Ya no falta ningún dato obligatorio. Guarde los cambios para poder validar la postulación.")).toBeVisible();
  await page.getByRole("button", { name: "Guardar cambios" }).click();
  await page.waitForURL((u) => u.pathname === detalle);
  await expect(page.getByText("Todos los datos obligatorios están completos.")).toBeVisible();
  await expect(page.getByText("CL 5 # 38 - 20")).toBeVisible();
  await expect(page.getByText("Santa Isabel", { exact: true })).toBeVisible();
  await expect(page.getByText(/^3\.42\d+, -76\.54\d+$/)).toBeVisible();
  await expect(page.getByText("Santiago de Cali (Valle del Cauca)").first()).toBeVisible();
  await expect(page.getByText("Datos editados")).toBeVisible(); // history timeline
});

test("an official validates it with signature and confirmation of the document package", async ({ page }) => {
  await page.goto(detalle);
  await page.getByRole("button", { name: "Validar registro" }).click();
  const d = page.getByRole("dialog", { name: /Validar la postulación PSE-/ });
  await expect(d.getByText(/se hace responsable de la información validada/)).toBeVisible();
  const confirmar = d.getByRole("button", { name: "Confirmar validación" });
  await expect(confirmar).toBeDisabled();
  await d.getByRole("checkbox", { name: "Confirmo la recepción del paquete de documentación completo del postulante" }).check();
  await d.getByRole("checkbox", { name: "Me hago responsable de la información validada" }).check();
  await d.getByLabel("No. de folios anexos (opcional)").fill("3");
  await firmar(page);
  await confirmar.click();
  await expect(page.getByText("Válido", ex)).toBeVisible();
  await expect(page.getByTestId("codigo-validacion")).toHaveText(/^VAL-\d{6}-[A-Z0-9]{6}$/);
  await expect(page.getByText(/^PRUEBA E2E Funcionario \(prueba\.e2e/)).toBeVisible();
  await expect(page.getByText(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}-05:00$/)).toBeVisible();
  await expect(page.getByRole("link", { name: "Editar datos" })).toHaveCount(0);
  await expect.poll(() => page.getByRole("img", { name: "Firma del funcionario que validó" }).evaluate((i: HTMLImageElement) => i.naturalWidth), { timeout: 30_000 }).toBeGreaterThan(0);
});

test("list, public status and metrics reflect the validated postulación", async ({ page }) => {
  await page.goto(`/postulaciones?q=${DOC}`);
  await expect(page.getByRole("row", { name: /PRUEBA E2E/i }).getByText("Válido", ex)).toBeVisible();
  // Editing updated the same record: still one postulación for the document (no duplicate).
  await expect(page.getByText("1 postulación(es)")).toBeVisible();
  await page.goto("/dashboard/postulaciones");
  await expect(page.getByRole("heading", { name: "Validaciones por funcionario" })).toBeVisible();
  await expect(page.getByText("PRUEBA E2E Funcionario")).toBeVisible();
  // The public lookup (dev server with E2E_POSTULACION_ABIERTA=1) only tells the status.
  await page.context().clearCookies();
  await page.goto("/postulacion");
  const modal = page.getByRole("dialog", { name: "Nueva postulación" });
  await modal.getByLabel("Número de documento", ex).fill(DOC);
  await modal.getByRole("button", { name: "Continuar" }).click();
  const existente = page.getByRole("dialog", { name: "Ya existe una postulación" });
  await expect(existente.getByText("Válido", ex)).toBeVisible();
  await expect(existente.getByRole("link")).toHaveCount(0);
});

test("the QR of the postulación opens the record for staff and only its status for the public", async ({ page, browser }) => {
  test.setTimeout(150_000); // two browser contexts on the dev server
  const id = detalle.split("/").pop();
  await page.goto(detalle);
  await expect(page.getByTestId("qr-postulacion")).toBeVisible();
  await page.goto(`/postulacion/estado/${id}`);
  await page.waitForURL((u) => u.pathname === detalle); // logged-in official: straight to the record
  // An explicit empty state: the project would otherwise hand the official session to this context too.
  const anonimo = await browser.newContext({ storageState: { cookies: [], origins: [] } });
  const p2 = await anonimo.newPage();
  await p2.goto(new URL(`/postulacion/estado/${id}`, page.url()).href, { waitUntil: "domcontentloaded" });
  await expect(p2.getByTestId("estado")).toHaveText("Válido");
  await expect(p2.getByTestId("radicado")).toHaveText(/^PSE-\d{6}$/);
  await expect(p2.getByText(/Prueba E2e/i)).toHaveCount(0); // no personal data
  await anonimo.close();
});

test("the QR poster downloads as a PDF and does not show the link", async ({ page, browser }) => {
  await page.goto("/postulaciones/qr");
  await expect(page.getByTestId("qr-formulario")).toBeVisible();
  await expect(page.getByTestId("vigencia-qr")).toHaveText(/^Vigente hasta el /);
  // The code in the QR opens the form for anyone, without leaving the code in the address bar; a tampered one is refused.
  const { token } = await (await page.request.post("/api/postulaciones/qr", { data: { dias: 1 } })).json();
  const anonimo = await browser.newContext({ storageState: { cookies: [], origins: [] } });
  const p2 = await anonimo.newPage();
  await p2.goto(new URL(`/postulacion/ingreso?t=${token}`, page.url()).href, { waitUntil: "domcontentloaded" });
  await p2.waitForURL((u) => u.pathname === "/postulacion" && !u.search);
  expect((await anonimo.cookies()).some((c) => c.name === "acceso_postulacion" && c.httpOnly)).toBe(true);
  await p2.goto(new URL(`/postulacion/ingreso?t=${token.slice(0, -2)}xx`, page.url()).href, { waitUntil: "domcontentloaded" });
  await p2.waitForURL((u) => u.searchParams.get("acceso") === "invalido");
  await anonimo.close();
  await expect(page.getByText(/https?:\/\//)).toHaveCount(0);
  const [descarga] = await Promise.all([page.waitForEvent("download"), page.getByRole("button", { name: "Descargar PDF para imprimir" }).click()]);
  expect(descarga.suggestedFilename()).toBe("postulacion-subsidio-qr.pdf");
  const ruta = await descarga.path();
  const { readFileSync } = await import("node:fs");
  const pdf = readFileSync(ruta!);
  expect(pdf.subarray(0, 5).toString()).toBe("%PDF-");
  expect(pdf.toString("latin1")).not.toContain("/postulacion");
});

test("an admin deletes the postulación with a reason; it is gone and the document is free again", async ({ page }) => {
  await page.goto(`/postulaciones?q=${DOC}`);
  await page.getByRole("button", { name: /^Borrar la postulación PSE-/ }).click();
  const d = page.getByRole("dialog", { name: /^Borrar la postulación PSE-/ });
  const confirmar = d.getByRole("button", { name: "Borrar definitivamente" });
  await expect(confirmar).toBeDisabled();
  await d.getByLabel("Motivo del borrado").fill("Registro de prueba e2e");
  await expect(confirmar).toBeDisabled();
  await d.getByRole("checkbox", { name: "Entiendo que el borrado es definitivo" }).check();
  await confirmar.click();
  await expect(page.getByText("0 postulación(es)")).toBeVisible({ timeout: 30_000 }); // recursive delete of the record and its files
  await page.goto("/postulaciones/nueva");
  const modal = page.getByRole("dialog", { name: "Nueva postulación" });
  await modal.getByLabel("Número de documento", ex).fill(DOC);
  await modal.getByRole("button", { name: "Continuar" }).click();
  await expect(page.getByRole("heading", { level: 2, name: "Datos del solicitante" })).toBeVisible();
});
