// Shared recorder for the short tutorials under video/tutoriales/<id>: one continuous Playwright page per video,
// narrated scenes timed by the sentence WAV durations (work/<id>/durations.json), visible cursor and click rings,
// privacy masks (test account e-mail/name, test radicado series, "Prueba" badge) and per-video API doubles.
//
// Env: BASE_URL (default the local dev server), AUTH_STATE (Playwright storageState with the "sesion" cookie).
import { chromium } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const REPO = path.resolve(ROOT, "..");
export const BASE = (process.env.BASE_URL ?? "http://localhost:3000").replace(/\/$/, "");
const STATE = process.env.AUTH_STATE ?? path.join(REPO, ".auth", "state.json");
const GAP = 0.3; // seconds of silence after each sentence
export const W = 1280;
export const H = 624; // build.py adds a 96 px caption bar below (1280x720 total)
export const DEMO_EMAIL = "funcionario@alcaldia.demo";
export const exacto = { exact: true };

// What must never appear on screen: the test account, and the test series of radicados (shown as a normal one).
const REEMPLAZOS = [
  ["prueba\\.e2e\\.postulaciones@cali\\.gov\\.co", "g", DEMO_EMAIL],
  ["PRUEBA E2E Funcionario", "g", "Funcionario Demo"],
  ["PSE-02(\\d{4})", "g", "PSE-00$1"],
  ["VAL-02(\\d{4})", "g", "VAL-00$1"],
];

export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let t0 = 0;
const now = () => (Date.now() - t0) / 1000;
const hasta = async (t) => sleep(Math.max(0, (t - now()) * 1000));

let WORK = "";
let paginaActual = null;
let dur = {};
const timeline = [];
const cortes = []; // [from, to] seconds of waiting (server latency) removed by build.py

// ---------------------------------------------------------------- page overlay (runs in the page)
function overlay({ reemplazos }) {
  const css = `
    nextjs-portal,[data-nextjs-toast],[data-nextjs-dev-tools-button],vercel-live-feedback,[data-vercel-toolbar]{display:none!important}
    #__cur{position:fixed;left:0;top:0;z-index:2147483647;pointer-events:none;width:26px;height:26px;margin:-2px 0 0 -2px;filter:drop-shadow(0 1px 2px rgba(0,0,0,.55))}
  `;
  const rx = reemplazos.map(([p, f, a]) => [new RegExp(p, f), a]);
  const limpiar = (raiz) => {
    if (!raiz) return;
    const w = document.createTreeWalker(raiz, NodeFilter.SHOW_TEXT);
    for (let n = w.nextNode(); n; n = w.nextNode()) {
      let t = n.nodeValue;
      for (const [r, a] of rx) t = t.replace(r, a);
      if (t !== n.nodeValue) n.nodeValue = t;
    }
    raiz.querySelectorAll?.("span").forEach((s) => { if (s.textContent === "Prueba" && s.children.length === 0) s.style.display = "none"; });
    raiz.querySelectorAll?.("input[value]").forEach((i) => { for (const [r, a] of rx) if (r.test(i.value)) i.value = i.value.replace(r, a); });
  };
  const montar = () => {
    if (!document.documentElement) return;
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
  // Text is masked only after hydration: touching React's text nodes before it would make hydration fail.
  let hidratado = false;
  new MutationObserver(() => { montar(); if (hidratado) limpiar(document.body); }).observe(document, { childList: true, subtree: true, characterData: true });
  montar();
  addEventListener("DOMContentLoaded", montar);
  addEventListener("load", () => setTimeout(() => { hidratado = true; limpiar(document.body); }, 400));
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
const P = { mouse: 380, type: 40, pausa: 200 };
export const rapido = () => Object.assign(P, { mouse: 220, type: 14, pausa: 80 });
export const normal = () => Object.assign(P, { mouse: 380, type: 40, pausa: 200 });

export async function mover(page, x, y, ms = P.mouse) {
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
export const soltar = async (page) => {
  await page.evaluate(() => document.activeElement?.blur?.());
  await sleep(P.pausa);
};
export async function aVista(loc, { arriba = 70, abajo = 110 } = {}) {
  await loc.waitFor({ state: "visible", timeout: 15000 });
  let b = await loc.boundingBox();
  if (!b || b.y < arriba || b.y + b.height > H - abajo) {
    await loc.evaluate((el) => el.scrollIntoView({ block: "center", behavior: "smooth" }));
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
export async function apuntar(page, loc, opts) {
  const b = await aVista(loc, opts);
  if (!b) throw new Error("target without box");
  // Aim at the first line box: the centre of a link wrapped over two lines is the gap between them.
  const r = (await loc.evaluate((el) => { const x = el.getClientRects()[0]; return x && { x: x.x, y: x.y, width: x.width, height: x.height }; })) ?? b;
  await mover(page, r.x + Math.min(r.width / 2, 120), r.y + r.height / 2);
  return b;
}
export async function clic(page, loc, opts = {}) {
  if (opts.blur !== false) await soltar(page);
  await apuntar(page, loc, opts);
  await page.mouse.down();
  await sleep(40);
  await page.mouse.up();
  await sleep(P.pausa);
}
export async function marcar(page, loc) {
  await clic(page, loc);
  if (!(await loc.isChecked().catch(() => true))) await loc.check({ force: true });
}
export async function escribir(page, loc, texto, { tab = true, borrar = false } = {}) {
  await clic(page, loc);
  if (borrar) await page.keyboard.press("Control+A");
  await page.keyboard.type(texto, { delay: P.type });
  if (tab) await page.keyboard.press("Tab");
  await sleep(P.pausa);
}
export async function combo(page, loc, texto) {
  await escribir(page, loc, texto, { tab: false });
  await page.getByRole("listbox").getByRole("option").first().waitFor({ state: "visible", timeout: 8000 });
  await sleep(P.pausa);
  await page.keyboard.press("Enter");
  await page.keyboard.press("Tab");
  await sleep(P.pausa);
}
export async function elegirVarias(page, nombre, etiquetas) {
  const c = page.getByRole("combobox", { name: nombre, ...exacto });
  await clic(page, c);
  for (const e of etiquetas) await clic(page, page.getByRole("option", { name: e, ...exacto }), { abajo: 40, blur: false });
  await page.keyboard.press("Escape");
  await sleep(P.pausa);
}
export async function desplazar(page, dy, ms = 900) {
  const pasos = Math.round(ms / 30);
  for (let i = 0; i < pasos; i++) {
    await page.mouse.wheel(0, dy / pasos);
    await sleep(30);
  }
}
export const campo = (page, l) => page.getByLabel(l, exacto);
export const grupo = (page, n) => page.getByRole("group", { name: n });
export const titulo = (page, t) => page.getByRole("heading", { level: 2, name: t });

/** Draws a believable signature on a signature pad and confirms it with "Usar esta firma". */
export async function firmar(page, raiz = page) {
  const pad = raiz.getByTestId("pad-firma");
  await aVista(pad, { abajo: 160 });
  const b = await pad.boundingBox();
  const pt = (fx, fy) => [b.x + b.width * fx, b.y + b.height * fy];
  const [sx, sy] = pt(0.12, 0.6);
  await mover(page, sx, sy, 300);
  await page.mouse.down();
  for (let i = 0; i <= 60; i++) {
    const t = i / 60;
    const [x, y] = pt(0.12 + 0.72 * t + 0.05 * Math.sin(t * 18), 0.5 + 0.28 * Math.sin(t * 15) * (1 - 0.6 * t) - 0.1 * Math.sin(t * 5));
    await page.mouse.move(x, y);
    await sleep(9);
  }
  await page.mouse.up();
  mx = pt(0.84, 0.5)[0]; my = pt(0.84, 0.5)[1];
  await clic(page, raiz.getByRole("button", { name: "Usar esta firma", ...exacto }));
}

// ---------------------------------------------------------------- slides (data: URLs, so the overlay also runs there)
const ESTILO = `body{margin:0;font-family:system-ui,Segoe UI,Arial,sans-serif;background:linear-gradient(135deg,#00365f,#0b5c99);color:#fff;min-height:100vh;display:flex;flex-direction:column;justify-content:center;padding:0 64px;box-sizing:border-box}
h1{font-size:52px;margin:0 0 8px;line-height:1.1}h2{font-size:30px;margin:0 0 26px;font-weight:600;color:#cfe6ff}p{font-size:26px;margin:6px 0;color:#e6f1ff}
.k{font-size:20px;letter-spacing:.02em;color:#ffd166;margin-bottom:14px;font-weight:700}
.g{display:grid;grid-template-columns:1fr 1fr;gap:14px}.c{background:rgba(255,255,255,.12);border:2px solid rgba(255,255,255,.35);border-radius:16px;padding:14px 18px;font-size:25px;line-height:1.25;display:flex;gap:12px;align-items:center;opacity:0;transform:translateY(14px);transition:all .45s}
.c.v{opacity:1;transform:none}.c b{flex:none;width:34px;height:34px;border-radius:50%;background:#ffd166;color:#00365f;display:grid;place-items:center;font-size:20px}`;
export const pagina = (cuerpo) => `data:text/html;charset=utf-8,${encodeURIComponent(`<!doctype html><meta charset="utf-8"><title>Guía</title><style>${ESTILO}</style><body>${cuerpo}</body>`)}`;
export const portada = (serie, t, sub) => pagina(`<div class="k">${serie}</div><h1>${t}</h1><h2>${sub}</h2><p>Alcaldía de Santiago de Cali · Secretaría de Vivienda Social y Hábitat</p>`);
export const tarjetas = (t, sub, xs, simbolo = "✓") => pagina(`<h1>${t}</h1><h2>${sub}</h2><div class="g">${xs.map((x, i) => `<div class="c"><b>${simbolo === "#" ? i + 1 : simbolo}</b><span>${x}</span></div>`).join("")}</div>`);
export async function revelar(page, desde, hasta_, ms = 900) {
  for (let i = desde; i < hasta_; i++) {
    await page.evaluate((k) => document.querySelectorAll(".c")[k]?.classList.add("v"), i);
    await sleep(ms);
  }
}

// ---------------------------------------------------------------- demo ID photos (drawn, clearly fake)
export async function fotosDemo(browser, { numero, apellidos, nombres }) {
  const ctx = await browser.newContext();
  const pg = await ctx.newPage();
  const dibujar = (lado) =>
    pg.evaluate(({ lado, numero, apellidos, nombres }) => {
      const c = document.createElement("canvas");
      c.width = 1280; c.height = 800;
      const x = c.getContext("2d");
      // Front and back must look different: the app refuses the same photo twice.
      const frente = lado === "frente";
      x.fillStyle = frente ? "#2b2f36" : "#7a5a3a"; x.fillRect(0, 0, 1280, 800);
      x.save(); x.translate(frente ? 640 : 610, frente ? 400 : 420); x.rotate(frente ? -0.02 : 0.06);
      x.fillStyle = frente ? "#e8eef5" : "#f4ead2"; x.fillRect(-520, -320, 1040, 640);
      x.fillStyle = frente ? "#c9d6e6" : "#d8b878"; x.fillRect(-520, -320, 1040, 90);
      x.fillStyle = "#1f3b5c"; x.font = "bold 34px sans-serif"; x.fillText("DOCUMENTO DE EJEMPLO · SIN VALOR LEGAL", -490, -258);
      if (lado === "frente") {
        x.fillStyle = "#9db2cb"; x.fillRect(-490, -190, 260, 330);
        x.fillStyle = "#6f87a6"; x.beginPath(); x.arc(-360, -80, 70, 0, 7); x.fill(); x.fillRect(-440, -10, 160, 130);
        x.fillStyle = "#222"; x.font = "bold 30px sans-serif";
        x.fillText(`NÚMERO ${numero}`, -190, -140);
        x.font = "26px sans-serif"; x.fillText("APELLIDOS", -190, -80);
        x.font = "bold 40px sans-serif"; x.fillText(apellidos, -190, -35);
        x.font = "26px sans-serif"; x.fillText("NOMBRES", -190, 25);
        x.font = "bold 40px sans-serif"; x.fillText(nombres, -190, 70);
        x.font = "26px sans-serif"; x.fillText("PERSONA FICTICIA PARA DEMOSTRACIÓN", -490, 255);
      } else {
        x.fillStyle = "#222";
        for (let i = 0; i < 70; i++) x.fillRect(-480 + i * 9, -170, 2 + (i % 4), 150);
        x.font = "bold 34px sans-serif"; x.fillText(numero.replace(/\D/g, ""), -480, 20);
        x.font = "26px sans-serif"; x.fillText("REVERSO · EJEMPLO DIDÁCTICO", -480, 90);
        x.fillText("ESTE DOCUMENTO NO ES REAL", -480, 140);
      }
      x.restore();
      return c.toDataURL("image/jpeg", 0.88).split(",")[1];
    }, { lado, numero, apellidos, nombres });
  const out = { frente: Buffer.from(await dibujar("frente"), "base64"), reverso: Buffer.from(await dibujar("reverso"), "base64") };
  await ctx.close();
  return out;
}

// ---------------------------------------------------------------- session + API doubles
export function cookieDeSesion() {
  const s = JSON.parse(fs.readFileSync(STATE, "utf8"));
  const c = s.cookies.find((k) => k.name === "sesion");
  if (!c) throw new Error(`no "sesion" cookie in ${STATE} (run context/login-prueba.mjs)`);
  return { name: c.name, value: c.value, url: BASE, httpOnly: true, secure: BASE.startsWith("https"), sameSite: "Lax", expires: c.expires };
}

/**
 * `simular(req, url)` returns a JSON body (or {status, json}) to answer an /api call, or undefined to let it reach the
 * server when it matches `reales`. Anything else gets 501 so nothing unexpected is written.
 */
async function instalarApi(context, { simular = () => undefined, reales = [] }) {
  const host = new URL(BASE).host;
  await context.route((u) => !["data:", "blob:", "about:"].includes(u.protocol) && u.host !== host && !/geocodificador\.ia\.cali\.gov\.co$/.test(u.host), (r) => r.abort());
  await context.route("**/api/**", async (route) => {
    const req = route.request();
    const u = new URL(req.url());
    const r = await simular(req, u);
    if (r !== undefined) {
      const conEstado = r && typeof r === "object" && "status" in r && "json" in r;
      return route.fulfill({ status: conEstado ? r.status : 200, contentType: "application/json", body: JSON.stringify(conEstado ? r.json : r) });
    }
    if (reales.some((x) => x.test(`${req.method()} ${u.pathname}`))) return route.continue();
    console.warn(`[api no simulada -> 501] ${req.method()} ${u.pathname}`);
    return route.fulfill({ status: 501, contentType: "application/json", body: JSON.stringify({ error: "No simulado en la grabación" }) });
  });
}

// ---------------------------------------------------------------- recording lifecycle
/** Visits the routes once, unrecorded: the dev server compiles each page on first hit (tens of seconds). */
export async function calentar(rutas, { sesion = true } = {}) {
  const browser = await chromium.launch();
  const context = await browser.newContext();
  if (sesion) await context.addCookies([cookieDeSesion()]);
  const page = await context.newPage();
  for (const r of rutas) await page.goto(`${BASE}${r}`, { waitUntil: "networkidle", timeout: 120000 }).catch((e) => console.warn(`calentar ${r}: ${e.message}`));
  await browser.close();
}

export async function abrir(id, { sesion = true, api = {} } = {}) {
  WORK = path.join(ROOT, "work", id);
  dur = JSON.parse(fs.readFileSync(path.join(WORK, "durations.json"), "utf8"));
  fs.rmSync(path.join(WORK, "raw"), { recursive: true, force: true });
  const browser = await chromium.launch();
  const context = await browser.newContext({
    viewport: { width: W, height: H }, locale: "es-CO", timezoneId: "America/Bogota", colorScheme: "light",
    recordVideo: { dir: path.join(WORK, "raw"), size: { width: W, height: H } },
  });
  await context.addInitScript(overlay, { reemplazos: REEMPLAZOS });
  await instalarApi(context, api);
  if (sesion) await context.addCookies([cookieDeSesion()]);
  t0 = Date.now();
  const page = await context.newPage();
  page.on("console", (m) => { if (m.type() === "error") console.log(`[console] ${m.text().slice(0, 160)}`); });
  page.on("pageerror", (e) => console.log(`[pageerror] ${e.message.slice(0, 160)}`));
  await page.mouse.move(mx, my);
  paginaActual = page;
  return { browser, context, page };
}

/** One narrated scene: action i runs while sentence i plays; the clock waits for the sentence (plus a gap) to end. */
export async function escena(nombre, acciones) {
  const ds = dur[nombre];
  if (!ds) throw new Error(`scene "${nombre}" not in durations.json`);
  for (let i = 0; i < ds.length; i++) {
    const start = now();
    timeline.push({ scene: nombre, i, start: +start.toFixed(3), dur: ds[i] });
    const fin = start + ds[i] + GAP;
    try { await acciones[i]?.(); } catch (e) {
      console.error(`ERROR ${nombre}[${i}] at ${paginaActual?.url()}: ${e.message}`);
      await paginaActual?.screenshot({ path: path.join(WORK, "error.png") }).catch(() => {});
      throw e;
    }
    const extra = now() - fin;
    if (extra > 0.05) console.warn(`overrun ${nombre}[${i}] +${extra.toFixed(1)}s`);
    // Long waits (slow saves) are cut: keep 0.8 s of the loading state before the result shows.
    if (extra > 2) cortes.push([+fin.toFixed(3), +(now() - 0.8).toFixed(3)]);
    await hasta(fin);
  }
}

export async function cerrar({ browser, context, page }) {
  await sleep(1200);
  const fin = now();
  await context.close();
  fs.writeFileSync(path.join(WORK, "timeline.json"), JSON.stringify({ total: fin, items: timeline, cortes }, null, 1));
  fs.copyFileSync(await page.video().path(), path.join(WORK, "raw.webm"));
  await browser.close();
  console.log(`recorded ${fin.toFixed(1)} s -> ${path.relative(REPO, path.join(WORK, "raw.webm"))}`);
}
