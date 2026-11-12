import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { ayudaDe } from "./ayudas";

const pasos = ["hogar", "composicion", "inmueble", "riesgo", "titularidad", "cierre-financiero"].flatMap((m) => {
  const dir = join("src/modules", m, "ui");
  return readdirSync(dir).filter((f) => /^Paso.*\.tsx$/.test(f)).map((f) => join(dir, f));
});

describe("ayudas", () => {
  it("every literal label/legend of the form steps has a help text", () => {
    const sinAyuda: string[] = [];
    for (const f of pasos) {
      for (const m of readFileSync(f, "utf8").matchAll(/\b(?:label|legend)="([^"]+)"/g)) {
        // Section/field labels that are not questions (e.g. the country code picker) are not listed here.
        if (!/^Código de país/.test(m[1]) && !ayudaDe(m[1])) sinAyuda.push(`${f}: ${m[1]}`);
      }
    }
    expect(sinAyuda).toEqual([]);
  });
  it("numbered labels resolve to their base text", () => expect(ayudaDe("Edad del adulto mayor 3")).toBeTruthy());
});
