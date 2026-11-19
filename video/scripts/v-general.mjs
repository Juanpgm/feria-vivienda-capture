// Tutorial 4: general guide (create account, sign in, users approval, menu, dashboard, records, postulación metrics,
// theme, sign out). Local dev server. SIMULATED: users list and approvals, records list, the registros summary and
// sign-out; postulación pages are real (only the fictitious demo record and aggregate counts are shown).
// Usage: node video/scripts/v-general.mjs   (after the validation tutorial: its demo record must exist, validated)
import { chromium } from "@playwright/test";
import fs from "node:fs";
import { abrir, apuntar, BASE, calentar, campo, cerrar, clic, cookieDeSesion, desplazar, escena, escribir, exacto, normal, pagina, portada, rapido, revelar, sleep, tarjetas } from "./lib.mjs";

const SERIE = "Guía general";
const dashboard = JSON.parse(fs.readFileSync(new URL("../work/dashboard.json", import.meta.url), "utf8"));
const uid = (n) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const fila = (n, nombre, doc, barrio, comuna, estrato, min) => ({
  id: uid(n), radicado: `FV-${String(n).padStart(6, "0")}`, nombre, tipo_documento: "cc", numero_documento: doc, barrio, comuna, estrato,
  estado: "registrado", estado_revision: "pendiente_revision", adjuntos_completos: true, registrado_por_nombre: "Funcionario Demo",
  registrado_en: new Date(Date.now() - min * 60_000).toISOString(),
});
const FILAS = [
  fila(123, "María Fernanda Ruiz Demo", "1000000001", "Aguacatal", "Comuna 1", 3, 3),
  fila(122, "Carlos Andrés Mora Demo", "1000000002", "El Calvario", "Comuna 3", 2, 38),
  fila(121, "Luz Marina Pérez Demo", "1000000003", "El Cedro", "Comuna 19", 3, 95),
  fila(120, "Jorge Iván Rojas Demo", "1000000004", "Asturias", "Comuna 12", 4, 160),
  fila(119, "Ana Lucía Gómez Demo", "1000000005", "Terron Colorado", "Comuna 1", 1, 240),
];
const usuarios = [
  { uid: "u1", nombre: "Ana María Pérez Gómez", correo: "ana.perez@example.test", rol: "usuario", estado: "pendiente" },
  { uid: "u2", nombre: "Luis Fernando Gómez", correo: "luis.gomez@example.test", rol: "usuario", estado: "pendiente" },
  { uid: "u3", nombre: "Carolina Ramírez", correo: "carolina.ramirez@example.test", rol: "usuario", estado: "aprobado" },
  { uid: "u4", nombre: "Funcionario Demo", correo: "funcionario@alcaldia.demo", rol: "admin", estado: "aprobado" },
];

// Phone screenshot of the open menu, shown on a slide (the recording itself stays 1280 wide).
async function capturaMenuMovil() {
  const b = await chromium.launch();
  const c = await b.newContext({ viewport: { width: 390, height: 760 }, deviceScaleFactor: 2 });
  await c.addCookies([cookieDeSesion()]);
  const p = await c.newPage();
  await p.route("**/api/dashboard**", (r) => r.fulfill({ json: dashboard }));
  await p.goto(`${BASE}/dashboard`, { waitUntil: "networkidle" });
  await p.getByRole("button", { name: "Menú" }).click();
  await p.evaluate((demo) => document.querySelectorAll("span").forEach((s) => { if (/@/.test(s.textContent ?? "") && s.children.length === 0) s.textContent = demo; }), "funcionario@alcaldia.demo");
  const png = await p.screenshot({ type: "png" });
  await b.close();
  return png.toString("base64");
}

await calentar(["/admin/usuarios", "/registros", "/dashboard", "/postulaciones?estado=valido", "/dashboard/postulaciones"]);
await calentar(["/login", "/registro"], { sesion: false });
const movil = await capturaMenuMovil();
let ses;
ses = await abrir("general", {
  sesion: false,
  api: {
    reales: [],
    simular: async (req, u) => {
      const m = req.method(), p = u.pathname;
      if (m === "GET" && p === "/api/dashboard") return dashboard;
      if (m === "GET" && p === "/api/usuarios") return { usuarios };
      const mu = p.match(/^\/api\/usuarios\/([^/]+)\/(aprobar|rechazar)$/);
      if (m === "POST" && mu) {
        const x = usuarios.find((k) => k.uid === mu[1]);
        Object.assign(x, mu[2] === "aprobar" ? { estado: "aprobado", motivo: null } : { estado: "rechazado", rechazado_por_correo: "funcionario@alcaldia.demo", rechazado_en: new Date().toISOString(), motivo: req.postDataJSON()?.motivo ?? null });
        return { ok: true };
      }
      if (m === "GET" && p === "/api/registros") {
        const q = (u.searchParams.get("q") ?? "").trim().toUpperCase();
        return { items: q ? FILAS.filter((f) => f.numero_documento.includes(q) || f.radicado.includes(q)) : FILAS, siguiente: null };
      }
      if (m === "POST" && p === "/api/auth/salir") { await ses.context.clearCookies(); return { ok: true }; }
      return undefined;
    },
  },
});
const { page, context } = ses;

await page.goto(portada(SERIE, "Cómo usar la aplicación", "Cuenta, ingreso, menú, métricas y reportes"));
await escena("intro", [null, async () => { await page.goto(tarjetas("En esta guía", "Para funcionarios y administradores", ["Crear cuenta e ingresar", "Aprobar usuarios", "Moverse por el menú", "Métricas y reportes"], "#")); await sleep(200); await revelar(page, 0, 4, 800); }]);

await escena("cuenta", [
  async () => {
    await page.goto(`${BASE}/login`);
    await page.getByRole("heading", { name: "Ingresar", level: 1 }).waitFor();
    await clic(page, page.getByRole("link", { name: "Crear cuenta", ...exacto }));
    await page.getByRole("heading", { name: "Crear cuenta", level: 1 }).waitFor();
  },
  async () => {
    rapido();
    await escribir(page, campo(page, "Nombre completo"), "Persona Demo");
    await escribir(page, campo(page, "Correo"), "persona.demo@example.test");
    await escribir(page, campo(page, "Contraseña"), "clave-demo-123", { tab: false });
    normal();
  },
  async () => { await apuntar(page, page.getByRole("button", { name: /con Google/ })); },
]);

await escena("ingreso", [
  async () => {
    await page.goto(`${BASE}/login`);
    await page.getByRole("heading", { name: "Ingresar", level: 1 }).waitFor();
    rapido();
    await escribir(page, campo(page, "Correo"), "funcionario@alcaldia.demo");
    await escribir(page, campo(page, "Contraseña"), "clave-demo-123", { tab: false });
    normal();
    await apuntar(page, page.getByRole("button", { name: "Ingresar", ...exacto }));
    await sleep(500);
    await apuntar(page, page.getByRole("button", { name: /con Google/ }));
  },
  async () => {
    await context.addCookies([cookieDeSesion()]);
    await page.goto(`${BASE}/dashboard`);
    await page.getByRole("heading", { name: "Resumen de registros", level: 1 }).waitFor({ timeout: 20000 });
  },
]);

const pendientes = page.locator("section", { has: page.getByRole("heading", { name: "Pendientes de aprobación" }) });
const noAprobados = page.locator("details", { hasText: "No aprobados" });
await escena("usuarios", [
  async () => {
    await clic(page, page.getByRole("link", { name: "Usuarios", ...exacto }));
    await page.getByRole("heading", { name: "Usuarios", level: 1 }).waitFor({ timeout: 20000 });
    await page.getByText("Cargando usuarios").waitFor({ state: "hidden" }).catch(() => {});
  },
  async () => {
    await clic(page, pendientes.getByRole("button", { name: "Aprobar a Ana María Pérez Gómez", ...exacto }));
    await clic(page, pendientes.getByRole("button", { name: "No aprobar a Luis Fernando Gómez", ...exacto }));
    const g = page.getByRole("group", { name: "Confirmar no aprobar a Luis Fernando Gómez", ...exacto });
    rapido();
    await escribir(page, g.getByLabel("Motivo (opcional)"), "Faltan datos", { tab: false });
    normal();
    await clic(page, g.getByRole("button", { name: "Confirmar no aprobar a Luis Fernando Gómez", ...exacto }));
  },
  async () => {
    await clic(page, noAprobados.locator("summary"));
    await apuntar(page, noAprobados.getByRole("button", { name: "Aprobar a Luis Fernando Gómez", ...exacto }));
    await sleep(500);
    await apuntar(page, page.getByRole("heading", { name: "Crear usuario" }), { abajo: 200 });
  },
]);

await escena("menu", [
  async () => {
    await page.evaluate(() => scrollTo({ top: 0, behavior: "smooth" }));
    await sleep(500);
    for (const n of ["Dashboard", "Registros", "Postulaciones", "Usuarios", "Ciudadanos", "Formulario postulación"]) {
      await apuntar(page, page.getByRole("navigation", { name: "Principal" }).getByRole("link", { name: n, ...exacto }));
      await sleep(350);
    }
  },
  async () => {
    await page.goto(pagina(`<div style="display:flex;align-items:center;gap:56px"><img src="data:image/png;base64,${movil}" style="height:520px;border-radius:28px;border:10px solid #111;box-shadow:0 20px 50px rgba(0,0,0,.45)"><div><h1>En el celular</h1><h2>Pulse Menú para ver las opciones</h2></div></div>`));
  },
]);

await escena("dashboard", [
  async () => {
    await page.goto(`${BASE}/dashboard`);
    await page.getByRole("heading", { name: "Resumen de registros", level: 1 }).waitFor({ timeout: 20000 });
    await sleep(500);
    await desplazar(page, 500, 1200);
    await sleep(300);
    await desplazar(page, 500, 1200);
  },
  async () => {
    await page.evaluate(() => scrollTo({ top: 0, behavior: "smooth" }));
    await sleep(600);
    await apuntar(page, page.getByRole("form", { name: "Filtros del resumen" }).getByLabel("Desde"));
    await sleep(400);
    await apuntar(page, page.getByRole("form", { name: "Filtros del resumen" }).getByLabel("Funcionario"));
    await sleep(400);
    await apuntar(page, page.getByRole("button", { name: "Actualizar" }));
  },
]);

await escena("registros", [
  async () => {
    await clic(page, page.getByRole("navigation", { name: "Principal" }).getByRole("link", { name: "Registros", ...exacto }));
    await campo(page, "Documento o radicado").waitFor({ timeout: 20000 });
    rapido();
    await escribir(page, campo(page, "Documento o radicado"), "1000000001", { tab: false });
    normal();
    await clic(page, page.getByRole("button", { name: "Buscar", ...exacto }));
    await apuntar(page, page.getByRole("link", { name: /FV-000123/ }).first());
  },
]);

await escena("postulaciones", [
  async () => {
    await page.goto(`${BASE}/postulaciones?estado=valido`);
    await page.getByRole("heading", { name: "Postulaciones al subsidio", level: 1 }).waitFor({ timeout: 20000 });
    await apuntar(page, page.getByRole("navigation", { name: "Principal" }).getByRole("link", { name: "Postulaciones", ...exacto }));
    await sleep(400);
    await clic(page, page.getByRole("link", { name: "Métricas", ...exacto }));
    await page.getByRole("heading", { name: "Postulaciones al Subsidio Distrital de Vivienda", level: 1 }).waitFor({ timeout: 20000 });
    await apuntar(page, page.getByText("Validadas", exacto).first());
  },
  async () => { await apuntar(page, page.getByText("Datos actualizados cada minuto.")); await desplazar(page, 500, 1200); },
]);

await escena("salir", [
  async () => {
    await page.evaluate(() => scrollTo({ top: 0, behavior: "smooth" }));
    await sleep(500);
    await clic(page, page.getByRole("button", { name: "Tema oscuro" }));
    await sleep(900);
    await clic(page, page.getByRole("button", { name: "Tema claro" }));
    await clic(page, page.getByRole("button", { name: "Cerrar sesión" }));
    await page.getByRole("heading", { name: "Ingresar", level: 1 }).waitFor({ timeout: 20000 });
  },
]);

await page.goto(tarjetas("Recuerde", "Buenas prácticas", ["No comparta su contraseña", "Cierre sesión al terminar", "Use el Dashboard para seguir el avance", "Las postulaciones se validan en persona"]));
await escena("cierre", [async () => { await sleep(200); await revelar(page, 0, 4, 800); }]);
await sleep(1200);

await cerrar(ses);
