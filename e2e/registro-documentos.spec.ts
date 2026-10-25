// Authenticated e2e for the identity-document step (photos). NEVER writes to Firestore: the adjuntos API is mocked
// and asserted NOT to be called while capturing (upload happens at submit, owned by the submit flow).
// The step ("Autorización y documento") is reached by moving the IndexedDB draft to it, so this spec does not depend on the other steps' UI.
// The photos are locked until the consent is given, so every test authorizes the treatment of data first.
import { expect, test, type Page } from "@playwright/test";
import { PASOS } from "../src/modules/registro/ui/pasos";
import { hayEstadoAuth, MENSAJE_SIN_SESION } from "./auth";
import { entradaFoto, nuevoRegistro, siguiente, tituloPaso, type NumeroPaso } from "./ayudas";
import { TEXTO_TRATAMIENTO } from "./ayudas-envio";
import { archivoTexto, imagenConExif, imagenGrande, imagenPequena, imagenPng, textoComoJpeg } from "./imagenes";

test.beforeAll(() => {
  if (!hayEstadoAuth()) throw new Error(MENSAJE_SIN_SESION);
});

const INDICE = PASOS.findIndex((p) => p.id === "autorizacion");
const PASO_DOCUMENTOS = (INDICE + 1) as NumeroPaso;
const MAX_BYTES = 700 * 1024;

/** Reads/updates the raw IndexedDB entries of idb-keyval ("keyval-store"). */
async function idb<T>(page: Page, fn: string, ...args: unknown[]): Promise<T> {
  return page.evaluate(
    async ([codigo, a]) => {
      const db = await new Promise<IDBDatabase>((ok, mal) => {
        const r = indexedDB.open("keyval-store");
        r.onsuccess = () => ok(r.result);
        r.onerror = () => mal(r.error);
      });
      const req = <X,>(r: IDBRequest<X>) => new Promise<X>((ok, mal) => ((r.onsuccess = () => ok(r.result)), (r.onerror = () => mal(r.error))));
      const st = db.transaction("keyval", "readwrite").objectStore("keyval");
      const r = await new Function("st", "req", "args", `return (async () => { ${codigo as string} })()`)(st, req, a);
      db.close();
      return r;
    },
    [fn, args] as const,
  );
}

const clavesFoto = (page: Page) => idb<string[]>(page, `return (await req(st.getAllKeys())).map(String).filter((k) => k.startsWith("foto:"));`);
const claveBorrador = (page: Page) => idb<string[]>(page, `return (await req(st.getAllKeys())).map(String).filter((k) => k.startsWith("borrador:"));`);

/** Drafts/photos stored by the app, read back for assertions: blob size + first bytes. */
const fotoGuardada = (page: Page, lado: "frente" | "reverso") =>
  idb<{ bytes: number; mime: string; ancho: number; alto: number; tam: number; cabecera: number[] } | null>(
    page,
    `const k = (await req(st.getAllKeys())).map(String).find((k) => k.endsWith(":documento_${lado}"));
     if (!k) return null;
     const v = await req(st.get(k));
     return { bytes: v.bytes, mime: v.blob.type, ancho: v.ancho, alto: v.alto, tam: v.blob.size, cabecera: [...new Uint8Array(await v.blob.slice(0, 3).arrayBuffer())] };`,
  );

/** Starts a draft, lets it autosave, then moves it to the documents step and reloads. */
async function abrirPasoDocumentos(page: Page) {
  const subidas: string[] = [];
  await page.route("**/api/registros/**/adjuntos**", (route) => {
    subidas.push(route.request().url());
    return route.fulfill({ json: { ok: true } });
  });
  await nuevoRegistro(page);
  await page.getByLabel("Primer nombre", { exact: true }).fill("Ana");
  await expect(page.getByRole("status")).toContainText("Borrador guardado");
  await idb(page, `const k = (await req(st.getAllKeys())).map(String).find((k) => k.startsWith("borrador:")); const v = await req(st.get(k)); v.paso = "autorizacion"; v.maximo = args[0]; await req(st.put(v, k));`, INDICE);
  await page.reload();
  await expect(tituloPaso(page, PASO_DOCUMENTOS)).toBeVisible();
  // Locked until the consent is given.
  await expect(entradaFoto(page, "frente")).toHaveCount(0);
  await page.getByRole("checkbox", { name: TEXTO_TRATAMIENTO, exact: true }).check();
  await expect(entradaFoto(page, "frente")).toBeVisible();
  return subidas;
}

const miniatura = (page: Page, lado: "frente" | "reverso") => page.getByRole("img", { name: new RegExp(`Vista previa: ${lado}`) });
const seccion = (page: Page, lado: "frente" | "reverso") => page.getByRole("region", { name: lado === "frente" ? "Frente del documento" : "Reverso del documento" });

test.describe("documento de identidad: captura", () => {
  test("avisa quien ve las fotos y exige las dos para continuar", async ({ page }) => {
    const subidas = await abrirPasoDocumentos(page);
    await expect(page.getByText("solo pueden ser vistas por el personal administrador")).toBeVisible();
    await expect(seccion(page, "frente")).toContainText("Sin foto");

    await siguiente(page);
    await expect(page.getByText("Falta la foto del frente del documento", { exact: true })).toBeVisible();
    await expect(page.getByText("Falta la foto del reverso del documento", { exact: true })).toBeVisible();
    await expect(page.getByText("Revise los campos marcados antes de continuar.")).toBeVisible();
    await expect(tituloPaso(page, PASO_DOCUMENTOS)).toBeVisible(); // did not advance

    await entradaFoto(page, "frente").setInputFiles(await imagenPequena(page));
    await expect(miniatura(page, "frente")).toBeVisible();
    await expect(page.getByText("Falta la foto del frente del documento", { exact: true })).toHaveCount(0);
    await siguiente(page);
    await expect(tituloPaso(page, PASO_DOCUMENTOS)).toBeVisible(); // still missing the back
    await expect(page.getByText("Falta la foto del reverso del documento", { exact: true })).toBeVisible();
    expect(subidas).toEqual([]);
  });

  test("una foto grande se reduce a JPEG de 1600 px y 700 KB como maximo, con vista previa y tamano", async ({ page }) => {
    const subidas = await abrirPasoDocumentos(page);
    const grande = await imagenGrande(page);
    expect(grande.buffer.length).toBeGreaterThan(2 * 1024 * 1024);

    await entradaFoto(page, "frente").setInputFiles(grande);
    await expect(miniatura(page, "frente")).toBeVisible();
    await expect(seccion(page, "frente")).toContainText(/\d+ KB · \d+ × \d+ px/);
    const f = (await fotoGuardada(page, "frente"))!;
    expect(f.mime).toBe("image/jpeg");
    expect(f.cabecera).toEqual([0xff, 0xd8, 0xff]);
    expect(f.tam).toBeLessThanOrEqual(MAX_BYTES);
    expect(f.tam).toBe(f.bytes);
    expect(Math.max(f.ancho, f.alto)).toBeLessThanOrEqual(1600);
    // The thumbnail really decoded.
    expect(await miniatura(page, "frente").evaluate((img: HTMLImageElement) => img.naturalWidth)).toBe(f.ancho);
    expect(subidas).toEqual([]);
  });

  test("un PNG se convierte a JPEG", async ({ page }) => {
    await abrirPasoDocumentos(page);
    await entradaFoto(page, "reverso").setInputFiles(await imagenPng(page));
    await expect(miniatura(page, "reverso")).toBeVisible();
    expect((await fotoGuardada(page, "reverso"))!.cabecera).toEqual([0xff, 0xd8, 0xff]);
  });

  test("rechaza archivos que no son imagen, sea cual sea su nombre o tipo declarado", async ({ page }) => {
    await abrirPasoDocumentos(page);
    for (const archivo of [archivoTexto(), textoComoJpeg()]) {
      await entradaFoto(page, "frente").setInputFiles(archivo);
      await expect(seccion(page, "frente").getByRole("alert")).toContainText("El archivo no es una imagen");
      await expect(miniatura(page, "frente")).toHaveCount(0);
    }
    expect(await clavesFoto(page)).toEqual([]);
    // A valid photo afterwards clears the error.
    await entradaFoto(page, "frente").setInputFiles(await imagenPequena(page));
    await expect(miniatura(page, "frente")).toBeVisible();
    await expect(seccion(page, "frente").getByRole("alert")).toHaveCount(0);
  });

  test("respeta la orientacion EXIF: 800x400 marcada como girada queda vertical", async ({ page }) => {
    await abrirPasoDocumentos(page);
    await entradaFoto(page, "frente").setInputFiles(await imagenConExif(page));
    await expect(seccion(page, "frente")).toContainText("400 × 800 px");
    const f = (await fotoGuardada(page, "frente"))!;
    expect([f.ancho, f.alto]).toEqual([400, 800]);
  });

  test("volver a tomar reemplaza la foto y quitar la elimina del equipo", async ({ page }) => {
    await abrirPasoDocumentos(page);
    await entradaFoto(page, "frente").setInputFiles(await imagenPequena(page));
    await expect(seccion(page, "frente")).toContainText("640 × 400 px");

    await seccion(page, "frente").getByRole("button", { name: "Volver a tomar" }).click(); // opens the picker; we answer it directly
    await entradaFoto(page, "frente").setInputFiles(await imagenConExif(page));
    await expect(seccion(page, "frente")).toContainText("400 × 800 px");
    expect(await clavesFoto(page)).toHaveLength(1);

    await seccion(page, "frente").getByRole("button", { name: "Quitar" }).click();
    await expect(seccion(page, "frente")).toContainText("Sin foto");
    await expect(miniatura(page, "frente")).toHaveCount(0);
    expect(await clavesFoto(page)).toEqual([]);
    await siguiente(page);
    await expect(page.getByText("Falta la foto del frente del documento", { exact: true })).toBeVisible();
  });
});

test.describe("documento de identidad: borrador", () => {
  test("las fotos sobreviven a recargar, no se guardan dentro del borrador y permiten continuar al resumen", async ({ page }) => {
    const subidas = await abrirPasoDocumentos(page);
    await entradaFoto(page, "frente").setInputFiles(await imagenPequena(page, "a.jpg"));
    await entradaFoto(page, "reverso").setInputFiles(await imagenPequena(page, "b.jpg", "#d5742a"));
    await expect(miniatura(page, "reverso")).toBeVisible();
    await expect(page.getByRole("status")).toContainText("Borrador guardado");

    // The draft record only carries "capturada" markers: no image bytes.
    const borrador = await idb<string>(page, `const k = (await req(st.getAllKeys())).map(String).find((k) => k.startsWith("borrador:")); return JSON.stringify(await req(st.get(k)));`);
    expect(borrador).toContain('"documento_frente":"capturada"');
    expect(borrador.length).toBeLessThan(5000);
    expect(await page.evaluate(() => JSON.stringify({ ...localStorage }))).not.toMatch(/foto|capturada/);

    await page.reload();
    await expect(tituloPaso(page, PASO_DOCUMENTOS)).toBeVisible();
    await expect(miniatura(page, "frente")).toBeVisible();
    await expect(miniatura(page, "reverso")).toBeVisible();

    await siguiente(page);
    await expect(tituloPaso(page, PASOS.length as NumeroPaso)).toBeVisible(); // Revisión y firma
    expect(subidas).toEqual([]);
  });

  test("descartar el borrador elimina tambien las fotos", async ({ page }) => {
    await abrirPasoDocumentos(page);
    await entradaFoto(page, "frente").setInputFiles(await imagenPequena(page));
    await entradaFoto(page, "reverso").setInputFiles(await imagenPequena(page));
    await expect(miniatura(page, "reverso")).toBeVisible();
    expect(await clavesFoto(page)).toHaveLength(2);

    await page.getByRole("button", { name: "Descartar borrador", exact: true }).click();
    await page.getByRole("button", { name: "Sí, descartar" }).click();
    await expect(page).toHaveURL(/\/registros\/nuevo$/);
    expect(await clavesFoto(page)).toEqual([]);
    expect(await claveBorrador(page)).toEqual([]);
  });

  test("si el borrador marca una foto que ya no esta en el equipo, la marca se corrige y el paso queda incompleto", async ({ page }) => {
    await abrirPasoDocumentos(page);
    await entradaFoto(page, "frente").setInputFiles(await imagenPequena(page));
    await entradaFoto(page, "reverso").setInputFiles(await imagenPequena(page));
    await expect(miniatura(page, "reverso")).toBeVisible();
    await expect(page.getByRole("status")).toContainText("Borrador guardado");
    await idb(page, `for (const k of (await req(st.getAllKeys())).map(String).filter((k) => k.startsWith("foto:")).slice(0, 1)) await req(st.delete(k));`);
    await page.reload();
    await expect(tituloPaso(page, PASO_DOCUMENTOS)).toBeVisible();
    expect(await clavesFoto(page)).toHaveLength(1);
    await siguiente(page);
    await expect(tituloPaso(page, PASO_DOCUMENTOS)).toBeVisible();
  });
});

test.describe("documento de identidad: camara en vivo (escritorio)", () => {
  test("permiso denegado: muestra el mensaje y deja elegir un archivo", async ({ page }) => {
    await page.addInitScript(() => {
      navigator.mediaDevices.getUserMedia = () => Promise.reject(new DOMException("denied", "NotAllowedError"));
    });
    await abrirPasoDocumentos(page);
    await seccion(page, "frente").getByRole("button", { name: "Usar la cámara" }).click();
    await expect(seccion(page, "frente").getByRole("alert")).toContainText("el permiso fue denegado");
    await seccion(page, "frente").getByRole("button", { name: "Cerrar cámara" }).click();
    await entradaFoto(page, "frente").setInputFiles(await imagenPequena(page));
    await expect(miniatura(page, "frente")).toBeVisible();
  });

  test("captura un cuadro de la camara y lo procesa como cualquier otra foto", async ({ page }) => {
    await page.addInitScript(() => {
      navigator.mediaDevices.getUserMedia = async () => {
        const c = document.createElement("canvas");
        c.width = 640;
        c.height = 480;
        const ctx = c.getContext("2d")!;
        setInterval(() => {
          ctx.fillStyle = "#2a7";
          ctx.fillRect(0, 0, 640, 480);
          ctx.fillStyle = "#fff";
          ctx.fillRect(Math.random() * 500, 100, 100, 100);
        }, 50);
        return c.captureStream(20);
      };
    });
    await abrirPasoDocumentos(page);
    await seccion(page, "reverso").getByRole("button", { name: "Usar la cámara" }).click();
    const capturar = seccion(page, "reverso").getByRole("button", { name: "Capturar" });
    await expect(capturar).toBeEnabled();
    await expect(capturar).toBeFocused();
    await capturar.click();
    await expect(miniatura(page, "reverso")).toBeVisible();
    await expect(seccion(page, "reverso")).toContainText("640 × 480 px");
    await expect(seccion(page, "reverso").getByRole("button", { name: "Cerrar cámara" })).toHaveCount(0);
  });
});
