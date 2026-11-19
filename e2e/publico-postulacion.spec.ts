// Public postulación form (QR target). Needs the dev server started with E2E_POSTULACION_ABIERTA=1 (dev-only switch
// override); every API call is answered by a double here, so nothing touches the real Firestore.
import { expect, test, type Page } from "@playwright/test";
import { dibujarFirma } from "./ayudas-envio";
import { entradaFoto } from "./ayudas";
import { imagenGrande, imagenPequena } from "./imagenes";

const exacto = { exact: true } as const;
const DOC = "1144555666";

async function servidor(page: Page, { existe = false } = {}) {
  const envios: Record<string, unknown>[] = [];
  await page.route("**/api/postulaciones/consulta", (r) =>
    r.fulfill({ json: existe ? { existe: true, documento: DOC, radicado: "PSE-000007", estado: "sin_validar" } : { existe: false, documento: DOC } }),
  );
  // Geocoder of the Alcaldía (shape captured from the real service): it locates street addresses, not "Avenida Norte" ones.
  await page.route("**/api/postulaciones/ubicar", async (r) => {
    const { direccion } = r.request().postDataJSON() as { direccion: string };
    const ubicada = /^calle 5 /i.test(direccion);
    await r.fulfill({
      json: {
        ubicacion: ubicada
          ? { direccion_catastral: "CL 5 # 38 - 20", id_barrio_vereda: "1908", nombre_barrio_vereda: "Santa Isabel", codigo_division: "19", estrato: 4, latitud: 3.427998, longitud: -76.545395 }
          : { direccion_catastral: "AV 5 NORTE # 5N - 02 BO CENTENARIO", id_barrio_vereda: null, nombre_barrio_vereda: null, codigo_division: null, estrato: null, latitud: null, longitud: null },
      },
    });
  });
  await page.route("**/api/postulaciones", async (r) => {
    envios.push(r.request().postDataJSON());
    await r.fulfill({ status: 201, json: { id: "00000000-0000-4000-8000-000000000001", radicado: "PSE-000008" } });
  });
  return envios;
}

async function abrir(page: Page) {
  await page.goto("/postulacion");
  const modal = page.getByRole("dialog", { name: "Nueva postulación" });
  await expect(modal).toBeVisible();
  await modal.getByLabel("Número de documento", exacto).fill(DOC);
  await modal.getByRole("button", { name: "Continuar" }).click();
}

test("an existing document only shows its radicado and status, never the form", async ({ page }) => {
  await servidor(page, { existe: true });
  await abrir(page);
  const modal = page.getByRole("dialog", { name: "Ya existe una postulación" });
  await expect(modal.getByTestId("radicado-existente")).toHaveText("PSE-000007");
  await expect(modal.getByText("Sin validar", exacto)).toBeVisible();
  await expect(page.getByRole("heading", { name: "Datos del solicitante" })).toHaveCount(0);
});

test("a new postulación goes through the 3 steps and is sent with photos, signature and normalized values", async ({ page }) => {
  const envios = await servidor(page);
  await abrir(page);
  await expect(page.getByRole("heading", { level: 2, name: "Datos del solicitante" })).toBeVisible();
  await expect(page.getByLabel("Número de documento", exacto)).toHaveValue(DOC);

  // Step 1: required fields and the photos block the next step until filled.
  await page.getByRole("button", { name: "Siguiente", ...exacto }).click();
  await expect(page.getByText("Revise los campos marcados antes de continuar.")).toBeVisible();
  await expect(page.getByText("Falta la foto del frente del documento")).toBeVisible();

  await page.getByLabel("Nombres", exacto).fill("  ana   MARÍA ");
  await page.getByLabel("Apellidos", exacto).fill("pérez gómez");
  await page.getByLabel("Apellidos", exacto).press("Tab");
  await expect(page.getByLabel("Nombres", exacto)).toHaveValue("Ana María");
  await page.getByLabel("Fecha de nacimiento", exacto).fill("15031985");
  await page.getByLabel("Teléfono o celular", exacto).fill("3001234567");
  // A barrio named in the address is used when the geocoder cannot locate it; the estrato then comes from the barrio.
  const dir = page.getByLabel("Dirección de domicilio actual", exacto);
  await dir.fill("Av 5 Norte # 5N-02, Barrio Centenario");
  await dir.press("Tab");
  await expect(page.getByText("Ubicamos la dirección en el barrio Centenario y lo seleccionamos abajo. Cámbielo si no es correcto.")).toBeVisible();
  await expect(page.getByRole("combobox", { name: "Barrio o vereda", ...exacto })).toHaveValue("Centenario");
  await expect(page.getByTestId("estrato-automatico")).toContainText("Estrato 5");
  await expect(page.getByText("Dirección catastral: AV 5 NORTE # 5N - 02 BO CENTENARIO")).toBeVisible();
  // A street address is located by the geocoder of the Alcaldía (comuna, barrio, estrato), replacing the automatic barrio.
  await dir.fill("Calle 5 # 38-20");
  await dir.press("Tab");
  await expect(page.getByText("Ubicamos la dirección en el barrio Santa Isabel (geocodificador de la Alcaldía)", { exact: false })).toBeVisible();
  await expect(page.getByRole("combobox", { name: "Comuna o corregimiento", ...exacto })).toHaveValue("Comuna 19");
  await expect(page.getByTestId("estrato-automatico")).toContainText("Estrato 4");
  await expect(page.getByRole("group", { name: "Estrato socioeconómico" })).toHaveCount(0);
  // Places are picked from the 1,122 municipios of Colombia.
  const exp = page.getByRole("combobox", { name: "Lugar de expedición", ...exacto });
  await exp.fill("cali");
  await expect(page.getByRole("listbox").getByRole("option").first()).toHaveText("Cali (Valle del Cauca)");
  await expect(page.getByRole("listbox").getByRole("option", { name: "California (Santander)" })).toBeVisible();
  await exp.press("Enter");
  await expect(exp).toHaveValue("Cali (Valle del Cauca)");
  await page.getByLabel("Ingreso mensual del solicitante", exacto).fill("$1.200.000");
  await page.getByLabel("Ingreso mensual del solicitante", exacto).press("Tab");
  await expect(page.getByLabel("Ingreso mensual del solicitante", exacto)).toHaveValue("1200000");

  // The "?" help explains a field.
  await page.getByRole("button", { name: "Ayuda: Ingreso mensual del solicitante" }).click();
  await expect(page.getByRole("note").filter({ hasText: "Lo que usted gana en un mes" })).toBeVisible();

  await entradaFoto(page, "frente").setInputFiles(await imagenPequena(page, "frente.jpg"));
  await expect(page.getByRole("img", { name: /Vista previa: frente/ })).toBeVisible();
  // A different scene: two framed pictures of the same layout count as "the same photo" (front = back check).
  await entradaFoto(page, "reverso").setInputFiles(await imagenGrande(page, "reverso.jpg"));
  await expect(page.getByRole("img", { name: /Vista previa: reverso/ })).toBeVisible();
  await page.getByRole("button", { name: "Siguiente", ...exacto }).click();

  // Step 2: two household members; a minor with C.C. is rejected; the total adds everyone.
  await expect(page.getByRole("heading", { level: 2, name: "Grupo familiar" })).toBeVisible();
  await page.getByRole("button", { name: "+ Agregar integrante" }).click();
  await page.getByLabel("Nombres y apellidos completos", exacto).fill("luis pérez");
  await page.getByLabel("Fecha de nacimiento del integrante", exacto).fill("01062015");
  await page.getByLabel("Tipo de documento (TD)", exacto).selectOption("cc");
  await page.getByLabel("Ingresos mensuales del integrante", exacto).fill("300.000");
  await page.getByRole("button", { name: "Siguiente", ...exacto }).click();
  await expect(page.getByText("Un menor de 18 años se identifica con R.C., T.I. o NUIP (M.E.)")).toBeVisible();
  await page.getByLabel("Tipo de documento (TD)", exacto).selectOption("ti");
  await expect(page.getByText("$1.500.000 COP")).toBeVisible();
  await page.getByRole("button", { name: "Siguiente", ...exacto }).click();

  // Step 3: modality 1 shows the project block; sources are picked first, then their values.
  await expect(page.getByRole("heading", { level: 2, name: "Subsidio y cierre financiero" })).toBeVisible();
  await page.getByRole("radio", { name: "Adquisición de vivienda nueva" }).check();
  await expect(page.getByRole("heading", { name: "Datos del proyecto de vivienda" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Datos de la obligación" })).toHaveCount(0);
  await page.getByRole("checkbox", { name: "Ahorro programado" }).check();
  await page.getByRole("checkbox", { name: "Cesantías" }).check();
  await page.getByLabel("Valor de ahorro programado", exacto).fill("2.000.000");
  await page.getByLabel("Valor de cesantías", exacto).fill("1,000,000");
  await expect(page.getByText("$3.000.000 COP")).toBeVisible();

  await page.getByRole("button", { name: "Enviar postulación" }).click();
  await expect(page.getByText("Debe aceptar la declaración bajo juramento para enviar la postulación")).toBeVisible();
  expect(envios).toHaveLength(0);

  await page.getByRole("checkbox", { name: "El titular autoriza el tratamiento de sus datos personales", ...exacto }).check();
  await page.getByRole("checkbox", { name: "Autoriza el tratamiento de datos sensibles", ...exacto }).check();
  await page.getByRole("checkbox", { name: /Declaro bajo la gravedad de juramento/ }).check();
  await dibujarFirma(page);
  await page.getByRole("button", { name: "Usar esta firma", ...exacto }).click();
  await expect(page.getByText("Firma registrada.", exacto)).toBeVisible();
  await page.getByRole("button", { name: "Enviar postulación" }).click();

  await expect(page.getByTestId("radicado")).toHaveText("PSE-000008");
  expect(envios).toHaveLength(1);
  const cuerpo = envios[0] as { valores: Record<string, Record<string, unknown>>; adjuntos: Record<string, string> };
  expect(Object.keys(cuerpo.adjuntos).sort()).toEqual(["documento_frente", "documento_reverso", "firma"]);
  expect(cuerpo.valores.solicitante).toMatchObject({
    nombres: "Ana María", numero_documento: DOC, ingreso_mensual: "1200000", lugar_expedicion: "76001",
    codigo_division: "19", id_barrio_vereda: "1908", estrato: "4", latitud: 3.427998, longitud: -76.545395, direccion_catastral: "CL 5 # 38 - 20",
  });
  expect(cuerpo.valores.postulacion).toMatchObject({ modalidad: "1", fuentes: ["ahorro_programado", "cesantias"] });
  expect((cuerpo.valores.postulacion.recursos as Record<string, { valor: string }>).cesantias.valor).toBe("1000000");
  expect(cuerpo.valores.firma).toEqual({ metodo_firma: "dibujada" });
  expect(cuerpo.valores.documentos).toBeUndefined();
});
