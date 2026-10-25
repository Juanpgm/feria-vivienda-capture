// Authenticated e2e for /registros (list/search/pagination), /registros/[id] (detail) and the duplicate-document
// warning of step 1. Nothing can be created without the submit button (PR 3b), so every API answer is mocked with
// page.route: this spec NEVER reads or writes the real Firestore.
import { expect, test, type Page, type Request, type Route } from "@playwright/test";
import { hayEstadoAuth, MENSAJE_SIN_SESION } from "./auth";
import { abrirLista, HOY, llenarPaso1, nuevoDesdeLista, siguiente, tituloPaso } from "./ayudas";
import { generarCasos } from "./datos-prueba";
import { detalle, fila, simularLista, uuid } from "./mocks-registros";

test.beforeAll(() => {
  if (!hayEstadoAuth()) throw new Error(MENSAJE_SIN_SESION);
});

test.describe("/registros", () => {
  test("sin registros: estado vacio con direccion y enlace para registrar", async ({ page }) => {
    await simularLista(page, () => ({ json: { items: [], siguiente: null } }));
    await page.goto("/registros");
    await expect(page.getByRole("heading", { level: 1, name: "Registros" })).toBeVisible();
    await expect(page.getByText("Aún no hay registros.")).toBeVisible();
    await expect(page.getByRole("link", { name: "Nuevo registro" })).toHaveAttribute("href", "/registros/nuevo");
    await expect(page.getByRole("table")).toHaveCount(0);
    await expect(page.getByRole("navigation", { name: "Paginación" })).toHaveCount(0);
  });

  test("tabla con filas, enlace al detalle y fecha en hora de Bogota", async ({ page }) => {
    await simularLista(page, () => ({ json: { items: [fila(1), fila(2, { tipo_documento: "ce", estado_revision: "habilitado" })], siguiente: null } }));
    await page.goto("/registros");
    const tabla = page.getByRole("table", { name: /Registros/ });
    await expect(tabla.getByRole("row")).toHaveCount(3); // header + 2
    const f1 = tabla.getByRole("row").filter({ hasText: "FV-000001" });
    await expect(f1).toContainText("Persona Número1 Apellido");
    await expect(f1).toContainText("C.C. 1000001");
    await expect(f1).toContainText("Aguacatal, Comuna 1");
    await expect(f1).toContainText("Pendiente de revisión");
    await expect(f1).toContainText(/05\/03\/2026,? 3:42/);
    await expect(tabla.getByRole("row").filter({ hasText: "FV-000002" })).toContainText("Habilitado");
    await tabla.getByRole("link", { name: "FV-000002" }).click();
    await expect(page).toHaveURL(new RegExp(`/registros/${uuid(2)}$`));
  });

  test("busqueda por documento o radicado y por nombre envia los filtros; sin resultados orienta al usuario", async ({ page }) => {
    const recibidas = await simularLista(page, (p) => ({ json: { items: p.get("q") ? [] : [fila(1)], siguiente: null } }));
    await page.goto("/registros");
    await expect(page.getByRole("table")).toBeVisible();
    expect(recibidas[0].toString()).toBe("");

    await page.getByLabel("Documento o radicado", { exact: true }).fill("FV-000123");
    await page.getByLabel("Nombre", { exact: true }).fill("Ana");
    await page.getByRole("button", { name: "Buscar", exact: true }).click();
    await expect(page.getByText("No se encontraron registros con esos criterios.")).toBeVisible();
    expect(recibidas.at(-1)!.get("q")).toBe("FV-000123");
    expect(recibidas.at(-1)!.get("nombre")).toBe("Ana");

    await page.getByRole("button", { name: "Quitar filtros" }).click();
    await expect(page.getByRole("table")).toBeVisible();
    expect(recibidas.at(-1)!.has("q")).toBe(false);
    await expect(page.getByLabel("Documento o radicado", { exact: true })).toHaveValue("");
  });

  test("filtros de administracion: estado, comuna, barrio dependiente, funcionario y fechas", async ({ page }) => {
    const recibidas = await simularLista(page, () => ({ json: { items: [fila(1)], siguiente: null } }));
    await page.goto("/registros");
    await page.getByText("Más filtros").click();
    await expect(page.getByLabel("Barrio o vereda", { exact: true })).toBeDisabled();
    await page.getByLabel("Comuna o corregimiento", { exact: true }).selectOption({ label: "Comuna 1" });
    await expect(page.getByLabel("Barrio o vereda", { exact: true })).toBeEnabled();
    await page.getByLabel("Barrio o vereda", { exact: true }).selectOption({ label: "Aguacatal" });
    await page.getByLabel("Estado de revisión", { exact: true }).selectOption({ label: "Habilitado" });
    await page.getByLabel("Registrado desde", { exact: true }).fill("2026-03-01");
    await page.getByLabel("Registrado hasta", { exact: true }).fill("2026-03-31");
    await page.getByRole("button", { name: "Buscar", exact: true }).click();
    await expect.poll(() => recibidas.at(-1)!.get("estado_revision")).toBe("habilitado");
    const p = recibidas.at(-1)!;
    expect(p.get("comuna")).toBe("01");
    expect(p.get("barrio")).toBe("0199");
    expect(p.get("desde")).toBe("2026-03-01");
    expect(p.get("hasta")).toBe("2026-03-31");
    // Changing the comuna clears the dependent barrio.
    await page.getByLabel("Comuna o corregimiento", { exact: true }).selectOption({ label: "Comuna 2" });
    await expect(page.getByLabel("Barrio o vereda", { exact: true })).toHaveValue("");
  });

  test("paginacion con cursor: siguiente, anterior y fin de la lista", async ({ page }) => {
    const recibidas = await simularLista(page, (p) => {
      const c = p.get("cursor");
      if (!c) return { json: { items: [fila(1), fila(2)], siguiente: "CURSOR-2" } };
      return { json: { items: [fila(3)], siguiente: null } };
    });
    await page.goto("/registros");
    const pager = page.getByRole("navigation", { name: "Paginación" });
    await expect(page.getByRole("link", { name: "FV-000001" })).toBeVisible();
    await expect(pager.getByRole("button", { name: "Anterior" })).toBeDisabled();
    await pager.getByRole("button", { name: "Siguiente" }).click();
    await expect(page.getByRole("link", { name: "FV-000003" })).toBeVisible();
    expect(recibidas.at(-1)!.get("cursor")).toBe("CURSOR-2");
    await expect(pager.getByText("Página 2")).toBeVisible();
    await expect(pager.getByRole("button", { name: "Siguiente" })).toBeDisabled();
    await pager.getByRole("button", { name: "Anterior" }).click();
    await expect(page.getByRole("link", { name: "FV-000001" })).toBeVisible();
    expect(recibidas.at(-1)!.has("cursor")).toBe(false);
    await expect(pager.getByText("Página 1")).toBeVisible();
  });

  test("error del servidor: aviso claro y Reintentar recupera", async ({ page }) => {
    let falla = true;
    await simularLista(page, () => (falla ? { status: 500, json: { error: "Error interno" } } : { json: { items: [fila(1)], siguiente: null } }));
    await page.goto("/registros");
    await expect(page.locator("main").getByRole("alert")).toContainText("Error interno");
    falla = false;
    await page.getByRole("button", { name: "Reintentar" }).click();
    await expect(page.getByRole("link", { name: "FV-000001" })).toBeVisible();
    await expect(page.locator("main").getByRole("alert")).toHaveCount(0);
  });

  test("filtro invalido (422) muestra el mensaje del campo", async ({ page }) => {
    await simularLista(page, (p) =>
      p.get("q") ? { status: 422, json: { error: "Datos inválidos", campos: { q: ["Ingrese un número de documento válido"] } } } : { json: { items: [], siguiente: null } },
    );
    await page.goto("/registros");
    await page.getByLabel("Documento o radicado", { exact: true }).fill("---");
    await page.getByRole("button", { name: "Buscar", exact: true }).click();
    await expect(page.locator("main").getByRole("alert")).toContainText("Ingrese un número de documento válido");
  });

  test("movil 390: lista en vez de tabla, sin desbordes", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await simularLista(page, () => ({ json: { items: [fila(1), fila(2)], siguiente: "X" } }));
    await page.goto("/registros");
    await expect(page.getByRole("table")).toHaveCount(0); // display:none leaves the accessibility tree
    const item = page.getByRole("listitem").filter({ hasText: "FV-000001" });
    await expect(item).toContainText("C.C. 1000001");
    await expect(item).toContainText("Estrato 3");
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1)).toBe(true);
  });
});

test.describe("/registros/[id]", () => {
  const abrir = async (page: Page, n: number, status = 200, json: unknown = detalle(n)) => {
    await page.route((u) => u.pathname === `/api/registros/${uuid(n)}`, (route) => route.fulfill({ status, json }));
    await page.goto(`/registros/${uuid(n)}`);
  };

  test("muestra radicado, quien registro, estado, todas las secciones y el historial", async ({ page }) => {
    await abrir(page, 7);
    await expect(page.getByRole("heading", { level: 1, name: "Registro FV-000007" })).toBeVisible();
    const control = page.getByRole("region", { name: "Control" });
    await expect(control).toContainText("Ana Funcionaria (ana.funcionaria@cali.gov.co)");
    await expect(control).toContainText("Pendiente de revisión");
    await expect(control).toContainText(/05\/03\/2026,? 3:42/);
    await expect(page.getByRole("region", { name: "Datos del hogar" })).toContainText("Ana María Pérez");
    await expect(page.getByRole("region", { name: "Composición familiar" })).toContainText("Personas en el hogar");
    await expect(page.getByRole("region", { name: "Inmueble y ubicación" })).toContainText("Aguacatal");
    await expect(page.getByRole("region", { name: "Riesgo y dictamen técnico" })).toContainText("Colapso Total");
    await expect(page.getByRole("region", { name: "Titularidad" })).toContainText("Propietario");
    await expect(page.getByRole("region", { name: "Cierre financiero" })).toContainText("Llegó con la hermana.");
    await expect(page.getByRole("region", { name: "Historial" })).toContainText("Registro creado");
    await expect(page.locator("img")).toHaveCount(1); // only the brand logo: no document photos or signature
    await page.getByRole("link", { name: "Volver a registros" }).click();
    await expect(page).toHaveURL(/\/registros$/);
  });

  test("registro inexistente o ajeno: 404 explicado", async ({ page }) => {
    await abrir(page, 8, 404, { error: "Registro no encontrado" });
    await expect(page.getByRole("heading", { level: 1, name: "Registro no encontrado" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Volver a registros" })).toBeVisible();
  });

  test("error de servidor: aviso y Reintentar", async ({ page }) => {
    let falla = true;
    await page.route((u) => u.pathname === `/api/registros/${uuid(9)}`, (route) =>
      falla ? route.fulfill({ status: 500, json: { error: "Error interno" } }) : route.fulfill({ json: detalle(9) }),
    );
    await page.goto(`/registros/${uuid(9)}`);
    await expect(page.locator("main").getByRole("alert")).toContainText("Error interno");
    falla = false;
    await page.getByRole("button", { name: "Reintentar" }).click();
    await expect(page.getByRole("heading", { level: 1, name: "Registro FV-000009" })).toBeVisible();
  });
});

test.describe("aviso de documento duplicado (paso 1)", () => {
  const caso = generarCasos(HOY)[0];
  const AVISO = /Ya existe un registro con este documento\./;

  /** Registers the answer and records the requests that reach it. */
  async function simularDuplicado(page: Page, accion: (route: Route) => Promise<void>) {
    const pedidas: Request[] = [];
    await page.route("**/api/registros/duplicado*", (route) => {
      pedidas.push(route.request());
      return accion(route);
    });
    return pedidas;
  }

  test("avisa sin bloquear: radicado y fecha visibles y se puede seguir al paso 2", async ({ page }) => {
    await abrirLista(page);
    const pedidas = await simularDuplicado(page, (r) =>
      r.fulfill({ json: { existe: true, coincidencia: "exacta", cantidad: 1, radicado: "FV-000123", fecha_registro_bogota: "2026-03-05" } }),
    );
    await nuevoDesdeLista(page);
    await llenarPaso1(page, caso);
    await expect(page.getByText("Ya existe un registro con este documento. Radicado FV-000123, registrado el 05/03/2026.")).toBeVisible();
    expect(pedidas.length).toBeGreaterThan(0);
    const url = new URL(pedidas.at(-1)!.url());
    expect(url.searchParams.get("numero")).toBe(caso.esperado.documento);
    expect(url.searchParams.get("tipo")).toBe("cc");
    await expect(page.getByText(/Registrado por/)).toHaveCount(0); // a funcionario never sees who

    await siguiente(page);
    await expect(tituloPaso(page, 2)).toBeVisible();
  });

  test("coincidencia parecida y datos extra para administracion", async ({ page }) => {
    await abrirLista(page);
    await simularDuplicado(page, (r) =>
      r.fulfill({
        json: {
          existe: true, coincidencia: "similar", cantidad: 2, radicado: "FV-000045", fecha_registro_bogota: "2026-03-04",
          registrado_por_nombre: "Luis Gómez", estado_revision: "habilitado",
        },
      }),
    );
    await nuevoDesdeLista(page);
    await llenarPaso1(page, caso);
    const aviso = page.getByText(/documento muy parecido/);
    await expect(aviso).toContainText("Radicado FV-000045, registrado el 04/03/2026.");
    await expect(aviso).toContainText("Hay 2 registros con este documento.");
    await expect(aviso).toContainText("Registrado por Luis Gómez. Estado: Habilitado.");
  });

  test("el aviso se oculta si se edita el numero de documento", async ({ page }) => {
    await abrirLista(page);
    await simularDuplicado(page, (r) =>
      r.fulfill({ json: { existe: true, coincidencia: "exacta", cantidad: 1, radicado: "FV-000123", fecha_registro_bogota: "2026-03-05" } }),
    );
    await nuevoDesdeLista(page);
    await llenarPaso1(page, caso);
    await expect(page.getByText(AVISO)).toBeVisible();
    await page.getByLabel("Número de documento", { exact: true }).fill("99887766");
    await expect(page.getByText(AVISO)).toHaveCount(0);
  });

  test("sin coincidencias no hay aviso", async ({ page }) => {
    await abrirLista(page); // default answer: { existe: false }
    await nuevoDesdeLista(page);
    await llenarPaso1(page, caso);
    await expect(page.getByLabel("Número de documento", { exact: true })).toHaveValue(caso.esperado.documento);
    await page.waitForTimeout(600); // debounce + response
    await expect(page.getByText(/Ya existe un registro/)).toHaveCount(0);
  });

  for (const [nombre, accion] of [
    ["error 500", (r: Route) => r.fulfill({ status: 500, json: { error: "Error interno" } })],
    ["sin conexion", (r: Route) => r.abort("failed")],
    ["respuesta que no es JSON", (r: Route) => r.fulfill({ status: 200, body: "<html>" })],
    ["sesion vencida (401)", (r: Route) => r.fulfill({ status: 401, json: { error: "No autenticado" } })],
  ] as const) {
    test(`un fallo del chequeo se ignora y no bloquea el registro (${nombre})`, async ({ page }) => {
      await abrirLista(page);
      const pedidas = await simularDuplicado(page, accion);
      await nuevoDesdeLista(page);
      await llenarPaso1(page, caso);
      await expect.poll(() => pedidas.length).toBeGreaterThan(0);
      await page.waitForTimeout(400);
      await expect(page.getByText(/Ya existe un registro/)).toHaveCount(0);
      await expect(page.locator("main").getByRole("alert")).toHaveCount(0); // (Next's route announcer is also an alert)
      await siguiente(page);
      await expect(tituloPaso(page, 2)).toBeVisible();
    });
  }
});
