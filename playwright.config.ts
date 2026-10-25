import { defineConfig, devices } from "@playwright/test";
import { ESTADO_AUTH, hayEstadoAuth } from "./e2e/auth";

// Needs a dev server already running (`npm run dev`) unless E2E_BASE_URL points elsewhere.
const baseURL = process.env.E2E_BASE_URL ?? "http://localhost:3000";

export default defineConfig({
  testDir: "e2e",
  testMatch: "**/*.spec.ts",
  workers: 1,
  fullyParallel: false,
  retries: 0,
  timeout: 60_000,
  expect: { timeout: 7_000 },
  reporter: [["list"], ["html", { open: "never" }]],
  use: {
    baseURL,
    locale: "es-CO",
    timezoneId: "America/Bogota",
    // Headless by default; `E2E_HEADED=1 npm run e2e` (or `npx playwright test --headed`) shows the browser.
    headless: process.env.E2E_HEADED !== "1",
    trace: "on-first-retry",
  },
  projects: [
    { name: "publico", testMatch: "**/publico-*.spec.ts", use: { ...devices["Desktop Chrome"] } },
    {
      name: "autenticado",
      testMatch: ["**/registro-*.spec.ts", "**/admin-*.spec.ts"],
      use: {
        ...devices["Desktop Chrome"],
        // Missing file: the spec fails with an explicit instruction instead of an ENOENT.
        storageState: hayEstadoAuth() ? ESTADO_AUTH : undefined,
      },
    },
  ],
  // The dev server is started by the developer; never spawn a second one.
  webServer: { command: "npm run dev", url: baseURL, reuseExistingServer: true, timeout: 120_000 },
});
