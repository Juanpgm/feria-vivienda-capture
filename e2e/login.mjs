// One-time manual login: opens a headed Chromium at /login, waits until you are signed in,
// then saves the session (cookies/storage) to .auth/state.json for the authenticated e2e specs.
// The password is typed by you in the browser; this script never reads, logs or stores it.
import { mkdirSync } from "node:fs";
import { chromium } from "@playwright/test";

const base = process.env.E2E_BASE_URL ?? "http://localhost:3000";
const salida = ".auth/state.json";

const browser = await chromium.launch({ headless: false });
const context = await browser.newContext({ locale: "es-CO", timezoneId: "America/Bogota" });
const page = await context.newPage();
await page.goto(`${base}/login`);
console.log("Inicie sesión en la ventana del navegador (tiene 5 minutos)...");
await page.waitForURL((url) => !url.pathname.startsWith("/login"), { timeout: 300_000 });
// Let the session cookie settle before saving.
await page.waitForLoadState("networkidle");
mkdirSync(".auth", { recursive: true });
await context.storageState({ path: salida });
await browser.close();
console.log(`Sesión guardada en ${salida}. Ya puede ejecutar: npm run e2e`);
