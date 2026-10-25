// Authenticated e2e for /registros/nuevo steps 1-3, driven by the synthetic datasets in datos-prueba.ts.
//
// IMPORTANT: this spec NEVER writes to Firestore. There is no submit yet (POST /api/registros wiring arrives
// in phase 3); the only persistence exercised is the IndexedDB draft, discarded between cases.
// Requires a saved session: run `npm run e2e:login` once (see playwright.config.ts).
import { expect, test } from "@playwright/test";
import { hayEstadoAuth, MENSAJE_SIN_SESION } from "./auth";
import {
  digitosDeFecha, HOY, llenarPaso1, llenarPaso2, llenarPaso3, nuevoRegistro, siguiente, tituloPaso, verificarPaso1, verificarPaso2, verificarPaso3,
} from "./ayudas";
import { generarCasos, generarCasosInvalidos, sumarDias } from "./datos-prueba";

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
      for (const m of c.mensajesUi ?? c.mensajes) await expect(page.getByText(m, { exact: true }).first()).toBeVisible();
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

  test("fechas: se escriben solo digitos, las barras se agregan, pegar 8 digitos o dd/mm/aaaa funciona", async ({ page }) => {
    await nuevoRegistro(page);
    const nac = page.getByLabel("Fecha de nacimiento", { exact: true });
    await expect(nac).toHaveAttribute("inputmode", "numeric");
    await nac.pressSequentially("15031990");
    await expect(nac).toHaveValue("15/03/1990");
    await expect(page.getByText("Edad:", { exact: false })).toBeVisible();
    await nac.fill("");
    await nac.fill("15/03/1990"); // pasted with slashes
    await expect(nac).toHaveValue("15/03/1990");
    await nac.fill("1a5-0b3x1990"); // letters and other separators are dropped
    await expect(nac).toHaveValue("15/03/1990");
    await nac.press("Backspace");
    await expect(nac).toHaveValue("15/03/199");
    // The draft keeps the half-typed text and restores it after a reload.
    await expect(page.getByRole("status")).toContainText("Borrador guardado");
    await page.reload();
    await expect(page.getByLabel("Fecha de nacimiento", { exact: true })).toHaveValue("15/03/199");
  });

  test("fechas: el error de una fecha imposible aparece mientras se escribe y se corrige al cambiar el dia", async ({ page }) => {
    await nuevoRegistro(page);
    const nac = page.getByLabel("Fecha de nacimiento", { exact: true });
    await nac.fill("31022001");
    await expect(page.getByText("Esa fecha no existe: el mes 02 de 2001 no tiene el día 31", { exact: true })).toBeVisible();
    await nac.fill("28022001");
    await expect(page.getByText("Esa fecha no existe", { exact: false })).toHaveCount(0);
    await nac.fill("29022004"); // leap year
    await expect(page.getByText("Esa fecha no existe", { exact: false })).toHaveCount(0);
    await expect(page.getByText("Edad:", { exact: false })).toBeVisible();
  });

  test("fechas: el calendario nativo escribe la fecha en el campo", async ({ page }) => {
    await nuevoRegistro(page);
    await expect(page.getByRole("button", { name: "Abrir calendario de fecha de nacimiento", exact: true })).toBeVisible();
    await page.getByLabel("Selector nativo de fecha de nacimiento", { exact: true }).fill("1988-07-09");
    await expect(page.getByLabel("Fecha de nacimiento", { exact: true })).toHaveValue("09/07/1988");
    await expect(page.getByText("Edad:", { exact: false })).toBeVisible();
  });

  test("fecha de expedicion futura se rechaza y la de hoy se acepta", async ({ page }) => {
    await nuevoRegistro(page);
    const exp = page.getByLabel("Fecha de expedición", { exact: true });
    await exp.fill(digitosDeFecha(sumarDias(HOY, 1)));
    await exp.press("Tab");
    await expect(page.getByText("La fecha de expedición no puede ser futura", { exact: true })).toBeVisible();
    await exp.fill(digitosDeFecha(HOY));
    await expect(page.getByText("La fecha de expedición no puede ser futura", { exact: true })).toHaveCount(0);
  });

  test("telefono: +57 por defecto para CC, el selector es buscable y un +codigo pegado cambia el selector", async ({ page }) => {
    await nuevoRegistro(page);
    const codigo = page.getByRole("combobox", { name: "Código de país del teléfono principal", exact: true });
    await expect(codigo).toHaveValue(/\+57$/);
    await expect(page.getByText("Ejemplo: 300 123 4567", { exact: true })).toBeVisible();

    await codigo.click();
    const opcionColombia = page.getByRole("option", { name: /Colombia \+57/ });
    await expect(opcionColombia).toBeVisible();
    expect(await page.getByRole("option").count()).toBeGreaterThan(200); // every country is listed
    await codigo.fill("+58"); // searchable by dial code
    await expect(page.getByRole("option", { name: /Venezuela \+58/ })).toBeVisible();
    await codigo.fill("espa"); // accent-insensitive Spanish names
    await expect(page.getByRole("option", { name: /España \+34/ })).toBeVisible();
    await codigo.press("Escape");

    const tel = page.getByLabel("Teléfono principal", { exact: true });
    await tel.fill("+34 612 34 56 78");
    await expect(codigo).toHaveValue(/\+34$/);
    await tel.press("Tab");
    await expect(tel).toHaveValue("612345678");
    await expect(page.getByText("Ejemplo: 300 123 4567", { exact: true })).toHaveCount(0);
  });

  test("telefono: CE preselecciona el codigo de la nacionalidad mientras el campo esta vacio y respeta el cambio manual", async ({ page }) => {
    await nuevoRegistro(page);
    await page.getByRole("group", { name: "Tipo de documento" }).getByRole("radio", { name: "C.E.", exact: true }).check();
    const nacionalidad = page.getByRole("combobox", { name: "Nacionalidad", exact: true });
    const principal = page.getByRole("combobox", { name: "Código de país del teléfono principal", exact: true });
    const alterno = page.getByRole("combobox", { name: "Código de país del teléfono alterno", exact: true });
    await nacionalidad.fill("Venezolana");
    await nacionalidad.press("Enter");
    await expect(principal).toHaveValue(/\+58$/);
    await expect(alterno).toHaveValue(/\+58$/);

    // A manual choice stays when the nationality changes afterwards.
    await principal.fill("Colombia");
    await principal.press("Enter");
    await nacionalidad.fill("Peruana");
    await nacionalidad.press("Enter");
    await expect(principal).toHaveValue(/\+57$/);
    await expect(alterno).toHaveValue(/\+51$/);

    // A typed number is never reinterpreted: the code stays when the nationality changes.
    await page.getByLabel("Teléfono alterno (opcional)", { exact: true }).fill("912 345 678");
    await nacionalidad.fill("Española");
    await nacionalidad.press("Enter");
    await expect(alterno).toHaveValue(/\+51$/);

    // CC goes back to +57 on an untouched empty phone.
    await page.getByRole("group", { name: "Tipo de documento" }).getByRole("radio", { name: "C.C.", exact: true }).check();
    await expect(principal).toHaveValue(/\+57$/);
  });

  test("telefono: el codigo elegido y el numero se conservan en el borrador", async ({ page }) => {
    await nuevoRegistro(page);
    const codigo = page.getByRole("combobox", { name: "Código de país del teléfono principal", exact: true });
    await codigo.fill("Estados Unidos");
    await codigo.press("Enter");
    const tel = page.getByLabel("Teléfono principal", { exact: true });
    await tel.fill("202 555 0123");
    await tel.press("Tab");
    await expect(page.getByRole("status")).toContainText("Borrador guardado");
    await page.reload();
    await expect(page.getByRole("combobox", { name: "Código de país del teléfono principal", exact: true })).toHaveValue(/\+1$/);
    await expect(page.getByLabel("Teléfono principal", { exact: true })).toHaveValue("2025550123");
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
