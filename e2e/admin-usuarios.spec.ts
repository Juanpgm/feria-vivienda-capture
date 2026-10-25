// /admin/usuarios: "No aprobar" flow, "No aprobados" section and reconsideration. Needs the saved superadmin session
// (npm run e2e:login) only to pass the page guard; every /api/usuarios answer is mocked (no Firestore/Auth access).
import { expect, test, type Page } from "@playwright/test";
import { hayEstadoAuth, MENSAJE_SIN_SESION } from "./auth";
import { simularUsuarios, usuario, type UsuarioMock } from "./mocks-usuarios";

test.beforeAll(() => {
  if (!hayEstadoAuth()) throw new Error(MENSAJE_SIN_SESION);
});

const BASE: UsuarioMock[] = [
  usuario(1, { nombre: "Ana María Pérez Gómez" }),
  usuario(2, { nombre: "Luis Fernando Gómez Restrepo", correo: "luis.gomez@gmail.com" }),
  usuario(3, { nombre: "Marta Rojas", estado: "aprobado" }),
];

const seccion = (page: Page, titulo: string) => page.locator("section", { has: page.getByRole("heading", { name: titulo }) });
const pendientes = (page: Page) => seccion(page, "Pendientes de aprobación");
const noAprobados = (page: Page) => page.locator("details", { hasText: "No aprobados" });
const abrirNoAprobados = async (page: Page) => {
  await noAprobados(page).locator("summary").click();
  return noAprobados(page);
};

async function abrir(page: Page, usuarios = BASE) {
  const sim = await simularUsuarios(page, usuarios);
  await page.goto("/admin/usuarios");
  await expect(page.getByRole("heading", { name: "Usuarios", exact: true })).toBeVisible();
  await expect(page.getByText("Cargando usuarios")).toBeHidden();
  return sim;
}

test("pendientes ofrece Aprobar y No aprobar por fila; No aprobados queda colapsado", async ({ page }) => {
  await abrir(page);
  const sec = pendientes(page);
  await expect(sec.getByRole("button", { name: "Aprobar a Ana María Pérez Gómez", exact: true })).toBeVisible();
  await expect(sec.getByRole("button", { name: "No aprobar a Ana María Pérez Gómez", exact: true })).toBeVisible();
  await expect(sec.getByRole("button", { name: "No aprobar a Luis Fernando Gómez Restrepo", exact: true })).toBeVisible();
  await expect(noAprobados(page).locator("summary")).toHaveText("No aprobados (0)");
  expect(await noAprobados(page).evaluate((d: HTMLDetailsElement) => d.open)).toBe(false);
});

test("No aprobar sin motivo: confirmación en la página, aviso y paso a No aprobados", async ({ page }) => {
  const sim = await abrir(page);
  page.on("dialog", () => {
    throw new Error("no debe usarse window.confirm");
  });
  await pendientes(page).getByRole("button", { name: "No aprobar a Ana María Pérez Gómez", exact: true }).click();
  const grupo = page.getByRole("group", { name: "Confirmar no aprobar a Ana María Pérez Gómez", exact: true });
  await expect(grupo).toBeVisible();
  await expect(grupo.getByLabel("Motivo (opcional)")).toBeFocused();
  expect(sim.llamadas).toEqual([]); // nothing sent before confirming

  await grupo.getByRole("button", { name: "Confirmar no aprobar a Ana María Pérez Gómez", exact: true }).click();
  await expect(page.getByText("Cuenta de Ana María Pérez Gómez no aprobada.")).toBeVisible();
  expect(sim.llamadas).toEqual([{ uid: "uid-1", accion: "rechazar", body: {} }]);
  await expect(pendientes(page).getByRole("cell", { name: "Ana María Pérez Gómez", exact: true })).toBeHidden();
  await expect(pendientes(page).getByRole("cell", { name: "Luis Fernando Gómez Restrepo", exact: true })).toBeVisible();

  const sec = await abrirNoAprobados(page);
  await expect(sec.locator("summary")).toHaveText("No aprobados (1)");
  await expect(sec.getByText("Ana María Pérez Gómez")).toBeVisible();
  await expect(sec.getByText("admin.prueba@cali.gov.co")).toBeVisible();
  await expect(sec.getByText("05/03/2026, 3:42 p. m.")).toBeVisible();
  await expect(sec.getByText("Sin motivo")).toBeVisible();
});

test("No aprobar con motivo: se envía recortado y se muestra", async ({ page }) => {
  const sim = await abrir(page);
  await pendientes(page).getByRole("button", { name: "No aprobar a Luis Fernando Gómez Restrepo", exact: true }).click();
  const campo = page.getByLabel("Motivo (opcional)");
  await campo.fill("  No es funcionario  ");
  await page.getByRole("button", { name: "Confirmar no aprobar a Luis Fernando Gómez Restrepo", exact: true }).click();
  await expect(page.getByText("Cuenta de Luis Fernando Gómez Restrepo no aprobada.")).toBeVisible();
  expect(sim.llamadas).toEqual([{ uid: "uid-2", accion: "rechazar", body: { motivo: "No es funcionario" } }]);
  const sec = await abrirNoAprobados(page);
  await expect(sec.getByText("Motivo: No es funcionario")).toBeVisible();
});

test("el motivo admite como máximo 200 caracteres y muestra el contador", async ({ page }) => {
  await abrir(page);
  await pendientes(page).getByRole("button", { name: "No aprobar a Ana María Pérez Gómez", exact: true }).click();
  const campo = page.getByLabel("Motivo (opcional)");
  await campo.pressSequentially("x".repeat(250));
  expect(await campo.inputValue()).toHaveLength(200);
  await expect(page.getByText("200 de 200 caracteres")).toBeVisible();
});

test("Cancelar cierra la confirmación sin enviar nada y devuelve el foco", async ({ page }) => {
  const sim = await abrir(page);
  const disparador = pendientes(page).getByRole("button", { name: "No aprobar a Ana María Pérez Gómez", exact: true });
  await disparador.click();
  await page.getByLabel("Motivo (opcional)").fill("borrador");
  await page.getByRole("button", { name: "Cancelar" }).click();
  await expect(page.getByRole("group", { name: /^Confirmar no aprobar/ })).toBeHidden();
  await expect(disparador).toBeFocused();
  expect(sim.llamadas).toEqual([]);
  await expect(pendientes(page).getByRole("cell", { name: "Ana María Pérez Gómez", exact: true })).toBeVisible();
  // Reopening starts clean.
  await disparador.click();
  await expect(page.getByLabel("Motivo (opcional)")).toHaveValue("");
});

test("Aprobar sigue funcionando desde pendientes", async ({ page }) => {
  const sim = await abrir(page);
  await pendientes(page).getByRole("button", { name: "Aprobar a Ana María Pérez Gómez", exact: true }).click();
  await expect(page.getByText("Cuenta de Ana María Pérez Gómez aprobada.")).toBeVisible();
  expect(sim.llamadas).toEqual([{ uid: "uid-1", accion: "aprobar", body: {} }]);
  await expect(seccion(page, "Aprobados").getByText("Ana María Pérez Gómez")).toBeVisible();
});

test("reconsiderar: Aprobar desde No aprobados devuelve la cuenta a Aprobados", async ({ page }) => {
  const sim = await abrir(page, [
    usuario(1, {
      nombre: "Ana María Pérez Gómez",
      estado: "rechazado",
      rechazado_por_correo: "admin.prueba@cali.gov.co",
      rechazado_en: "2026-03-05T20:42:00.000Z",
      motivo: "Correo no institucional",
    }),
  ]);
  await expect(pendientes(page).getByText(/No hay cuentas pendientes/)).toBeVisible();
  const sec = await abrirNoAprobados(page);
  await expect(sec.getByText("Motivo: Correo no institucional")).toBeVisible();
  await sec.getByRole("button", { name: "Aprobar a Ana María Pérez Gómez", exact: true }).click();
  await expect(page.getByText("Cuenta de Ana María Pérez Gómez aprobada.")).toBeVisible();
  expect(sim.llamadas).toEqual([{ uid: "uid-1", accion: "aprobar", body: {} }]);
  await expect(noAprobados(page).locator("summary")).toHaveText("No aprobados (0)");
  await expect(seccion(page, "Aprobados").getByText("Ana María Pérez Gómez")).toBeVisible();
});

test("estados vacíos con indicación", async ({ page }) => {
  await abrir(page, []);
  await expect(pendientes(page).getByText(/No hay cuentas pendientes\. Las cuentas nuevas aparecen aquí/)).toBeVisible();
  const sec = await abrirNoAprobados(page);
  await expect(sec.getByText(/No hay cuentas no aprobadas\. Cuando se use No aprobar/)).toBeVisible();
  await expect(seccion(page, "Aprobados").getByText(/Aún no hay usuarios aprobados/)).toBeVisible();
});

test("error al rechazar: alerta en la fila, la lista no cambia y se puede reintentar", async ({ page }) => {
  const sim = await abrir(page);
  await pendientes(page).getByRole("button", { name: "No aprobar a Ana María Pérez Gómez", exact: true }).click();
  sim.fallar = { status: 403, error: "No puede cambiar el estado de ese rol" };
  await page.getByRole("button", { name: "Confirmar no aprobar a Ana María Pérez Gómez", exact: true }).click();
  await expect(page.getByRole("alert").filter({ hasText: "No puede cambiar el estado de ese rol" })).toBeVisible();
  await expect(pendientes(page).getByRole("cell", { name: "Ana María Pérez Gómez", exact: true })).toBeVisible();
  await expect(noAprobados(page).locator("summary")).toHaveText("No aprobados (0)");
  await page.getByRole("button", { name: "Confirmar no aprobar a Ana María Pérez Gómez", exact: true }).click();
  await expect(page.getByText("Cuenta de Ana María Pérez Gómez no aprobada.")).toBeVisible();
});

test("error al cargar la lista: mensaje con Reintentar", async ({ page }) => {
  const sim = await simularUsuarios(page, BASE);
  sim.fallarLista = true;
  await page.goto("/admin/usuarios");
  await expect(page.getByRole("alert").filter({ hasText: "Error interno" })).toBeVisible();
  sim.fallarLista = false;
  await page.getByRole("button", { name: "Reintentar" }).click();
  await expect(pendientes(page).getByRole("cell", { name: "Ana María Pérez Gómez", exact: true })).toBeVisible();
});

// Visual pass: light/dark x desktop (1280x800) / mobile (390x844). Screenshots go to test-results/visual (not committed).
const VISTAS = { escritorio: { width: 1280, height: 800 }, movil: { width: 390, height: 844 } } as const;
const sinHorizontal = (page: Page) =>
  page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1);
const objetivosPequenos = (page: Page) =>
  page.evaluate(() =>
    [...document.querySelectorAll<HTMLElement>("main button, main a, main input, main select, main textarea, main summary")]
      .filter((el) => el.getAttribute("tabindex") !== "-1" && el.getBoundingClientRect().width > 0)
      .filter((el) => (el.closest("label") ?? el).getBoundingClientRect().height < 43.5)
      .map((el) => el.getAttribute("aria-label") ?? el.textContent?.trim() ?? el.tagName),
  );

const VISUAL: UsuarioMock[] = [
  usuario(1, { nombre: "Ana María Pérez Gómez" }),
  usuario(2, { nombre: "Luis Fernando Gómez Restrepo", correo: "luis.fernando.gomez.restrepo@proveedor-externo.com" }),
  usuario(3, { nombre: "Marta Rojas", estado: "aprobado" }),
  usuario(4, {
    nombre: "Carlos Andrés Londoño",
    estado: "rechazado",
    rechazado_por_correo: "admin.prueba@cali.gov.co",
    rechazado_en: "2026-03-05T20:42:00.000Z",
    motivo: "El correo no corresponde a una dependencia de la Alcaldía; solicitar confirmación con la secretaría.",
  }),
  usuario(5, { nombre: "Sofía Vergara", estado: "rechazado", rechazado_por_correo: "otro.admin@cali.gov.co", rechazado_en: "2026-03-06T14:05:00.000Z" }),
];

for (const esquema of ["light", "dark"] as const) {
  for (const [vista, viewport] of Object.entries(VISTAS)) {
    test.describe(`usuarios ${esquema} / ${vista}`, () => {
      test.use({ colorScheme: esquema, viewport });

      test("lista, confirmación abierta y No aprobados", async ({ page }) => {
        await page.addInitScript(() => localStorage.removeItem("tema"));
        await abrir(page, VISUAL);
        const comprobar = async (nombre: string) => {
          expect(await sinHorizontal(page)).toBe(true);
          expect(await objetivosPequenos(page)).toEqual([]);
          await page.screenshot({ path: `test-results/visual/${esquema}-${vista}-usuarios-${nombre}.png`, fullPage: true });
        };
        await comprobar("lista");

        await pendientes(page).getByRole("button", { name: "No aprobar a Luis Fernando Gómez Restrepo", exact: true }).click();
        await page.getByLabel("Motivo (opcional)").fill("No corresponde a una dependencia");
        await comprobar("confirmacion");
        await page.getByRole("button", { name: "Cancelar" }).click();

        await abrirNoAprobados(page);
        await comprobar("no-aprobados");
      });
    });
  }
}
