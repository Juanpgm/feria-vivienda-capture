// Visual pass over the identity-document step and the admin "Ver documento" block: light/dark x desktop (1280x800) /
// mobile (390x844). Screenshots go to test-results/visual (not committed). No Firestore writes: adjuntos are mocked.
import { expect, test, type Page } from "@playwright/test";
import { PASOS } from "../src/modules/registro/ui/pasos";
import { hayEstadoAuth, MENSAJE_SIN_SESION } from "./auth";
import { entradaFoto, nuevoRegistro, siguiente, tituloPaso, type NumeroPaso } from "./ayudas";
import { TEXTO_TRATAMIENTO } from "./ayudas-envio";
import { imagenGrande, imagenPequena, archivoTexto } from "./imagenes";
import { detalle, uuid } from "./mocks-registros";

test.beforeAll(() => {
  if (!hayEstadoAuth()) throw new Error(MENSAJE_SIN_SESION);
});

const VISTAS = {
  escritorio: { width: 1280, height: 800 },
  movil: { width: 390, height: 844 },
} as const;

const sinHorizontal = (page: Page) => page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1);
const objetivosPequenos = (page: Page) =>
  page.evaluate(() =>
    [...document.querySelectorAll<HTMLElement>("main button, main a, main input, main select, main textarea")]
      .filter((el) => el.getAttribute("tabindex") !== "-1" && el.getBoundingClientRect().width > 0)
      .filter((el) => !(el.tagName === "A" && el.closest("p"))) // inline links inside a paragraph (the consent text)
      .filter((el) => (el.closest("label") ?? el).getBoundingClientRect().height < 43.5)
      .map((el) => el.getAttribute("aria-label") ?? el.textContent?.trim() ?? el.tagName),
  );

async function abrirPaso(page: Page) {
  await nuevoRegistro(page);
  await page.getByLabel("Primer nombre", { exact: true }).fill("Ana");
  await expect(page.getByRole("status")).toContainText("Borrador guardado");
  const indice = PASOS.findIndex((p) => p.id === "autorizacion");
  await page.evaluate(async (i) => {
    const db = await new Promise<IDBDatabase>((ok) => ((indexedDB.open("keyval-store").onsuccess = (e) => ok((e.target as IDBOpenDBRequest).result))));
    const st = db.transaction("keyval", "readwrite").objectStore("keyval");
    const k = await new Promise<IDBValidKey[]>((ok) => ((st.getAllKeys().onsuccess = (e) => ok((e.target as IDBRequest).result))));
    const clave = k.find((x) => String(x).startsWith("borrador:"))!;
    const v = await new Promise<Record<string, unknown>>((ok) => ((st.get(clave).onsuccess = (e) => ok((e.target as IDBRequest).result))));
    st.put({ ...v, paso: "autorizacion", maximo: i }, clave);
    await new Promise((ok) => (st.transaction.oncomplete = ok));
  }, indice);
  await page.reload();
  await expect(tituloPaso(page, (indice + 1) as NumeroPaso)).toBeVisible();
}

for (const esquema of ["light", "dark"] as const) {
  for (const [vista, viewport] of Object.entries(VISTAS)) {
    test.describe(`documentos ${esquema} / ${vista}`, () => {
      test.use({ colorScheme: esquema, viewport });

      test("paso vacio, con errores, con error de archivo y con fotos", async ({ page }) => {
        await page.addInitScript(() => localStorage.removeItem("tema"));
        await abrirPaso(page);
        // Locked until the consent is given: the explanation replaces the capture controls.
        await expect(page.getByText("Las fotos se habilitan cuando el titular autoriza")).toBeVisible();
        expect(await sinHorizontal(page)).toBe(true);
        await page.screenshot({ path: `test-results/visual/${esquema}-${vista}-documentos-bloqueado.png`, fullPage: true });
        await page.getByRole("checkbox", { name: TEXTO_TRATAMIENTO, exact: true }).check();
        await expect(entradaFoto(page, "frente")).toBeVisible();
        expect(await sinHorizontal(page)).toBe(true);
        expect(await objetivosPequenos(page)).toEqual([]);
        await page.screenshot({ path: `test-results/visual/${esquema}-${vista}-documentos-vacio.png`, fullPage: true });

        await siguiente(page);
        await expect(page.getByText("Falta la foto del frente del documento", { exact: true })).toBeVisible();
        await page.screenshot({ path: `test-results/visual/${esquema}-${vista}-documentos-errores.png`, fullPage: true });

        await entradaFoto(page, "frente").setInputFiles(archivoTexto());
        await expect(page.getByText("El archivo no es una imagen", { exact: false })).toBeVisible();
        expect(await sinHorizontal(page)).toBe(true);
        await page.screenshot({ path: `test-results/visual/${esquema}-${vista}-documentos-archivo-invalido.png`, fullPage: true });

        await entradaFoto(page, "frente").setInputFiles(await imagenGrande(page));
        await entradaFoto(page, "reverso").setInputFiles(await imagenPequena(page));
        await expect(page.getByRole("img", { name: /Vista previa: reverso/ })).toBeVisible();
        await expect(page.getByRole("img", { name: /Vista previa: frente/ })).toBeVisible();
        expect(await sinHorizontal(page)).toBe(true);
        expect(await objetivosPequenos(page)).toEqual([]);
        await page.screenshot({ path: `test-results/visual/${esquema}-${vista}-documentos-fotos.png`, fullPage: true });
      });

      test("detalle del registro: bloque 'Ver documento' para admin", async ({ page }) => {
        await page.addInitScript(() => localStorage.removeItem("tema"));
        await page.route((u) => u.pathname === `/api/registros/${uuid(5)}`, (route) => route.fulfill({ json: detalle(5) }));
        await page.goto(`/registros/${uuid(5)}`);
        const bloque = page.getByRole("region", { name: "Documento de identidad" });
        await expect(bloque).toBeVisible();
        expect(await sinHorizontal(page)).toBe(true);
        expect(await objetivosPequenos(page)).toEqual([]);
        await bloque.scrollIntoViewIfNeeded();
        await page.screenshot({ path: `test-results/visual/${esquema}-${vista}-documentos-admin.png`, fullPage: true });
      });
    });
  }
}

test("el enlace 'Ver documento' abre la imagen del endpoint en una pestana nueva", async ({ page }) => {
  await page.route((u) => u.pathname === `/api/registros/${uuid(5)}`, (route) => route.fulfill({ json: detalle(5) }));
  const pedidos: string[] = [];
  const jpeg = (await imagenPequena(page)).buffer;
  await page.context().route(`**/api/registros/${uuid(5)}/adjuntos/*`, (route) => {
    pedidos.push(new URL(route.request().url()).pathname);
    return route.fulfill({ body: jpeg, contentType: "image/jpeg", headers: { "cache-control": "private, no-store" } });
  });
  await page.goto(`/registros/${uuid(5)}`);
  const enlace = page.getByRole("link", { name: /Ver documento: reverso/ });
  await expect(enlace).toHaveAttribute("target", "_blank");
  await expect(enlace).toHaveAttribute("rel", /noopener/);
  const [nueva] = await Promise.all([page.context().waitForEvent("page"), enlace.click()]);
  await nueva.waitForLoadState();
  expect(pedidos).toEqual([`/api/registros/${uuid(5)}/adjuntos/documento_reverso`]);
  await nueva.close();
});
