// Visual pass over the drafts list and the new fields of this batch (nombre separado, unica propiedad con excepcion,
// observaciones): light/dark x desktop (1280x800) / mobile (390x844). Screenshots go to test-results/visual (not committed).
// No Firestore writes (see registro-pasos-1-3.spec.ts).
import { expect, test, type Page } from "@playwright/test";
import { hayEstadoAuth, MENSAJE_SIN_SESION } from "./auth";
import { abrirLista, avanzarHasta, HOY, llenarPaso1, llenarPaso6, llenarPaso7, nuevoDesdeLista, tituloPaso } from "./ayudas";
import { generarCasos } from "./datos-prueba";

test.beforeAll(() => {
  if (!hayEstadoAuth()) throw new Error(MENSAJE_SIN_SESION);
});

const VISTAS = {
  escritorio: { width: 1280, height: 800 },
  movil: { width: 390, height: 844 },
} as const;

const sinHorizontal = (page: Page) => page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1);
/** Buttons and links of the main area shorter than 44 px. */
const objetivosPequenos = (page: Page) =>
  page.evaluate(() =>
    [...document.querySelectorAll<HTMLElement>("main button, main a, main input, main select, main textarea")]
      .filter((el) => el.getAttribute("tabindex") !== "-1" && el.getBoundingClientRect().width > 0)
      .filter((el) => (el.closest("label") ?? el).getBoundingClientRect().height < 43.5)
      .map((el) => el.getAttribute("aria-label") ?? el.textContent?.trim() ?? el.tagName),
  );

for (const esquema of ["light", "dark"] as const) {
  for (const [vista, viewport] of Object.entries(VISTAS)) {
    test.describe(`borradores y campos nuevos ${esquema} / ${vista}`, () => {
      test.use({ colorScheme: esquema, viewport });

      test("lista de borradores (vacia, con dos, con confirmacion) sin desbordes y con objetivos de 44 px", async ({ page }) => {
        await page.addInitScript(() => localStorage.removeItem("tema"));
        const [a, b] = generarCasos(HOY);
        await abrirLista(page);
        await page.screenshot({ path: `test-results/visual/${esquema}-${vista}-borradores-vacia.png`, fullPage: true });

        await nuevoDesdeLista(page);
        await avanzarHasta(page, a, 3);
        await page.getByRole("link", { name: "Ver borradores en curso" }).click();
        await nuevoDesdeLista(page);
        await llenarPaso1(page, b);
        await expect(page.getByRole("status")).toContainText("Borrador guardado");
        await page.getByRole("link", { name: "Ver borradores en curso" }).click();

        await expect(page.getByRole("listitem")).toHaveCount(2);
        expect(await sinHorizontal(page)).toBe(true);
        expect(await objetivosPequenos(page)).toEqual([]);
        await page.screenshot({ path: `test-results/visual/${esquema}-${vista}-borradores-dos.png`, fullPage: true });

        await page.getByRole("button", { name: "Descartar borrador de Luis Gómez" }).click();
        await expect(page.getByRole("group", { name: "Confirmar descarte de Luis Gómez" })).toBeVisible();
        expect(await sinHorizontal(page)).toBe(true);
        expect(await objetivosPequenos(page)).toEqual([]);
        await page.screenshot({ path: `test-results/visual/${esquema}-${vista}-borradores-confirmar.png`, fullPage: true });
      });

      test("nombre en cuadricula, unica propiedad con excepcion y observaciones", async ({ page }) => {
        await page.addInitScript(() => localStorage.removeItem("tema"));
        const c = generarCasos(HOY)[0];
        await abrirLista(page);
        await nuevoDesdeLista(page);
        await llenarPaso1(page, c);
        await expect(page.getByLabel("Primer nombre", { exact: true })).toHaveValue("Ana");
        expect(await sinHorizontal(page)).toBe(true);
        await page.screenshot({ path: `test-results/visual/${esquema}-${vista}-paso1-nombre.png`, fullPage: true });

        const conExcepcion = { extra: { ...c.extra, titularidad: { tipo: "propietario_clt" as const, matricula: "370-1", unica: "no" as const, excepcion: "dependencia_arriendo_40" as const } } };
        await avanzarHasta(page, c, 6);
        await llenarPaso6(page, conExcepcion);
        await expect(page.getByLabel("Excepción que aplica", { exact: true })).toBeVisible();
        expect(await sinHorizontal(page)).toBe(true);
        expect(await objetivosPequenos(page)).toEqual([]);
        await page.screenshot({ path: `test-results/visual/${esquema}-${vista}-paso6-unica-no.png`, fullPage: true });

        await page.getByRole("button", { name: "Siguiente", exact: true }).click();
        await expect(tituloPaso(page, 7)).toBeVisible();
        await llenarPaso7(page, { extra: { ...c.extra, financiero: { ...c.extra.financiero, observaciones: "Prefiere que la llamen en la tarde.\nTiene cita el lunes." } } });
        expect(await sinHorizontal(page)).toBe(true);
        expect(await objetivosPequenos(page)).toEqual([]);
        await page.screenshot({ path: `test-results/visual/${esquema}-${vista}-paso7-observaciones.png`, fullPage: true });
      });
    });
  }
}
