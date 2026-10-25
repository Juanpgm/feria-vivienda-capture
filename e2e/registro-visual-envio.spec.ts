// Visual/a11y pass over consent (8), summary (10), signature + send (11) and the confirmation screen:
// light/dark x desktop (1440x900) / mobile (390x844). Screenshots go to test-results/visual (not committed).
// All /api calls are answered by the in-memory double: NOTHING is written to Firestore.
import { expect, test, type Page } from "@playwright/test";
import { hayEstadoAuth, MENSAJE_SIN_SESION } from "./auth";
import { HOY, tituloPaso } from "./ayudas";
import {
  botonEnviar, dibujarFirma, firmarEnPantalla, irAFirma, llegarAlResumen, llenarConsentimiento, N_PASOS, PASO, pad, simularServidor, TEXTO_SENSIBLES, TEXTO_TRATAMIENTO,
} from "./ayudas-envio";
import { generarCasos } from "./datos-prueba";
import { nuevoRegistro, avanzarHasta } from "./ayudas";

test.beforeAll(() => {
  if (!hayEstadoAuth()) throw new Error(MENSAJE_SIN_SESION);
});

const VISTAS = {
  escritorio: { width: 1440, height: 900 },
  movil: { width: 390, height: 844 },
} as const;

/** Visible form controls shorter than 44 px, or without a bound label (checkbox/radio measured by their label). */
async function auditarControles(page: Page) {
  return page.evaluate(() => {
    const problemas: string[] = [];
    const visible = (el: Element) => {
      const r = el.getBoundingClientRect();
      return r.width > 0 && r.height > 0 && getComputedStyle(el).visibility !== "hidden";
    };
    const zona = document.querySelector("main") ?? document.body;
    for (const el of zona.querySelectorAll<HTMLElement>("input, select, textarea, button:not([data-rail]), a[href]")) {
      if (!visible(el) || el.closest("nav")) continue;
      const input = el as HTMLInputElement;
      const etiqueta = el.getAttribute("aria-label") || (input.labels && input.labels.length > 0) || el.textContent?.trim();
      const nombre = el.getAttribute("aria-label") ?? el.getAttribute("name") ?? el.textContent?.trim().slice(0, 30) ?? el.tagName;
      if (!etiqueta && !el.closest("fieldset")?.querySelector("legend")) problemas.push(`sin etiqueta: ${nombre}`);
      if (el.tagName === "A" && el.closest("p")) continue; // inline link inside a sentence
      const caja = (input.type === "radio" || input.type === "checkbox" ? (el.closest("label") ?? el) : el).getBoundingClientRect();
      if (caja.height < 43.5) problemas.push(`alto ${caja.height.toFixed(1)}: ${nombre}`);
    }
    return problemas;
  });
}
const sinHorizontal = (page: Page) => page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1);

for (const esquema of ["light", "dark"] as const) {
  for (const [vista, viewport] of Object.entries(VISTAS)) {
    test.describe(`consentimiento, firma y confirmación ${esquema} / ${vista}`, () => {
      test.use({ colorScheme: esquema, viewport });

      test("consentimiento: texto legible, controles de 44 px, error visible y sin scroll horizontal", async ({ page }) => {
        await page.addInitScript(() => localStorage.removeItem("tema"));
        await simularServidor(page);
        await nuevoRegistro(page);
        await avanzarHasta(page, generarCasos(HOY)[0], PASO.consentimiento);
        await expect(tituloPaso(page, PASO.consentimiento)).toBeVisible();
        // Desktop shows the rail (aria-current on the active step); mobile shows "Paso n de N" instead.
        if (vista === "escritorio") {
          await expect(page.getByRole("navigation", { name: "Pasos del registro" }).locator('[aria-current="step"]')).toContainText("Consentimiento");
        } else {
          await expect(page.getByText(`Paso ${PASO.consentimiento} de ${N_PASOS}`, { exact: true })).toBeVisible();
        }
        expect(await sinHorizontal(page), "scroll horizontal").toBe(true);
        expect(await auditarControles(page), "controles").toEqual([]);
        await page.screenshot({ path: `test-results/visual/${esquema}-${vista}-consentimiento.png`, fullPage: true });

        await page.getByRole("button", { name: "Siguiente", exact: true }).click();
        await expect(page.getByText("Debe autorizar el tratamiento de datos personales para poder registrar la postulación")).toBeVisible();
        await page.screenshot({ path: `test-results/visual/${esquema}-${vista}-consentimiento-error.png`, fullPage: true });

        await llenarConsentimiento(page, { sensibles: false });
        await page.getByRole("checkbox", { name: TEXTO_SENSIBLES, exact: true }).focus();
        await page.screenshot({ path: `test-results/visual/${esquema}-${vista}-consentimiento-foco.png` });
        await expect(page.getByRole("checkbox", { name: TEXTO_TRATAMIENTO, exact: true })).toBeChecked();
      });

      test("firma y envío: pad, vista previa, requisitos y confirmación", async ({ page }) => {
        await page.addInitScript(() => localStorage.removeItem("tema"));
        await simularServidor(page);
        await llegarAlResumen(page, generarCasos(HOY)[0], { sensibles: false });
        expect(await sinHorizontal(page), "scroll horizontal en el resumen").toBe(true);
        await page.screenshot({ path: `test-results/visual/${esquema}-${vista}-resumen.png`, fullPage: true });

        await irAFirma(page);
        expect(await sinHorizontal(page), "scroll horizontal en firma").toBe(true);
        await page.screenshot({ path: `test-results/visual/${esquema}-${vista}-firma-vacia.png`, fullPage: true });

        // The pad must stay usable at this width: wide enough and tall enough to sign.
        const caja = (await pad(page).boundingBox())!;
        expect(caja.width).toBeGreaterThan(vista === "movil" ? 300 : 500);
        expect(caja.height).toBeGreaterThan(vista === "movil" ? 150 : 250);
        // The pad is a light surface with dark ink in both themes.
        expect(await pad(page).evaluate((c) => getComputedStyle(c.parentElement!).backgroundColor)).toBe("rgb(255, 255, 255)");
        await dibujarFirma(page, 2);
        await page.screenshot({ path: `test-results/visual/${esquema}-${vista}-firma-dibujada.png`, fullPage: true });
        expect(await auditarControles(page), "controles en firma").toEqual([]);

        await firmarEnPantalla(page);
        await page.screenshot({ path: `test-results/visual/${esquema}-${vista}-firma-lista.png`, fullPage: true });
        await expect(botonEnviar(page)).toBeEnabled();
        await botonEnviar(page).click();

        await expect(page.getByTestId("radicado")).toBeVisible();
        expect(await sinHorizontal(page), "scroll horizontal en confirmación").toBe(true);
        expect(await auditarControles(page), "controles en confirmación").toEqual([]);
        await page.screenshot({ path: `test-results/visual/${esquema}-${vista}-confirmacion.png`, fullPage: true });
        // The radicado is the biggest text of the screen.
        const tam = await page.getByTestId("radicado").evaluate((e) => parseFloat(getComputedStyle(e).fontSize));
        expect(tam).toBeGreaterThanOrEqual(40);
      });

      test("fallo de envío: estado de error legible", async ({ page }) => {
        await page.addInitScript(() => localStorage.removeItem("tema"));
        await simularServidor(page, { adjuntosFallan: new Set(["documento_reverso"]) });
        await llegarAlResumen(page, generarCasos(HOY)[0]);
        await irAFirma(page);
        await firmarEnPantalla(page);
        await botonEnviar(page).click();
        await expect(page.getByRole("alert").filter({ hasText: "pero no se completó el envío" })).toBeVisible({ timeout: 20_000 });
        await page.screenshot({ path: `test-results/visual/${esquema}-${vista}-envio-error.png`, fullPage: true });
      });
    });
  }
}
