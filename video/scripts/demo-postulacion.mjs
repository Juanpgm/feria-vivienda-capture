// Prepares the fictitious postulación used by the validation tutorial: created through the UI with the test account
// (test series PSE-020001+, out of the metrics), modality 1 WITHOUT project and resources so it shows missing data,
// then marked as coming from the public form. Document 99900001xx: context/limpiar-postulaciones.mjs deletes it.
//
// Usage (dev server running with E2E_POSTULACION_ABIERTA=1, session of the test account in .auth/state.json):
//   node --env-file=.env video/scripts/demo-postulacion.mjs
// Prints the id of the postulación (video/work/validacion/demo.json).
import { cert, initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import fs from "node:fs";
import path from "node:path";
import { chromium } from "@playwright/test";
import { BASE, cookieDeSesion, exacto, fotosDemo } from "./lib.mjs";

export const DEMO = { documento: "9990000180", nombres: "María Fernanda", apellidos: "Ruiz Ortega", miembro: "1100000180" };

const browser = await chromium.launch();
const fotos = await fotosDemo(browser, { numero: "999.000.0180", apellidos: "RUIZ ORTEGA", nombres: "MARÍA FERNANDA" });
const context = await browser.newContext({ viewport: { width: 1280, height: 900 }, locale: "es-CO", timezoneId: "America/Bogota" });
await context.addCookies([cookieDeSesion()]);
const page = await context.newPage();
page.setDefaultTimeout(30_000);
const campo = (l) => page.getByLabel(l, exacto);
const combo = async (nombre, texto) => {
  const c = page.getByRole("combobox", { name: nombre, ...exacto });
  await c.fill(texto);
  await page.getByRole("listbox").getByRole("option").first().waitFor();
  await c.press("Enter");
  await c.press("Tab");
};
const varias = async (nombre, etiquetas) => {
  const c = page.getByRole("combobox", { name: nombre, ...exacto });
  await c.click();
  for (const e of etiquetas) await page.getByRole("option", { name: e, ...exacto }).click();
  await c.press("Escape");
};
const responder = (g, o) => page.getByRole("group", { name: g }).getByText(o, exacto).click();

await page.goto(`${BASE}/postulaciones/nueva`);
const modal = page.getByRole("dialog", { name: "Nueva postulación" });
await modal.getByLabel("Número de documento", exacto).fill(DEMO.documento);
await modal.getByRole("button", { name: "Continuar" }).click();
await page.getByRole("checkbox", { name: "El titular autoriza el tratamiento de sus datos personales", ...exacto }).check();
await page.getByRole("checkbox", { name: "Autoriza el tratamiento de datos sensibles", ...exacto }).check();
await campo("Nombres").fill(DEMO.nombres);
await campo("Apellidos").fill(DEMO.apellidos);
await combo("Lugar de expedición", "cali");
await campo("Fecha de expedición").fill("15032005");
await campo("Fecha de nacimiento").fill("12051985");
await combo("Lugar de nacimiento", "cali");
await campo("Género").selectOption("cis_femenino");
await campo("Teléfono o celular").fill("3005550180");
await campo("Correo electrónico").fill("maria.ruiz@correo.demo");
await responder("¿Autoriza recibir notificaciones por medios electrónicos?", "Sí");
await campo("Dirección de domicilio actual").fill("Calle 5 # 38-20");
await page.getByTestId("estrato-automatico").waitFor();
await campo("Tiempo de residencia en Cali (años)").fill("15");
await campo("Ocupación").selectOption("independiente");
await campo("Ingreso mensual del solicitante").fill("1400000");
await responder("¿Está afiliado a una caja de compensación?", "No");
await responder("¿Está afiliado al Sisbén?", "No");
await varias("Condición especial del solicitante", ["Ninguna"]);
await campo("Archivo de imagen: frente del documento").setInputFiles({ name: "frente.jpg", mimeType: "image/jpeg", buffer: fotos.frente });
await page.getByRole("img", { name: /Vista previa: frente/ }).waitFor();
await campo("Archivo de imagen: reverso del documento").setInputFiles({ name: "reverso.jpg", mimeType: "image/jpeg", buffer: fotos.reverso });
await page.getByRole("img", { name: /Vista previa: reverso/ }).waitFor();
await page.getByRole("button", { name: "Siguiente", ...exacto }).click();

await page.getByRole("button", { name: "+ Agregar integrante" }).click();
const t = page.getByRole("region", { name: /^Integrante 1/ });
await t.getByLabel("Nombres y apellidos completos", exacto).fill("Samuel Ruiz Ortega");
await t.getByLabel("Fecha de nacimiento del integrante", exacto).fill("03092014");
await t.getByLabel("Parentesco con el jefe del hogar", exacto).selectOption("hijo");
await t.getByLabel("Tipo de documento (TD)", exacto).selectOption("ti");
await t.getByLabel("Número de documento del integrante", exacto).fill(DEMO.miembro);
await t.getByLabel("Estado civil", exacto).selectOption("soltero");
await t.getByLabel("Ocupación del integrante", exacto).selectOption("estudiante");
await t.getByLabel("Identidad de género", exacto).selectOption("cis_masculino");
await varias("Condición especial del integrante", ["Ninguna"]);
await t.getByLabel("Ingresos mensuales del integrante", exacto).fill("0");
await page.getByRole("button", { name: "Siguiente", ...exacto }).click();

await page.getByRole("radio", { name: "Adquisición de vivienda nueva" }).check();
await page.getByRole("checkbox", { name: /Declaro bajo la gravedad de juramento/ }).check();
const pad = page.getByTestId("pad-firma");
await pad.evaluate((el) => el.scrollIntoView({ block: "center" }));
const b = await pad.boundingBox();
await page.mouse.move(b.x + b.width * 0.15, b.y + b.height * 0.6);
await page.mouse.down();
for (let i = 0; i <= 40; i++) await page.mouse.move(b.x + b.width * (0.15 + 0.7 * (i / 40)), b.y + b.height * (0.5 + 0.25 * Math.sin(i / 3)));
await page.mouse.up();
await page.getByRole("button", { name: "Usar esta firma", ...exacto }).click();
await page.getByRole("button", { name: "Enviar postulación" }).click();
const radicado = await page.getByTestId("radicado").textContent({ timeout: 60_000 });
await browser.close();

const c = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT ?? "");
const db = getFirestore(initializeApp({ credential: cert({ projectId: c.project_id, clientEmail: c.client_email, privateKey: c.private_key }) }));
const doc = (await db.collection("postulantes_subsidios_emergencia").where("radicado", "==", radicado).get()).docs[0];
// Shown as it would arrive from the QR: the public form (the tutorial explains both origins are validated alike).
await doc.ref.update({ origen: "publico", creado_por_uid: null, creado_por_nombre: null });
for (const h of (await doc.ref.collection("historial").where("tipo", "==", "creacion").get()).docs) await h.ref.update({ por_uid: null, por_nombre: "Ciudadano (formulario público)" });
const out = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Z]:)/, "$1")), "../work/validacion/demo.json");
fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, JSON.stringify({ id: doc.id, radicado, ...DEMO }));
console.log(`demo ${radicado} ${doc.id} faltantes=${doc.data().faltantes.length}`);
