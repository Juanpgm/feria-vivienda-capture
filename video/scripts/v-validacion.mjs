// Tutorial 1: how an official validates a postulación (in person). Real app (local dev server) with the fictitious
// demo postulación from demo-postulacion.mjs; its edit and validation are real writes on that test record only.
// Usage: node video/scripts/v-validacion.mjs   (validating is one-shot: re-create the demo before recording again)
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { abrir, apuntar, BASE, calentar, campo, cerrar, clic, desplazar, escena, escribir, exacto, firmar, marcar, normal, pagina, portada, rapido, revelar, sleep, tarjetas } from "./lib.mjs";

const demo = JSON.parse(fs.readFileSync(path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../work/validacion/demo.json"), "utf8"));
const SERIE = "Guía para funcionarios";
await calentar([`/postulaciones?q=${demo.documento}`, `/postulaciones/${demo.id}`, `/postulaciones/${demo.id}/editar`]);
const ses = await abrir("validacion", { api: { reales: [/^(GET|POST|PUT) \/api\/postulaciones\//] } });
const { page } = ses;
const texto = (t) => page.getByText(t, exacto);

await page.goto(portada(SERIE, "Cómo validar una postulación", "Subsidio Distrital de Vivienda"));
await escena("intro", [
  null,
  async () => { await page.goto(tarjetas("Toda postulación se valida en persona", "Por un funcionario, con la documentación en la mano", ["Registrada por el ciudadano con el código QR", "Registrada por un funcionario"])); await sleep(200); await revelar(page, 0, 2, 1200); },
  null,
]);

await escena("buscar", [
  async () => {
    await page.goto(`${BASE}/postulaciones?q=${demo.documento}`);
    await page.getByRole("heading", { name: "Postulaciones al subsidio", level: 1 }).waitFor();
    await apuntar(page, page.getByRole("link", { name: "Postulaciones", ...exacto }).first());
    rapido();
    await escribir(page, page.getByRole("searchbox").or(page.getByPlaceholder("Radicado, documento o nombre")), demo.documento, { tab: false, borrar: true });
    normal();
    await clic(page, page.getByRole("button", { name: "Filtrar", ...exacto }));
  },
  async () => {
    await apuntar(page, page.getByRole("row").filter({ hasText: demo.documento }).getByText("Sin validar", exacto));
    await sleep(600);
    await clic(page, page.getByRole("row").filter({ hasText: demo.documento }).getByRole("link").first());
    await page.getByRole("heading", { level: 1 }).filter({ hasText: /^PSE-/ }).waitFor({ timeout: 20000 });
  },
]);

await escena("revisar", [
  async () => {
    await apuntar(page, page.getByRole("heading", { level: 1 }));
    await sleep(700);
    await apuntar(page, page.getByText(/Formulario público/));
  },
  async () => {
    await apuntar(page, page.getByRole("heading", { name: "Documento de identidad" }), { abajo: 420 });
    await sleep(300);
    await apuntar(page, page.getByRole("img", { name: "Frente del documento de identidad" }));
    await sleep(900);
    await apuntar(page, page.getByRole("img", { name: "Reverso del documento de identidad" }));
  },
  async () => { await desplazar(page, 700, 1600); await sleep(300); await desplazar(page, 500, 1200); },
]);

await escena("faltantes", [
  async () => {
    await apuntar(page, page.getByRole("heading", { name: /^Faltan \d+ dato\(s\) obligatorios para validar$/ }), { abajo: 300 });
    await sleep(900);
    await apuntar(page, page.getByRole("button", { name: "Validar registro" }));
  },
  async () => {
    await apuntar(page, page.getByRole("link", { name: /^Completar: / }).first());
    await sleep(700);
    await clic(page, page.getByRole("link", { name: "Subsanar datos faltantes" }));
    await page.waitForURL((u) => u.pathname.endsWith("/editar"), { timeout: 20000 });
    await page.waitForLoadState("networkidle");
  },
]);

await escena("subsanar", [
  async () => {
    rapido();
    await escribir(page, campo(page, "Nombre del proyecto habitacional"), "Altos del Ingenio");
    await escribir(page, campo(page, "Nombre de la constructora"), "Constructora Valle Demo");
    await clic(page, page.getByText("VIS (vivienda de interés social)", exacto));
    await escribir(page, campo(page, "Valor de la solución de vivienda VIS"), "150000000");
    await marcar(page, page.getByRole("checkbox", { name: "Ahorro programado" }));
    await escribir(page, campo(page, "Valor de ahorro programado"), "5000000");
    normal();
  },
  async () => {
    await apuntar(page, page.getByText("Ya no falta ningún dato obligatorio. Guarde los cambios para poder validar la postulación."));
    await sleep(500);
    await clic(page, page.getByRole("button", { name: "Guardar cambios" }));
    await page.waitForURL((u) => !u.pathname.endsWith("/editar"), { timeout: 30000 });
  },
]);

const dialogo = page.getByRole("dialog", { name: /Validar la postulación/ });
await escena("validar", [
  async () => {
    await apuntar(page, page.getByText("Todos los datos obligatorios están completos."), { abajo: 300 });
    await sleep(600);
    await clic(page, page.getByRole("button", { name: "Validar registro" }));
    await dialogo.waitFor();
  },
  async () => { await apuntar(page, dialogo.getByRole("note")); },
  async () => {
    await marcar(page, dialogo.getByRole("checkbox", { name: "Confirmo la recepción del paquete de documentación completo del postulante" }));
    await marcar(page, dialogo.getByRole("checkbox", { name: "Me hago responsable de la información validada" }));
  },
  async () => {
    await escribir(page, dialogo.getByLabel("No. de folios anexos (opcional)"), "12", { tab: false });
    await firmar(page, dialogo);
    await clic(page, dialogo.getByRole("button", { name: "Confirmar validación" }));
    await page.getByText("Válido", exacto).first().waitFor({ timeout: 30000 });
  },
]);

await escena("resultado", [
  async () => {
    await page.evaluate(() => scrollTo({ top: 0, behavior: "smooth" }));
    await sleep(700);
    await apuntar(page, texto("Válido").first());
    await sleep(600);
    await apuntar(page, page.getByTestId("codigo-validacion"), { abajo: 250 });
    await sleep(500);
    await apuntar(page, page.getByRole("img", { name: "Firma del funcionario que validó" }));
  },
  async () => { await apuntar(page, page.getByRole("heading", { name: "Historial" }), { abajo: 300 }); await desplazar(page, 300, 900); },
]);

await page.goto(pagina(`<h1>Recuerde</h1><h2>La validación es humana y presencial</h2>`));
await escena("cierre", [
  null,
  async () => {
    await page.goto(tarjetas("Recuerde", "La validación es humana y presencial", ["Cada registro se valida en persona", "Compare el documento físico con las fotos", "Reciba el paquete de documentación completo", "La validación queda firmada y no se deshace", "Sin validación, el registro no cuenta"]));
    await sleep(200);
    await revelar(page, 0, 4, 1100);
  },
  async () => { await revelar(page, 4, 5); },
]);

await cerrar(ses);
