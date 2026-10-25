import { expect, type Page } from "@playwright/test";
import { CONDICIONES_ESPECIALES } from "../src/shared/constantes";
import { fechaBogota } from "../src/shared/tiempo";
import { type Caso, type CasoInvalido, ETIQUETA_RANGO } from "./datos-prueba";

export const HOY = fechaBogota();
const RUTA = process.env.E2E_RUTA_NUEVO ?? "/registros/nuevo";

export const TITULO_PASO = {
  1: "Datos del hogar",
  2: "Composición familiar",
  3: "Especial protección constitucional",
} as const;

const exacto = { exact: true } as const;

/** Opens a fresh draft: discards whatever the stored user's draft slot holds (the confirm dialog is accepted). */
export async function nuevoRegistro(page: Page) {
  await page.goto(RUTA);
  const { pathname } = new URL(page.url());
  if (pathname !== RUTA) {
    throw new Error(
      `La sesión guardada no permite abrir ${RUTA} (quedó en ${pathname}). ` +
        "Vuelva a ejecutar `npm run e2e:login` con un usuario aprobado.",
    );
  }
  const descartar = page.getByRole("button", { name: "Descartar borrador" });
  await expect(descartar).toBeVisible();
  await expect(page.getByRole("heading", { level: 2 })).toBeVisible();
  // Discard only when a draft exists. Discarding a clean form would remount it asynchronously and could
  // swallow the first keystrokes typed right after.
  const hayBorrador = !(await page.getByRole("status").innerText()).includes("Sin cambios por guardar");
  if (hayBorrador) {
    page.once("dialog", (d) => void d.accept());
    await descartar.click();
  }
  await expect(page.getByRole("heading", { level: 2, name: TITULO_PASO[1] })).toBeVisible();
  await expect(page.getByRole("status")).toContainText("Sin cambios por guardar");
  await expect(page.getByLabel("Nombre completo", exacto)).toHaveValue("");
}

/** Types like a person: fill, then Tab so blur normalization runs. */
async function escribir(page: Page, etiqueta: string, valor: string | undefined) {
  if (!valor) return;
  const campo = page.getByLabel(etiqueta, exacto);
  await campo.fill(valor);
  await campo.press("Tab");
}

export async function llenarPaso1(page: Page, c: Pick<Caso, "solicitante"> | Pick<CasoInvalido, "solicitante">) {
  const s = c.solicitante;
  await escribir(page, "Nombre completo", s.nombre);
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
  await escribir(page, "Fecha de expedición", s.expedicion);
  await escribir(page, "Teléfono principal", s.telefono1);
  await escribir(page, "Teléfono alterno (opcional)", s.telefono2);
  await escribir(page, "Correo electrónico", s.correo);
  await escribir(page, "Fecha de nacimiento", s.nacimiento);
  await page.getByLabel("Estado civil", exacto).selectOption(s.estadoCivil);
  await escribir(page, "Años de residencia", s.aniosResidencia);
}

/** What the person sees after blur: normalized text and derived hints. */
export async function verificarPaso1(page: Page, c: Caso) {
  const e = c.esperado;
  await expect(page.getByLabel("Nombre completo", exacto)).toHaveValue(e.nombre);
  await expect(page.getByLabel("Número de documento", exacto)).toHaveValue(e.documento);
  await expect(page.getByLabel("Teléfono principal", exacto)).toHaveValue(e.telefono1);
  if (e.telefono2) await expect(page.getByLabel("Teléfono alterno (opcional)", exacto)).toHaveValue(e.telefono2);
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

export async function llenarPaso3(page: Page, c: Pick<Caso, "composicion"> | Pick<CasoInvalido, "composicion">) {
  for (const codigo of c.composicion.condiciones) {
    await page.getByRole("checkbox", { name: CONDICIONES_ESPECIALES[codigo as keyof typeof CONDICIONES_ESPECIALES], ...exacto }).click();
  }
}

export async function verificarPaso3(page: Page, c: Caso) {
  for (const [codigo, etiqueta] of Object.entries(CONDICIONES_ESPECIALES)) {
    const caja = page.getByRole("checkbox", { name: etiqueta, ...exacto });
    if (c.esperado.condicionesFinales.includes(codigo)) await expect(caja).toBeChecked();
    else await expect(caja).not.toBeChecked();
  }
}

export const siguiente = (page: Page) => page.getByRole("button", { name: "Siguiente", ...exacto }).click();
export const tituloPaso = (page: Page, n: 1 | 2 | 3) => page.getByRole("heading", { level: 2, name: TITULO_PASO[n] });
