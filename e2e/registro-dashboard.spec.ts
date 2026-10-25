// /dashboard against the running dev server with the saved superadmin session. The API is mocked: no Firestore access.
import { expect, test, type Page } from "@playwright/test";
import { hayEstadoAuth, MENSAJE_SIN_SESION } from "./auth";
import { payload, registrosSinteticos, simularDashboard } from "./mocks-dashboard";

test.beforeAll(() => {
  if (!hayEstadoAuth()) throw new Error(MENSAJE_SIN_SESION);
});

const sinHorizontal = (page: Page) => page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1);
const REGISTROS = registrosSinteticos(120);

test("sin registros: ceros y mensaje con indicaciones, sin gráficos", async ({ page }) => {
  await simularDashboard(page, () => ({ json: payload("completo", []) }));
  await page.goto("/dashboard");
  await expect(page.getByRole("heading", { level: 1, name: "Resumen de registros" })).toBeVisible();
  await expect(page.getByText("Aún no hay registros.")).toBeVisible();
  await expect(page.getByText("Cuando los funcionarios envíen registros")).toBeVisible();
  const cifras = page.getByRole("region", { name: "Cifras principales" });
  await expect(cifras.getByText("Registros en total")).toBeVisible();
  await expect(page.getByRole("heading", { level: 2, name: "Estrato" })).toHaveCount(0);
});

test("con datos: cifras, todas las secciones, números visibles y tabla alternativa", async ({ page }) => {
  const datos = payload("completo", REGISTROS);
  await simularDashboard(page, () => ({ json: datos }));
  await page.goto("/dashboard");

  const cifras = page.getByRole("region", { name: "Cifras principales" });
  await expect(cifras.getByText("120", { exact: true }).first()).toBeVisible();
  for (const [etiqueta, n] of [
    ["Hoy", datos.resumen.hoy],
    ["Últimos 7 días", datos.resumen.ultimos_7],
    ["Últimos 30 días", datos.resumen.ultimos_30],
  ] as const)
    await expect(cifras.locator("div", { has: page.getByText(etiqueta, { exact: true }) }).last().getByText(String(n), { exact: true })).toBeVisible();

  for (const h of [
    "Registros por día",
    "Registros por funcionario",
    "Estado de revisión",
    "Sector",
    "Comuna o corregimiento",
    "Barrio o vereda",
    "Estrato",
    "Ingresos del hogar",
    "Tamaño del hogar",
    "Adultos mayores en el hogar",
    "Titularidad del inmueble",
    "Dictamen técnico",
    "Registro Único de Damnificados (RUD)",
    "Seguro del inmueble",
  ])
    await expect(page.getByRole("heading", { level: 2, name: h })).toBeVisible();

  // Numbers are printed next to each bar (no hover needed).
  const estrato = page.locator("section", { has: page.getByRole("heading", { level: 2, name: "Estrato" }) });
  await expect(estrato.getByText("Estrato 1")).toBeVisible();
  await expect(estrato.locator("li").first()).toContainText("20");
  // Top 15 barrios plus "Otros".
  const barrios = page.locator("section", { has: page.getByRole("heading", { level: 2, name: "Barrio o vereda" }) });
  await expect(barrios.locator("li")).toHaveCount(16);
  await expect(barrios.locator("li").last()).toContainText("Otros, 3 más");
  // Funcionario table with name, email, count.
  const funcionarios = page.locator("section", { has: page.getByRole("heading", { level: 2, name: "Registros por funcionario" }) });
  await expect(funcionarios.getByRole("rowheader", { name: /Ana María Funcionaria/ })).toBeVisible();
  await expect(funcionarios.getByText("luis.gomez@cali.gov.co").locator("visible=true")).toBeVisible();

  // Table fallback replaces the bars.
  await expect(estrato.getByRole("table")).toHaveCount(0);
  await page.getByRole("button", { name: "Ver como tablas" }).click();
  await expect(page.getByRole("button", { name: "Ver gráficos" })).toHaveAttribute("aria-pressed", "true");
  const tabla = estrato.getByRole("table", { name: "Estrato" });
  await expect(tabla).toBeVisible();
  await expect(tabla.getByRole("columnheader")).toHaveText(["Categoría", "Registros", "Porcentaje"]);
  await expect(tabla.getByRole("row")).toHaveCount(7);
  await expect(page.getByRole("table", { name: "Registros por día" })).toBeVisible();
});

test("filtros: Aplicar y Actualizar viajan al servidor; Limpiar los quita", async ({ page }) => {
  const datos = payload("completo", REGISTROS);
  const recibidas = await simularDashboard(page, () => ({ json: datos }));
  await page.goto("/dashboard");
  await expect(page.getByRole("heading", { level: 2, name: "Estrato" })).toBeVisible();
  expect(recibidas.at(-1)!.toString()).toBe("");

  await page.getByLabel("Desde", { exact: true }).fill("2026-03-01");
  await page.getByLabel("Hasta", { exact: true }).fill("2026-03-09");
  await page.getByLabel("Funcionario", { exact: true }).selectOption({ label: "Luis Fernando Gómez Restrepo" });
  await page.getByRole("button", { name: "Aplicar" }).click();
  await expect.poll(() => recibidas.at(-1)!.get("funcionario")).toBe("f2");
  expect(recibidas.at(-1)!.get("desde")).toBe("2026-03-01");
  expect(recibidas.at(-1)!.get("hasta")).toBe("2026-03-09");
  expect(recibidas.at(-1)!.has("refrescar")).toBe(false);
  await expect(page.getByText("Registros en el filtro")).toBeVisible();

  await page.getByRole("button", { name: "Actualizar" }).click();
  await expect.poll(() => recibidas.at(-1)!.get("refrescar")).toBe("1");

  await page.getByRole("button", { name: "Limpiar" }).click();
  await expect.poll(() => recibidas.at(-1)!.toString()).toBe("");
  await expect(page.getByLabel("Desde", { exact: true })).toHaveValue("");
});

test("filtro sin resultados ofrece quitar los filtros", async ({ page }) => {
  await simularDashboard(page, (p) => ({ json: p.get("desde") ? payload("completo", [], { desde: "2027-01-01" }) : payload("completo", REGISTROS) }));
  await page.goto("/dashboard");
  await expect(page.getByRole("heading", { level: 2, name: "Estrato" })).toBeVisible();
  await page.getByLabel("Desde", { exact: true }).fill("2027-01-01");
  await page.getByRole("button", { name: "Aplicar" }).click();
  await expect(page.getByText("No hay registros con esos filtros.")).toBeVisible();
  await page.getByRole("button", { name: "Quitar filtros" }).click();
  await expect(page.getByRole("heading", { level: 2, name: "Estrato" })).toBeVisible();
});

test("forma de usuario: cifras globales y propias, sin desgloses ni funcionarios", async ({ page }) => {
  await simularDashboard(page, () => ({ json: payload("usuario", REGISTROS, { uid: "f1" }) }));
  await page.goto("/dashboard");
  await expect(page.getByText("Registros del programa")).toBeVisible();
  await expect(page.getByText("Sus registros")).toBeVisible();
  await expect(page.getByRole("heading", { level: 2 })).toHaveCount(0);
  await expect(page.getByText("ana.funcionaria@cali.gov.co")).toHaveCount(0);
});

test("forma de lectura (cuenta sin aprobar): solo cifras generales y aviso", async ({ page }) => {
  await simularDashboard(page, () => ({ json: payload("lectura", REGISTROS) }));
  await page.goto("/dashboard");
  await expect(page.getByText("Registros del programa")).toBeVisible();
  await expect(page.getByText("Sus registros")).toHaveCount(0);
  await expect(page.getByText(/cuando un administrador apruebe su cuenta/)).toBeVisible();
});

test("error del servidor: alerta y Reintentar recupera", async ({ page }) => {
  let fallar = true;
  await simularDashboard(page, () => (fallar ? { status: 500, json: { error: "Error interno" } } : { json: payload("completo", REGISTROS) }));
  await page.goto("/dashboard");
  await expect(page.getByRole("alert").filter({ hasText: "Error interno" })).toBeVisible();
  fallar = false;
  await page.getByRole("button", { name: "Reintentar" }).click();
  await expect(page.getByRole("heading", { level: 2, name: "Estrato" })).toBeVisible();
  await expect(page.getByRole("alert").filter({ hasText: "Error interno" })).toHaveCount(0);
});

test("422 del servidor muestra el mensaje del campo", async ({ page }) => {
  await simularDashboard(page, () => ({ status: 422, json: { error: "Datos inválidos", campos: { hasta: ["La fecha final no puede ser anterior a la inicial"] } } }));
  await page.goto("/dashboard");
  await expect(page.getByRole("alert").filter({ hasText: "La fecha final no puede ser anterior a la inicial" })).toBeVisible();
});

test.describe("movil 390x844", () => {
  test.use({ viewport: { width: 390, height: 844 } });
  test("sin desplazamiento horizontal con datos, tablas y vacío", async ({ page }) => {
    await simularDashboard(page, () => ({ json: payload("completo", REGISTROS) }));
    await page.goto("/dashboard");
    await expect(page.getByRole("heading", { level: 2, name: "Estrato" })).toBeVisible();
    expect(await sinHorizontal(page)).toBe(true);
    await page.getByRole("button", { name: "Ver como tablas" }).click();
    await expect(page.getByRole("table", { name: "Estrato" })).toBeVisible();
    expect(await sinHorizontal(page)).toBe(true);
  });
});
