// Visual pass over /dashboard: light/dark x desktop (1280x800) / mobile (390x844). Screenshots go to
// test-results/visual (not committed). API answers are mocked: no Firestore access.
import { expect, test, type Page } from "@playwright/test";
import { hayEstadoAuth, MENSAJE_SIN_SESION } from "./auth";
import { payload, registrosSinteticos, simularDashboard } from "./mocks-dashboard";

test.beforeAll(() => {
  if (!hayEstadoAuth()) throw new Error(MENSAJE_SIN_SESION);
});

const VISTAS = {
  escritorio: { width: 1280, height: 800 },
  movil: { width: 390, height: 844 },
} as const;

const sinHorizontal = (page: Page) => page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1);
const objetivosPequenos = (page: Page) =>
  page.evaluate(() =>
    [...document.querySelectorAll<HTMLElement>("main button, main a, main input, main select, main textarea, main summary")]
      .filter((el) => el.getAttribute("tabindex") !== "-1" && el.getBoundingClientRect().width > 0)
      .filter((el) => (el.closest("label") ?? el).getBoundingClientRect().height < 43.5)
      .map((el) => el.getAttribute("aria-label") ?? el.textContent?.trim() ?? el.tagName),
  );

const REGISTROS = registrosSinteticos(120);

for (const esquema of ["light", "dark"] as const) {
  for (const [vista, viewport] of Object.entries(VISTAS)) {
    test.describe(`dashboard ${esquema} / ${vista}`, () => {
      test.use({ colorScheme: esquema, viewport });

      test("admin: graficos, tablas, vacio y error", async ({ page }) => {
        await page.addInitScript(() => localStorage.removeItem("tema"));
        let modo: "datos" | "vacio" | "error" = "datos";
        await simularDashboard(page, () =>
          modo === "error" ? { status: 500, json: { error: "Error interno" } } : { json: payload("completo", modo === "datos" ? REGISTROS : []) },
        );
        await page.goto("/dashboard");
        await expect(page.getByRole("heading", { level: 2, name: "Estrato" })).toBeVisible();
        expect(await sinHorizontal(page)).toBe(true);
        expect(await objetivosPequenos(page)).toEqual([]);
        await page.screenshot({ path: `test-results/visual/${esquema}-${vista}-dashboard-graficos.png`, fullPage: true });

        await page.getByRole("button", { name: "Ver como tablas" }).click();
        await expect(page.getByRole("table", { name: "Estrato" })).toBeVisible();
        expect(await sinHorizontal(page)).toBe(true);
        expect(await objetivosPequenos(page)).toEqual([]);
        await page.screenshot({ path: `test-results/visual/${esquema}-${vista}-dashboard-tablas.png`, fullPage: true });

        modo = "vacio";
        await page.getByRole("button", { name: "Actualizar" }).click();
        await expect(page.getByText("Aún no hay registros.")).toBeVisible();
        expect(await sinHorizontal(page)).toBe(true);
        await page.screenshot({ path: `test-results/visual/${esquema}-${vista}-dashboard-vacio.png`, fullPage: true });

        modo = "error";
        await page.getByRole("button", { name: "Actualizar" }).click();
        await expect(page.getByRole("alert").filter({ hasText: "Error interno" })).toBeVisible();
        await page.screenshot({ path: `test-results/visual/${esquema}-${vista}-dashboard-error.png`, fullPage: true });
      });

      test("usuario y lectura", async ({ page }) => {
        await page.addInitScript(() => localStorage.removeItem("tema"));
        let alcance: "usuario" | "lectura" = "usuario";
        await simularDashboard(page, () => ({ json: payload(alcance, REGISTROS) }));
        await page.goto("/dashboard");
        await expect(page.getByText("Sus registros")).toBeVisible();
        expect(await sinHorizontal(page)).toBe(true);
        await page.screenshot({ path: `test-results/visual/${esquema}-${vista}-dashboard-usuario.png`, fullPage: true });

        alcance = "lectura";
        await page.getByRole("button", { name: "Actualizar" }).click();
        await expect(page.getByText(/cuando un administrador apruebe su cuenta/)).toBeVisible();
        await page.screenshot({ path: `test-results/visual/${esquema}-${vista}-dashboard-lectura.png`, fullPage: true });
      });
    });
  }
}
