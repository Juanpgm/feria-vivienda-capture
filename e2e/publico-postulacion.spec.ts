// Public postulación form (QR target). Needs the dev server started with E2E_POSTULACION_ABIERTA=1 (dev-only switch
// override); every API call is answered by a double here, so nothing touches the real Firestore.
import { expect, test, type Page } from "@playwright/test";
import { dibujarFirma } from "./ayudas-envio";
import { entradaFoto } from "./ayudas";
import { imagenGrande, imagenPequena } from "./imagenes";
import { combo, responder, varias } from "./ayudas-postulacion";

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
    await new Promise((ok) => setTimeout(ok, 700)); // the real service takes a moment: the form must say it is searching
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

test("a document already listed as a member of another household cannot apply", async ({ page }) => {
  await page.route("**/api/postulaciones/consulta", (r) => r.fulfill({ json: { existe: false, documento: DOC, integrante: true } }));
  await page.goto("/postulacion");
  const modal = page.getByRole("dialog", { name: "Nueva postulación" });
  await modal.getByLabel("Número de documento", exacto).fill(DOC);
  await modal.getByRole("button", { name: "Continuar" }).click();
  const aviso = page.getByRole("dialog", { name: "Ya hace parte de otra postulación" });
  await expect(aviso.getByText(/ya está registrado como integrante del grupo familiar de otra postulación/)).toBeVisible();
  await expect(aviso.getByRole("link")).toHaveCount(0); // the public does not learn which postulación
  await expect(page.getByRole("heading", { name: "Datos del solicitante" })).toHaveCount(0);
});

test("a QR code that is not valid is refused where the QR lands", async ({ page }) => {
  await page.goto("/postulacion/ingreso?t=1700000000.1.AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA");
  await page.waitForURL((u) => u.pathname === "/postulacion" && u.searchParams.get("acceso") === "invalido");
});

test("a new postulación goes through the 3 steps and is sent with photos, signature and normalized values", async ({ page }) => {
  const envios = await servidor(page);
  await abrir(page);
  await expect(page.getByRole("heading", { level: 2, name: "Datos del solicitante" })).toBeVisible();

  // The authorization comes first: without it nothing else is asked and the step cannot be passed.
  await expect(page.getByLabel("Nombres", exacto)).toHaveCount(0);
  await expect(page.getByText("Para continuar con el registro debe autorizar el tratamiento de sus datos personales y de sus datos sensibles.")).toBeVisible();
  await page.getByRole("button", { name: "Siguiente", ...exacto }).click();
  await expect(page.getByRole("heading", { level: 2, name: "Datos del solicitante" })).toBeVisible();
  // The policy text is folded; it opens on demand.
  await expect(page.getByText("Quién es el responsable de sus datos")).toBeHidden();
  await page.getByText("Ver la política de tratamiento de datos personales").click();
  await expect(page.getByText("Quién es el responsable de sus datos")).toBeVisible();
  await page.getByRole("checkbox", { name: "El titular autoriza el tratamiento de sus datos personales", ...exacto }).check();
  await expect(page.getByLabel("Nombres", exacto)).toHaveCount(0); // sensitive data authorization is required too
  await page.getByRole("checkbox", { name: "Autoriza el tratamiento de datos sensibles", ...exacto }).check();
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
  const comuna = page.getByRole("combobox", { name: "Comuna o corregimiento", ...exacto });
  // Without an address there is nothing to choose: comuna, barrio and estrato stay hidden.
  await expect(comuna).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "Estrato", ...exacto })).toHaveCount(0);
  // An address that cannot be located shows them, to be filled by hand.
  await dir.fill("Carrera 99 # 9-99");
  await expect(page.getByTestId("aviso-ubicacion")).toContainText("No pudimos ubicar la dirección");
  await expect(comuna).toBeVisible();
  // Erasing the address hides them again.
  await dir.fill("");
  await expect(comuna).toHaveCount(0);
  await expect(page.getByTestId("aviso-ubicacion")).toHaveCount(0);
  // Searched as soon as the person stops typing (no need to leave the field), with a visible notice meanwhile.
  await dir.fill("Av 5 Norte # 5N-02, Barrio Centenario");
  await expect(page.getByTestId("aviso-ubicacion")).toHaveText(/Buscando la comuna y el barrio de esta dirección/);
  // Flagged by the earlier empty "Siguiente", they stay visible but locked while the search runs.
  await expect(comuna).toBeDisabled();
  await expect(page.getByTestId("aviso-ubicacion")).toHaveText("Ubicamos la dirección en el barrio Centenario (barrio escrito en la dirección) y lo seleccionamos abajo. Cámbielo si no es correcto.");
  await expect(dir).toBeFocused();
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
  // A barrio chosen by hand is never replaced: a different result is offered with a button.
  const barrio = page.getByRole("combobox", { name: "Barrio o vereda", ...exacto });
  await barrio.fill("Bellavista");
  await expect(page.getByRole("listbox").getByRole("option").first()).toBeVisible();
  await barrio.press("Enter");
  await page.getByRole("button", { name: "Buscar ubicación" }).click();
  await expect(page.getByTestId("aviso-ubicacion")).toContainText("Según la dirección, el barrio es Santa Isabel (geocodificador de la Alcaldía), pero usted eligió otro.");
  await expect(barrio).not.toHaveValue("Santa Isabel");
  await page.getByRole("button", { name: "Usar Santa Isabel" }).click();
  await expect(barrio).toHaveValue("Santa Isabel");
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

  // Every titular field is required (decision 2026-11-19).
  await page.getByRole("button", { name: "Siguiente", ...exacto }).click();
  await expect(page.getByText("Ingrese su correo electrónico")).toBeVisible();
  await page.getByLabel("Fecha de expedición", exacto).fill("01042003");
  await combo(page, "Lugar de nacimiento", "cali");
  await page.getByLabel("Género", exacto).selectOption("cis_femenino");
  await page.getByLabel("Correo electrónico", exacto).fill("ana.perez@correo.com");
  await responder(page, /artículo 56 de la Ley 1437/, "Sí");
  await page.getByLabel("Tiempo de residencia en Cali (años)", exacto).fill("20");
  await page.getByLabel("Ocupación", exacto).selectOption("independiente");
  await responder(page, "¿Está afiliado a una caja de compensación?", "No");
  await responder(page, "¿Está afiliado al Sisbén?", "No");
  await varias(page, "Condición especial del solicitante", ["Ninguna"]);
  await page.getByRole("button", { name: "Siguiente", ...exacto }).click();

  // Step 2: two household members; a minor with C.C. is rejected; the total adds everyone.
  await expect(page.getByRole("heading", { level: 2, name: "Grupo familiar" })).toBeVisible();
  await page.getByRole("button", { name: "+ Agregar integrante" }).click();
  await page.getByLabel("Nombres y apellidos completos", exacto).fill("luis pérez");
  await page.getByLabel("Fecha de nacimiento del integrante", exacto).fill("01062015");
  await page.getByLabel("Tipo de documento (TD)", exacto).selectOption("cc");
  await page.getByLabel("Ingresos mensuales del integrante", exacto).fill("300.000");
  // A spouse is married or in a marital union (fixed); heterosexual is not a gender identity; conditions are multiple.
  await page.getByLabel("Parentesco con el jefe del hogar", exacto).selectOption("conyuge");
  await expect(page.getByLabel("Estado civil", exacto)).toHaveValue("casado_union");
  await expect(page.getByLabel("Estado civil", exacto)).toBeDisabled();
  await page.getByLabel("Parentesco con el jefe del hogar", exacto).selectOption("hijo");
  await expect(page.getByLabel("Estado civil", exacto)).toBeEnabled();
  await expect(page.getByLabel("Identidad de género", exacto).locator("option", { hasText: "Heterosexual" })).toHaveCount(0);
  // Every member field is required too (no phone or email for members).
  await page.getByRole("button", { name: "Siguiente", ...exacto }).click();
  await expect(page.getByText("Ingrese el número de documento")).toBeVisible();
  await expect(page.getByLabel("Teléfono o celular", exacto)).toHaveCount(0);
  await page.getByLabel("Número de documento del integrante", exacto).fill("1100000001");
  await page.getByLabel("Estado civil", exacto).selectOption("soltero");
  await page.getByLabel("Ocupación del integrante", exacto).selectOption("estudiante");
  await page.getByLabel("Identidad de género", exacto).selectOption("cis_masculino");
  await varias(page, "Condición especial del integrante", ["Persona con discapacidad", "Población joven"]);
  await page.getByRole("button", { name: "Siguiente", ...exacto }).click();
  await expect(page.getByText("Un menor de 18 años se identifica con R.C., T.I. o NUIP (M.E.)")).toBeVisible();
  await page.getByLabel("Tipo de documento (TD)", exacto).selectOption("ti");
  await expect(page.getByRole("status").filter({ hasText: "Total ingresos del grupo familiar" })).toContainText("$1.500.000 COP");
  await page.getByRole("button", { name: "Siguiente", ...exacto }).click();

  // Step 3: modality 1 shows the project block; sources are picked first, then their values.
  await expect(page.getByRole("heading", { level: 2, name: "Subsidio y cierre financiero" })).toBeVisible();
  await page.getByRole("radio", { name: "Adquisición de vivienda nueva" }).check();
  await expect(page.getByRole("heading", { name: "Datos del proyecto de vivienda" })).toBeVisible();
  // First the project type; only the value of the chosen type is shown (the other one is stored as 0).
  const vis = page.getByLabel("Valor de la solución de vivienda VIS", exacto);
  const vip = page.getByLabel("Valor de la solución de vivienda VIP", exacto);
  await expect(vis).toHaveCount(0);
  await expect(vip).toHaveCount(0);
  await page.getByText("VIP (vivienda de interés prioritario)", exacto).click();
  await expect(vip).toBeVisible();
  await expect(vis).toHaveCount(0);
  // Switching type does not leave the 0 of the other choice in the field.
  await page.getByText("VIS (vivienda de interés social)", exacto).click();
  await expect(vis).toHaveValue("");
  await expect(vip).toHaveCount(0);
  await page.getByText("VIP (vivienda de interés prioritario)", exacto).click();
  await vip.fill("95.000.000");
  await expect(page.getByRole("heading", { name: "Datos de la obligación" })).toHaveCount(0);
  await page.getByRole("checkbox", { name: "Ahorro programado" }).check();
  await page.getByRole("checkbox", { name: "Cesantías" }).check();
  await page.getByLabel("Valor de ahorro programado", exacto).fill("2.000.000");
  await page.getByLabel("Valor de cesantías", exacto).fill("1,000,000");
  // Entities are picked from the official list (Superfinanciera / cajas de compensación) of the right kind.
  const banco = page.getByRole("combobox", { name: "Entidad financiera (ahorro programado)", ...exacto });
  await banco.fill("bancol");
  await expect(page.getByRole("listbox").getByRole("option", { name: "Bancolombia" })).toBeVisible();
  await banco.press("Enter");
  await expect(banco).toHaveValue("Bancolombia");
  const fondo = page.getByRole("combobox", { name: "Fondo de cesantías (cesantías)", ...exacto });
  await fondo.fill("porv");
  await expect(page.getByRole("listbox").getByRole("option").first()).toHaveText("Porvenir (fondo de pensiones y cesantías)");
  await fondo.fill("bancolombia");
  await expect(page.getByRole("listbox").getByRole("option", { name: "Bancolombia" })).toHaveCount(0); // a bank is not a fondo de cesantías
  // Not listed: "Otra entidad" lets the name be typed.
  await fondo.fill("otra entidad");
  await page.getByRole("listbox").getByRole("option", { name: "Otra entidad (escribir el nombre)" }).click();
  await page.getByLabel("Fondo de cesantías (cesantías)", exacto).fill("Fondo de empleados XYZ");
  await expect(page.getByRole("status").filter({ hasText: "Total aportes del hogar" })).toContainText("$3.000.000 COP");

  await page.getByRole("button", { name: "Enviar postulación" }).click();
  await expect(page.getByText("Debe aceptar la declaración bajo juramento para enviar la postulación")).toBeVisible();
  expect(envios).toHaveLength(0);

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
  expect(cuerpo.valores.postulacion).toMatchObject({ modalidad: "1", fuentes: ["ahorro_programado", "cesantias"], tipo_vivienda: "vip", valor_vis: "0", valor_vip: "95000000" });
  expect((cuerpo.valores.postulacion.recursos as Record<string, { entidad: string }>).ahorro_programado.entidad).toBe("Bancolombia");
  expect((cuerpo.valores.postulacion.recursos as Record<string, { entidad: string }>).cesantias.entidad).toBe("Fondo de empleados XYZ");
  expect((cuerpo.valores.postulacion.recursos as Record<string, { valor: string }>).cesantias.valor).toBe("1000000");
  expect(cuerpo.valores.firma).toEqual({ metodo_firma: "dibujada", origen: "pantalla" });
  // Next steps: stay on site for the in-person validation, or the registration will not count.
  await expect(page.getByRole("heading", { name: "Siguientes pasos" })).toBeVisible();
  await expect(page.getByText("Si no se presenta al llamado, su registro no será validado y no contará dentro de la postulación.")).toBeVisible();
  // The receipt carries the QR of this postulación (no link shown).
  await expect(page.getByTestId("qr-postulacion")).toBeVisible();
  await expect(page.getByRole("link", { name: "Guardar código QR" })).toHaveAttribute("download", "postulacion-PSE-000008.png");
  await expect(page.getByText("/postulacion/estado/")).toHaveCount(0);
  expect(cuerpo.valores.documentos).toBeUndefined();
});

for (const [nombre, vp] of [["laptop baja", { width: 1280, height: 640 }], ["celular pequeño", { width: 360, height: 600 }]] as const) {
  test(`the entry modal fits a short screen (${nombre}): Continuar is visible and works with a click`, async ({ page }) => {
    await page.setViewportSize(vp);
    await servidor(page);
    await page.goto("/postulacion");
    const modal = page.getByRole("dialog", { name: "Nueva postulación" });
    await modal.getByLabel("Número de documento", exacto).fill(DOC);
    const continuar = modal.getByRole("button", { name: "Continuar" });
    await expect(continuar).toBeInViewport({ ratio: 1 });
    await continuar.click();
    await expect(page.getByRole("heading", { level: 2, name: "Datos del solicitante" })).toBeVisible();
  });
}
