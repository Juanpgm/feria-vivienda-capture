// Tutorial 2: how to register a postulación (citizen view, also useful to staff). Public form on the local dev server
// (E2E_POSTULACION_ABIERTA=1 opens it without a printed QR). The document lookup and the final send are SIMULATED:
// no record is created and no consecutive is used. The address is located by the real geocoder of the Alcaldía.
// Usage: node video/scripts/v-registro.mjs
import { abrir, apuntar, BASE, calentar, campo, cerrar, clic, combo, elegirVarias, escena, escribir, exacto, firmar, fotosDemo, marcar, normal, pagina, portada, rapido, revelar, sleep, tarjetas, titulo } from "./lib.mjs";

const PERSONA = { documento: "1000000245", nombres: "Carlos Andrés", apellidos: "Mora Díaz" };
const SERIE = "Guía para ciudadanos";

await calentar(["/postulacion"], { sesion: false });
const ses = await abrir("registro", {
  sesion: false,
  api: {
    reales: [/^POST \/api\/postulaciones\/ubicar$/],
    simular: (req, u) => {
      if (req.method() === "POST" && u.pathname === "/api/postulaciones/consulta") return { existe: false, documento: PERSONA.documento };
      if (req.method() === "POST" && u.pathname === "/api/postulaciones") return { status: 201, json: { id: "00000000-0000-4000-8000-000000000245", radicado: "PSE-000245" } };
      return undefined;
    },
  },
});
const { page, browser } = ses;
const fotos = await fotosDemo(browser, { numero: "1.000.000.245", apellidos: "MORA DÍAZ", nombres: "CARLOS ANDRÉS" });
const responder = (g, o) => clic(page, page.getByRole("group", { name: g }).getByText(o, exacto));
const siguiente = async (proximo) => {
  await clic(page, page.getByRole("button", { name: "Siguiente", ...exacto }));
  await titulo(page, proximo).waitFor({ timeout: 15000 });
};

await page.goto(portada(SERIE, "Cómo registrar su postulación", "Subsidio Distrital de Vivienda, paso a paso"));
await escena("intro", [null, null]);

await page.goto(tarjetas("Antes de empezar", "En el punto de atención de la Secretaría", ["Escanee el código QR del cartel con la cámara de su celular", "Tenga a mano su documento y los datos de su hogar"], "#"));
await escena("qr", [
  async () => { await sleep(300); await revelar(page, 0, 1); },
  async () => { await revelar(page, 1, 2); },
]);

const modal = page.getByRole("dialog", { name: "Nueva postulación" });
await escena("documento", [
  async () => {
    await page.goto(`${BASE}/postulacion`);
    await modal.waitFor();
    await sleep(500);
    await apuntar(page, modal.getByText("Se le pedirá:"));
    await sleep(500);
    await apuntar(page, modal.getByText(/Los datos del proyecto de vivienda/));
  },
  async () => {
    await clic(page, modal.getByRole("combobox", { name: "Tipo de documento del solicitante" }));
    await modal.getByRole("combobox", { name: "Tipo de documento del solicitante" }).selectOption("cc");
    await escribir(page, modal.getByLabel("Número de documento", exacto), PERSONA.documento, { tab: false });
    await clic(page, modal.getByRole("button", { name: "Continuar" }));
    await titulo(page, "Datos del solicitante").waitFor({ timeout: 15000 });
  },
]);

await escena("paso1", [
  async () => {
    rapido();
    await marcar(page, page.getByRole("checkbox", { name: "El titular autoriza el tratamiento de sus datos personales", ...exacto }));
    await marcar(page, page.getByRole("checkbox", { name: "Autoriza el tratamiento de datos sensibles", ...exacto }));
    await escribir(page, campo(page, "Nombres"), PERSONA.nombres);
    await escribir(page, campo(page, "Apellidos"), PERSONA.apellidos);
    await combo(page, page.getByRole("combobox", { name: "Lugar de expedición", ...exacto }), "cali");
    await escribir(page, campo(page, "Fecha de expedición"), "20082008");
    await escribir(page, campo(page, "Fecha de nacimiento"), "07041990");
    await combo(page, page.getByRole("combobox", { name: "Lugar de nacimiento", ...exacto }), "cali");
    await clic(page, campo(page, "Género"));
    await campo(page, "Género").selectOption("cis_masculino");
  },
  async () => {
    await escribir(page, campo(page, "Teléfono o celular"), "3015550245");
    await escribir(page, campo(page, "Correo electrónico"), "carlos.mora@correo.demo");
    await responder("¿Autoriza recibir notificaciones por medios electrónicos?", "Sí");
    await escribir(page, campo(page, "Dirección de domicilio actual"), "Calle 5 # 38-20");
    await page.getByTestId("estrato-automatico").waitFor({ timeout: 20000 });
    await apuntar(page, page.getByTestId("estrato-automatico"));
  },
  async () => {
    await escribir(page, campo(page, "Tiempo de residencia en Cali (años)"), "12");
    await clic(page, campo(page, "Ocupación"));
    await campo(page, "Ocupación").selectOption("independiente");
    await escribir(page, campo(page, "Ingreso mensual del solicitante"), "1800000");
    await responder("¿Está afiliado a una caja de compensación?", "No");
    await responder("¿Está afiliado al Sisbén?", "No");
    await elegirVarias(page, "Condición especial del solicitante", ["Ninguna"]);
  },
  async () => {
    const f = campo(page, "Archivo de imagen: frente del documento");
    await apuntar(page, page.getByRole("heading", { name: /documento de identidad/i }).last());
    await f.setInputFiles({ name: "frente.jpg", mimeType: "image/jpeg", buffer: fotos.frente });
    await page.getByRole("img", { name: /Vista previa: frente/ }).waitFor({ timeout: 15000 });
    await campo(page, "Archivo de imagen: reverso del documento").setInputFiles({ name: "reverso.jpg", mimeType: "image/jpeg", buffer: fotos.reverso });
    await apuntar(page, page.getByRole("img", { name: /Vista previa: reverso/ }));
    await siguiente("Grupo familiar");
  },
]);

await escena("paso2", [
  async () => {
    await clic(page, page.getByRole("button", { name: "+ Agregar integrante" }));
    const t = page.getByRole("region", { name: /^Integrante 1/ });
    await escribir(page, t.getByLabel("Nombres y apellidos completos", exacto), "Laura Mora Díaz");
    await escribir(page, t.getByLabel("Fecha de nacimiento del integrante", exacto), "15062016");
    await t.getByLabel("Parentesco con el jefe del hogar", exacto).selectOption("hijo");
    await t.getByLabel("Tipo de documento (TD)", exacto).selectOption("ti");
    await escribir(page, t.getByLabel("Número de documento del integrante", exacto), "1100000245");
    await t.getByLabel("Estado civil", exacto).selectOption("soltero");
    await t.getByLabel("Ocupación del integrante", exacto).selectOption("estudiante");
    await t.getByLabel("Identidad de género", exacto).selectOption("cis_femenino");
    await elegirVarias(page, "Condición especial del integrante", ["Ninguna"]);
    await escribir(page, t.getByLabel("Ingresos mensuales del integrante", exacto), "0");
  },
  async () => { await siguiente("Subsidio y cierre financiero"); },
]);

await escena("paso3", [
  async () => {
    await marcar(page, page.getByRole("radio", { name: "Adquisición de vivienda nueva" }));
    await escribir(page, campo(page, "Nombre del proyecto habitacional"), "Altos del Ingenio");
    await escribir(page, campo(page, "Nombre de la constructora"), "Constructora Valle Demo");
    await clic(page, page.getByText("VIS (vivienda de interés social)", exacto));
    await escribir(page, campo(page, "Valor de la solución de vivienda VIS"), "150000000");
  },
  async () => {
    await marcar(page, page.getByRole("checkbox", { name: "Ahorro programado" }));
    await escribir(page, campo(page, "Valor de ahorro programado"), "6000000");
  },
  async () => {
    normal();
    await marcar(page, page.getByRole("checkbox", { name: /Declaro bajo la gravedad de juramento/ }));
    await firmar(page);
    await clic(page, page.getByRole("button", { name: "Enviar postulación" }));
    await page.getByTestId("radicado").waitFor({ timeout: 20000 });
  },
]);

await escena("confirmacion", [
  async () => {
    await apuntar(page, page.getByTestId("radicado"));
    await sleep(800);
    await apuntar(page, page.getByText("Código QR de su postulación"));
  },
  async () => { await apuntar(page, page.getByRole("heading", { name: "Siguientes pasos" }), { abajo: 260 }); },
]);

await escena("validacion", [
  async () => { await apuntar(page, page.getByText(/Permanezca en el sitio/)); },
  async () => { await apuntar(page, page.getByText(/Cuando lo llamen, entregue su documentación/)); },
  async () => { await apuntar(page, page.getByText(/Si no se presenta al llamado/)); },
]);

await page.goto(tarjetas("Recuerde", "Su registro cuenta cuando se valida", ["Es gratis y sin intermediarios", "Guarde su número de postulación", "Espere el llamado en el sitio", "Entregue su documentación completa"]));
await escena("cierre", [async () => { await sleep(200); await revelar(page, 0, 4, 900); }]);
await page.goto(pagina(`<h1>Su registro cuenta cuando se valida</h1><h2>Espere el llamado y entregue su documentación</h2>`));
await sleep(2500);

await cerrar(ses);
