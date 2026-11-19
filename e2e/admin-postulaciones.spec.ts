// Staff flow of the postulaciones against the REAL backend (authorized 2026-11-18): create -> missing data -> edit ->
// signed validation -> list, public status and metrics. Test data: documents 99900001xx, names "PRUEBA E2E"; it is
// deleted afterwards with context/limpiar-postulaciones.mjs. Needs .auth/state.json of an approved admin.
import { expect, test, type Page } from "@playwright/test";
import { hayEstadoAuth, MENSAJE_SIN_SESION } from "./auth";
import { entradaFoto } from "./ayudas";
import { dibujarFirma } from "./ayudas-envio";
import { imagenGrande, imagenPequena } from "./imagenes";

const ex = { exact: true } as const;
const DOC = `99900001${String(Date.now() % 100).padStart(2, "0")}`;
let detalle = "";

test.describe.configure({ mode: "serial" });
test.beforeAll(() => {
  if (!hayEstadoAuth()) throw new Error(MENSAJE_SIN_SESION);
});

async function combo(page: Page, nombre: string, texto: string) {
  const c = page.getByRole("combobox", { name: nombre, ...ex });
  await page.mouse.move(0, 0);
  await c.fill(texto);
  await expect(page.getByRole("listbox").getByRole("option").first()).toBeVisible();
  await c.press("Enter");
  await c.press("Tab");
}

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
  await expect(page.getByRole("link", { name: "Imprimir código QR" })).toBeVisible();
});

test("a staff member creates an incomplete postulación: it cannot be validated yet", async ({ page }) => {
  await page.goto("/postulaciones/nueva");
  const modal = page.getByRole("dialog", { name: "Nueva postulación" });
  await modal.getByLabel("Número de documento", ex).fill(DOC);
  await modal.getByRole("button", { name: "Continuar" }).click();
  await page.getByLabel("Nombres", ex).fill("PRUEBA E2E");
  await page.getByLabel("Apellidos", ex).fill("Postulación Uno");
  await page.getByLabel("Fecha de nacimiento", ex).fill("15031985");
  await page.getByLabel("Teléfono o celular", ex).fill("3001234567");
  await entradaFoto(page, "frente").setInputFiles(await imagenPequena(page, "frente.jpg"));
  await expect(page.getByRole("img", { name: /Vista previa: frente/ })).toBeVisible();
  await entradaFoto(page, "reverso").setInputFiles(await imagenGrande(page, "reverso.jpg"));
  await expect(page.getByRole("img", { name: /Vista previa: reverso/ })).toBeVisible();
  await page.getByRole("button", { name: "Siguiente", ...ex }).click();
  await page.getByRole("button", { name: "Siguiente", ...ex }).click();
  await page.getByRole("radio", { name: "Arrendamiento" }).check();
  await page.getByRole("checkbox", { name: "El titular autoriza el tratamiento de sus datos personales", ...ex }).check();
  await page.getByRole("checkbox", { name: "Autoriza el tratamiento de datos sensibles", ...ex }).check();
  await page.getByRole("checkbox", { name: /Declaro bajo la gravedad de juramento/ }).check();
  // Staff can choose how the applicant signs; drawn is the default.
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
  await expect(page.getByRole("dialog", { name: "Ya existe una postulación" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Ver la postulación" })).toHaveAttribute("href", detalle);
});

test("editing fills the missing data and the record becomes complete", async ({ page }) => {
  await page.goto(`${detalle}/editar`);
  await page.waitForLoadState("networkidle"); // typing before hydration would be overwritten
  await combo(page, "Lugar de expedición", "cali");
  await page.getByLabel("Fecha de expedición", ex).fill("01042003");
  await combo(page, "Lugar de nacimiento", "cali");
  await page.getByLabel("Género", ex).selectOption("cis_femenino");
  await page.getByRole("group", { name: /artículo 56 de la Ley 1437/ }).getByText("Sí", ex).click();
  // REAL geocoder of the Alcaldía: comuna, barrio, estrato and coordinates come from the address.
  const dir = page.getByLabel("Dirección de domicilio actual", ex);
  await dir.fill("Calle 5 # 38-20");
  await dir.press("Tab");
  await expect(page.getByText("Ubicamos la dirección en el barrio Santa Isabel (geocodificador de la Alcaldía)", { exact: false })).toBeVisible({ timeout: 15_000 });
  await expect(page.getByTestId("estrato-automatico")).toContainText("Estrato 4");
  await page.getByLabel("Tiempo de residencia en Cali (años)", ex).fill("20");
  await page.getByLabel("Ocupación", ex).selectOption("independiente");
  await page.getByLabel("Ingreso mensual del solicitante", ex).fill("1.000.000");
  await page.getByRole("group", { name: "¿Está afiliado a una caja de compensación?" }).getByText("No", ex).click();
  await page.getByRole("group", { name: "¿Está afiliado al Sisbén?" }).getByText("Sí", ex).click();
  await page.getByLabel("Grupo Sisbén IV", ex).selectOption("A");
  await page.getByLabel("Subgrupo Sisbén IV", ex).selectOption("3");
  await page.getByRole("button", { name: "Siguiente", ...ex }).click();
  await page.getByRole("button", { name: "Siguiente", ...ex }).click();
  await page.getByRole("button", { name: "Guardar cambios" }).click();
  await page.waitForURL((u) => u.pathname === detalle);
  await expect(page.getByText("Todos los datos obligatorios están completos.")).toBeVisible();
  await expect(page.getByText("CL 5 # 38 - 20")).toBeVisible();
  await expect(page.getByText("Santa Isabel", { exact: true })).toBeVisible();
  await expect(page.getByText(/^3\.42\d+, -76\.54\d+$/)).toBeVisible();
  await expect(page.getByText("Santiago de Cali (Valle del Cauca)").first()).toBeVisible();
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
