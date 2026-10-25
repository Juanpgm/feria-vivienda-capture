// Authenticated e2e for the list of drafts of /registros/nuevo: several people attended in parallel without losing data.
//
// IMPORTANT: this spec NEVER writes to Firestore (there is no submit); the only persistence is IndexedDB, and every
// test runs in a fresh browser context, so each one starts with an empty list.
import { expect, test, type Page } from "@playwright/test";
import { PASOS } from "../src/modules/registro/ui/pasos";
import { hayEstadoAuth, MENSAJE_SIN_SESION } from "./auth";
import { abrirLista, HOY, llenarSolicitante, nuevoDesdeLista, siguiente, tituloPaso } from "./ayudas";
import { generarCasos } from "./datos-prueba";

test.beforeAll(() => {
  if (!hayEstadoAuth()) throw new Error(MENSAJE_SIN_SESION);
});

const [A, B] = [generarCasos(HOY)[0], generarCasos(HOY)[1]]; // Ana María Pérez Gómez / Luis Fernando Gómez
const fila = (page: Page, nombre: string) => page.getByRole("listitem").filter({ hasText: nombre });
const volverALista = async (page: Page) => {
  await page.getByRole("link", { name: "Ver borradores en curso" }).click();
  await expect(page.getByRole("heading", { level: 2, name: "Borradores en curso" })).toBeVisible();
};
const esperarGuardado = (page: Page) => expect(page.getByRole("status")).toContainText("Borrador guardado");

// Raw IndexedDB access (idb-keyval default store) to inspect keys and seed a legacy draft.
const claves = (page: Page) =>
  page.evaluate(
    () =>
      new Promise<string[]>((ok, ko) => {
        const r = indexedDB.open("keyval-store");
        r.onsuccess = () => {
          const q = r.result.transaction("keyval").objectStore("keyval").getAllKeys();
          q.onsuccess = () => ok(q.result.map(String));
          q.onerror = () => ko(q.error);
        };
        r.onerror = () => ko(r.error);
      }),
  );
const escribirClave = (page: Page, clave: string, valor: unknown) =>
  page.evaluate(
    ([k, v]) =>
      new Promise<void>((ok, ko) => {
        const r = indexedDB.open("keyval-store");
        r.onsuccess = () => {
          const t = r.result.transaction("keyval", "readwrite");
          t.objectStore("keyval").put(v, k as string);
          t.oncomplete = () => ok();
          t.onerror = () => ko(t.error);
        };
        r.onerror = () => ko(r.error);
      }),
    [clave, valor] as const,
  );

test("lista vacia: muestra la nota y el boton Nuevo registro", async ({ page }) => {
  await abrirLista(page);
  await expect(page.getByText("No hay borradores. Inicie un registro nuevo.")).toBeVisible();
  await expect(page.getByRole("button", { name: "Nuevo registro", exact: true })).toBeVisible();
  await expect(page.getByRole("listitem")).toHaveCount(0);
});

test("abrir un registro nuevo sin escribir nada no deja un borrador vacio", async ({ page }) => {
  await abrirLista(page);
  await nuevoDesdeLista(page);
  await volverALista(page);
  await expect(page.getByText("No hay borradores. Inicie un registro nuevo.")).toBeVisible();
});

test("dos borradores en paralelo: cada uno conserva sus datos y su paso, y se retoman por separado", async ({ page }) => {
  await abrirLista(page);

  // Person A: step 1 complete, then on to step 2.
  await nuevoDesdeLista(page);
  const urlA = page.url();
  await llenarSolicitante(page, A);
  await siguiente(page);
  await expect(tituloPaso(page, 2)).toBeVisible();
  await esperarGuardado(page);
  await volverALista(page);
  await expect(fila(page, "Ana Pérez")).toContainText(`Paso 2 de ${PASOS.length}: Hogar`);

  // Person B arrives while A is open: a different draft with its own id, still on step 1.
  await nuevoDesdeLista(page);
  const urlB = page.url();
  expect(urlB).not.toBe(urlA);
  await llenarSolicitante(page, B);
  await esperarGuardado(page);
  await volverALista(page);

  await expect(page.getByRole("listitem")).toHaveCount(2);
  await expect(fila(page, "Ana Pérez")).toContainText(`Paso 2 de ${PASOS.length}: Hogar`);
  await expect(fila(page, "Luis Gómez")).toContainText(`Paso 1 de ${PASOS.length}: Solicitante`);
  expect((await claves(page)).filter((k) => k.startsWith("borrador:"))).toHaveLength(2);

  // Resume A: step 2, and its step 1 still has A's values (B never touched them).
  await page.getByRole("link", { name: "Continuar borrador de Ana Pérez" }).click();
  await expect(tituloPaso(page, 2)).toBeVisible();
  await expect(page).toHaveURL(urlA);
  await page.getByRole("navigation", { name: "Pasos del registro" }).getByRole("button", { name: /Solicitante/ }).click();
  await expect(page.getByLabel("Primer nombre", { exact: true })).toHaveValue("Ana");
  await expect(page.getByLabel("Primer apellido", { exact: true })).toHaveValue("Pérez");
  await expect(page.getByLabel("Número de documento", { exact: true })).toHaveValue(A.esperado.documento);

  // Editing A autosaves into A only.
  await page.getByLabel("Segundo nombre (opcional)", { exact: true }).fill("camila");
  await page.getByLabel("Segundo nombre (opcional)", { exact: true }).press("Tab");
  await esperarGuardado(page);
  await volverALista(page);

  // Resume B: its own values, untouched.
  await page.getByRole("link", { name: "Continuar borrador de Luis Gómez" }).click();
  await expect(page).toHaveURL(urlB);
  await expect(page.getByLabel("Primer nombre", { exact: true })).toHaveValue("Luis");
  await expect(page.getByLabel("Segundo nombre (opcional)", { exact: true })).toHaveValue("Fernando");
  await expect(page.getByLabel("Número de documento", { exact: true })).toHaveValue(B.esperado.documento);
  await expect(page.getByText("Se recuperó el borrador guardado en este equipo.")).toBeVisible();
});

test("lo ultimo escrito se guarda aunque se salga a la lista antes del autoguardado", async ({ page }) => {
  await abrirLista(page);
  await nuevoDesdeLista(page);
  await page.getByLabel("Primer nombre", { exact: true }).fill("Rapido");
  await volverALista(page); // < 1 s after typing
  await expect(fila(page, "Rapido")).toBeVisible();
});

test("descartar uno desde la lista pide confirmacion en la pagina y no toca los demas", async ({ page }) => {
  let dialogos = 0;
  page.on("dialog", (d) => (dialogos++, void d.dismiss()));
  await abrirLista(page);
  await nuevoDesdeLista(page);
  await llenarSolicitante(page, A);
  await esperarGuardado(page);
  await volverALista(page);
  await nuevoDesdeLista(page);
  await llenarSolicitante(page, B);
  await esperarGuardado(page);
  await volverALista(page);
  await expect(page.getByRole("listitem")).toHaveCount(2);

  await page.getByRole("button", { name: "Descartar borrador de Ana Pérez" }).click();
  await expect(page.getByRole("group", { name: "Confirmar descarte de Ana Pérez" })).toBeVisible();
  await page.getByRole("button", { name: "Conservar", exact: true }).click();
  await expect(page.getByRole("listitem")).toHaveCount(2);

  await page.getByRole("button", { name: "Descartar borrador de Ana Pérez" }).click();
  await page.getByRole("button", { name: "Sí, descartar", exact: true }).click();
  await expect(page.getByRole("listitem")).toHaveCount(1);
  await expect(fila(page, "Luis Gómez")).toBeVisible();
  await page.reload();
  await expect(page.getByRole("listitem")).toHaveCount(1);
  expect((await claves(page)).filter((k) => k.startsWith("borrador:"))).toHaveLength(1);
  expect(dialogos).toBe(0);
});

test("borrador legado de un solo espacio: se migra a la lista, el nombre se parte y los pasos afectados se revalidan", async ({ page }) => {
  await abrirLista(page);
  // Learn this user's key prefix from a real draft, then seed the old single-slot key (old shape, no version).
  await nuevoDesdeLista(page);
  await page.getByLabel("Primer nombre", { exact: true }).fill("Temporal");
  await esperarGuardado(page);
  const clave = (await claves(page)).find((k) => k.startsWith("borrador:"))!;
  const uid = clave.split(":")[1];
  await escribirClave(page, `borrador:${uid}`, {
    id: "11111111-2222-4333-8444-555555555555",
    paso: "titularidad", // 11-step era: it now lives in "Vivienda"
    maximo: 5,
    marcas: { hogar: "completo", titularidad: "completo" },
    guardado_en: new Date().toISOString(),
    valores: {
      solicitante: { nombre_completo: "Rosa Elena Pérez Gómez", tipo_documento: "cc" },
      inmueble: { direccion: "Calle 5 # 10-20", barrio_no_listado: true, barrio_vereda_otro: "Mi barrio" },
      titularidad: { tipo_titularidad: "poseedor_legitimo" },
    },
  });

  await abrirLista(page);
  await expect(page.getByRole("listitem")).toHaveCount(2);
  const legado = fila(page, "Rosa Pérez");
  await expect(legado).toContainText(`Paso 3 de ${PASOS.length}: Vivienda`);
  const k = await claves(page);
  expect(k).not.toContain(`borrador:${uid}`); // the old slot is gone
  expect(k).toContain(`borrador:${uid}:11111111-2222-4333-8444-555555555555`);

  await page.getByRole("link", { name: "Continuar borrador de Rosa Pérez" }).click();
  await expect(tituloPaso(page, 3)).toBeVisible();
  // The new required answer is pending: the step cannot be passed without it.
  await siguiente(page);
  await expect(page.getByRole("group", { name: "¿Es su única propiedad residencial?" })).toContainText("Seleccione Sí o No");
  await page.getByRole("navigation", { name: "Pasos del registro" }).getByRole("button", { name: /Solicitante/ }).click();
  await expect(page.getByLabel("Primer nombre", { exact: true })).toHaveValue("Rosa");
  await expect(page.getByLabel("Segundo nombre (opcional)", { exact: true })).toHaveValue("Elena");
  await expect(page.getByLabel("Primer apellido", { exact: true })).toHaveValue("Pérez");
  await expect(page.getByLabel("Segundo apellido (opcional)", { exact: true })).toHaveValue("Gómez");
  await page.getByRole("navigation", { name: "Pasos del registro" }).getByRole("button", { name: /Vivienda/ }).click();
  await expect(page.getByRole("combobox", { name: "Barrio o vereda", exact: true })).toHaveValue("");
});

test("borrador de la version de 11 pasos: se abre en el paso nuevo que corresponde, con todos sus datos y sus pasos completos", async ({ page }) => {
  await abrirLista(page);
  await nuevoDesdeLista(page);
  await page.getByLabel("Primer nombre", { exact: true }).fill("Temporal");
  await esperarGuardado(page);
  const uid = (await claves(page)).find((k) => k.startsWith("borrador:"))!.split(":")[1];
  const id = "22222222-3333-4444-8555-666666666666";
  await escribirClave(page, `borrador:${uid}:${id}`, {
    id,
    version: 2,
    paso: "proteccion", // step 3 of 11
    maximo: 7, // had reached the consent
    marcas: { hogar: "completo", composicion: "completo", proteccion: "completo", inmueble: "completo", riesgo: "errores", titularidad: "completo", financiero: "completo" },
    guardado_en: new Date().toISOString(),
    valores: {
      solicitante: { primer_nombre: "Marta", primer_apellido: "Rios" },
      composicion: { cantidad_personas_hogar: "4", condiciones_especiales: ["ninguna"] },
      cierre_financiero: { observaciones: "Prefiere llamada" },
    },
  });
  await abrirLista(page);
  await expect(fila(page, "Marta Rios")).toContainText(`Paso 2 de ${PASOS.length}: Hogar`);
  await page.getByRole("link", { name: "Continuar borrador de Marta Rios" }).click();
  await expect(tituloPaso(page, 2)).toBeVisible();
  await expect(page.getByLabel("Personas que viven en el hogar", { exact: true })).toHaveValue("4");
  const riel = page.getByRole("navigation", { name: "Pasos del registro" });
  await expect(riel.getByRole("button", { name: /Solicitante/ })).toContainText("Completo");
  await expect(riel.getByRole("button", { name: /Vivienda/ })).toContainText("Con errores"); // one of its old steps had errors
  await expect(riel.getByRole("button", { name: /Cierre financiero/ })).toContainText("Completo");
  await expect(riel.getByRole("button", { name: /Autorización y documento/ })).toBeEnabled(); // furthest step reached
  await expect(riel.getByRole("button", { name: /Revisión y firma/ })).toBeDisabled();
  await riel.getByRole("button", { name: /Cierre financiero/ }).click();
  await expect(page.getByLabel("Observaciones (opcional)", { exact: true })).toHaveValue("Prefiere llamada");
});

test("un borrador con un id que no existe se abre en blanco; un id invalido muestra la lista", async ({ page }) => {
  await abrirLista(page);
  await page.goto("/registros/nuevo?borrador=no-es-un-uuid");
  await expect(page.getByRole("heading", { level: 2, name: "Borradores en curso" })).toBeVisible();
  await page.goto("/registros/nuevo?borrador=aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee");
  await expect(tituloPaso(page, 1)).toBeVisible();
  await expect(page.getByLabel("Primer nombre", { exact: true })).toHaveValue("");
});
