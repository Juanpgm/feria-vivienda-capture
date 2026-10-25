import { expect, type Page } from "@playwright/test";
import { BANDAS_ADULTO_MAYOR, BANDAS_HOGAR, CONDICIONES_ESPECIALES, DICTAMENES, EXCEPCIONES_UNICA_PROPIEDAD, FUENTES_FINANCIACION, TITULARIDADES } from "../src/shared/constantes";
import { fechaBogota } from "../src/shared/tiempo";
import { parsePhoneNumberFromString } from "libphonenumber-js/min";
import { type Caso, type CasoInvalido, condicionesFinales, ETIQUETA_RANGO, type PaisTel } from "./datos-prueba";

export const ETIQUETAS_NOMBRE = ["Primer nombre", "Segundo nombre (opcional)", "Primer apellido", "Segundo apellido (opcional)"] as const;

export const HOY = fechaBogota();
const RUTA = process.env.E2E_RUTA_NUEVO ?? "/registros/nuevo";

export const TITULO_PASO = {
  1: "Datos del hogar",
  2: "Composición familiar",
  3: "Especial protección constitucional",
  4: "Inmueble y ubicación",
  5: "Riesgo y dictamen técnico",
  6: "Titularidad",
  7: "Cierre financiero",
  8: "Resumen",
} as const;
export type NumeroPaso = keyof typeof TITULO_PASO;

const exacto = { exact: true } as const;

/** The duplicate check reads the real Firestore: every spec that fills step 1 answers it locally instead (override with a later page.route). */
export const sinDuplicados = (page: Page) =>
  page.route("**/api/registros/duplicado*", (route) => route.fulfill({ json: { existe: false } }));

/** Opens /registros/nuevo (the list of drafts) and checks the session reached it. */
export async function abrirLista(page: Page) {
  await sinDuplicados(page);
  await page.goto(RUTA);
  const { pathname } = new URL(page.url());
  if (pathname !== RUTA) {
    throw new Error(
      `La sesión guardada no permite abrir ${RUTA} (quedó en ${pathname}). ` +
        "Vuelva a ejecutar `npm run e2e:login` con un usuario aprobado.",
    );
  }
  await expect(page.getByRole("heading", { level: 2, name: "Borradores en curso" })).toBeVisible();
}

/** Starts a NEW draft from the list ("Nuevo registro" creates a fresh UUID); the browser context starts with empty IndexedDB. */
export async function nuevoDesdeLista(page: Page) {
  await page.getByRole("button", { name: "Nuevo registro", exact: true }).click();
  await expect(page).toHaveURL(/\/registros\/nuevo\?borrador=[0-9a-f-]{36}$/);
  await expect(page.getByRole("heading", { level: 2, name: TITULO_PASO[1] })).toBeVisible();
  await expect(page.getByRole("status")).toContainText("Sin cambios por guardar");
  await expect(page.getByLabel("Primer nombre", exacto)).toHaveValue("");
}

export async function nuevoRegistro(page: Page) {
  await abrirLista(page);
  await nuevoDesdeLista(page);
}

/** Types like a person: fill, then Tab so blur normalization runs. */
async function escribir(page: Page, etiqueta: string, valor: string | undefined) {
  if (!valor) return;
  const campo = page.getByLabel(etiqueta, exacto);
  await campo.fill(valor);
  await campo.press("Tab");
}

/** Dates are typed as digits only (the field adds the slashes); a literal "DD/MM/AAAA" is typed as given. */
export const digitosDeFecha = (valor: string) => (/^\d{4}-\d{2}-\d{2}$/.test(valor) ? valor.split("-").reverse().join("") : valor);
export const fechaMascara = (iso: string) => iso.split("-").reverse().join("/");

async function escribirFecha(page: Page, etiqueta: string, valor: string | undefined) {
  if (!valor) return;
  const campo = page.getByLabel(etiqueta, exacto);
  await campo.fill(digitosDeFecha(valor));
  await campo.press("Tab");
}

const selectorPais = (page: Page, alterno: boolean) =>
  page.getByRole("combobox", { name: alterno ? "Código de país del teléfono alterno" : "Código de país del teléfono principal", ...exacto });

/** Picks a country in the code selector by typing its Spanish name. */
async function elegirPais(page: Page, alterno: boolean, pais: PaisTel) {
  const combo = selectorPais(page, alterno);
  await combo.fill(pais.nombre);
  await combo.press("Enter");
  await combo.press("Tab");
  await expect(combo).toHaveValue(new RegExp(`\\+${pais.codigo}$`));
}

async function escribirTelefono(page: Page, alterno: boolean, valor: string | undefined, pais: PaisTel | undefined) {
  if (pais) await elegirPais(page, alterno, pais);
  await escribir(page, alterno ? "Teléfono alterno (opcional)" : "Teléfono principal", valor);
}

export async function llenarPaso1(page: Page, c: Pick<Caso, "solicitante"> | Pick<CasoInvalido, "solicitante">) {
  const s = c.solicitante;
  for (const [i, etiqueta] of ETIQUETAS_NOMBRE.entries()) await escribir(page, etiqueta, s.nombres[i]);
  const tipos = { cc: "C.C.", ce: "C.E.", otro: "Otro" } as const;
  await page.getByRole("group", { name: "Tipo de documento" }).getByRole("radio", { name: tipos[s.tipoDocumento], ...exacto }).check();
  if (s.tipoDocumento === "otro") await escribir(page, "Cuál documento", s.tipoDocumentoOtro);
  const nacionalidad = page.getByRole("combobox", { name: "Nacionalidad", ...exacto });
  if (s.tipoDocumento === "cc") {
    await expect(nacionalidad).toBeDisabled();
  } else {
    await nacionalidad.fill(s.nacionalidad.nombre);
    await nacionalidad.press("Enter");
    await nacionalidad.press("Tab");
  }
  await escribir(page, "Número de documento", s.documento);
  await escribirFecha(page, "Fecha de expedición", s.expedicion);
  await escribirTelefono(page, false, s.telefono1, s.codigoPais1);
  await escribirTelefono(page, true, s.telefono2, s.codigoPais2);
  await escribir(page, "Correo electrónico", s.correo);
  await escribirFecha(page, "Fecha de nacimiento", s.nacimiento);
  await page.getByLabel("Estado civil", exacto).selectOption(s.estadoCivil);
  await escribir(page, "Años de residencia", s.aniosResidencia);
}

/** The selector shows +<code> and the field the national digits of the stored E.164 number. */
async function verificarTelefono(page: Page, alterno: boolean, e164: string) {
  const p = parsePhoneNumberFromString(e164)!;
  await expect(selectorPais(page, alterno)).toHaveValue(new RegExp(`\\+${p.countryCallingCode}$`));
  await expect(page.getByLabel(alterno ? "Teléfono alterno (opcional)" : "Teléfono principal", exacto)).toHaveValue(p.nationalNumber);
}

/** What the person sees after blur: normalized text and derived hints. */
export async function verificarPaso1(page: Page, c: Caso) {
  const e = c.esperado;
  for (const [i, etiqueta] of ETIQUETAS_NOMBRE.entries()) await expect(page.getByLabel(etiqueta, exacto)).toHaveValue(e.nombres[i]);
  await expect(page.getByLabel("Número de documento", exacto)).toHaveValue(e.documento);
  await verificarTelefono(page, false, e.telefono1);
  if (e.telefono2) await verificarTelefono(page, true, e.telefono2);
  await expect(page.getByLabel("Fecha de nacimiento", exacto)).toHaveValue(fechaMascara(c.solicitante.nacimiento));
  await expect(page.getByLabel("Fecha de expedición", exacto)).toHaveValue(fechaMascara(c.solicitante.expedicion));
  await expect(page.getByLabel("Correo electrónico", exacto)).toHaveValue(e.correo);
  await expect(page.getByLabel("Años de residencia", exacto)).toHaveValue(e.anios);
  await expect(page.getByRole("combobox", { name: "Nacionalidad", ...exacto })).toHaveValue(e.nacionalidad);
  await expect(page.getByText(`Edad: ${e.edad} años`)).toBeVisible();
}

export async function llenarPaso2(page: Page, c: Pick<Caso, "composicion"> | Pick<CasoInvalido, "composicion">) {
  const k = c.composicion;
  await escribir(page, "Personas que viven en el hogar", k.personas);
  if (k.adultoMayor) {
    await page
      .getByRole("group", { name: "¿Hay adultos mayores en el hogar?" })
      .getByRole("radio", { name: k.adultoMayor === "si" ? "Sí" : "No", ...exacto })
      .check();
  }
  if (k.adultoMayor === "si" && k.edades.length) {
    await escribir(page, "Cuántos adultos mayores", String(k.edades.length));
    for (const [i, edad] of k.edades.entries()) await escribir(page, `Edad del adulto mayor ${i + 1}`, edad);
  }
  await escribir(page, "Ingreso mensual del hogar (COP)", k.ingreso);
}

export async function verificarPaso2(page: Page, c: Caso) {
  const e = c.esperado;
  // Digits only: the thousands separator depends on the browser ICU data.
  const ingreso = page.getByLabel("Ingreso mensual del hogar (COP)", exacto);
  await expect.poll(async () => (await ingreso.inputValue()).replace(/\D/g, "")).toBe(String(e.ingresoCop));
  await expect(page.getByText(ETIQUETA_RANGO[e.rango], { exact: false })).toBeVisible();
}

/** Opens a multi-select dropdown and toggles each option in order (the list stays open), then closes it. */
async function elegirVarias(page: Page, nombre: string, etiquetas: string[]) {
  if (!etiquetas.length) return;
  const combo = page.getByRole("combobox", { name: nombre, ...exacto });
  await combo.click();
  for (const e of etiquetas) await page.getByRole("option", { name: e, ...exacto }).click();
  await combo.press("Escape");
}

/** Chip of a selected multi-select option (removable button). */
export const chip = (page: Page, etiqueta: string) => page.getByRole("button", { name: `Quitar ${etiqueta}`, ...exacto });

export const CAMPO_CONDICIONES = "Condiciones del solicitante o su hogar";
export const CAMPO_FUENTES = "Fuentes de financiación";

export async function llenarPaso3(page: Page, c: Pick<Caso, "composicion"> | Pick<CasoInvalido, "composicion">) {
  await elegirVarias(page, CAMPO_CONDICIONES, c.composicion.condiciones.map((k) => CONDICIONES_ESPECIALES[k as keyof typeof CONDICIONES_ESPECIALES]));
}

export async function verificarPaso3(page: Page, c: Caso) {
  for (const [codigo, etiqueta] of Object.entries(CONDICIONES_ESPECIALES)) {
    if (c.esperado.condicionesFinales.includes(codigo)) await expect(chip(page, etiqueta)).toBeVisible();
    else await expect(chip(page, etiqueta)).toHaveCount(0);
  }
}

const grupo = (page: Page, nombre: string) => page.getByRole("group", { name: nombre, ...exacto });

/** Picks an option of a searchable combobox by typing it and pressing Enter. */
async function elegirEnCombobox(page: Page, nombre: string, texto: string) {
  const combo = page.getByRole("combobox", { name: nombre, ...exacto });
  await combo.fill(texto);
  await combo.press("Enter");
  await combo.press("Tab");
}

export async function llenarPaso4(page: Page, c: Pick<Caso, "extra"> | Pick<CasoInvalido, "extra">) {
  const v = c.extra.vivienda;
  await escribir(page, "Dirección del inmueble", v.direccion);
  if (v.division) await elegirEnCombobox(page, "Comuna o corregimiento", v.division.etiqueta);
  const rural = v.division?.sector === "Rural";
  if (v.lugar) {
    await elegirEnCombobox(page, rural ? "Vereda" : "Barrio o vereda", v.lugar.nombre);
  }
  if (v.estrato) await grupo(page, "Estrato socioeconómico").getByRole("radio", { name: String(v.estrato), ...exacto }).check();
}

export async function verificarPaso4(page: Page, c: Caso) {
  const v = c.extra.vivienda;
  await expect(page.getByRole("combobox", { name: "Comuna o corregimiento", ...exacto })).toHaveValue(v.division!.etiqueta);
  await expect(page.getByText(`Sector: ${v.division!.sector}`, exacto)).toBeVisible();
  await expect(page.getByRole("combobox", { name: v.division!.sector === "Rural" ? "Vereda" : "Barrio o vereda", ...exacto })).toHaveValue(v.lugar!.nombre);
  await expect(grupo(page, "Estrato socioeconómico").getByRole("radio", { name: String(v.estrato), ...exacto })).toBeChecked();
}

export async function llenarPaso5(page: Page, c: Pick<Caso, "extra"> | Pick<CasoInvalido, "extra">) {
  const r = c.extra.riesgo;
  if (r.rud) await grupo(page, "¿Está registrado en el RUD?").getByRole("radio", { name: r.rud === "si" ? "Sí" : "No", ...exacto }).check();
  if (r.rud === "si") {
    if (r.noSabe) await page.getByRole("checkbox", { name: "No lo sé", ...exacto }).check();
    else await escribir(page, "Número de RUD", r.numero);
  }
  if (r.dictamen) await page.getByLabel("Resultado del dictamen técnico", exacto).selectOption({ label: DICTAMENES[r.dictamen] });
  if (r.dictamen === "otro") await escribir(page, "Cuál dictamen", r.dictamenOtro);
}

export async function llenarPaso6(page: Page, c: Pick<Caso, "extra"> | Pick<CasoInvalido, "extra">) {
  const t = c.extra.titularidad;
  if (t.tipo) await grupo(page, "El solicitante es").getByRole("radio", { name: TITULARIDADES[t.tipo], ...exacto }).check();
  await escribir(page, "Número de matrícula (opcional)", t.matricula);
  if (t.unica) await grupo(page, "¿Es su única propiedad residencial?").getByRole("radio", { name: t.unica === "si" ? "Sí" : "No", ...exacto }).check();
  if (t.unica === "no" && t.excepcion) {
    await page.getByLabel("Excepción que aplica", exacto).selectOption({ label: EXCEPCIONES_UNICA_PROPIEDAD[t.excepcion] });
  }
}

export async function llenarPaso7(page: Page, c: Pick<Caso, "extra"> | Pick<CasoInvalido, "extra">) {
  const f = c.extra.financiero;
  await elegirVarias(page, CAMPO_FUENTES, f.fuentes.map((k) => FUENTES_FINANCIACION[k as keyof typeof FUENTES_FINANCIACION]));
  if (f.seguro) await grupo(page, "¿El inmueble tenía seguro?").getByRole("radio", { name: f.seguro === "si" ? "Sí" : "No", ...exacto }).check();
  if (f.seguro === "si" && f.aseguradora) await elegirEnCombobox(page, "Aseguradora", f.aseguradora.nombre);
  if (f.aseguradora?.codigo === "otra") await escribir(page, "Nombre de la aseguradora", f.aseguradoraOtra);
  await escribir(page, "Observaciones (opcional)", f.observaciones);
}

/** Fills steps 1..hasta with the dataset and advances after each one (the target step stays open). */
export async function avanzarHasta(page: Page, c: Caso | CasoInvalido, hasta: NumeroPaso) {
  const llenar = [llenarPaso1, llenarPaso2, llenarPaso3, llenarPaso4, llenarPaso5, llenarPaso6, llenarPaso7] as const;
  for (let n = 1; n < hasta; n++) {
    await llenar[n - 1](page, c);
    await siguiente(page);
    await expect(tituloPaso(page, (n + 1) as NumeroPaso)).toBeVisible();
  }
}

/** Seccion of the summary (a labelled region) as a locator. */
const seccionResumen = (page: Page, titulo: string) => page.getByRole("region", { name: titulo, ...exacto });

export async function verificarResumen(page: Page, c: Caso) {
  const e = c.esperado;
  const x = c.extra;
  await expect(tituloPaso(page, 8)).toBeVisible();
  await expect(page.getByText("Los datos de los pasos anteriores están completos.")).toBeVisible();

  const hogar = seccionResumen(page, "Datos del hogar");
  await expect(hogar).toContainText(e.nombre);
  await expect(hogar).toContainText(e.documento);
  await expect(hogar).toContainText(e.nacionalidad);
  await expect(hogar).toContainText(e.telefono1);
  await expect(hogar).toContainText(e.correo);
  await expect(hogar).toContainText(`(${e.edad} años)`);

  const comp = seccionResumen(page, "Composición familiar");
  const ingreso = comp.locator("dd").filter({ hasText: ETIQUETA_RANGO[e.rango] });
  await expect(ingreso).toBeVisible();
  expect((await ingreso.innerText()).replace(/\D/g, "")).toContain(String(e.ingresoCop));
  await expect(comp).toContainText(BANDAS_HOGAR[e.bandaHogar]);
  await expect(comp).toContainText(BANDAS_ADULTO_MAYOR[e.bandaAdultoMayor]);
  for (const cod of e.condicionesFinales) await expect(comp).toContainText(CONDICIONES_ESPECIALES[cod as keyof typeof CONDICIONES_ESPECIALES]);

  const inm = seccionResumen(page, "Inmueble y ubicación");
  await expect(inm.locator("dd").filter({ hasText: /^(Urbano|Rural)$/ })).toHaveText(x.vivienda.division!.sector);
  await expect(inm).toContainText(x.vivienda.lugar!.nombre);
  await expect(inm).toContainText(String(x.vivienda.estrato));
  await expect(inm).toContainText(x.vivienda.division!.etiqueta.replace(/^Corregimiento /, ""));

  const ries = seccionResumen(page, "Riesgo y dictamen técnico");
  await expect(ries).toContainText(x.riesgo.dictamen === "otro" ? `Otro: ${x.riesgo.dictamenOtro}` : DICTAMENES[x.riesgo.dictamen!]);
  await expect(ries.locator("dd").first()).toHaveText(x.riesgo.rud === "no" ? "No" : x.riesgo.noSabe ? "Sí, no sabe el número" : `Sí, número ${x.riesgo.numero}`);

  const tit = seccionResumen(page, "Titularidad");
  await expect(tit).toContainText(TITULARIDADES[x.titularidad.tipo!]);
  await expect(tit).toContainText(x.titularidad.matricula || "No registrada");
  await expect(tit).toContainText(
    x.titularidad.unica === "si" ? "Sí" : `No. Excepción: ${EXCEPCIONES_UNICA_PROPIEDAD[x.titularidad.excepcion!]}`,
  );

  const fin = seccionResumen(page, "Cierre financiero");
  for (const cod of condicionesFinales(x.financiero.fuentes)) await expect(fin).toContainText(FUENTES_FINANCIACION[cod as keyof typeof FUENTES_FINANCIACION]);
  await expect(fin.locator("dd").nth(1)).toHaveText(
    x.financiero.seguro === "no" ? "No" : `Sí, ${x.financiero.aseguradoraOtra ?? x.financiero.aseguradora!.nombre}`,
  );
  await expect(fin.locator("dd").last()).toHaveText(e.observaciones ? e.observaciones.replace(/\s+/g, " ") : "Sin observaciones");

  // Phase 3 requirements are listed as pending and there is no submit yet.
  const pendiente = seccionResumen(page, "Pendiente para poder enviar");
  await expect(pendiente).toContainText("Firma del solicitante");
  await expect(page.getByRole("button", { name: /enviar/i })).toHaveCount(0);
}

export const siguiente = (page: Page) => page.getByRole("button", { name: "Siguiente", ...exacto }).click();
export const tituloPaso = (page: Page, n: NumeroPaso) => page.getByRole("heading", { level: 2, name: TITULO_PASO[n] });
