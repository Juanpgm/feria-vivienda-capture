// Builds work/dashboard.json and work/detalle.json (demo payloads) with the REAL app domain code (aggregation reducer, registroSchema).
import { register } from "node:module";
import { writeFileSync, mkdirSync } from "node:fs";
register("./alias-hooks.mjs", import.meta.url);
const { agregar } = await import("../../src/modules/dashboard/domain/agregacion.ts");

const HOY = new Date().toISOString().slice(0, 10);
const F = [
  { uid: "f1", nombre: "Ana María Funcionaria", correo: "ana.demo@alcaldia.demo" },
  { uid: "f2", nombre: "Luis Fernando Gómez", correo: "luis.demo@alcaldia.demo" },
  { uid: "f3", nombre: "Carolina Ramírez", correo: "carolina.demo@alcaldia.demo" },
];
const BARRIOS = ["Aguacatal", "El Calvario", "El Cedro", "Asturias", "Terron Colorado", "Siloé", "Alto Nápoles", "Meléndez", "Caldas", "Floralia", "Petecuy", "Mojica"];
const REV = ["pendiente_revision", "pendiente_revision", "habilitado", "no_habilitado", "pendiente_subsanacion"];
const ING = ["0_4", "0_4", "0_4", "4_5_5", "mas_5_5"];
const DIC = ["colapso_total", "demolido", "orden_demolicion", "demolicion_en_proceso", "arreglos_locativos", "otro"];
const base = Date.parse(`${HOY}T00:00:00Z`);
const regs = Array.from({ length: 96 }, (_, i) => {
  const f = F[i % 3 === 2 ? 2 : i % 5 === 0 ? 1 : 0];
  const rural = i % 9 === 0;
  return {
    fecha_registro_bogota: new Date(base - ((i * 7) % 30) * 86_400_000).toISOString().slice(0, 10),
    estado: "registrado", estado_revision: REV[i % 5],
    registrado_por_uid: f.uid, registrado_por_nombre: f.nombre, registrado_por_correo: f.correo,
    comuna: rural ? "Pance" : `Comuna ${(i % 6) + 1}`, barrio: BARRIOS[(i * 5) % BARRIOS.length],
    sector: rural ? "rural" : "urbano", estrato: (i % 6) + 1, rango_ingresos: ING[i % 5],
    rango_hogar: ["1", "2_3", "4_mas"][i % 3], rango_adulto_mayor: ["ninguno", "65_73", "mayor_74"][i % 3 === 0 ? 1 : 0],
    titularidad: i % 4 === 0 ? "poseedor_legitimo" : "propietario_clt", dictamen: DIC[i % 6],
    en_rud: i % 7 !== 0, rud_no_sabe: i % 11 === 0, tiene_seguro: i % 5 === 0,
  };
});
const out = JSON.parse(JSON.stringify(agregar(regs, { alcance: "completo", uid: "f1", hoy: HOY, generadoEn: "2026-03-10T20:42:00.000Z" })));
mkdirSync(new URL("../work/", import.meta.url), { recursive: true });
writeFileSync(new URL("../work/dashboard.json", import.meta.url), JSON.stringify(out));
console.log("dashboard.json ok", Object.keys(out));

// ---- demo registro detail (fictitious applicant), parsed with the real registroSchema ----
const { registroSchema } = await import("../../src/modules/registro/domain/schema.ts");
const { valido } = await import("../../src/modules/registro/domain/fixture.ts");
const v = valido();
const r = registroSchema.parse({
  ...v,
  solicitante: { ...v.solicitante, primer_nombre: "María", segundo_nombre: "Fernanda", primer_apellido: "Ruiz", segundo_apellido: "Demo", numero_documento: "1000000001", fecha_expedicion_documento: "2010-03-15", telefono_1: "300 555 0101", correo_solicitante: "demo@example.test", fecha_nacimiento: "1985-05-12", anios_residencia: "12" },
  composicion: { cantidad_personas_hogar: 4, tiene_adulto_mayor: true, cantidad_adultos_mayores: 1, adultos_mayores: [{ edad: 68 }], condiciones_especiales: ["mujer_cabeza_hogar"], ingreso_hogar_cop: "3200000" },
  inmueble: { direccion: "Calle 5 # 10-20", codigo_division: "01", id_barrio_vereda: "0199", estrato: 3 },
  riesgo: { esta_en_rud: true, numero_rud: "RUD-12345", dictamen: "colapso_total" },
  titularidad: { tipo_titularidad: "propietario_clt", numero_matricula_inmobiliaria: "370-123456", es_unica_propiedad: true },
  cierre_financiero: { fuentes_financiacion: ["credito_hipotecario", "recursos_propios"], tiene_seguro: true, codigo_aseguradora: "allianz_seguros", observaciones: "Llegó con su hermana." },
});
const en = new Date(Date.now() - 3 * 60_000).toISOString();
const detalle = {
  id: "00000000-0000-4000-8000-000000000123", radicado: "FV-000123", estado: "registrado", estado_revision: "pendiente_revision", estado_revision_en: en,
  registrado_por_nombre: "Funcionario Demo", registrado_por_correo: "funcionario@alcaldia.demo", registrado_en: en,
  fecha_registro_bogota: en.slice(0, 10), version_esquema: 2, adjuntos_completos: true, adjuntos_requeridos: 3, adjuntos_presentes: 3,
  consentimiento: { version: "2026-10-v1", acepta_tratamiento: true, acepta_datos_sensibles: true, aceptado_en: en },
  firma: { metodo_firma: "dibujada", firmado_en: en, metodo_verificacion: null, nota_verificacion: null, verificado_por_nombre: null },
  datos: { solicitante: { ...r.solicitante, edad: 41 }, composicion: r.composicion, inmueble: r.inmueble, riesgo: r.riesgo, titularidad: r.titularidad, cierre_financiero: { ...r.cierre_financiero, observaciones: "Llegó con su hermana." } },
  historial: [{ tipo: "creacion", estado_revision: "pendiente_revision", por_nombre: "Funcionario Demo", por_correo: "funcionario@alcaldia.demo", en }],
};
writeFileSync(new URL("../work/detalle.json", import.meta.url), JSON.stringify(detalle));
console.log("detalle.json ok");
