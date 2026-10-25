// Authenticated e2e for /registros/nuevo steps 4-7 and the summary (step 8), driven by datos-prueba.ts.
//
// IMPORTANT: this spec NEVER writes to Firestore. The summary has no submit yet (documents, consent and signature
// arrive in phase 3); the only persistence exercised is the IndexedDB draft, discarded between cases.
// Requires a saved session: run `npm run e2e:login` once (see playwright.config.ts).
import { expect, test } from "@playwright/test";
import { hayEstadoAuth, MENSAJE_SIN_SESION } from "./auth";
import {
  avanzarHasta, CAMPO_FUENTES, chip, HOY, llenarPaso4, llenarPaso5, llenarPaso6, llenarPaso7, nuevoRegistro, siguiente, tituloPaso, verificarPaso4,
  verificarResumen, type NumeroPaso,
} from "./ayudas";
import { generarCasos, generarCasosInvalidos } from "./datos-prueba";

test.beforeAll(() => {
  if (!hayEstadoAuth()) throw new Error(MENSAJE_SIN_SESION);
});

const riel = (page: import("@playwright/test").Page) => page.getByRole("navigation", { name: "Pasos del registro" });
const LLENAR = { 4: llenarPaso4, 5: llenarPaso5, 6: llenarPaso6, 7: llenarPaso7 } as const;

test.describe("registro pasos 4-7 y resumen: datos validos", () => {
  for (const c of generarCasos(HOY)) {
    test(`${c.clave}: ${c.descripcion}`, async ({ page }) => {
      await nuevoRegistro(page);
      await avanzarHasta(page, c, 4);

      await llenarPaso4(page, c);
      await verificarPaso4(page, c);
      await siguiente(page);
      for (const n of [5, 6, 7] as const) {
        await expect(tituloPaso(page, n)).toBeVisible();
        await LLENAR[n](page, c);
        await siguiente(page);
      }

      await verificarResumen(page, c);
      await expect(riel(page).locator('[aria-current="step"]')).toContainText("Resumen");

      // "Editar" jumps to the step with the values intact, and the rail keeps every earlier step complete.
      await page.getByRole("button", { name: "Editar Inmueble y ubicación (paso 4)", exact: true }).click();
      await expect(tituloPaso(page, 4)).toBeVisible();
      await verificarPaso4(page, c);
      await expect(page.getByRole("button", { name: /Datos del hogar/ })).toContainText("Completo");
    });
  }
});

test.describe("registro pasos 4-7: datos invalidos", () => {
  for (const c of generarCasosInvalidos(HOY).filter((x) => x.paso >= 4)) {
    test(`${c.clave}: ${c.descripcion}`, async ({ page }) => {
      await nuevoRegistro(page);
      const base = generarCasos(HOY)[0];
      await avanzarHasta(page, base, c.paso as NumeroPaso);
      await LLENAR[c.paso as 4 | 5 | 6 | 7](page, c);
      await siguiente(page);

      await expect(page.getByText("Revise los campos marcados antes de continuar.")).toBeVisible();
      await expect(tituloPaso(page, c.paso as NumeroPaso)).toBeVisible(); // did not advance
      for (const m of c.mensajesUi ?? c.mensajes) await expect(page.getByText(m, { exact: true }).first()).toBeVisible();
      await expect
        .poll(() => page.evaluate(() => !!document.activeElement?.closest('[aria-invalid="true"], fieldset[aria-describedby]')))
        .toBe(true);
    });
  }
});

test.describe("registro pasos 4-7 y resumen: comportamientos puntuales", () => {
  test("cambiar la comuna limpia el barrio incompatible y filtra las opciones", async ({ page }) => {
    await nuevoRegistro(page);
    const c = generarCasos(HOY)[0];
    await avanzarHasta(page, c, 4);
    await llenarPaso4(page, c); // Comuna 1 / Aguacatal
    const barrio = page.getByRole("combobox", { name: "Barrio o vereda", exact: true });
    await expect(barrio).toHaveValue("Aguacatal");

    const comuna = page.getByRole("combobox", { name: "Comuna o corregimiento", exact: true });
    await comuna.fill("Comuna 3");
    await comuna.press("Enter");
    await expect(barrio).toHaveValue("");
    await expect(page.getByText("Sector: Urbano", { exact: true })).toBeVisible();

    // Only barrios of the chosen comuna are offered.
    await barrio.fill("Aguacatal");
    await expect(page.getByRole("option", { name: "Aguacatal" })).toHaveCount(0);
    await barrio.fill("El Calvario");
    await expect(page.getByRole("option", { name: "El Calvario" })).toBeVisible();

    // A corregimiento flips the sector and relabels the field.
    await comuna.fill("Corregimiento Pance");
    await comuna.press("Enter");
    await expect(page.getByText("Sector: Rural", { exact: true })).toBeVisible();
    await expect(page.getByRole("combobox", { name: "Vereda", exact: true })).toBeVisible();
  });

  test("'No aparece en la lista' cambia a texto libre y vuelve a la lista", async ({ page }) => {
    await nuevoRegistro(page);
    const c = generarCasos(HOY)[0];
    await avanzarHasta(page, c, 4);
    await llenarPaso4(page, c);
    await page.getByRole("checkbox", { name: "No aparece en la lista", exact: true }).check();
    await expect(page.getByRole("combobox", { name: "Barrio o vereda", exact: true })).toHaveCount(0);
    await page.getByLabel("Barrio (escríbalo)", { exact: true }).fill("Sector escrito a mano");
    await page.getByRole("checkbox", { name: "No aparece en la lista", exact: true }).uncheck();
    await expect(page.getByRole("combobox", { name: "Barrio o vereda", exact: true })).toHaveValue("");
  });

  test("RUD: 'No lo sé' deshabilita el numero; seguro Otra pide el nombre; Ninguna es exclusiva", async ({ page }) => {
    await nuevoRegistro(page);
    const c = generarCasos(HOY)[0];
    await avanzarHasta(page, c, 5);
    await page.getByRole("group", { name: "¿Está registrado en el RUD?" }).getByRole("radio", { name: "Sí", exact: true }).check();
    await page.getByLabel("Número de RUD", { exact: true }).fill("123");
    await page.getByRole("checkbox", { name: "No lo sé", exact: true }).check();
    await expect(page.getByLabel("Número de RUD", { exact: true })).toBeDisabled();
    await expect(page.getByLabel("Número de RUD", { exact: true })).toHaveValue("");

    await llenarPaso5(page, { extra: { ...c.extra, riesgo: { rud: "no", dictamen: "demolido" } } });
    await siguiente(page);
    await llenarPaso6(page, c);
    await siguiente(page);
    await expect(tituloPaso(page, 7)).toBeVisible();

    const fuentes = page.getByRole("combobox", { name: CAMPO_FUENTES, exact: true });
    await fuentes.click();
    await page.getByRole("option", { name: "Recursos propios", exact: true }).click();
    await page.getByRole("option", { name: "Ninguna", exact: true }).click();
    await expect(chip(page, "Recursos propios")).toHaveCount(0);
    await expect(chip(page, "Ninguna")).toBeVisible();
    await page.getByRole("option", { name: "Subsidio concurrente", exact: true }).click();
    await expect(chip(page, "Ninguna")).toHaveCount(0);
    await expect(chip(page, "Subsidio concurrente")).toBeVisible();
    await chip(page, "Subsidio concurrente").click();
    await expect(chip(page, "Subsidio concurrente")).toHaveCount(0);
    await fuentes.press("Escape");

    await page.getByRole("group", { name: "¿El inmueble tenía seguro?" }).getByRole("radio", { name: "Sí", exact: true }).check();
    const aseguradora = page.getByRole("combobox", { name: "Aseguradora", exact: true });
    await aseguradora.fill("Otra");
    await aseguradora.press("Enter");
    await expect(page.getByLabel("Nombre de la aseguradora", { exact: true })).toBeVisible();
  });

  test("el resumen marca lo que falta cuando se vacia un dato despues de avanzar", async ({ page }) => {
    await nuevoRegistro(page);
    const c = generarCasos(HOY)[0];
    await avanzarHasta(page, c, 8);
    await expect(page.getByText("Los datos de los pasos anteriores están completos.")).toBeVisible();

    // Go back to step 4, empty the address, and jump to the summary through the rail (no validation on the way).
    await riel(page).getByRole("button", { name: /Inmueble y ubicación/ }).click();
    await page.getByLabel("Dirección del inmueble", { exact: true }).fill("");
    await riel(page).getByRole("button", { name: /Resumen/ }).click();

    await expect(page.getByText("Faltan datos en 1 sección: Inmueble y ubicación.")).toBeVisible();
    await expect(page.getByText("Ingrese la dirección")).toBeVisible();
    // The edit link takes the person to the step that needs fixing.
    await page.getByRole("button", { name: "Editar Inmueble y ubicación (paso 4)", exact: true }).click();
    await expect(tituloPaso(page, 4)).toBeVisible();
  });

  test("el resumen no tiene boton de envio y lista lo pendiente de la siguiente fase", async ({ page }) => {
    await nuevoRegistro(page);
    await avanzarHasta(page, generarCasos(HOY)[0], 8);
    await expect(page.getByRole("button", { name: /enviar/i })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Siguiente", exact: true })).toHaveCount(0);
    for (const t of ["Fotos del documento de identidad (frente y reverso)", "Autorización de tratamiento de datos personales", "Firma del solicitante"]) {
      await expect(page.getByText(t, { exact: true })).toBeVisible();
    }
  });

  test("el borrador conserva los pasos 4-7 al recargar", async ({ page }) => {
    await nuevoRegistro(page);
    const c = generarCasos(HOY).find((x) => x.extra.vivienda.barrioOtro)!;
    await avanzarHasta(page, c, 5);
    await expect(page.getByRole("status")).toContainText("Borrador guardado");
    await page.reload();
    await expect(tituloPaso(page, 5)).toBeVisible();
    await riel(page).getByRole("button", { name: /Inmueble y ubicación/ }).click();
    await verificarPaso4(page, c);
  });
});
