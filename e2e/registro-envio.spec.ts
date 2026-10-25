// Authenticated e2e for the last steps: consent (8), signature + send (11) and the confirmation screen. Every /api call
// of the submit is answered by an in-memory double (ayudas-envio.ts): NOTHING is written to Firestore. The double
// validates each POST with the REAL registroSchema. Each test runs in a fresh browser context (empty IndexedDB).
import { expect, test, type Page } from "@playwright/test";
import { registroSchema } from "../src/modules/registro/domain/schema";
import { hayEstadoAuth, MENSAJE_SIN_SESION } from "./auth";
import { avanzarHasta, HOY, llenarPaso9, nuevoRegistro, siguiente, tituloPaso } from "./ayudas";
import {
  botonEnviar, botonUsarFirma, clavesIdb, dibujarFirma, firmarEnPantalla, irAFirma, llegarAlResumen, llenarConsentimiento, N_PASOS, PASO,
  pad, simularServidor, TEXTO_SENSIBLES, TEXTO_TRATAMIENTO, verificacionManual,
} from "./ayudas-envio";
import { type Caso, generarCasos } from "./datos-prueba";
import { detalle, fila, simularLista, uuid } from "./mocks-registros";

test.beforeAll(() => {
  if (!hayEstadoAuth()) throw new Error(MENSAJE_SIN_SESION);
});

const casos = generarCasos(HOY);
const caso = (clave: string) => casos.find((c) => c.clave === clave)!;
const ENVIABLES = ["cc-nombre-mayusculas", "ce-venezolana", "otro-ppt-peruana", "am-dos", "prot-todas", "ingreso-alto"];
const enmascarado = (n: string) => "*".repeat(Math.max(0, n.length - 4)) + n.slice(-4);

test.describe("envio completo: los 11 pasos hasta la confirmacion", () => {
  for (const clave of ENVIABLES) {
    test(`${clave}: registra, sube 3 archivos y muestra el radicado`, async ({ page }) => {
      const c = caso(clave);
      const srv = await simularServidor(page);
      await llegarAlResumen(page, c);
      expect(PASO.firma).toBe(N_PASOS);

      // Summary: consent status, nothing to send from here, no signature image.
      await expect(page.getByRole("region", { name: "Autorización de datos", exact: true })).toContainText("Autorizado");
      await expect(page.getByRole("region", { name: "Pendiente para poder enviar", exact: true })).toContainText("Firma del solicitante");
      await expect(page.getByRole("button", { name: /enviar/i })).toHaveCount(0);
      await expect(page.locator("img[alt*='Firma']")).toHaveCount(0);

      await irAFirma(page);
      await expect(botonEnviar(page)).toBeDisabled(); // not signed yet
      await firmarEnPantalla(page);
      await expect(botonEnviar(page)).toBeEnabled();
      await botonEnviar(page).click();

      // Confirmation: radicado, applicant, masked document, Bogota time, both actions.
      await expect(page.getByRole("heading", { level: 2, name: "Registro enviado" })).toBeVisible();
      const radicado = srv.registros.get([...srv.registros.keys()][0])!.radicado;
      await expect(page.getByTestId("radicado")).toHaveText(radicado);
      await expect(page.getByText(c.esperado.nombre, { exact: true })).toBeVisible();
      await expect(page.getByText(enmascarado(c.esperado.documento))).toBeVisible();
      await expect(page.getByText(c.esperado.documento, { exact: true })).toHaveCount(0);
      await expect(page.getByText(/05\/03\/2026.*3:42.*\(hora de Colombia\)/)).toBeVisible();
      await expect(page.getByRole("button", { name: "Registrar otra persona", exact: true })).toBeVisible();
      await expect(page.getByRole("link", { name: "Ver registro", exact: true })).toHaveAttribute("href", `/registros/${[...srv.registros.keys()][0]}`);

      // What the server received.
      expect(srv.posts).toHaveLength(1);
      expect(srv.invalidos).toEqual([]);
      const p = srv.posts[0] as { consentimiento: { acepta_datos_sensibles: boolean }; firma: unknown };
      expect(p.firma).toEqual({ metodo_firma: "dibujada" });
      expect(JSON.stringify(srv.posts[0])).not.toContain("data:image");
      expect(srv.subidas.map((s) => s.tipo).sort()).toEqual(["documento_frente", "documento_reverso", "firma"]);
      const firma = srv.subidas.find((s) => s.tipo === "firma")!;
      expect(firma.bytes).toBeGreaterThan(200);
      expect(firma.bytes).toBeLessThanOrEqual(100 * 1024);
      expect(firma.mime).toBe("image/png");
      expect(srv.completar).toHaveLength(1);

      // Draft and photos are gone and the URL no longer names the used draft.
      expect((await clavesIdb(page)).filter((k) => k.startsWith("borrador:") || k.startsWith("foto:"))).toEqual([]);
      expect(new URL(page.url()).search).toBe("");
      await page.reload();
      await expect(page.getByRole("heading", { level: 2, name: "Borradores en curso" })).toBeVisible();
    });
  }
});

test.describe("consentimiento (paso 8)", () => {
  test("sin autorizar el tratamiento no se avanza y el mensaje se asocia al control", async ({ page }) => {
    await simularServidor(page);
    const c = caso("cc-nombre-mayusculas");
    await llegarAlResumenHastaConsentimiento(page, c);
    await siguiente(page);
    await expect(tituloPaso(page, PASO.consentimiento)).toBeVisible();
    const caja = page.getByRole("checkbox", { name: TEXTO_TRATAMIENTO, exact: true });
    await expect(page.getByText("Debe autorizar el tratamiento de datos personales para poder registrar la postulación")).toBeVisible();
    await expect(caja).toHaveAttribute("aria-invalid", "true");
    await expect(caja).toBeFocused();
    await expect(page.getByText("Revise los campos marcados antes de continuar.")).toBeVisible();
    // Both boxes start unticked; the text is marked as a draft and links to the Alcaldía policy.
    await expect(page.getByRole("checkbox", { name: TEXTO_SENSIBLES, exact: true })).not.toBeChecked();
    await expect(page.getByText(/Borrador pendiente de validación jurídica/)).toBeVisible();
    await expect(page.getByRole("link", { name: /Política de tratamiento de datos personales/ })).toHaveAttribute("href", /cali\.gov\.co.*politica-de-tratamiento-de-datos-personales/);
    await caja.check();
    await siguiente(page);
    await expect(tituloPaso(page, PASO.documentos)).toBeVisible();
  });

  test("rechazar los datos sensibles explica la consecuencia y se guarda no_autorizado", async ({ page }) => {
    const srv = await simularServidor(page);
    const c = caso("prot-todas");
    await llegarAlResumenHastaConsentimiento(page, c);
    await llenarConsentimiento(page, { sensibles: false });
    await expect(page.getByText(/queda como «no autorizado»/)).toBeVisible();
    await expect(page.getByText(/No se guardará lo marcado en Especial protección: .*discapacidad/i)).toBeVisible();
    await page.getByRole("checkbox", { name: TEXTO_SENSIBLES, exact: true }).check();
    await expect(page.getByText(/No se guardará lo marcado/)).toHaveCount(0);
    await page.getByRole("checkbox", { name: TEXTO_SENSIBLES, exact: true }).uncheck();
    await completarDesdeConsentimiento(page);

    await expect(page.getByRole("region", { name: "Autorización de datos", exact: true })).toContainText("No autorizado");
    await irAFirma(page);
    await firmarEnPantalla(page);
    await botonEnviar(page).click();
    await expect(page.getByTestId("radicado")).toBeVisible();

    const entrada = srv.posts[0];
    expect((entrada as { consentimiento: { acepta_datos_sensibles: boolean } }).consentimiento.acepta_datos_sensibles).toBe(false);
    // The client still sent the selection; the schema (also run by the server) strips it.
    expect(registroSchema.parse(entrada).composicion.condiciones_especiales).toEqual(["no_autorizado"]);
  });
});

test.describe("firma y envio (paso 11)", () => {
  test("pad vacio: error, deshacer y borrar; firma valida se previsualiza y se puede rehacer", async ({ page }) => {
    await simularServidor(page);
    await llegarAlResumen(page, caso("cc-nombre-mayusculas"));
    await irAFirma(page);

    await botonUsarFirma(page).click();
    await expect(page.getByText("Dibuje la firma", { exact: true })).toBeVisible();
    // A tap (no real stroke) is still empty.
    const caja = (await pad(page).boundingBox())!;
    await page.mouse.click(caja.x + 50, caja.y + 50);
    await botonUsarFirma(page).click();
    await expect(page.getByText("Dibuje la firma", { exact: true })).toBeVisible();

    // The tap above counts as a dot (it can be the dot of an "i"); it is not enough ink by itself.
    await dibujarFirma(page, 2);
    await expect(page.getByText("3 trazos dibujados.")).toBeVisible();
    await page.getByRole("button", { name: "Deshacer último trazo", exact: true }).click();
    await expect(page.getByText("2 trazos dibujados.")).toBeVisible();
    await page.getByRole("button", { name: "Borrar", exact: true }).click();
    await expect(page.getByText("El área de firma está vacía.")).toBeVisible();
    await expect(page.getByRole("button", { name: "Borrar", exact: true })).toBeDisabled();

    await firmarEnPantalla(page);
    await expect(page.getByRole("img", { name: "Firma dibujada por el solicitante" })).toBeVisible();
    await page.getByRole("button", { name: "Firmar de nuevo", exact: true }).click();
    await expect(pad(page)).toBeVisible();
    await expect(botonEnviar(page)).toBeDisabled();
  });

  test("verificación manual: pide método y nota, y envía solo las dos fotos (sin imagen de firma)", async ({ page }) => {
    const srv = await simularServidor(page);
    await llegarAlResumen(page, caso("ce-venezolana"));
    await irAFirma(page);

    await page.getByRole("radio", { name: "No es posible firmar en pantalla (verificación manual)", exact: true }).check();
    await page.getByRole("button", { name: "Registrar verificación manual", exact: true }).click();
    await expect(page.getByText("Elija cómo se verificó la identidad")).toBeVisible();
    await expect(page.getByText("Escriba la nota de la verificación").or(page.getByText(/La nota debe tener al menos 10 caracteres/))).toBeVisible();
    await page.getByLabel("Método de verificación", { exact: true }).selectOption("huella");
    await page.getByLabel("Nota de la verificación", { exact: true }).fill("corta");
    await page.getByRole("button", { name: "Registrar verificación manual", exact: true }).click();
    await expect(page.getByText("La nota debe tener al menos 10 caracteres")).toBeVisible();
    await expect(botonEnviar(page)).toBeDisabled();

    await verificacionManual(page, "huella", "Huella tomada en la planilla de la feria, hoja 4");
    await expect(botonEnviar(page)).toBeEnabled();
    await botonEnviar(page).click();
    await expect(page.getByTestId("radicado")).toBeVisible();

    expect(srv.posts[0]).toMatchObject({ firma: { metodo_firma: "verificacion_manual", metodo_verificacion: "huella", nota_verificacion: "Huella tomada en la planilla de la feria, hoja 4" } });
    expect(srv.subidas.map((s) => s.tipo).sort()).toEqual(["documento_frente", "documento_reverso"]);
  });

  test("subida fallida: muestra el archivo, conserva el borrador y Reintentar no crea otro registro", async ({ page }) => {
    const srv = await simularServidor(page, { adjuntosFallan: new Set(["documento_reverso"]) });
    await llegarAlResumen(page, caso("am-dos"));
    await irAFirma(page);
    await firmarEnPantalla(page);
    await botonEnviar(page).click();

    const alerta = page.getByRole("alert").filter({ hasText: "pero no se completó el envío" });
    await expect(alerta).toBeVisible({ timeout: 20_000 });
    await expect(alerta).toContainText("FV-000123");
    await expect(alerta.getByRole("listitem")).toHaveText(["Foto del reverso del documento"]);
    await expect(page.getByTestId("radicado")).toHaveCount(0);
    expect(srv.registros.size).toBe(1);
    expect((await clavesIdb(page)).some((k) => k.startsWith("borrador:"))).toBe(true);
    expect(srv.subidas.map((s) => s.tipo).sort()).toEqual(["documento_frente", "firma"]);

    // The connection recovers: same radicado, only the missing file goes up, one create call in total.
    srv.opciones.adjuntosFallan!.clear();
    srv.intentosAdjunto.length = 0;
    await botonEnviar(page).click();
    await expect(page.getByTestId("radicado")).toHaveText("FV-000123");
    expect(srv.posts).toHaveLength(1);
    expect(srv.registros.size).toBe(1);
    expect(srv.intentosAdjunto).toEqual(["documento_reverso"]);
    expect((await clavesIdb(page)).filter((k) => k.startsWith("borrador:") || k.startsWith("foto:"))).toEqual([]);
  });

  test("sin conexión al crear: mensaje claro, el borrador se conserva y se puede reintentar", async ({ page }) => {
    const srv = await simularServidor(page, { crearFalla: "red" });
    await llegarAlResumen(page, caso("cc-nombre-mayusculas"));
    await irAFirma(page);
    await firmarEnPantalla(page);
    await botonEnviar(page).click();
    const alerta = page.getByRole("alert").filter({ hasText: "No se pudo enviar el registro." });
    await expect(alerta).toContainText("No hay conexión con el servidor");
    await expect(alerta).not.toContainText("radicado");
    expect((await clavesIdb(page)).some((k) => k.startsWith("borrador:"))).toBe(true);
    srv.opciones.crearFalla = null;
    await botonEnviar(page).click();
    await expect(page.getByTestId("radicado")).toHaveText("FV-000123");
    expect(srv.registros.size).toBe(1);
  });

  test("409: el identificador ya está en uso por otro funcionario", async ({ page }) => {
    const srv = await simularServidor(page, { crearFalla: { status: 409, json: { error: "El identificador del registro ya está en uso" } } });
    await llegarAlResumen(page, caso("cc-nombre-mayusculas"));
    await irAFirma(page);
    await firmarEnPantalla(page);
    await botonEnviar(page).click();
    await expect(page.getByRole("alert").filter({ hasText: "ya está en uso" })).toBeVisible();
    expect(srv.registros.size).toBe(0);
    expect(await botonEnviar(page).isEnabled()).toBe(true);
  });

  test("doble clic: un solo registro y un solo radicado", async ({ page }) => {
    const srv = await simularServidor(page, { retardoCrear: 800 });
    await llegarAlResumen(page, caso("cc-nombre-mayusculas"));
    await irAFirma(page);
    await firmarEnPantalla(page);
    const boton = botonEnviar(page);
    await boton.dblclick();
    await boton.click({ force: true, noWaitAfter: true, timeout: 1000 }).catch(() => undefined);
    await expect(page.getByTestId("radicado")).toBeVisible();
    expect(srv.posts).toHaveLength(1);
    expect(srv.registros.size).toBe(1);
    expect(srv.completar).toHaveLength(1);
  });

  test("durante el envío se bloquea la navegación y se anuncia el progreso", async ({ page }) => {
    await simularServidor(page, { retardoCrear: 1200 });
    await llegarAlResumen(page, caso("cc-nombre-mayusculas"));
    await irAFirma(page);
    await firmarEnPantalla(page);
    await botonEnviar(page).click();
    await expect(page.getByText("Creando el registro…")).toBeVisible();
    await expect(page.getByRole("button", { name: "Atrás", exact: true })).toBeDisabled();
    await expect(page.getByRole("button", { name: "Descartar borrador", exact: true })).toBeDisabled();
    await expect(page.getByTestId("radicado")).toBeVisible();
  });

  test("editar datos después de firmar borra la firma y bloquea el envío hasta firmar de nuevo", async ({ page }) => {
    await simularServidor(page);
    await llegarAlResumen(page, caso("cc-nombre-mayusculas"));
    await irAFirma(page);
    await firmarEnPantalla(page);
    await expect(botonEnviar(page)).toBeEnabled();

    // Visiting an earlier step WITHOUT changing anything keeps the signature.
    const riel = page.getByRole("navigation", { name: "Pasos del registro" });
    await riel.getByRole("button", { name: /Inmueble y ubicación/ }).click();
    await expect(tituloPaso(page, 4)).toBeVisible();
    await riel.getByRole("button", { name: /Firma y envío/ }).click();
    await expect(page.getByText("Firma registrada.", { exact: true })).toBeVisible();
    await expect(page.getByText(/cambiaron después de firmar/)).toHaveCount(0);

    // Editing the address clears it.
    await riel.getByRole("button", { name: /Inmueble y ubicación/ }).click();
    const direccion = page.getByLabel("Dirección del inmueble", { exact: true });
    await direccion.fill("Carrera 99 # 1-23");
    await direccion.press("Tab");
    await riel.getByRole("button", { name: /Firma y envío/ }).click();
    await expect(page.getByText(/Los datos del registro cambiaron después de firmar/)).toBeVisible();
    await expect(pad(page)).toBeVisible();
    await expect(page.getByText("Firma registrada.", { exact: true })).toHaveCount(0);
    await expect(botonEnviar(page)).toBeDisabled();
    // Signing again enables it, and the notice goes away.
    await firmarEnPantalla(page);
    await expect(page.getByText(/cambiaron después de firmar/)).toHaveCount(0);
    await expect(botonEnviar(page)).toBeEnabled();
  });
});

test.describe("lista y detalle: archivos, autorización y firma", () => {
  test("la lista marca como Incompleto el registro al que le faltan archivos", async ({ page }) => {
    await simularLista(page, () => ({ json: { items: [fila(1), fila(2, { adjuntos_completos: false })], siguiente: null } }));
    await page.goto("/registros");
    const completo = page.getByRole("row").filter({ hasText: "FV-000001" });
    const incompleto = page.getByRole("row").filter({ hasText: "FV-000002" });
    await expect(incompleto).toContainText("Incompleto");
    await expect(completo).not.toContainText("Incompleto");
  });

  test("el detalle muestra versión y hora de la autorización, el método de firma y los archivos recibidos, sin imagen", async ({ page }) => {
    const d = detalle(5);
    await page.route((u) => u.pathname === `/api/registros/${uuid(5)}`, (route) =>
      route.fulfill({ json: { ...d, adjuntos_completos: false, adjuntos_presentes: 2, adjuntos_requeridos: 3 } }),
    );
    await page.goto(`/registros/${uuid(5)}`);
    const aut = page.getByRole("region", { name: "Autorización y firma", exact: true });
    await expect(aut).toContainText("Autorizado · texto 2026-10-v1");
    await expect(aut).toContainText(/05\/03\/2026,? 3:42/);
    await expect(aut.locator("dd").nth(1)).toHaveText("No autorizado");
    await expect(aut).toContainText("Dibujada en pantalla");
    await expect(page.getByRole("region", { name: "Control" })).toContainText("Incompleto (2 de 3 archivos recibidos)");
  });

  test("el detalle de una verificación manual muestra método, nota y quién la hizo", async ({ page }) => {
    const d = detalle(6);
    const firma = { metodo_firma: "verificacion_manual", firmado_en: "2026-03-05T20:42:00.000Z", metodo_verificacion: "huella", nota_verificacion: "Huella en la planilla 4", verificado_por_nombre: "Ana Funcionaria" };
    await page.route((u) => u.pathname === `/api/registros/${uuid(6)}`, (route) => route.fulfill({ json: { ...d, firma, adjuntos_requeridos: 2, adjuntos_presentes: 2 } }));
    await page.goto(`/registros/${uuid(6)}`);
    const aut = page.getByRole("region", { name: "Autorización y firma", exact: true });
    await expect(aut).toContainText("Verificación manual (Huella) por Ana Funcionaria");
    await expect(aut).toContainText("Huella en la planilla 4");
  });
});

// ---- local helpers ----

/** Steps 1-7 filled; the consent step is open and untouched. */
async function llegarAlResumenHastaConsentimiento(page: Page, c: Caso) {
  await nuevoRegistro(page);
  await avanzarHasta(page, c, PASO.consentimiento);
  await expect(tituloPaso(page, PASO.consentimiento)).toBeVisible();
}

/** From the consent step (already answered): photos, then the summary. */
async function completarDesdeConsentimiento(page: Page) {
  await siguiente(page);
  await expect(tituloPaso(page, PASO.documentos)).toBeVisible();
  await llenarPaso9(page);
  await siguiente(page);
  await expect(tituloPaso(page, PASO.resumen)).toBeVisible();
}
