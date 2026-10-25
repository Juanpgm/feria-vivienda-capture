// Authenticated e2e for /registros/nuevo steps 1-3, driven by the synthetic datasets in datos-prueba.ts.
//
// IMPORTANT: this spec NEVER writes to Firestore. There is no submit yet (POST /api/registros wiring arrives
// in phase 3); the only persistence exercised is the IndexedDB draft, discarded between cases.
// Requires a saved session: run `npm run e2e:login` once (see playwright.config.ts).
import { expect, test } from "@playwright/test";
import { hayEstadoAuth, MENSAJE_SIN_SESION } from "./auth";
import {
  HOY, llenarPaso1, llenarPaso2, llenarPaso3, nuevoRegistro, siguiente, tituloPaso, verificarPaso1, verificarPaso2, verificarPaso3,
} from "./ayudas";
import { generarCasos, generarCasosInvalidos } from "./datos-prueba";

test.beforeAll(() => {
  if (!hayEstadoAuth()) throw new Error(MENSAJE_SIN_SESION);
});

test.describe("registro pasos 1-3: datos validos", () => {
  for (const c of generarCasos(HOY)) {
    test(`${c.clave}: ${c.descripcion}`, async ({ page }) => {
      await nuevoRegistro(page);

      // Step 1: typed like a person, normalization visible after blur.
      await llenarPaso1(page, c);
      await verificarPaso1(page, c);
      const estado = page.getByRole("status");
      await expect(estado).toContainText("Borrador guardado");

      // The draft survives a reload and resumes on the same step with the normalized values.
      await page.reload();
      await expect(page.getByText("Se recuperó el borrador guardado en este equipo.")).toBeVisible();
      await verificarPaso1(page, c);

      await siguiente(page);
      await expect(tituloPaso(page, 2)).toBeVisible();
      await expect(page.getByRole("navigation", { name: "Pasos del registro" }).locator('[aria-current="step"]')).toContainText(
        "Composición familiar",
      );

      // Step 2: household, older adults, income bracket shown next to the COP value.
      await llenarPaso2(page, c);
      await verificarPaso2(page, c);
      await siguiente(page);
      await expect(tituloPaso(page, 3)).toBeVisible();

      // Step 3: multi-select with exclusive "Ninguna".
      await llenarPaso3(page, c);
      await verificarPaso3(page, c);
      await siguiente(page);
      await expect(tituloPaso(page, 4)).toBeVisible();

      // Going back, the rail marks the earlier steps as complete.
      await page.getByRole("button", { name: "Atrás" }).click();
      await expect(tituloPaso(page, 3)).toBeVisible();
      await expect(page.getByRole("button", { name: /Composición familiar/ })).toContainText("Completo");
      // Steps 4-8 are covered by registro-pasos-4-resumen.spec.ts.
    });
  }
});

test.describe("registro pasos 1-3: datos invalidos", () => {
  for (const c of generarCasosInvalidos(HOY).filter((x) => x.paso <= 3)) {
    test(`${c.clave}: ${c.descripcion}`, async ({ page }) => {
      await nuevoRegistro(page);
      const base = generarCasos(HOY)[0];

      // Fill valid earlier steps and advance.
      if (c.paso > 1) {
        await llenarPaso1(page, base);
        await siguiente(page);
        await expect(tituloPaso(page, 2)).toBeVisible();
      }
      if (c.paso > 2) {
        await llenarPaso2(page, base);
        await siguiente(page);
        await expect(tituloPaso(page, 3)).toBeVisible();
      }

      // Fill the failing step with the bad values and try to advance.
      if (c.paso === 1) await llenarPaso1(page, c);
      if (c.paso === 2) await llenarPaso2(page, c);
      if (c.paso === 3) await llenarPaso3(page, c);
      await siguiente(page);

      await expect(page.getByText("Revise los campos marcados antes de continuar.")).toBeVisible();
      await expect(tituloPaso(page, c.paso)).toBeVisible(); // did not advance
      for (const m of c.mensajes) await expect(page.getByText(m, { exact: true }).first()).toBeVisible();
      // Focus moves to the first invalid control.
      await expect
        .poll(() => page.evaluate(() => !!document.activeElement?.closest('[aria-invalid="true"], fieldset[aria-describedby]')))
        .toBe(true);
    });
  }
});

test.describe("registro pasos 1-3: comportamientos puntuales", () => {
  test("CC fuerza nacionalidad Colombiana y bloquea el selector", async ({ page }) => {
    await nuevoRegistro(page);
    await page.getByRole("group", { name: "Tipo de documento" }).getByRole("radio", { name: "C.C.", exact: true }).check();
    const nacionalidad = page.getByRole("combobox", { name: "Nacionalidad", exact: true });
    await expect(nacionalidad).toHaveValue("Colombiana");
    await expect(nacionalidad).toBeDisabled();
    await page.getByRole("group", { name: "Tipo de documento" }).getByRole("radio", { name: "C.E.", exact: true }).check();
    await expect(nacionalidad).toBeEnabled();
  });

  test("Descartar borrador limpia los datos y no queda nada al recargar", async ({ page }) => {
    await nuevoRegistro(page);
    const [c] = generarCasos(HOY);
    await llenarPaso1(page, c);
    await expect(page.getByRole("status")).toContainText("Borrador guardado");
    await nuevoRegistro(page); // discards
    await page.reload();
    await expect(page.getByText("Se recuperó el borrador guardado en este equipo.")).toHaveCount(0);
    await expect(page.getByLabel("Nombre completo", { exact: true })).toHaveValue("");
  });

  test("el menor de edad solo muestra la edad: no bloquea el paso (la advertencia llega del servidor)", async ({ page }) => {
    await nuevoRegistro(page);
    const menor = generarCasos(HOY).find((x) => x.clave === "menor-de-edad")!;
    await llenarPaso1(page, menor);
    await verificarPaso1(page, menor);
    await siguiente(page);
    await expect(tituloPaso(page, 2)).toBeVisible();
  });
});

// Placeholder: the same datasets will drive a full submit once steps 4-9 and the submit button exist.
// It must create ONE document per dataset in a test project/emulator, never in the production Firestore.
test.fixme("envio completo de cada dataset (pasos 4-9 + POST /api/registros)", async () => {
  // for (const c of generarCasos(HOY)) { llenar pasos 1-9; enviar; verificar 201 y advertencias (menor_de_edad) }
});
