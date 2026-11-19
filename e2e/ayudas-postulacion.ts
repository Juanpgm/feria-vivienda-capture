// Fills the postulación form like a person would. Every titular and member field is required (decision 2026-11-19),
// so these helpers fill all of them; the address is located by the geocoder (real or mocked by the spec).
import { expect, type Page } from "@playwright/test";
import { entradaFoto } from "./ayudas";
import { imagenGrande, imagenPequena } from "./imagenes";

const ex = { exact: true } as const;

/** Searchable single select: type, wait for the list, pick the first match. */
export async function combo(page: Page, nombre: string, texto: string) {
  const c = page.getByRole("combobox", { name: nombre, ...ex });
  await page.mouse.move(0, 0);
  await c.fill(texto);
  await expect(page.getByRole("listbox").getByRole("option").first()).toBeVisible();
  await c.press("Enter");
  await c.press("Tab");
}

/** Multi-select: open it, toggle each option, close it. */
export async function varias(page: Page, nombre: string, etiquetas: string[]) {
  const c = page.getByRole("combobox", { name: nombre, ...ex });
  await c.click();
  for (const e of etiquetas) await page.getByRole("option", { name: e, ...ex }).click();
  await c.press("Escape");
}

/** Segmented / radio answer inside a named group. */
export const responder = (page: Page, grupo: string | RegExp, opcion: string) => page.getByRole("group", { name: grupo }).getByText(opcion, ex).click();

export async function autorizar(page: Page) {
  await page.getByRole("checkbox", { name: "El titular autoriza el tratamiento de sus datos personales", ...ex }).check();
  await page.getByRole("checkbox", { name: "Autoriza el tratamiento de datos sensibles", ...ex }).check();
}

/**
 * All titular data of step 1 (after the authorization). `direccion` must be one the geocoder locates, so comuna,
 * barrio and estrato are filled in automatically.
 */
export async function llenarTitular(page: Page, o: { nombres?: string; apellidos?: string; direccion?: string; ingreso?: string } = {}) {
  await page.getByLabel("Nombres", ex).fill(o.nombres ?? "Ana María");
  await page.getByLabel("Apellidos", ex).fill(o.apellidos ?? "Pérez Gómez");
  await combo(page, "Lugar de expedición", "cali");
  await page.getByLabel("Fecha de expedición", ex).fill("01042003");
  await page.getByLabel("Fecha de nacimiento", ex).fill("15031985");
  await combo(page, "Lugar de nacimiento", "cali");
  await page.getByLabel("Género", ex).selectOption("cis_femenino");
  await page.getByLabel("Teléfono o celular", ex).fill("3001234567");
  await page.getByLabel("Correo electrónico", ex).fill("ana.perez@correo.com");
  await responder(page, /artículo 56 de la Ley 1437/, "Sí");
  const dir = page.getByLabel("Dirección de domicilio actual", ex);
  await dir.fill(o.direccion ?? "Calle 5 # 38-20");
  await expect(page.getByTestId("estrato-automatico")).toBeVisible({ timeout: 20_000 });
  await page.getByLabel("Tiempo de residencia en Cali (años)", ex).fill("20");
  await page.getByLabel("Ocupación", ex).selectOption("independiente");
  await page.getByLabel("Ingreso mensual del solicitante", ex).fill(o.ingreso ?? "1200000");
  await responder(page, "¿Está afiliado a una caja de compensación?", "No");
  await responder(page, "¿Está afiliado al Sisbén?", "No");
  await varias(page, "Condición especial del solicitante", ["Ninguna"]);
}

export async function fotos(page: Page) {
  await entradaFoto(page, "frente").setInputFiles(await imagenPequena(page, "frente.jpg"));
  await expect(page.getByRole("img", { name: /Vista previa: frente/ })).toBeVisible();
  // A different scene: two framed pictures of the same layout count as "the same photo" (front = back check).
  await entradaFoto(page, "reverso").setInputFiles(await imagenGrande(page, "reverso.jpg"));
  await expect(page.getByRole("img", { name: /Vista previa: reverso/ })).toBeVisible();
}

/** All fields of member `i` (0-based) of step 2, a minor child by default. */
export async function llenarIntegrante(page: Page, i: number, o: { nombre?: string; nacimiento?: string; td?: string; documento?: string; ingresos?: string } = {}) {
  const tarjeta = page.getByRole("region", { name: new RegExp(`^Integrante ${i + 1}`) });
  await tarjeta.getByLabel("Nombres y apellidos completos", ex).fill(o.nombre ?? "Luis Pérez");
  await tarjeta.getByLabel("Fecha de nacimiento del integrante", ex).fill(o.nacimiento ?? "01062015");
  await tarjeta.getByLabel("Parentesco con el jefe del hogar", ex).selectOption("hijo");
  await tarjeta.getByLabel("Tipo de documento (TD)", ex).selectOption(o.td ?? "ti");
  await tarjeta.getByLabel("Número de documento del integrante", ex).fill(o.documento ?? "1100000001");
  await tarjeta.getByLabel("Estado civil", ex).selectOption("soltero");
  await tarjeta.getByLabel("Ocupación del integrante", ex).selectOption("estudiante");
  await tarjeta.getByLabel("Identidad de género", ex).selectOption("cis_masculino");
  await varias(page, "Condición especial del integrante", ["Ninguna"]);
  await tarjeta.getByLabel("Ingresos mensuales del integrante", ex).fill(o.ingresos ?? "0");
}
