// Authenticated e2e for /registros/nuevo steps 1-2 (Solicitante, Hogar), driven by the synthetic datasets in datos-prueba.ts.
//
// IMPORTANT: this spec NEVER writes to Firestore. There is no submit yet (POST /api/registros wiring arrives
// in phase 3); the only persistence exercised is the IndexedDB draft (each test runs in a fresh browser context).
// Requires a saved session: run `npm run e2e:login` once (see playwright.config.ts).
import { expect, test } from "@playwright/test";
import { hayEstadoAuth, MENSAJE_SIN_SESION } from "./auth";
import {
  digitosDeFecha, HOY, llenarComposicion, llenarProteccion, llenarSolicitante, nuevoRegistro, siguiente, tituloPaso, verificarComposicion,
  verificarProteccion, verificarSolicitante,
} from "./ayudas";
import { generarCasos, generarCasosInvalidos, restarAnios, sumarDias } from "./datos-prueba";

test.beforeAll(() => {
  if (!hayEstadoAuth()) throw new Error(MENSAJE_SIN_SESION);
});

test.describe("registro pasos Solicitante y Hogar: datos validos", () => {
  for (const c of generarCasos(HOY)) {
    test(`${c.clave}: ${c.descripcion}`, async ({ page }) => {
      await nuevoRegistro(page);

      // Step 1: typed like a person, normalization visible after blur.
      await llenarSolicitante(page, c);
      await verificarSolicitante(page, c);
      const estado = page.getByRole("status");
      await expect(estado).toContainText("Borrador guardado");

      // The draft survives a reload and resumes on the same step with the normalized values.
      await page.reload();
      await expect(page.getByText("Se recuperó el borrador guardado en este equipo.")).toBeVisible();
      await verificarSolicitante(page, c);

      await siguiente(page);
      await expect(tituloPaso(page, 2)).toBeVisible();
      await expect(page.getByRole("navigation", { name: "Pasos del registro" }).locator('[aria-current="step"]')).toContainText("Hogar");

      // Step 2: household, older adults and income bracket, then the special protection multi-select with exclusive "Ninguna".
      await llenarComposicion(page, c);
      await verificarComposicion(page, c);
      await llenarProteccion(page, c);
      await verificarProteccion(page, c);
      await siguiente(page);
      await expect(tituloPaso(page, 3)).toBeVisible();

      // Going back, the rail marks the earlier steps as complete.
      await page.getByRole("button", { name: "Atrás" }).click();
      await expect(tituloPaso(page, 2)).toBeVisible();
      await expect(page.getByRole("navigation", { name: "Pasos del registro" }).getByRole("button", { name: /Solicitante/ })).toContainText("Completo");
      // Steps 3-6 are covered by registro-pasos-vivienda-revision.spec.ts.
    });
  }
});

test.describe("registro pasos Solicitante y Hogar: datos invalidos", () => {
  for (const c of generarCasosInvalidos(HOY).filter((x) => x.paso <= 2)) {
    test(`${c.clave}: ${c.descripcion}`, async ({ page }) => {
      await nuevoRegistro(page);
      const base = generarCasos(HOY)[0];

      // Fill the valid earlier step and advance.
      if (c.paso > 1) {
        await llenarSolicitante(page, base);
        await siguiente(page);
        await expect(tituloPaso(page, 2)).toBeVisible();
      }

      // Fill the failing step with the bad values and try to advance.
      if (c.paso === 1) await llenarSolicitante(page, c);
      if (c.paso === 2) {
        await llenarComposicion(page, c);
        await llenarProteccion(page, c);
      }
      // Leave the last field first (a click on "Siguiente" that also blurs a field can be swallowed by the layout change).
      await tituloPaso(page, c.paso).click();
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

test.describe("registro pasos Solicitante y Hogar: comportamientos puntuales", () => {
  test("CC fuerza nacionalidad Colombiana y bloquea el selector", async ({ page }) => {
    await nuevoRegistro(page);
    await page.getByRole("group", { name: "Tipo de documento" }).getByRole("radio", { name: "C.C.", exact: true }).check();
    const nacionalidad = page.getByRole("combobox", { name: "Nacionalidad", exact: true });
    await expect(nacionalidad).toHaveValue("Colombiana");
    await expect(nacionalidad).toBeDisabled();
    await page.getByRole("group", { name: "Tipo de documento" }).getByRole("radio", { name: "C.E.", exact: true }).check();
    await expect(nacionalidad).toBeEnabled();
  });

  test("Descartar borrador pide confirmacion en la pagina, vuelve a la lista y no queda nada al recargar", async ({ page }) => {
    let dialogos = 0;
    page.on("dialog", (d) => (dialogos++, void d.dismiss()));
    await nuevoRegistro(page);
    const [c] = generarCasos(HOY);
    await llenarSolicitante(page, c);
    await expect(page.getByRole("status")).toContainText("Borrador guardado");

    await page.getByRole("button", { name: "Descartar borrador", exact: true }).click();
    await expect(page.getByText("¿Descartar este borrador? Se borrarán los datos ingresados.")).toBeVisible();
    await page.getByRole("button", { name: "Conservar", exact: true }).click();
    await expect(page.getByLabel("Primer nombre", { exact: true })).toHaveValue(c.esperado.nombres[0]);

    await page.getByRole("button", { name: "Descartar borrador", exact: true }).click();
    await page.getByRole("button", { name: "Sí, descartar", exact: true }).click();
    await expect(page.getByRole("heading", { level: 2, name: "Borradores en curso" })).toBeVisible();
    await expect(page.getByText("No hay borradores. Inicie un registro nuevo.")).toBeVisible();
    await page.reload();
    await expect(page.getByText("No hay borradores. Inicie un registro nuevo.")).toBeVisible();
    expect(dialogos).toBe(0); // never window.confirm
  });

  test("nombre separado: cada parte se normaliza al salir, las opcionales pueden quedar vacias y Title Case incluye particulas", async ({ page }) => {
    await nuevoRegistro(page);
    const campo = (n: string) => page.getByLabel(n, { exact: true });
    await campo("Primer nombre").fill("  JOSÉ  ");
    await campo("Primer nombre").press("Tab");
    await expect(campo("Primer nombre")).toHaveValue("José");
    await campo("Primer apellido").fill("de la   cRUZ");
    await campo("Primer apellido").press("Tab");
    await expect(campo("Primer apellido")).toHaveValue("De La Cruz");
    await campo("Segundo apellido (opcional)").fill("o'brien-núñez");
    await campo("Segundo apellido (opcional)").press("Tab");
    await expect(campo("Segundo apellido (opcional)")).toHaveValue("O'Brien-Núñez");
    await expect(campo("Segundo nombre (opcional)")).toHaveValue("");

    // Required parts report their own message; the optional ones never do.
    await campo("Primer nombre").fill("");
    await campo("Primer nombre").press("Tab");
    await expect(page.getByText("Ingrese el primer nombre", { exact: true })).toBeVisible();
    await expect(page.getByText("Ingrese el primer apellido", { exact: true })).toHaveCount(0);
  });

  test("nombre separado: en escritorio los cuatro campos forman una cuadricula de 2x2", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await nuevoRegistro(page);
    const caja = async (n: string) => (await page.getByLabel(n, { exact: true }).boundingBox())!;
    const [pn, sn, pa, sa] = [await caja("Primer nombre"), await caja("Segundo nombre (opcional)"), await caja("Primer apellido"), await caja("Segundo apellido (opcional)")];
    expect(Math.abs(pn.y - sn.y)).toBeLessThan(2);
    expect(Math.abs(pa.y - sa.y)).toBeLessThan(2);
    expect(sn.x).toBeGreaterThan(pn.x + pn.width - 1);
    expect(pa.y).toBeGreaterThan(pn.y + pn.height);
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

  test("mayores de edad: 17 anios se bloquea con mensaje claro, 18 cumplidos hoy avanza", async ({ page }) => {
    await nuevoRegistro(page);
    const base = generarCasos(HOY)[0];
    const sinNacimiento = { ...base, solicitante: { ...base.solicitante, nacimiento: sumarDias(restarAnios(HOY, 18), 1) } };
    await llenarSolicitante(page, sinNacimiento);
    await expect(page.getByText("Edad: 17 años")).toBeVisible();
    await siguiente(page);
    await expect(page.getByText("Solo pueden registrarse personas de 18 años o más", { exact: true }).first()).toBeVisible();
    await expect(tituloPaso(page, 1)).toBeVisible();

    const nac = page.getByLabel("Fecha de nacimiento", { exact: true });
    await nac.fill(digitosDeFecha(restarAnios(HOY, 18)));
    await expect(page.getByText("Edad: 18 años")).toBeVisible();
    await siguiente(page);
    await expect(tituloPaso(page, 2)).toBeVisible();
  });
});
