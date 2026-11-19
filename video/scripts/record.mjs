// Records the tutorial against BASE_URL (default: production) with Playwright, ONE continuous page/video.
// Safety: every /api/** call is answered by an in-memory double (never reaches the server); unknown ones get 501.
// Non-base hosts are aborted. The session cookie is read in memory from .auth/state.json (never written anywhere).
//
// Env: BASE_URL, AUTH_STATE (storageState with the "sesion" cookie), PROBE=1 (only check that the session is accepted).
// Output: work/raw.webm + work/timeline.json (start second of every narrated sentence, used by build.py).
import { chromium } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const REPO = path.resolve(ROOT, "..");
const BASE = (process.env.BASE_URL ?? "https://feria-vivienda.vercel.app").replace(/\/$/, "");
const STATE = process.env.AUTH_STATE ?? path.join(REPO, ".auth", "state.json");
const WORK = path.join(ROOT, "work");
const GAP = 0.25; // seconds of silence after each sentence
const W = 1280;
const H = 624; // viewport; build.py adds a 96 px caption bar below (1280x720 total)
const DEMO_EMAIL = "funcionario@alcaldia.demo";
const exacto = { exact: true };

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let t0 = 0;
const now = () => (Date.now() - t0) / 1000;
const hasta = async (t) => sleep(Math.max(0, (t - now()) * 1000));

const dur = JSON.parse(fs.readFileSync(path.join(WORK, "durations.json"), "utf8"));
const dashboard = JSON.parse(fs.readFileSync(path.join(WORK, "dashboard.json"), "utf8"));
const detalle = JSON.parse(fs.readFileSync(path.join(WORK, "detalle.json"), "utf8"));

// ---------------------------------------------------------------- API doubles (fictitious data only)
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
const usuariosIniciales = () => [
  { uid: "u1", nombre: "Ana María Pérez Gómez", correo: "ana.perez@example.test", rol: "usuario", estado: "pendiente" },
  { uid: "u2", nombre: "Luis Fernando Gómez", correo: "luis.gomez@example.test", rol: "usuario", estado: "pendiente" },
  { uid: "u3", nombre: "Carolina Ramírez", correo: "carolina.ramirez@example.test", rol: "usuario", estado: "aprobado" },
  { uid: "u4", nombre: "Funcionario Demo", correo: DEMO_EMAIL, rol: "admin", estado: "aprobado" },
];

async function instalarApi(context) {
  const usuarios = usuariosIniciales();
  const hostBase = new URL(BASE).host;
  // Anything that is not the app itself (Firebase, Google, analytics...) is cut off.
  await context.route((u) => !["data:", "blob:", "about:"].includes(u.protocol) && u.host !== hostBase, (r) => r.abort());
  await context.route("**/api/**", async (route) => {
    const req = route.request();
    const u = new URL(req.url());
    const p = u.pathname;
    const m = req.method();
    const json = (body, status = 200) => route.fulfill({ status, contentType: "application/json", body: JSON.stringify(body) });
    if (m === "GET" && p === "/api/dashboard") return json(dashboard);
    if (m === "GET" && p === "/api/usuarios") return json({ usuarios });
    const mu = p.match(/^\/api\/usuarios\/([^/]+)\/(aprobar|rechazar)$/);
    if (m === "POST" && mu) {
      const x = usuarios.find((k) => k.uid === mu[1]);
      if (!x) return json({ error: "Usuario no encontrado" }, 404);
      const body = req.postDataJSON() ?? {};
      if (mu[2] === "aprobar") Object.assign(x, { estado: "aprobado", rechazado_por_correo: null, rechazado_en: null, motivo: null });
      else Object.assign(x, { estado: "rechazado", rechazado_por_correo: DEMO_EMAIL, rechazado_en: new Date().toISOString(), motivo: body.motivo ?? null });
      return json({ ok: true });
    }
    if (m === "GET" && p === "/api/registros/duplicado") {
      const n = (u.searchParams.get("numero") ?? "").replace(/\D/g, "");
      if (n === "1000000099")
        return json({ existe: true, coincidencia: "exacta", cantidad: 1, radicado: "FV-000045", fecha_registro_bogota: new Date(Date.now() - 86_400_000).toISOString().slice(0, 10), registrado_por_nombre: "Funcionario Demo", estado_revision: "pendiente_revision" });
      return json({ existe: false });
    }
    if (m === "GET" && p === "/api/registros") {
      const q = (u.searchParams.get("q") ?? "").trim().toUpperCase();
      const items = q ? FILAS.filter((f) => f.numero_documento.includes(q) || f.radicado.includes(q)) : FILAS;
      return json({ items, siguiente: null });
    }
    if (m === "POST" && p === "/api/registros") {
      const body = req.postDataJSON() ?? {};
      return json({ id: body.id, radicado: "FV-000123", creado: true, registrado_en: new Date().toISOString(), advertencias: [] }, 201);
    }
    if (m === "POST" && /^\/api\/registros\/[^/]+\/adjuntos$/.test(p)) return json({ tipo: req.postDataJSON()?.tipo, bytes: 52000, sin_cambios: false });
    if (m === "POST" && /^\/api\/registros\/[^/]+\/completar$/.test(p)) return json({ completo: true, requeridos: 3, presentes: 3, faltan: [] });
    if (m === "GET" && /^\/api\/registros\/[^/]+$/.test(p)) {
      const en = new Date(Date.now() - 4 * 60_000).toISOString();
      return json({ ...detalle, registrado_en: en, estado_revision_en: en, fecha_registro_bogota: en.slice(0, 10), consentimiento: { ...detalle.consentimiento, aceptado_en: en }, firma: { ...detalle.firma, firmado_en: en }, historial: [{ ...detalle.historial[0], en }] });
    }
    console.warn(`[api no simulada -> 501] ${m} ${p}`);
    return json({ error: "No simulado en la grabación" }, 501);
  });
}

// ---------------------------------------------------------------- page overlay: cursor, click ring, privacy, no dev badge
function overlay({ demo }) {
  const css = `
    nextjs-portal,[data-nextjs-toast],[data-nextjs-dev-tools-button],vercel-live-feedback,[data-vercel-toolbar]{display:none!important}
    header nav[aria-label="Principal"] span.text-muted:not([data-demo]){visibility:hidden!important}
    #__cur{position:fixed;left:0;top:0;z-index:2147483647;pointer-events:none;width:26px;height:26px;margin:-2px 0 0 -2px;filter:drop-shadow(0 1px 2px rgba(0,0,0,.55))}
    #__cur.off{display:none}
  `;
  const fixEmail = () => {
    document.querySelectorAll('header nav[aria-label="Principal"] span.text-muted').forEach((s) => {
      if (s.textContent !== demo) s.textContent = demo;
      s.setAttribute("data-demo", "1");
    });
  };
  const montar = () => {
    if (!document.documentElement) return; // init scripts can run before <html> exists
    if (!document.getElementById("__demo_css")) {
      const st = document.createElement("style");
      st.id = "__demo_css";
      st.textContent = css;
      document.documentElement.appendChild(st);
    }
    if (!document.getElementById("__cur")) {
      const c = document.createElement("div");
      c.id = "__cur";
      c.innerHTML = '<svg viewBox="0 0 24 24" width="26" height="26"><path d="M3 2l17 9.5-7.5 1.8L9.6 21z" fill="#fff" stroke="#111" stroke-width="1.6" stroke-linejoin="round"/></svg>';
      let pos = [-50, -50];
      try { pos = JSON.parse(sessionStorage.getItem("__cur") ?? "[-50,-50]"); } catch { /* storage may be blocked */ }
      c.style.transform = `translate(${pos[0]}px,${pos[1]}px)`;
      document.documentElement.appendChild(c);
    }
  };
  const obs = new MutationObserver(() => { fixEmail(); montar(); });
  obs.observe(document, { childList: true, subtree: true, characterData: true });
  montar();
  addEventListener("DOMContentLoaded", () => { montar(); fixEmail(); });
  addEventListener("mousemove", (e) => {
    const c = document.getElementById("__cur");
    if (c) c.style.transform = `translate(${e.clientX}px,${e.clientY}px)`;
    try { sessionStorage.setItem("__cur", JSON.stringify([e.clientX, e.clientY])); } catch { /* ignore */ }
  }, true);
  addEventListener("mousedown", (e) => {
    const r = document.createElement("div");
    r.style.cssText = `position:fixed;z-index:2147483646;pointer-events:none;left:${e.clientX - 22}px;top:${e.clientY - 22}px;width:44px;height:44px;border-radius:50%;border:4px solid #f59e0b;background:rgba(245,158,11,.25)`;
    document.documentElement.appendChild(r);
    r.animate([{ transform: "scale(.4)", opacity: 1 }, { transform: "scale(1.5)", opacity: 0 }], { duration: 550, easing: "ease-out" }).onfinish = () => r.remove();
  }, true);
}

// ---------------------------------------------------------------- human-like helpers
let mx = 640;
let my = 300;
const P = { mouse: 420, type: 45, pausa: 250 };
const rapido = () => Object.assign(P, { mouse: 200, type: 16, pausa: 80 });
const normal = () => Object.assign(P, { mouse: 380, type: 40, pausa: 200 });

async function mover(page, x, y, ms = P.mouse) {
  const n = Math.max(6, Math.round(ms / 16));
  const x0 = mx, y0 = my;
  const arco = Math.min(40, Math.hypot(x - x0, y - y0) / 8) * (Math.random() < 0.5 ? -1 : 1);
  for (let i = 1; i <= n; i++) {
    const k = i / n;
    const e = k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2;
    await page.mouse.move(x0 + (x - x0) * e + Math.sin(Math.PI * e) * arco, y0 + (y - y0) * e);
    await sleep(ms / n);
  }
  mx = x; my = y;
}
const soltar = async (page) => {
  await page.evaluate(() => document.activeElement?.blur?.()); // known quirk: blur first so a shifting error cannot swallow the next click
  await sleep(P.pausa);
};
async function aVista(loc, { arriba = 70, abajo = 110 } = {}) {
  let b = await loc.boundingBox();
  if (!b || b.y < arriba || b.y + b.height > H - abajo) {
    await loc.evaluate((el) => el.scrollIntoView({ block: "center", behavior: "smooth" }));
    // wait until the smooth scroll settles, so the pointer never aims at a stale position
    let ultimo = -1e9;
    for (let i = 0; i < 40; i++) {
      await sleep(60);
      b = await loc.boundingBox();
      if (b && Math.abs(b.y - ultimo) < 0.5 && i > 2) break;
      ultimo = b?.y ?? -1e9;
    }
  }
  return b;
}
async function apuntar(page, loc, opts) {
  const b = await aVista(loc, opts);
  if (!b) throw new Error("target without box");
  await mover(page, b.x + Math.min(b.width / 2, 120), b.y + b.height / 2);
  return b;
}
async function clic(page, loc, opts = {}) {
  if (opts.blur !== false) await soltar(page);
  await apuntar(page, loc, opts);
  await page.mouse.down();
  await sleep(40);
  await page.mouse.up();
  await sleep(P.pausa);
}
async function marcar(page, loc) {
  await clic(page, loc);
  if (!(await loc.isChecked().catch(() => true))) await loc.check({ force: true });
}
async function escribir(page, loc, texto, { tab = true, borrar = false } = {}) {
  await clic(page, loc);
  if (borrar) await page.keyboard.press("Control+A");
  await page.keyboard.type(texto, { delay: P.type });
  if (tab) await page.keyboard.press("Tab");
  await sleep(P.pausa);
}
async function combo(page, loc, texto) {
  await escribir(page, loc, texto, { tab: false });
  await page.getByRole("option").first().waitFor({ state: "visible", timeout: 8000 });
  await sleep(P.pausa);
  await page.keyboard.press("Enter");
  await page.keyboard.press("Tab");
  await sleep(P.pausa);
}
async function elegirVarias(page, nombre, etiquetas) {
  const c = page.getByRole("combobox", { name: nombre, ...exacto });
  await clic(page, c);
  for (const e of etiquetas) await clic(page, page.getByRole("option", { name: e, ...exacto }), { abajo: 40, blur: false });
  await page.keyboard.press("Escape");
  await sleep(P.pausa);
}
async function desplazar(page, dy, ms = 900) {
  const pasos = Math.round(ms / 30);
  for (let i = 0; i < pasos; i++) {
    await page.mouse.wheel(0, dy / pasos);
    await sleep(30);
  }
}
const campo = (page, l) => page.getByLabel(l, exacto);
const grupo = (page, n) => page.getByRole("group", { name: n, ...exacto });
const titulo = (page, t) => page.getByRole("heading", { level: 2, name: t });
async function siguiente(page, proximo) {
  await soltar(page);
  const b = page.getByRole("button", { name: "Siguiente", ...exacto });
  const bb = await b.boundingBox();
  await mover(page, bb.x + bb.width / 2, bb.y + bb.height / 2);
  await page.mouse.down(); await sleep(70); await page.mouse.up();
  await titulo(page, proximo).waitFor({ state: "visible", timeout: 15000 });
  await sleep(200);
}

// ---------------------------------------------------------------- slides (data: URLs so the init script also runs there)
const ESTILO = `body{margin:0;font-family:system-ui,Segoe UI,Arial,sans-serif;background:linear-gradient(135deg,#0b3b66,#13609b);color:#fff;min-height:100vh;display:flex;flex-direction:column;justify-content:center;padding:0 56px;box-sizing:border-box}
h1{font-size:54px;margin:0 0 6px}h2{font-size:34px;margin:0 0 22px;font-weight:600;color:#cfe6ff}p{font-size:28px;margin:6px 0;color:#e6f1ff}
.g{display:grid;grid-template-columns:1fr 1fr;gap:14px}.c{background:rgba(255,255,255,.12);border:2px solid rgba(255,255,255,.35);border-radius:16px;padding:14px 18px;font-size:26px;line-height:1.2;display:flex;gap:12px;align-items:center;opacity:0;transform:translateY(14px);transition:all .45s}
.c.v{opacity:1;transform:none}.c b{flex:none;width:34px;height:34px;border-radius:50%;background:#f59e0b;color:#111;display:grid;place-items:center;font-size:22px}`;
const pagina = (cuerpo) => `data:text/html;charset=utf-8,${encodeURIComponent(`<!doctype html><meta charset="utf-8"><title>Guía</title><style>${ESTILO}</style><body>${cuerpo}</body>`)}`;
const tarjetas = (xs) => `<div class="g">${xs.map((x) => `<div class="c"><b>✓</b><span>${x}</span></div>`).join("")}</div>`;
const FOTOS = ["Buena luz natural, sin flash", "Documento plano sobre fondo oscuro liso", "Documento completo: los cuatro bordes visibles", "Sin reflejos ni dedos", "Enfocar antes de tomar", "Comprobar que se lea el texto y el número", "Frente y reverso, con el celular en horizontal", "Volver a tomar si sale borrosa"];
const FERIA = ["Cargar el equipo y tener wifi o datos estables", "Consultar si la persona ya fue atendida (buscar el documento)", "Un borrador por persona", "Leer el consentimiento a la persona", "Revisar el resumen con ella antes de enviar", "Pedir la firma en pantalla", "Anotar o dictar el radicado al final", "No compartir contraseñas", "Cerrar sesión en equipos compartidos"];
const revelar = async (page, desde, hasta_) => {
  for (let i = desde; i < hasta_; i++) {
    await page.evaluate((k) => document.querySelectorAll(".c")[k]?.classList.add("v"), i);
    await sleep(950);
  }
};

// ---------------------------------------------------------------- demo ID photos (drawn, clearly fake)
async function fotosDemo(browser) {
  const ctx = await browser.newContext();
  const pg = await ctx.newPage();
  const dibujar = (lado) =>
    pg.evaluate((lado) => {
      const c = document.createElement("canvas");
      c.width = 1280; c.height = 800;
      const x = c.getContext("2d");
      x.fillStyle = "#2b2f36"; x.fillRect(0, 0, 1280, 800); // dark flat background
      x.save(); x.translate(640, 400); x.rotate(-0.02);
      x.fillStyle = "#e8eef5"; x.fillRect(-520, -320, 1040, 640);
      x.fillStyle = "#c9d6e6"; x.fillRect(-520, -320, 1040, 90);
      x.fillStyle = "#1f3b5c"; x.font = "bold 34px sans-serif"; x.fillText("DOCUMENTO DE EJEMPLO · SIN VALOR LEGAL", -490, -258);
      if (lado === "frente") {
        x.fillStyle = "#9db2cb"; x.fillRect(-490, -190, 260, 330);
        x.fillStyle = "#6f87a6"; x.beginPath(); x.arc(-360, -80, 70, 0, 7); x.fill(); x.fillRect(-440, -10, 160, 130);
        x.fillStyle = "#222"; x.font = "bold 30px sans-serif";
        x.fillText("NÚMERO 1.000.000.001", -190, -140);
        x.font = "26px sans-serif"; x.fillText("APELLIDOS", -190, -80);
        x.font = "bold 40px sans-serif"; x.fillText("RUIZ DEMO", -190, -35);
        x.font = "26px sans-serif"; x.fillText("NOMBRES", -190, 25);
        x.font = "bold 40px sans-serif"; x.fillText("MARÍA FERNANDA", -190, 70);
        x.font = "26px sans-serif"; x.fillText("NACIMIENTO 12-MAY-1985", -190, 130);
        x.fillText("PERSONA FICTICIA PARA DEMOSTRACIÓN", -490, 255);
      } else {
        x.fillStyle = "#222";
        for (let i = 0; i < 70; i++) x.fillRect(-480 + i * 9, -170, 2 + (i % 4), 150);
        x.font = "bold 34px sans-serif"; x.fillText("1000000001", -480, 20);
        x.font = "26px sans-serif"; x.fillText("REVERSO · EJEMPLO DIDÁCTICO", -480, 90);
        x.fillText("ESTE DOCUMENTO NO ES REAL", -480, 140);
      }
      x.restore();
      return c.toDataURL("image/jpeg", 0.88).split(",")[1];
    }, lado);
  const out = { frente: Buffer.from(await dibujar("frente"), "base64"), reverso: Buffer.from(await dibujar("reverso"), "base64") };
  await ctx.close();
  return out;
}

// ---------------------------------------------------------------- narrated scenes
const timeline = [];
async function escena(nombre, acciones) {
  const ds = dur[nombre];
  for (let i = 0; i < ds.length; i++) {
    const start = now();
    timeline.push({ scene: nombre, i, start: +start.toFixed(3), dur: ds[i] });
    const fin = start + ds[i] + GAP;
    try { await acciones[i]?.(); } catch (e) { console.error(`ERROR ${nombre}[${i}]: ${e.message}`); throw e; }
    const extra = now() - fin;
    if (extra > 0.05) console.warn(`overrun ${nombre}[${i}] +${extra.toFixed(1)}s`);
    await hasta(fin);
  }
}

function cookieDeSesion() {
  const s = JSON.parse(fs.readFileSync(STATE, "utf8"));
  const c = s.cookies.find((k) => k.name === "sesion") ?? s.cookies[0];
  if (!c) throw new Error("no session cookie in storage state");
  return { name: c.name, value: c.value, url: BASE, httpOnly: c.httpOnly, secure: true, sameSite: c.sameSite ?? "Lax", expires: c.expires };
}

async function main() {
  fs.rmSync(path.join(WORK, "raw"), { recursive: true, force: true });
  const browser = await chromium.launch();
  const fotos = await fotosDemo(browser);
  const context = await browser.newContext({
    viewport: { width: W, height: H }, locale: "es-CO", timezoneId: "America/Bogota", colorScheme: "light",
    recordVideo: { dir: path.join(WORK, "raw"), size: { width: W, height: H } },
  });
  await context.addInitScript(overlay, { demo: DEMO_EMAIL });
  await instalarApi(context);
  t0 = Date.now();
  const page = await context.newPage();
  page.on("console", (m) => { if (["error", "warning"].includes(m.type())) console.log(`[console ${m.type()}] ${m.text().slice(0, 160)}`); });
  await page.mouse.move(mx, my);

  if (process.env.PROBE) {
    await context.addCookies([cookieDeSesion()]);
    await page.goto(`${BASE}/dashboard`);
    await sleep(1500);
    await mover(page, 700, 330, 300);
    await page.mouse.down();
    await sleep(120);
    console.log("PROBE cursor:", await page.evaluate(() => { const c = document.getElementById("__cur"); return c ? [c.style.transform, getComputedStyle(c).display] : null; }));
    console.log("PROBE final path:", new URL(page.url()).pathname);
    await page.screenshot({ path: path.join(WORK, "probe.png") });
    await context.close(); await browser.close();
    return;
  }

  // 0. Title card
  await page.goto(pagina(`<h1>Feria de Vivienda</h1><h2>Guía de uso de la aplicación</h2><p>Registro de solicitantes · Seguimiento</p>`));
  await escena("intro", []);

  // 1. Login / create account (public: no session cookie yet)
  await escena("login", [
    async () => {
      await page.goto(`${BASE}/login`);
      await page.getByRole("heading", { name: "Ingresar", level: 1 }).waitFor();
      await escribir(page, campo(page, "Correo"), DEMO_EMAIL, { tab: true });
      await escribir(page, campo(page, "Contraseña"), "demo-clave-123", { tab: false });
      await apuntar(page, page.getByRole("button", { name: "Ingresar con Google", ...exacto }));
    },
    async () => {
      await clic(page, page.getByRole("link", { name: "Crear cuenta", ...exacto }));
      await page.getByRole("heading", { name: "Crear cuenta", level: 1 }).waitFor();
      await escribir(page, campo(page, "Nombre completo"), "Persona Demo", { tab: true });
    },
    async () => { await apuntar(page, page.getByRole("button", { name: "Crear cuenta con Google", ...exacto })); },
  ]);

  rapido();
  // session from here on (authenticated pages)
  await context.addCookies([cookieDeSesion()]);

  // 2. Admin: users
  const seccionUsuarios = page.locator("section", { has: page.getByRole("heading", { name: "Pendientes de aprobación" }) });
  const noAprobados = page.locator("details", { hasText: "No aprobados" });
  await escena("admin", [
    async () => {
      await page.goto(`${BASE}/admin/usuarios`);
      if (new URL(page.url()).pathname !== "/admin/usuarios") throw new Error(`session rejected, landed on ${new URL(page.url()).pathname}`);
      await page.getByRole("heading", { name: "Usuarios", exact: true, level: 1 }).waitFor();
      await page.getByText("Cargando usuarios").waitFor({ state: "hidden" }).catch(() => {});
      await apuntar(page, page.getByRole("link", { name: "Usuarios", ...exacto }));
    },
    async () => {
      await apuntar(page, seccionUsuarios.getByRole("button", { name: "Aprobar a Ana María Pérez Gómez", ...exacto }));
      await clic(page, seccionUsuarios.getByRole("button", { name: "No aprobar a Luis Fernando Gómez", ...exacto }));
      const g = page.getByRole("group", { name: "Confirmar no aprobar a Luis Fernando Gómez", ...exacto });
      await escribir(page, g.getByLabel("Motivo (opcional)"), "Faltan datos", { tab: false });
      await clic(page, g.getByRole("button", { name: "Confirmar no aprobar a Luis Fernando Gómez", ...exacto }));
    },
    async () => {
      await clic(page, noAprobados.locator("summary"));
      await clic(page, noAprobados.getByRole("button", { name: "Aprobar a Luis Fernando Gómez", ...exacto }));
      await apuntar(page, page.getByRole("heading", { name: "Crear usuario" }), { abajo: 200 });
    },
  ]);

  // 3. New record: list -> drafts -> form
  await escena("nuevo", [
    async () => {
      await clic(page, page.getByRole("link", { name: "Registros", ...exacto }).first());
      await page.getByRole("heading", { name: "Registros", level: 1 }).waitFor();
      await page.getByRole("link", { name: "Nuevo registro" }).first().waitFor();
      await clic(page, page.getByRole("link", { name: "Nuevo registro" }).first());
      await titulo(page, "Borradores en curso").waitFor();
    },
    async () => {
      await apuntar(page, titulo(page, "Borradores en curso"));
      await clic(page, page.getByRole("button", { name: "Nuevo registro", ...exacto }));
      await titulo(page, "Solicitante").waitFor();
    },
    async () => {
      const sig = page.getByRole("button", { name: "Siguiente", ...exacto });
      const atras = page.getByRole("button", { name: "Atrás", ...exacto });
      for (const b of [atras, sig]) { const bb = await b.boundingBox(); await mover(page, bb.x + bb.width / 2, bb.y + bb.height / 2); await sleep(500); }
    },
  ]);

  // 4. Step 1
  const ETIQ = ["Primer nombre", "Segundo nombre (opcional)", "Primer apellido", "Segundo apellido (opcional)"];
  const NOMBRE = ["María", "Fernanda", "Ruiz", "Demo"];
  const numero = () => campo(page, "Número de documento");
  await escena("p1", [
    async () => {
      rapido();
      for (let i = 0; i < 4; i++) await escribir(page, campo(page, ETIQ[i]), NOMBRE[i]);
      await marcar(page, grupo(page, "Tipo de documento").getByRole("radio", { name: "C.C.", ...exacto }));
      await apuntar(page, page.getByRole("combobox", { name: "Nacionalidad", ...exacto }));
      await escribir(page, numero(), "1000000099");
      await escribir(page, campo(page, "Fecha de expedición"), "15032010");
    },
    async () => {
      const aviso = page.getByText("Ya existe un registro con este documento");
      await aviso.waitFor({ state: "visible", timeout: 8000 }).catch(() => console.warn("duplicate notice did not show"));
      await apuntar(page, aviso).catch(() => {});
      await sleep(1200);
      await escribir(page, numero(), "1000000001", { borrar: true });
    },
    async () => {
      await apuntar(page, page.getByRole("combobox", { name: "Código de país del teléfono principal", ...exacto }));
      await escribir(page, campo(page, "Teléfono principal"), "3005550101");
      await escribir(page, campo(page, "Correo electrónico"), "demo@example.test");
    },
    async () => {
      rapido();
      await escribir(page, campo(page, "Fecha de nacimiento"), "12051985");
      await apuntar(page, campo(page, "Estado civil"));
      await campo(page, "Estado civil").selectOption("soltero");
      await escribir(page, campo(page, "Años de residencia"), "12");
      await siguiente(page, "Hogar");
    },
  ]);

  // 5. Step 2
  await escena("p2", [
    async () => {
      rapido();
      await escribir(page, campo(page, "Personas que viven en el hogar"), "4");
      await marcar(page, grupo(page, "¿Hay adultos mayores en el hogar?").getByRole("radio", { name: "Sí", ...exacto }));
      await escribir(page, campo(page, "Cuántos adultos mayores"), "1");
      await escribir(page, campo(page, "Edad del adulto mayor 1"), "68");
      await escribir(page, campo(page, "Ingreso mensual del hogar (COP)"), "3200000");
    },
    async () => {
      await elegirVarias(page, "Condiciones del solicitante o su hogar", ["Mujer cabeza de hogar"]);
      await siguiente(page, "Vivienda");
    },
  ]);

  // 6. Step 3
  await escena("p3", [
    async () => {
      rapido();
      await escribir(page, campo(page, "Dirección del inmueble"), "Calle 5 # 10-20");
      await combo(page, page.getByRole("combobox", { name: "Comuna o corregimiento", ...exacto }), "Comuna 1");
      await combo(page, page.getByRole("combobox", { name: "Barrio o vereda", ...exacto }), "Aguacatal");
      await marcar(page, grupo(page, "Estrato socioeconómico").getByRole("radio", { name: "3", ...exacto }));
    },
    async () => {
      rapido();
      await marcar(page, grupo(page, "¿Está registrado en el RUD?").getByRole("radio", { name: "Sí", ...exacto }));
      await escribir(page, campo(page, "Número de RUD"), "RUD-12345");
      await apuntar(page, campo(page, "Resultado del dictamen técnico"));
      await campo(page, "Resultado del dictamen técnico").selectOption({ label: "Colapso Total (Destruido)" });
      await marcar(page, grupo(page, "El solicitante es").getByRole("radio", { name: "Propietario con título o Certificado de Libertad y Tradición (CLT)", ...exacto }));
      await escribir(page, campo(page, "Número de matrícula (opcional)"), "370-123456");
      await marcar(page, grupo(page, "¿Es su única propiedad residencial?").getByRole("radio", { name: "Sí", ...exacto }));
      await siguiente(page, "Cierre financiero");
    },
  ]);

  // 7. Step 4
  await escena("p4", [
    async () => {
      rapido();
      await elegirVarias(page, "Fuentes de financiación", ["Crédito hipotecario / Leasing habitacional", "Recursos propios"]);
      await marcar(page, grupo(page, "¿El inmueble tenía seguro?").getByRole("radio", { name: "Sí", ...exacto }));
      await combo(page, page.getByRole("combobox", { name: "Aseguradora", ...exacto }), "Allianz");
      await escribir(page, campo(page, "Observaciones (opcional)"), "Llegó con su hermana.");
      await siguiente(page, "Autorización y documento");
    },
  ]);

  // 8. Step 5
  const TXT_TRAT = "El titular autoriza el tratamiento de sus datos personales";
  const TXT_SENS = "Autoriza el tratamiento de datos sensibles (opcional)";
  await escena("p5", [
    async () => {
      await marcar(page, page.getByRole("checkbox", { name: TXT_TRAT, ...exacto }));
      await marcar(page, page.getByRole("checkbox", { name: TXT_SENS, ...exacto }));
    },
    async () => {
      const f = campo(page, "Archivo de imagen: frente del documento");
      await f.waitFor({ state: "attached" });
      await apuntar(page, f);
      await f.setInputFiles({ name: "frente.jpg", mimeType: "image/jpeg", buffer: fotos.frente });
      await sleep(500);
      const r = campo(page, "Archivo de imagen: reverso del documento");
      await apuntar(page, r);
      await r.setInputFiles({ name: "reverso.jpg", mimeType: "image/jpeg", buffer: fotos.reverso });
      await page.getByRole("img", { name: /Vista previa: reverso/ }).waitFor({ state: "visible", timeout: 10000 });
      await sleep(700);
      await siguiente(page, "Revisión y firma");
    },
  ]);

  // 9. Step 6
  await escena("p6", [
    async () => {
      await sleep(300);
      await apuntar(page, page.locator('[aria-label^="Editar "]').first(), { abajo: 120 }).catch(() => console.warn("Editar not found"));
      await sleep(900);
      await desplazar(page, 300, 1100);
      await sleep(300);
      await desplazar(page, 300, 1100);
    },
    async () => {
      const pad = page.getByTestId("pad-firma");
      await pad.evaluate((el) => el.scrollIntoView({ block: "center", behavior: "smooth" }));
      await sleep(800);
      const b = await pad.boundingBox();
      const pt = (fx, fy) => [b.x + b.width * fx, b.y + b.height * fy];
      const [sx, sy] = pt(0.12, 0.6);
      await mover(page, sx, sy, 350);
      await page.mouse.down();
      for (let i = 0; i <= 70; i++) {
        const t = i / 70;
        const [x, y] = pt(0.12 + 0.72 * t + 0.05 * Math.sin(t * 18), 0.5 + 0.28 * Math.sin(t * 15) * (1 - 0.6 * t) - 0.1 * Math.sin(t * 5));
        await page.mouse.move(x, y);
        await sleep(10);
      }
      await page.mouse.up();
      const [ux, uy] = pt(0.16, 0.82);
      await mover(page, ux, uy, 200);
      await page.mouse.down();
      for (let i = 1; i <= 20; i++) { const [x, y] = pt(0.16 + 0.6 * (i / 20), 0.82 - 0.03 * (i / 20)); await page.mouse.move(x, y); await sleep(14); }
      await page.mouse.up();
      mx = pt(0.76, 0.8)[0]; my = pt(0.76, 0.8)[1];
      await clic(page, page.getByRole("button", { name: "Usar esta firma", ...exacto }));
      await page.getByText("Firma registrada.", exacto).waitFor({ timeout: 8000 });
    },
    async () => {
      await clic(page, page.getByRole("button", { name: "Enviar registro", ...exacto }));
      await page.getByTestId("radicado").waitFor({ timeout: 30000 });
      await apuntar(page, page.getByTestId("radicado"));
    },
  ]);

  // 10. Records list + detail
  await escena("registros", [
    async () => {
      rapido();
      await clic(page, page.getByRole("link", { name: "Registros", ...exacto }).first());
      await campo(page, "Documento o radicado").waitFor();
      await escribir(page, campo(page, "Documento o radicado"), "1000000001", { tab: false });
      await clic(page, page.getByRole("button", { name: "Buscar", ...exacto }));
      const enlace = page.getByRole("link", { name: /FV-000123/ }).first();
      await enlace.waitFor({ timeout: 8000 });
      await clic(page, enlace);
      await page.getByRole("heading", { name: "Registro FV-000123", level: 1 }).waitFor({ timeout: 10000 });
      await page.getByRole("heading", { name: "Documento de identidad" }).scrollIntoViewIfNeeded();
      await desplazar(page, 500, 900);
    },
  ]);

  // 11. Dashboard
  await escena("dashboard", [
    async () => {
      rapido();
      await clic(page, page.getByRole("link", { name: "Dashboard", ...exacto }));
      const h = page.getByRole("heading", { name: "Resumen de registros", level: 1 });
      if (!(await h.waitFor({ timeout: 4000 }).then(() => true, () => false))) {
        console.warn(`dashboard click did not navigate (at ${new URL(page.url()).pathname}); using goto`);
        await page.goto(`${BASE}/dashboard`);
        await h.waitFor({ timeout: 10000 });
      }
      await sleep(900);
      for (let i = 0; i < 3; i++) { await desplazar(page, 450, 800); await sleep(300); }
    },
  ]);

  // 12. Recommendations (slides)
  await page.goto(pagina(`<h1>Recomendaciones</h1><h2>Fotos del documento y trabajo en la feria</h2>`));
  await escena("reco", [
    async () => {},
    async () => {
      await page.goto(pagina(`<h1>Recomendaciones</h1><h2>Fotos del documento</h2>${tarjetas(FOTOS)}`));
      await sleep(300);
      await revelar(page, 0, 4);
    },
    async () => { await revelar(page, 4, 8); },
    async () => {
      await page.goto(pagina(`<h1>Recomendaciones</h1><h2>En la feria</h2>${tarjetas(FERIA)}`));
      await sleep(300);
      await revelar(page, 0, 3);
    },
    async () => { await revelar(page, 3, 7); },
    async () => { await revelar(page, 7, 9); },
  ]);
  await sleep(1500);
  const fin = now();
  await context.close();
  fs.writeFileSync(path.join(WORK, "timeline.json"), JSON.stringify({ total: fin, items: timeline }, null, 1));
  const v = await page.video().path();
  fs.copyFileSync(v, path.join(WORK, "raw.webm"));
  await browser.close();
  console.log(`recorded ${fin.toFixed(1)} s -> work/raw.webm`);
}

main().catch((e) => { console.error(e); process.exit(1); });
