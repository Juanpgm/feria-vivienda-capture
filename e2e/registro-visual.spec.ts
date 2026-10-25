// Authenticated visual/a11y smoke for the stepper: light/dark x desktop/mobile (390x844).
// No Firestore writes (see registro-pasos-1-3.spec.ts).
import { expect, test, type Page } from "@playwright/test";
import { hayEstadoAuth, MENSAJE_SIN_SESION } from "./auth";
import { HOY, llenarPaso1, llenarPaso2, nuevoRegistro, siguiente, tituloPaso } from "./ayudas";
import { generarCasos } from "./datos-prueba";

test.beforeAll(() => {
  if (!hayEstadoAuth()) throw new Error(MENSAJE_SIN_SESION);
});

const VISTAS = {
  escritorio: { width: 1280, height: 800 },
  movil: { width: 390, height: 844 },
} as const;

const sinHorizontal = (page: Page) =>
  page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1);

for (const esquema of ["light", "dark"] as const) {
  for (const [vista, viewport] of Object.entries(VISTAS)) {
    test.describe(`${esquema} / ${vista}`, () => {
      test.use({ colorScheme: esquema, viewport });

      test("tema, radios distinguibles, objetivos de 44 px, sin scroll horizontal, etiquetas enlazadas", async ({ page }) => {
        // A theme stored by the manual login session must not hide the system scheme under test.
        await page.addInitScript(() => localStorage.removeItem("tema"));
        await nuevoRegistro(page);
        await expect(page.locator("html")).toHaveClass(esquema === "dark" ? /dark/ : /^(?!.*dark)/);
        expect(await sinHorizontal(page)).toBe(true);

        // Radios: unchecked = empty ring, checked = filled with the brand color.
        const grupo = page.getByRole("group", { name: "Tipo de documento" });
        await grupo.getByRole("radio", { name: "C.C.", exact: true }).check();
        const estilos = async (nombre: string) =>
          grupo.getByRole("radio", { name: nombre, exact: true }).evaluate((el) => {
            const s = getComputedStyle(el);
            const caja = el.closest("label")!.getBoundingClientRect();
            return { fondo: s.backgroundColor, borde: s.borderTopColor, alturaEtiqueta: caja.height, ancho: el.getBoundingClientRect().width };
          });
        const marcado = await estilos("C.C.");
        const vacio = await estilos("C.E.");
        expect(vacio.fondo).toBe("rgba(0, 0, 0, 0)");
        expect(marcado.fondo).not.toBe("rgba(0, 0, 0, 0)");
        expect(marcado.fondo).toBe(esquema === "dark" ? "rgb(127, 178, 229)" : "rgb(0, 84, 146)");
        expect(marcado.borde).toBe(marcado.fondo);
        expect(vacio.borde).not.toBe(vacio.fondo);
        expect(vacio.ancho).toBeGreaterThanOrEqual(20);
        expect(marcado.alturaEtiqueta).toBeGreaterThanOrEqual(43.5);

        // Every control has an accessible name through a bound label.
        const sinEtiqueta = await page.evaluate(() =>
          [...document.querySelectorAll<HTMLInputElement>("form input:not([type=hidden]), form select, form textarea")]
            .filter((el) => !(el.labels?.length || el.getAttribute("aria-label") || el.getAttribute("aria-labelledby")))
            .map((el) => el.name || el.id || el.tagName),
        );
        expect(sinEtiqueta).toEqual([]);

        if (vista === "movil") {
          await expect(page.getByText("Paso 1 de 8")).toBeVisible();
          await expect(page.getByRole("navigation", { name: "Pasos del registro" })).toBeHidden();
        } else {
          await expect(page.getByRole("navigation", { name: "Pasos del registro" }).locator('[aria-current="step"]')).toHaveCount(1);
        }

        // Walk steps 2 and 3 with a valid dataset checking horizontal overflow.
        const c = generarCasos(HOY)[0];
        await llenarPaso1(page, c);
        await siguiente(page);
        await expect(tituloPaso(page, 2)).toBeVisible();
        expect(await sinHorizontal(page)).toBe(true);
        await llenarPaso2(page, { composicion: { ...c.composicion, personas: "3", adultoMayor: "si", edades: ["74", "80"] } });
        expect(await sinHorizontal(page)).toBe(true);
        await siguiente(page);
        await expect(tituloPaso(page, 3)).toBeVisible();
        expect(await sinHorizontal(page)).toBe(true);
        await page.screenshot({ path: `test-results/visual-${esquema}-${vista}.png`, fullPage: true });
      });
    });
  }
}
