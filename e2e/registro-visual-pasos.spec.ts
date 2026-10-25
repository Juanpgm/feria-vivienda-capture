// Authenticated visual/a11y pass over steps 1-8: light/dark x desktop (1440x900) / mobile (390x844).
// Screenshots go to test-results/visual (not committed). No Firestore writes (see registro-pasos-1-3.spec.ts).
import { expect, test, type Page } from "@playwright/test";
import { hayEstadoAuth, MENSAJE_SIN_SESION } from "./auth";
import { CAMPO_FUENTES, HOY, llenarPaso1, llenarPaso2, llenarPaso3, llenarPaso4, llenarPaso5, llenarPaso6, llenarPaso7, nuevoRegistro, siguiente, tituloPaso, TITULO_PASO, type NumeroPaso } from "./ayudas";
import { generarCasos } from "./datos-prueba";

test.beforeAll(() => {
  if (!hayEstadoAuth()) throw new Error(MENSAJE_SIN_SESION);
});

const VISTAS = {
  escritorio: { width: 1440, height: 900 },
  movil: { width: 390, height: 844 },
} as const;
const LLENAR = [llenarPaso1, llenarPaso2, llenarPaso3, llenarPaso4, llenarPaso5, llenarPaso6, llenarPaso7] as const;

/** Visible form controls shorter than 44 px, or without a bound label. */
async function auditarControles(page: Page) {
  return page.evaluate(() => {
    const problemas: string[] = [];
    const visible = (el: Element) => {
      const r = el.getBoundingClientRect();
      return r.width > 0 && r.height > 0 && getComputedStyle(el).visibility !== "hidden";
    };
    const form = document.querySelector("main") ?? document.body;
    for (const el of form.querySelectorAll<HTMLElement>("input, select, textarea, button:not([data-rail])")) {
      if (!visible(el) || el.closest("nav") || el.getAttribute("tabindex") === "-1") continue; // tabindex -1 = hidden native date helper
      const input = el as HTMLInputElement;
      const etiqueta = el.getAttribute("aria-label") || (input.labels && input.labels.length > 0) || el.textContent?.trim();
      const nombre = el.getAttribute("name") ?? el.id ?? el.tagName;
      const fieldset = el.closest("fieldset");
      if (!etiqueta && !(fieldset && fieldset.querySelector("legend"))) problemas.push(`sin etiqueta: ${nombre}`);
      const caja = (input.type === "radio" || input.type === "checkbox" ? (el.closest("label") ?? el) : el).getBoundingClientRect();
      if (caja.height < 43.5) problemas.push(`alto ${caja.height.toFixed(1)}: ${el.getAttribute("aria-label") ?? nombre}`);
    }
    return problemas;
  });
}

const sinHorizontal = (page: Page) => page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1);

for (const esquema of ["light", "dark"] as const) {
  for (const [vista, viewport] of Object.entries(VISTAS)) {
    test.describe(`pasos 1-8 ${esquema} / ${vista}`, () => {
      test.use({ colorScheme: esquema, viewport });

      test("sin scroll horizontal, objetivos de 44 px, etiquetas, paso activo y estados de los controles", async ({ page }) => {
        await page.addInitScript(() => localStorage.removeItem("tema"));
        await nuevoRegistro(page);
        const c = generarCasos(HOY)[0];

        for (let n = 1; n <= 8; n++) {
          const paso = n as NumeroPaso;
          await expect(tituloPaso(page, paso)).toBeVisible();
          // Desktop shows the rail (aria-current on the active step); mobile shows "Paso n de 8" instead.
          if (vista === "escritorio") {
            await expect(page.getByRole("navigation", { name: "Pasos del registro" }).locator('[aria-current="step"]')).toContainText(TITULO_PASO[paso]);
          } else {
            await expect(page.getByText(`Paso ${n} de 8`, { exact: true })).toBeVisible();
          }

          if (n === 5) {
            // Segmented control: the chosen segment is visibly different (fill + weight) and the radio is checked.
            const rud = page.getByRole("group", { name: "¿Está registrado en el RUD?" });
            await rud.getByRole("radio", { name: "Sí", exact: true }).check();
            await expect(page.getByLabel("Número de RUD", { exact: true })).toBeVisible();
            const estilo = (nombre: string) =>
              rud.getByRole("radio", { name: nombre, exact: true }).evaluate((el) => {
                const s = getComputedStyle(el.closest("label")!);
                return { fondo: s.backgroundColor, peso: s.fontWeight, marcado: (el as HTMLInputElement).checked };
              });
            const si = await estilo("Sí");
            const no = await estilo("No");
            expect(si.marcado).toBe(true);
            expect(no.marcado).toBe(false);
            expect(si.fondo).toBe(esquema === "dark" ? "rgb(127, 178, 229)" : "rgb(0, 84, 146)");
            expect(no.fondo).not.toBe(si.fondo);
            expect(Number(si.peso)).toBeGreaterThan(Number(no.peso));
            await rud.getByRole("radio", { name: "No", exact: true }).check();
            await expect(page.getByLabel("Número de RUD", { exact: true })).toHaveCount(0);
          }
          if (n === 7) {
            // Multi-select: open list marks chosen options, chips mirror the selection.
            const combo = page.getByRole("combobox", { name: CAMPO_FUENTES, exact: true });
            await combo.click();
            await page.getByRole("option", { name: "Recursos propios", exact: true }).click();
            await expect(page.getByRole("option", { name: "Recursos propios", exact: true })).toHaveAttribute("aria-selected", "true");
            await expect(page.getByRole("option", { name: "Ninguna", exact: true })).toHaveAttribute("aria-selected", "false");
            await page.screenshot({ path: `test-results/visual/${esquema}-${vista}-paso7-lista.png`, fullPage: true });
            await combo.press("Escape");
            await page.getByRole("button", { name: "Quitar Recursos propios", exact: true }).click();
          }

          if (n < 8) await LLENAR[n - 1](page, c);
          expect(await sinHorizontal(page), `scroll horizontal en paso ${n}`).toBe(true);
          expect(await auditarControles(page), `controles del paso ${n}`).toEqual([]);
          await page.screenshot({ path: `test-results/visual/${esquema}-${vista}-paso${n}.png`, fullPage: true });
          if (n < 8) await siguiente(page);
        }
      });
    });
  }
}
