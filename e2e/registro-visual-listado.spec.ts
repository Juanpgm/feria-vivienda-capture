// Visual pass over /registros, /registros/[id] and the duplicate warning: light/dark x desktop (1280x800) / mobile
// (390x844). Screenshots go to test-results/visual (not committed). API answers are mocked: no Firestore access.
import { expect, test, type Page } from "@playwright/test";
import { hayEstadoAuth, MENSAJE_SIN_SESION } from "./auth";
import { abrirLista, HOY, llenarSolicitante, nuevoDesdeLista } from "./ayudas";
import { generarCasos } from "./datos-prueba";
import { detalle, fila, simularLista, uuid } from "./mocks-registros";

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

const NOMBRES = ["Ana María Pérez Gómez", "Luis Fernando Gómez Restrepo", "María Fernanda Rodríguez de la Cruz", "Carlos Andrés Londoño"];
const filas = NOMBRES.map((nombre, i) =>
  fila(i + 1, {
    nombre,
    barrio: i === 2 ? "Urbanización Ciudad Jardín Etapa Dos" : "Aguacatal",
    comuna: i === 2 ? "Comuna 17" : "Comuna 1",
    estado_revision: ["pendiente_revision", "habilitado", "no_habilitado", "pendiente_subsanacion"][i],
    tipo_documento: i === 1 ? "ce" : "cc",
  }),
);

for (const esquema of ["light", "dark"] as const) {
  for (const [vista, viewport] of Object.entries(VISTAS)) {
    test.describe(`registros ${esquema} / ${vista}`, () => {
      test.use({ colorScheme: esquema, viewport });

      test("lista: con filas, filtros abiertos, vacia y con error", async ({ page }) => {
        await page.addInitScript(() => localStorage.removeItem("tema"));
        let modo: "filas" | "vacia" | "error" = "filas";
        await simularLista(page, () =>
          modo === "error" ? { status: 500, json: { error: "Error interno" } } : { json: { items: modo === "filas" ? filas : [], siguiente: modo === "filas" ? "X" : null } },
        );
        await page.goto("/registros");
        await expect(page.getByRole("link", { name: "FV-000001" })).toBeVisible();
        expect(await sinHorizontal(page)).toBe(true);
        expect(await objetivosPequenos(page)).toEqual([]);
        await page.screenshot({ path: `test-results/visual/${esquema}-${vista}-registros-lista.png`, fullPage: true });

        await page.getByText("Más filtros").click();
        await page.getByLabel("Comuna o corregimiento", { exact: true }).selectOption({ label: "Comuna 1" });
        expect(await sinHorizontal(page)).toBe(true);
        expect(await objetivosPequenos(page)).toEqual([]);
        await page.screenshot({ path: `test-results/visual/${esquema}-${vista}-registros-filtros.png`, fullPage: true });

        modo = "vacia";
        await page.getByLabel("Documento o radicado", { exact: true }).fill("FV-000999");
        await page.getByRole("button", { name: "Buscar", exact: true }).click();
        await expect(page.getByText("No se encontraron registros con esos criterios.")).toBeVisible();
        expect(await objetivosPequenos(page)).toEqual([]);
        await page.screenshot({ path: `test-results/visual/${esquema}-${vista}-registros-sin-resultados.png`, fullPage: true });

        modo = "error";
        await page.getByRole("button", { name: "Buscar", exact: true }).click();
        await expect(page.locator("main").getByRole("alert")).toBeVisible();
        await page.screenshot({ path: `test-results/visual/${esquema}-${vista}-registros-error.png`, fullPage: true });
      });

      test("detalle de un registro", async ({ page }) => {
        await page.addInitScript(() => localStorage.removeItem("tema"));
        await page.route((u) => u.pathname === `/api/registros/${uuid(3)}`, (route) => route.fulfill({ json: detalle(3) }));
        await page.goto(`/registros/${uuid(3)}`);
        await expect(page.getByRole("heading", { level: 1, name: "Registro FV-000003" })).toBeVisible();
        expect(await sinHorizontal(page)).toBe(true);
        expect(await objetivosPequenos(page)).toEqual([]);
        await page.screenshot({ path: `test-results/visual/${esquema}-${vista}-registro-detalle.png`, fullPage: true });
      });

      test("aviso de documento duplicado en el paso 1", async ({ page }) => {
        await page.addInitScript(() => localStorage.removeItem("tema"));
        await abrirLista(page);
        await page.route("**/api/registros/duplicado*", (route) =>
          route.fulfill({
            json: { existe: true, coincidencia: "exacta", cantidad: 1, radicado: "FV-000123", fecha_registro_bogota: "2026-03-05", registrado_por_nombre: "Luis Gómez", estado_revision: "pendiente_revision" },
          }),
        );
        await nuevoDesdeLista(page);
        await llenarSolicitante(page, generarCasos(HOY)[0]);
        const aviso = page.getByText(/Ya existe un registro con este documento\./);
        await expect(aviso).toBeVisible();
        await aviso.scrollIntoViewIfNeeded();
        expect(await sinHorizontal(page)).toBe(true);
        await page.screenshot({ path: `test-results/visual/${esquema}-${vista}-paso1-duplicado.png`, fullPage: true });
      });
    });
  }
}
