// Authenticated e2e for /registros/nuevo steps 4-7 and the summary (step 8), driven by datos-prueba.ts.
//
// IMPORTANT: this spec NEVER writes to Firestore. The summary has no submit yet (documents, consent and signature
// arrive in phase 3); the only persistence exercised is the IndexedDB draft (each test runs in a fresh browser context).
// Requires a saved session: run `npm run e2e:login` once (see playwright.config.ts).
import { expect, test } from "@playwright/test";
import { hayEstadoAuth, MENSAJE_SIN_SESION } from "./auth";
import {
  avanzarHasta, CAMPO_FUENTES, chip, HOY, llenarPaso4, llenarPaso5, llenarPaso6, llenarPaso7, llenarPaso8, llenarPaso9, nuevoRegistro, siguiente, tituloPaso,
  verificarPaso4, verificarResumen, type NumeroPaso,
} from "./ayudas";
import { PASOS } from "../src/modules/registro/ui/pasos";
import { generarCasos, generarCasosInvalidos, restarAnios } from "./datos-prueba";

test.beforeAll(() => {
  if (!hayEstadoAuth()) throw new Error(MENSAJE_SIN_SESION);
});

const riel = (page: import("@playwright/test").Page) => page.getByRole("navigation", { name: "Pasos del registro" });
const seccionResumenFin = (page: import("@playwright/test").Page) => page.getByRole("region", { name: "Cierre financiero", exact: true });
const LLENAR = { 4: llenarPaso4, 5: llenarPaso5, 6: llenarPaso6, 7: llenarPaso7, 8: llenarPaso8, 9: llenarPaso9 } as const;
const RESUMEN = PASOS.findIndex((p) => p.id === "resumen") + 1;

test.describe("registro pasos 4-7 y resumen: datos validos", () => {
  for (const c of generarCasos(HOY)) {
    test(`${c.clave}: ${c.descripcion}`, async ({ page }) => {
      await nuevoRegistro(page);
      await avanzarHasta(page, c, 4);

      await llenarPaso4(page, c);
      await verificarPaso4(page, c);
      await siguiente(page);
      // Steps 5-7 with the dataset, then consent (8) and photos (9): both take no dataset.
      for (const n of [5, 6, 7, 8, 9] as const) {
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

  test("territorio solo por listas: no hay checkbox ni texto libre; el texto no elegido se descarta y el campo queda requerido", async ({ page }) => {
    await nuevoRegistro(page);
    const c = generarCasos(HOY)[0];
    await avanzarHasta(page, c, 4);
    await expect(page.getByRole("checkbox", { name: /No aparece en la lista/ })).toHaveCount(0);

    const comuna = page.getByRole("combobox", { name: "Comuna o corregimiento", exact: true });
    await comuna.fill("texto inventado");
    await comuna.press("Tab");
    await expect(comuna).toHaveValue("");
    await expect(page.getByText("Seleccione comuna o corregimiento", { exact: true })).toBeVisible();

    await comuna.fill("Comuna 1");
    await comuna.press("Enter");
    const barrio = page.getByRole("combobox", { name: "Barrio o vereda", exact: true });
    await barrio.fill("Sector escrito a mano");
    await barrio.press("Tab");
    await expect(barrio).toHaveValue("");
    await expect(page.getByText("Seleccione un barrio o vereda", { exact: true })).toBeVisible();

    // Enter with no match selects nothing either; Next stays blocked.
    await barrio.fill("zzzz");
    await barrio.press("Enter");
    await barrio.press("Tab");
    await expect(barrio).toHaveValue("");
    await page.getByLabel("Dirección del inmueble", { exact: true }).fill("Calle 5 # 10-20");
    await page.getByRole("radio", { name: "3", exact: true }).check();
    await siguiente(page);
    await expect(tituloPaso(page, 4)).toBeVisible();
    await expect(page.getByText("Seleccione un barrio o vereda", { exact: true }).first()).toBeVisible();
  });

  test("unica propiedad: Si no pide nada, No muestra la excepcion obligatoria y volver a Si la olvida", async ({ page }) => {
    await nuevoRegistro(page);
    const c = generarCasos(HOY)[0];
    await avanzarHasta(page, c, 6);
    const unica = page.getByRole("group", { name: "¿Es su única propiedad residencial?" });
    const excepcion = page.getByLabel("Excepción que aplica", { exact: true });
    await expect(excepcion).toHaveCount(0);
    await unica.getByRole("radio", { name: "No", exact: true }).check();
    await expect(excepcion.locator("option")).toHaveText([
      "Seleccione...",
      "También fueron destruidas otras propiedades residenciales",
      "Dependencia económica de al menos el 40 % del arriendo del inmueble",
    ]);
    await page.getByRole("radio", { name: /Propietario con título/ }).check();
    await siguiente(page);
    await expect(page.getByText("Seleccione la excepción que aplica", { exact: true })).toBeVisible();
    await expect(tituloPaso(page, 6)).toBeVisible();

    await excepcion.selectOption({ label: "Dependencia económica de al menos el 40 % del arriendo del inmueble" });
    await unica.getByRole("radio", { name: "Sí", exact: true }).check();
    await expect(excepcion).toHaveCount(0);
    await unica.getByRole("radio", { name: "No", exact: true }).check();
    await expect(page.getByLabel("Excepción que aplica", { exact: true })).toHaveValue("");
    await unica.getByRole("radio", { name: "Sí", exact: true }).check();
    await siguiente(page);
    await expect(tituloPaso(page, 7)).toBeVisible();
  });

  test("observaciones: contador, limite de 1000 y se muestra en el resumen", async ({ page }) => {
    await nuevoRegistro(page);
    const c = generarCasos(HOY).find((x) => x.extra.financiero.observaciones?.includes("tarde"))!;
    await avanzarHasta(page, c, 7);
    await llenarPaso7(page, c);
    await expect(page.getByText(`${c.extra.financiero.observaciones!.length} de 1000 caracteres`, { exact: true })).toBeVisible();
    const obs = page.getByLabel("Observaciones (opcional)", { exact: true });
    await obs.fill("x".repeat(1001));
    await siguiente(page);
    await expect(page.getByText("Máximo 1000 caracteres", { exact: true })).toBeVisible();
    await obs.fill("x".repeat(1000));
    await obs.press("Tab");
    await siguiente(page);
    await expect(tituloPaso(page, 8)).toBeVisible(); // consent follows the financial closing
    await llenarPaso8(page);
    await siguiente(page);
    await llenarPaso9(page);
    await siguiente(page);
    await expect(tituloPaso(page, RESUMEN as NumeroPaso)).toBeVisible();
    await expect(seccionResumenFin(page).locator("dd").last()).toHaveText("x".repeat(1000));
    // Empty observations are stored as null and the summary says so.
    await page.getByRole("button", { name: "Editar Cierre financiero (paso 7)", exact: true }).click();
    await page.getByLabel("Observaciones (opcional)", { exact: true }).fill("   ");
    await riel(page).getByRole("button", { name: /Resumen/ }).click();
    await expect(seccionResumenFin(page).locator("dd").last()).toHaveText("Sin observaciones");
  });

  test("consistencia del hogar: mas adultos mayores que personas se bloquea; con 65+ y sin adultos mayores solo hay una sugerencia", async ({ page }) => {
    await nuevoRegistro(page);
    const base = generarCasos(HOY)[0];
    const mayor = { ...base, solicitante: { ...base.solicitante, nacimiento: restarAnios(HOY, 70) } };
    await avanzarHasta(page, mayor, 2);

    const sugerencia = page.getByText("El solicitante tiene 65 años o más. Verifique si debe contarse como adulto mayor del hogar.", { exact: true });
    const adultos = page.getByRole("group", { name: "¿Hay adultos mayores en el hogar?" });
    await expect(sugerencia).toHaveCount(0);
    await adultos.getByRole("radio", { name: "No", exact: true }).check();
    await expect(sugerencia).toBeVisible();
    await page.getByLabel("Personas que viven en el hogar", { exact: true }).fill("1");
    await page.getByLabel("Ingreso mensual del hogar (COP)", { exact: true }).fill("1500000");
    await siguiente(page); // the hint never blocks
    await expect(tituloPaso(page, 3)).toBeVisible();
    await page.getByRole("button", { name: "Atrás" }).click();

    await adultos.getByRole("radio", { name: "Sí", exact: true }).check();
    await expect(sugerencia).toHaveCount(0);
    await page.getByLabel("Cuántos adultos mayores", { exact: true }).fill("2");
    await page.getByLabel("Edad del adulto mayor 1", { exact: true }).fill("70");
    await page.getByLabel("Edad del adulto mayor 2", { exact: true }).fill("71");
    await siguiente(page);
    await expect(page.getByText("Los adultos mayores no pueden ser más que las personas del hogar", { exact: true })).toBeVisible();
    await expect(tituloPaso(page, 2)).toBeVisible();
    await page.getByLabel("Personas que viven en el hogar", { exact: true }).fill("2");
    await siguiente(page);
    await expect(tituloPaso(page, 3)).toBeVisible();
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
    await avanzarHasta(page, c, RESUMEN as NumeroPaso);
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

  test("el resumen no envía: lista lo pendiente (la firma), muestra la autorización y no expone la firma", async ({ page }) => {
    await nuevoRegistro(page);
    await avanzarHasta(page, generarCasos(HOY)[0], RESUMEN as NumeroPaso);
    await expect(page.getByRole("button", { name: /^Enviar/i })).toHaveCount(0);
    // "Siguiente" only leads to the last step ("Firma y envío").
    await expect(page.getByRole("button", { name: "Siguiente", exact: true })).toHaveCount(1);
    const pendiente = page.getByRole("region", { name: "Pendiente para poder enviar", exact: true });
    await expect(pendiente).toContainText("Firma del solicitante");
    await expect(pendiente).toContainText("Autorización de tratamiento de datos: Autorizada.");
    await expect(pendiente).toContainText("Fotos del documento de identidad: Frente y reverso capturados.");
    await expect(page.getByRole("region", { name: "Autorización de datos", exact: true })).toContainText("Autorizado");
    await expect(page.getByRole("img", { name: /firma/i })).toHaveCount(0);
  });

  test("el borrador conserva los pasos 4-7 al recargar", async ({ page }) => {
    await nuevoRegistro(page);
    const c = generarCasos(HOY).find((x) => x.extra.vivienda.division?.codigo === "19")!;
    await avanzarHasta(page, c, 5);
    await expect(page.getByRole("status")).toContainText("Borrador guardado");
    await page.reload();
    await expect(tituloPaso(page, 5)).toBeVisible();
    await riel(page).getByRole("button", { name: /Inmueble y ubicación/ }).click();
    await verificarPaso4(page, c);
  });
});
