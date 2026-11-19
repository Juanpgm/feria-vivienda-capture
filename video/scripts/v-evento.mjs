// Tutorial 3: starting the event (public form switch, the expiring QR poster, printing, renewing, voiding, closing).
// Local dev server with the test account. SIMULATED: switching the form, voiding codes and issuing the code (its QR
// points to localhost with a fake token, so the QR seen in the video opens nothing). Nothing real changes.
// Usage: node video/scripts/v-evento.mjs
import fs from "node:fs";
import { abrir, apuntar, BASE, calentar, cerrar, clic, desplazar, escena, exacto, normal, portada, revelar, sleep, tarjetas } from "./lib.mjs";

const SERIE = "Guía para administradores";
// End of the chosen day in Bogota (UTC-5), like the real code.
const vence = (dias) => {
  const b = new Date(Date.now() - 5 * 3600_000);
  return Math.floor((Date.UTC(b.getUTCFullYear(), b.getUTCMonth(), b.getUTCDate() + dias - 1, 23, 59, 59) + 5 * 3600_000) / 1000);
};

await calentar(["/admin/postulaciones", "/postulaciones/qr"]);
const ses = await abrir("evento", {
  api: {
    simular: (req, u) => {
      if (req.method() === "GET" && u.pathname === "/api/dashboard") return JSON.parse(fs.readFileSync(new URL("../work/dashboard.json", import.meta.url), "utf8"));
      if (req.method() === "PUT" && u.pathname === "/api/postulaciones/formulario") return { ok: true, habilitado: req.postDataJSON()?.habilitado };
      if (req.method() === "POST" && u.pathname === "/api/postulaciones/qr/anular") return { ok: true };
      if (req.method() === "POST" && u.pathname === "/api/postulaciones/qr") {
        const dias = req.postDataJSON()?.dias ?? 1;
        return { token: `${vence(dias)}.0.VIDEO-DEMO-SIN-VALOR-VIDEO-DEMO-0`, exp: vence(dias) };
      }
      return undefined;
    },
  },
});
const { page } = ses;
page.on("download", (d) => d.cancel().catch(() => {}));

await page.goto(portada(SERIE, "Cómo iniciar el evento", "El código QR del formulario público"));
await escena("intro", [
  null,
  async () => { await page.goto(tarjetas("Iniciar el evento", "En cinco pasos", ["Habilitar el formulario", "Generar el código QR", "Imprimir el cartel", "Renovarlo cada día", "Anular si se pierde"], "#")); await sleep(200); await revelar(page, 0, 5, 700); },
]);

await escena("panel", [
  async () => {
    await page.goto(`${BASE}/dashboard`);
    await page.getByRole("link", { name: "Formulario postulación", ...exacto }).waitFor();
    await clic(page, page.getByRole("link", { name: "Formulario postulación", ...exacto }));
    await page.getByRole("heading", { name: "Formulario de postulación al subsidio", level: 1 }).waitFor({ timeout: 20000 });
  },
  async () => {
    await apuntar(page, page.getByText("Habilitado", exacto));
    await sleep(900);
    await apuntar(page, page.getByRole("button", { name: /^(Deshabilitar|Habilitar) formulario$/ }));
  },
]);

await escena("generar", [
  async () => {
    await clic(page, page.getByRole("link", { name: "Descargar QR en PDF" }));
    await page.getByRole("heading", { name: "Código QR del formulario de postulación", level: 1 }).waitFor({ timeout: 20000 });
  },
  async () => {
    const sel = page.getByLabel("Vigencia del código");
    await clic(page, sel);
    await sleep(400);
    await sel.selectOption({ label: "7 días" });
    await sleep(900);
    await sel.selectOption({ label: "Solo hoy" });
    await page.keyboard.press("Escape");
  },
  async () => {
    await apuntar(page, page.getByTestId("qr-formulario"), { abajo: 120 });
    await sleep(800);
    await desplazar(page, 300, 1000);
    await apuntar(page, page.getByTestId("vigencia-qr"));
  },
]);

await escena("imprimir", [
  async () => {
    await page.evaluate(() => scrollTo({ top: 0, behavior: "smooth" }));
    await sleep(600);
    await clic(page, page.getByRole("button", { name: "Descargar PDF para imprimir" }));
  },
  async () => { await apuntar(page, page.getByRole("article", { name: "Vista previa del cartel" })); await desplazar(page, 250, 1000); },
]);

await page.goto(tarjetas("¿Por qué vence el código?", "Para que el registro sea en el punto de atención", ["Solo se registran las personas que están en el sitio", "Una foto compartida del cartel deja de servir al vencer", "Use Solo hoy e imprima un cartel nuevo cada día"]));
await escena("porque", [
  async () => { await sleep(300); await revelar(page, 0, 1); },
  async () => { await revelar(page, 1, 2); },
  async () => { await revelar(page, 2, 3); },
]);

await escena("anular", [
  async () => {
    await page.goto(`${BASE}/admin/postulaciones`);
    await page.getByRole("heading", { name: "Formulario de postulación al subsidio", level: 1 }).waitFor({ timeout: 20000 });
    await clic(page, page.getByRole("button", { name: "Anular códigos QR emitidos" }));
    await clic(page, page.getByRole("group", { name: "Confirmar anulación" }).getByRole("button", { name: "Sí, anular" }));
  },
  async () => { await apuntar(page, page.getByText("Códigos anulados. Descargue e imprima un cartel nuevo.")); },
]);

await escena("terminar", [
  async () => {
    await clic(page, page.getByRole("button", { name: "Deshabilitar formulario" }));
    await page.getByText("Deshabilitado", exacto).waitFor();
    await apuntar(page, page.getByText("Deshabilitado", exacto));
  },
]);

normal();
await page.goto(tarjetas("Resumen del evento", "Cada día, en este orden", ["Habilite el formulario", "Genere el código de hoy", "Imprima y pegue el cartel", "Renueve el cartel cada día", "Anule si se pierde", "Deshabilite al terminar"], "#"));
await escena("cierre", [async () => { await sleep(200); await revelar(page, 0, 6, 1000); }]);
await sleep(1500);

await cerrar(ses);
