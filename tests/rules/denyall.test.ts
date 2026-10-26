import { afterAll, beforeAll, describe, it } from "vitest";
import { readFileSync } from "node:fs";
import {
  assertFails,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from "@firebase/rules-unit-testing";
import { doc, getDoc, setDoc } from "firebase/firestore";

// Requires the Firestore emulator (Java). Run with `npm run test:rules`; skipped otherwise.
const hasEmulator = !!process.env.FIRESTORE_EMULATOR_HOST;
const paths = [
  "registros/r1",
  "registros/r1/adjuntos/firma",
  "usuarios/u1",
  "accesos_adjuntos/a1",
  "contadores/global",
  "auditoria_exportaciones/e1",
];

describe.skipIf(!hasEmulator)("firestore.rules deny-all", () => {
  let env: RulesTestEnvironment;
  beforeAll(async () => {
    const [host, port] = process.env.FIRESTORE_EMULATOR_HOST!.split(":");
    env = await initializeTestEnvironment({
      projectId: "feria-vivienda-test",
      firestore: { rules: readFileSync("firestore.rules", "utf8"), host, port: Number(port) },
    });
  });
  afterAll(() => env?.cleanup());

  it.each(paths)("denies client read and write on %s", async (path) => {
    const db = env.authenticatedContext("u1", { rol: "superadmin", aprobado: true }).firestore();
    await assertFails(getDoc(doc(db, path)));
    await assertFails(setDoc(doc(db, path), { x: 1 }));
  });
});
