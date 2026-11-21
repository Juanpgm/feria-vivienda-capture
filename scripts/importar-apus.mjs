// Loads the APU price list (sheet "LISTADO DE PRECIOS") into Firestore `APUS/{ITEM}`.
//   node --env-file=.env scripts/importar-apus.mjs "ruta/presupuestos.xlsx"            -> dry run (counts only)
//   node --env-file=.env scripts/importar-apus.mjs "ruta/presupuestos.xlsx" --escribir -> writes
// Idempotent: each APU is set by its ITEM, so re-running with an updated workbook refreshes prices.
// APUs no longer in the workbook are reported, never deleted (old visits keep pointing at them).
import readXlsxFile from "read-excel-file/node";
import { cert, initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { parseServiceAccount } from "../src/shared/config.ts";
import { construirApus } from "../src/modules/mejoramiento/domain/apus.ts";

const archivo = process.argv[2];
if (!archivo) throw new Error("Falta la ruta del Excel");
const escribir = process.argv.includes("--escribir");

const hoja = (await readXlsxFile(archivo)).find((h) => h.sheet === "LISTADO DE PRECIOS");
if (!hoja) throw new Error('El libro no tiene la hoja "LISTADO DE PRECIOS"');
const { apus, duplicados, omitidas } = construirApus(hoja.data);
const invalidos = apus.filter((a) => a.item.includes("/") || a.item.length > 40);
if (invalidos.length) throw new Error(`ITEM no válido como id: ${invalidos.map((a) => a.item).join(", ")}`);

const capitulos = Object.entries(Object.groupBy(apus, (a) => `${a.capitulo} ${a.capitulo_nombre}`)).map(([k, v]) => `${k}: ${v.length}`);
console.log(`APUs: ${apus.length}. Repetidos (se conserva el primero): ${duplicados.join(", ") || "ninguno"}. Sin precio: ${omitidas.join(", ") || "ninguno"}.`);
console.log(capitulos.join("\n"));
if (!escribir) {
  console.log("Simulación: no se escribió nada. Use --escribir para cargar en Firestore.");
  process.exit(0);
}

const cuenta = parseServiceAccount(process.env.FIREBASE_SERVICE_ACCOUNT ?? "");
const db = getFirestore(initializeApp({ credential: cert({ projectId: process.env.FIREBASE_PROJECT_ID || cuenta.project_id, clientEmail: cuenta.client_email, privateKey: cuenta.private_key }) }));
const col = db.collection("APUS");
const existentes = (await col.select().get()).docs.map((d) => d.id);
for (let i = 0; i < apus.length; i += 400) {
  const batch = db.batch();
  for (const a of apus.slice(i, i + 400)) batch.set(col.doc(a.item), a);
  await batch.commit();
}
const nuevos = new Set(apus.map((a) => a.item));
const ausentes = existentes.filter((id) => !nuevos.has(id));
console.log(`Escritos: ${apus.length}. En Firestore pero no en el libro (no se borran): ${ausentes.length}.`);
