// Loads the citizen eligibility list (Excel) into Firestore `ciudadanos/{documento}`. Only these people can log in.
//   node --env-file=.env scripts/importar-ciudadanos.mjs "ruta/lista.xlsx" [--habilitar-enlace]
// Columns by position: 0 NOMBRE, 1 CÉDULA, 2 DIRECCIÓN (not stored), 3 TELÉFONO (not stored), 4 FORMULARIO RUD.
// Safe to re-run: it never touches a citizen's progress (registro, edit counter), only name and RUD form.
// The link switch stays OFF unless --habilitar-enlace is given (and only when it was never set).
import { readSheet } from "read-excel-file/node";
import { cert, initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { parseServiceAccount } from "../src/shared/config.ts";

const archivo = process.argv[2];
if (!archivo) throw new Error("Falta la ruta del Excel");
const habilitar = process.argv.includes("--habilitar-enlace");

const normalizar = (s) => String(s ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toUpperCase().replace(/[^A-Z0-9]/g, "");
const cuenta = parseServiceAccount(process.env.FIREBASE_SERVICE_ACCOUNT ?? "");
const db = getFirestore(initializeApp({ credential: cert({ projectId: process.env.FIREBASE_PROJECT_ID || cuenta.project_id, clientEmail: cuenta.client_email, privateKey: cuenta.private_key }) }));

const filas = (await readSheet(archivo)).slice(1);
const vistos = new Set();
const lote = [];
const omitidas = [];
for (const [i, f] of filas.entries()) {
  const nombre = String(f[0] ?? "").trim().replace(/\s+/g, " ");
  const documento = normalizar(f[1]);
  if (!nombre || !/^[A-Z0-9]{4,20}$/.test(documento) || nombre.split(" ").length < 2) omitidas.push(`fila ${i + 2}: datos incompletos`);
  else if (vistos.has(documento)) omitidas.push(`fila ${i + 2}: documento repetido`);
  else (vistos.add(documento), lote.push({ documento, nombre, formulario_rud: String(f[4] ?? "").trim() }));
}

for (let i = 0; i < lote.length; i += 400) {
  const batch = db.batch();
  for (const c of lote.slice(i, i + 400)) batch.set(db.collection("ciudadanos").doc(c.documento), { nombre: c.nombre, formulario_rud: c.formulario_rud }, { merge: true });
  await batch.commit();
}
const config = db.collection("configuracion").doc("ciudadano");
if (habilitar && !(await config.get()).exists) await config.set({ habilitado: true });
console.log(`Importados: ${lote.length}. Omitidos: ${omitidas.length}.`, omitidas.slice(0, 10).join(" | "));
