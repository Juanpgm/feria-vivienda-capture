// Unauthenticated smoke: login page, theme behavior, brand radios, console/network hygiene.
import { expect, test, type Page } from "@playwright/test";

const luminancia = (rgb: string) => {
  const [r, g, b] = rgb.match(/\d+/g)!.slice(0, 3).map((v) => {
    const c = Number(v) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const contraste = (a: string, b: string) => {
  const [x, y] = [luminancia(a), luminancia(b)].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
};

function vigilar(page: Page) {
  const problemas: string[] = [];
  page.on("console", (m) => {
    if (m.type() === "error" || m.type() === "warning") problemas.push(`console.${m.type()}: ${m.text()}`);
  });
  page.on("pageerror", (e) => problemas.push(`pageerror: ${e.message}`));
  page.on("response", (r) => {
    if (r.status() >= 400) problemas.push(`${r.status()} ${r.url()}`);
  });
  return problemas;
}

test("login renderiza sin errores de consola ni recursos 404", async ({ page }) => {
  const problemas = vigilar(page);
  await page.goto("/login");
  await expect(page.getByRole("heading", { name: "Ingresar" })).toBeVisible();
  await expect(page.getByLabel("Correo")).toBeVisible();
  await expect(page.getByLabel("Contraseña")).toBeVisible();
  await page.waitForLoadState("networkidle");
  await page.goto("/registro");
  await page.waitForLoadState("networkidle");
  expect(problemas).toEqual([]);
});

test("el icono de la app existe y se sirve sin redirigir al login", async ({ request }) => {
  const r = await request.get("/icon.svg");
  expect(r.status()).toBe(200);
  expect(r.headers()["content-type"]).toContain("image/svg+xml");
});

test("rutas privadas redirigen a /login sin sesion", async ({ page }) => {
  await page.goto("/registros/nuevo");
  await expect(page).toHaveURL(/\/login$/);
});

for (const esquema of ["light", "dark"] as const) {
  test.describe(`tema ${esquema}`, () => {
    test.use({ colorScheme: esquema });

    test("la primera visita sigue el esquema del sistema y los tokens se aplican", async ({ page }) => {
      await page.goto("/login");
      const html = page.locator("html");
      if (esquema === "dark") await expect(html).toHaveClass(/dark/);
      else await expect(html).not.toHaveClass(/dark/);
      await expect(page.locator("body")).toHaveCSS("background-color", esquema === "dark" ? "rgb(11, 22, 32)" : "rgb(255, 255, 255)");
      await expect(page.getByRole("button", { name: esquema === "dark" ? "Tema claro" : "Tema oscuro" })).toBeVisible();
    });

    test("radios: aro vacio sin marcar, relleno de marca al marcar, contraste AA del aro", async ({ page }) => {
      await page.goto("/login");
      await page.evaluate(() => {
        const d = document.createElement("div");
        d.innerHTML = '<input type="radio" class="radio" id="r-off" name="x"><input type="radio" class="radio" id="r-on" name="x" checked>';
        document.documentElement.append(d);
      });
      const leer = (id: string) =>
        page.locator(id).evaluate((el) => {
          const s = getComputedStyle(el);
          return { fondo: s.backgroundColor, borde: s.borderTopColor, pagina: getComputedStyle(document.body).backgroundColor, ancho: s.width };
        });
      const off = await leer("#r-off");
      const on = await leer("#r-on");
      expect(off.fondo).toBe("rgba(0, 0, 0, 0)");
      expect(on.fondo).toBe(esquema === "dark" ? "rgb(127, 178, 229)" : "rgb(0, 84, 146)");
      expect(on.borde).toBe(on.fondo);
      expect(contraste(off.borde, off.pagina)).toBeGreaterThanOrEqual(3); // WCAG 1.4.11
      expect(contraste(on.fondo, on.pagina)).toBeGreaterThanOrEqual(3);
      expect(off.ancho).toBe("20px");
    });

    test("el cambio del sistema se refleja en vivo mientras no haya eleccion manual", async ({ page }) => {
      await page.goto("/login");
      const html = page.locator("html");
      await page.emulateMedia({ colorScheme: esquema === "dark" ? "light" : "dark" });
      if (esquema === "dark") await expect(html).not.toHaveClass(/dark/);
      else await expect(html).toHaveClass(/dark/);
    });
  });
}

test("la eleccion manual se guarda y gana sobre el sistema, incluso tras recargar", async ({ page }) => {
  await page.emulateMedia({ colorScheme: "light" });
  await page.goto("/login");
  await page.getByRole("button", { name: "Tema oscuro" }).click();
  await expect(page.locator("html")).toHaveClass(/dark/);
  expect(await page.evaluate(() => localStorage.getItem("tema"))).toBe("oscuro");

  await page.reload();
  await expect(page.locator("html")).toHaveClass(/dark/);
  await page.emulateMedia({ colorScheme: "dark" });
  await page.emulateMedia({ colorScheme: "light" });
  await expect(page.locator("html")).toHaveClass(/dark/); // explicit choice ignores OS changes
  await expect(page.getByRole("button", { name: "Tema claro" })).toBeVisible();

  await page.getByRole("button", { name: "Tema claro" }).click();
  await expect(page.locator("html")).not.toHaveClass(/dark/);
  expect(await page.evaluate(() => localStorage.getItem("tema"))).toBe("claro");
});

test("sin localStorage disponible la pagina sigue funcionando", async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(window, "localStorage", { get: () => { throw new DOMException("blocked", "SecurityError"); } });
  });
  const problemas: string[] = [];
  page.on("pageerror", (e) => problemas.push(e.message));
  await page.emulateMedia({ colorScheme: "dark" });
  await page.goto("/login");
  await expect(page.getByRole("heading", { name: "Ingresar" })).toBeVisible();
  await page.getByRole("button", { name: /Tema/ }).click(); // must not throw
  expect(problemas).toEqual([]);
});
