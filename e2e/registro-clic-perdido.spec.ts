// A blur error pushes the fields below it down. If it appears while the pointer is going down on the NEXT control,
// the press started on the old layout and the click was lost (the user had to click twice).
// These tests press near the TOP edge of the target (a 20 px shift moves the pointer onto the previous element), hold
// the button while the validation runs, and assert the FIRST click worked. No `soltarFoco` workaround on purpose.
import { expect, test, type Locator, type Page } from "@playwright/test";
import { hayEstadoAuth, MENSAJE_SIN_SESION } from "./auth";
import { HOY, avanzarHasta, nuevoRegistro, type NumeroPaso } from "./ayudas";
import { generarCasos } from "./datos-prueba";

test.beforeAll(() => {
  if (!hayEstadoAuth()) throw new Error(MENSAJE_SIN_SESION);
});

const exacto = { exact: true } as const;
const grupo = (page: Page, nombre: string) => page.getByRole("group", { name: nombre, ...exacto });
const etiquetaDe = (control: Locator) => control.locator("xpath=ancestor::label[1]");

type Escenario = {
  nombre: string;
  paso: NumeroPaso;
  /** Runs before the press (e.g. a choice that unlocks the target). */
  preparar?: (page: Page) => Promise<void>;
  /** Field that loses focus; its blur shows an error above the target. */
  origen: (page: Page) => Locator;
  /** Clickable box that must react to the first press. */
  destino: (page: Page) => Locator;
  /** Gives the origin focus; defaults to focusing the locator. */
  enfocar?: (page: Page) => Promise<void>;
  verificar: (page: Page) => Promise<void>;
};

const ESCENARIOS: Escenario[] = [
  {
    nombre: "solicitante: apellido vacío -> radio C.E.",
    paso: 1,
    origen: (p) => p.getByLabel("Primer apellido", exacto),
    destino: (p) => etiquetaDe(grupo(p, "Tipo de documento").getByRole("radio", { name: "C.E.", ...exacto })),
    verificar: (p) => expect(grupo(p, "Tipo de documento").getByRole("radio", { name: "C.E.", ...exacto })).toBeChecked(),
  },
  {
    nombre: "solicitante: nombre vacío -> combobox de nacionalidad",
    paso: 1,
    preparar: async (p) => {
      await grupo(p, "Tipo de documento").getByRole("radio", { name: "C.E.", ...exacto }).check();
    },
    origen: (p) => p.getByLabel("Primer nombre", exacto),
    destino: (p) => p.getByRole("combobox", { name: "Nacionalidad", ...exacto }),
    verificar: (p) => expect(p.getByRole("combobox", { name: "Nacionalidad", ...exacto })).toBeFocused(),
  },
  {
    nombre: "documento vacío -> fecha de expedición",
    paso: 1,
    origen: (p) => p.getByLabel("Número de documento", exacto),
    destino: (p) => p.getByLabel("Fecha de expedición", exacto),
    verificar: (p) => expect(p.getByLabel("Fecha de expedición", exacto)).toBeFocused(),
  },
  {
    nombre: "hogar: personas vacío -> radio adulto mayor",
    paso: 2,
    origen: (p) => p.getByLabel("Personas que viven en el hogar", exacto),
    destino: (p) => etiquetaDe(grupo(p, "¿Hay adultos mayores en el hogar?").getByRole("radio", { name: "Sí", ...exacto })),
    verificar: (p) => expect(grupo(p, "¿Hay adultos mayores en el hogar?").getByRole("radio", { name: "Sí", ...exacto })).toBeChecked(),
  },
  {
    nombre: "vivienda: dirección vacía -> radio de estrato",
    paso: 3,
    origen: (p) => p.getByLabel("Dirección del inmueble", exacto),
    destino: (p) => etiquetaDe(grupo(p, "Estrato socioeconómico").getByRole("radio", { name: "3", ...exacto })),
    verificar: (p) => expect(grupo(p, "Estrato socioeconómico").getByRole("radio", { name: "3", ...exacto })).toBeChecked(),
  },
  {
    nombre: "financiero: fuentes vacías -> control segmentado del seguro",
    paso: 4,
    origen: (p) => p.getByRole("combobox", { name: "Fuentes de financiación", ...exacto }),
    destino: (p) => grupo(p, "¿El inmueble tenía seguro?").getByRole("radio", { name: "Sí", ...exacto }),
    verificar: (p) => expect(grupo(p, "¿El inmueble tenía seguro?").getByRole("radio", { name: "Sí", ...exacto })).toBeChecked(),
  },
  {
    nombre: "autorización: tratamiento desmarcado -> casilla de datos sensibles",
    paso: 5,
    // Checked then unchecked with the keyboard, so the field is dirty and invalid when it loses focus.
    enfocar: async (p) => {
      const c = p.getByRole("checkbox", { name: "El titular autoriza el tratamiento de sus datos personales", ...exacto });
      await c.focus();
      await c.press("Space");
      await c.press("Space");
    },
    origen: (p) => p.getByRole("checkbox", { name: "El titular autoriza el tratamiento de sus datos personales", ...exacto }),
    destino: (p) => etiquetaDe(p.getByRole("checkbox", { name: "Autoriza el tratamiento de datos sensibles (opcional)", ...exacto })),
    verificar: (p) => expect(p.getByRole("checkbox", { name: "Autoriza el tratamiento de datos sensibles (opcional)", ...exacto })).toBeChecked(),
  },
];

/** Presses `destino` near its top edge, holds the button while the blur validation runs, and releases. */
async function pulsar(page: Page, destino: Locator, modo: "mouse" | "tap") {
  await destino.evaluate((el) => el.scrollIntoView({ block: "center" }));
  const caja = await destino.boundingBox();
  if (!caja) throw new Error("El destino no tiene caja visible");
  const x = caja.x + caja.width / 2;
  const y = caja.y + 4;
  if (modo === "tap") {
    await page.touchscreen.tap(x, y);
    return;
  }
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.waitForTimeout(300); // the validation (and, before the fix, the layout shift) happens while the button is down
  await page.mouse.up();
}

// ponytail: with hasTouch the catalog comboboxes of step 3 stop answering to the shared fill helpers, so the tap runs
// only cover the scenarios of steps 1-3 (mouse runs cover every step at both viewport sizes).
const VISTAS = [
  { nombre: "escritorio", viewport: { width: 1440, height: 900 }, modo: "mouse" as const, hasTouch: false },
  { nombre: "móvil 390x844", viewport: { width: 390, height: 844 }, modo: "mouse" as const, hasTouch: false },
  { nombre: "móvil táctil 390x844", viewport: { width: 390, height: 844 }, modo: "tap" as const, hasTouch: true },
];

for (const { nombre, viewport, modo, hasTouch } of VISTAS) {
  test.describe(`clic perdido: ${nombre}`, () => {
    test.use({ viewport, hasTouch });

    {
      for (const e of ESCENARIOS.filter((x) => modo === "mouse" || x.paso <= 3)) {
        test(`${e.nombre} (${modo})`, async ({ page }) => {
          await nuevoRegistro(page);
          await avanzarHasta(page, generarCasos(HOY)[0], e.paso);
          await e.preparar?.(page);
          if (e.enfocar) await e.enfocar(page);
          else await e.origen(page).focus();
          await expect(e.origen(page)).toBeFocused();

          await pulsar(page, e.destino(page), modo);

          await e.verificar(page); // the FIRST press worked
          await expect(page.getByRole("alert").first()).toBeVisible(); // and the error still appears after the press
        });
      }
    }
  });
}
