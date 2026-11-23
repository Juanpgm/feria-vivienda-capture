// Where each value of a postulación goes on the official format (MMDS01.02.03.P001.F001 v010), printed exactly as the
// Excel prints it. The template PDF (../plantilla/formato-postulacion-v10.pdf) is Excel's own export of
// context/1. Formato_Postulacion_Subsidio_Distrital_de_Vivienda_v10-1.xlsx, so cells are located with the sheet's grid
// (column lefts / row tops in sheet points, read from Excel) and the linear transform of that export, calibrated by
// filling two cells (A22, R31) and reading their rects back. Pure: the server draws these operations on the template.
// Coordinates are PDF points with the origin at the top-left of the page (612 x 792, Letter).
import { CONDICIONES_ESPECIALES, PARENTESCOS, type FuenteRecurso } from "./catalogos";
import type { DatosPostulacion } from "./armar";

/** Left edge of columns A..U, sheet points. */
const COL = [0, 43.8, 94.2, 151.8, 195, 257.4, 307.8, 351.6, 415.8, 495, 554.4, 618.6, 710.4, 769.2, 798.6, 846.6, 901.2, 949.8, 996, 1022.4, 1071];
/** Top edge of rows 1..61, sheet points. */
const FILA = [
  0, 33.6, 67.2, 100.8, 110.4, 132, 154.8, 180.6, 193.8, 218.4, 231.6, 250.8, 291.6, 326.4, 351, 381, 426, 478.2, 529.2, 553.8, 588.6, 613.2, 633,
  652.8, 672.6, 692.4, 712.2, 732, 751.8, 771.6, 791.4, 811.2, 835.8, 860.4, 897, 951, 972, 1009.8, 1043.4, 1058.4, 1107, 1125.6, 1150.2, 1174.8,
  1199.4, 1216.2, 1233, 1249.8, 1266.6, 1283.4, 1300.2, 1317, 1333.8, 1358.4, 1373.4, 1433.4, 1486.2, 1507.2, 1537.8, 1553.4, 1574.4,
];
const ESCALA_X = 0.532765;
const ESCALA_Y = 0.521324;
const MARGEN_X = 20.28;
const MARGEN_Y = 51.894;
/** Excel breaks the page before row 52 and repeats rows 1-3 (100.8 sheet points) at the top of page 2. */
const PRIMERA_FILA_P2 = 52;
const ALTO_TITULOS = 100.8;

export type Rect = { pagina: number; x: number; y: number; w: number; h: number };
export type Operacion =
  | (Rect & { tipo: "texto"; texto: string; alinear: "izquierda" | "centro"; tam: number; negrita?: boolean })
  | { tipo: "marca"; pagina: number; x: number; y: number }
  | (Rect & { tipo: "firma"; cual: "solicitante" | "funcionario" });

const colDe = (letras: string) => letras.charCodeAt(0) - 65;

/** Rect of an Excel range ("C8:F9" or "Q9") on the printed template. */
export function celda(rango: string): Rect {
  const [a, b = a] = rango.split(":").map((r) => r.match(/^([A-T])(\d+)$/)!);
  const c0 = colDe(a[1]);
  const c1 = colDe(b[1]);
  const f0 = Number(a[2]);
  const f1 = Number(b[2]);
  const pagina = f0 >= PRIMERA_FILA_P2 ? 1 : 0;
  const y = (top: number) => MARGEN_Y + (pagina ? ALTO_TITULOS + top - FILA[PRIMERA_FILA_P2 - 1] : top) * ESCALA_Y;
  const x = MARGEN_X + COL[c0] * ESCALA_X;
  const top = y(FILA[f0 - 1]);
  return { pagina, x, y: top, w: (COL[c1 + 1] - COL[c0]) * ESCALA_X, h: y(FILA[f1]) - top };
}

/** What the server needs besides the data: the radicado and the validation (section 7). */
export type EntradaFormato = DatosPostulacion & {
  radicado: string;
  validacion: { funcionario_nombre: string; validado_en: string; folios_anexos: number | null } | null;
};

/** Centers (PDF points) of the template's check boxes, measured on the export. */
const CASILLAS = {
  genero: { cis_masculino: [115.6, 190.9], cis_femenino: [115.9, 198], transgenero: [195.2, 191.5], otro: [173.8, 198.3] },
  ocupacion: { empleado: [322.3, 190.6], independiente: [327.1, 197.1], pensionado: [385.3, 193.7] },
  notificacion: { si: [437.6, 243.2], no: [456.1, 243.3] },
  caja: { si: [77.8, 257.4], no: [76.8, 268.4] },
  sisben: { si: [291.3, 257.4], no: [290.3, 268.4] },
  entidad: { fev: [158.1, 563.8], svsh: [185.9, 570] },
  estado: { al_dia: [226.8, 585.6], en_mora: [268.3, 586.9], cobro_persuasivo: [334.1, 585.9], cobro_coactivo: [402.9, 585.6], cobro_juridico: [469.3, 585.6], facilidad_pago: [570.6, 585.3] },
} as const satisfies Record<string, Record<string, readonly [number, number]>>;

/** Section 1 "Condición especial (marcar con X)": the cell of each option (mark it, as on paper). */
const CELDA_CONDICION: Record<string, string> = {
  indigena: "E17", afrocolombiano: "F17", cabeza_hogar: "G17:H17", victima_conflicto: "I17:J17", adulto_mayor: "K17", desmovilizado: "L17",
  reubicado_alto_riesgo: "M17:N17", discapacidad: "O17", lgbti: "P17", reciclador: "Q17", rrom: "R17", mujer_victima_vbg: "S17:T17",
  poblacion_joven: "E18", docente_oficial: "F18", empleado_publico: "G18:H18", miembro_jal: "I18", miembro_jac: "J18", sector_salud: "K18",
  fuerza_publica: "L18", deportista_alto_rendimiento: "M18:N18", veterano_fuerza_publica: "O18:P18", madre_padre_comunitario: "Q18:R18", campesino: "S18:T18",
};
/** Section 3: the box of each modality (label + blank cell). */
const CELDA_MODALIDAD: Record<string, string> = {
  "1": "A34:C34", "2": "D34:F34", "3": "G34:I34", "4": "J34:K34", "5": "L34:M34", "6": "N34:P34", "7": "Q34:T34", "8": "A35:C35", "9": "D35:F35", "10": "G35:I35",
};
/** Section 5.1: row of each source (value in D:F, entity in K:T; the subsidy also has its resolution on the next row). */
const FILA_FUENTE: Record<FuenteRecurso, number> = { subsidio_familiar: 45, ahorro_programado: 47, cesantias: 48, creditos: 49, aportes_gubernamentales: 50, otros: 51 };

/** Section 2 codes, from the format's "Tabla guía y convenciones". */
const CODIGO_ESTADO_CIVIL: Record<string, string> = { soltero: "S", casado_union: "C", separado_viudo: "SP", no_aplica: "NA" };
const CODIGO_OCUPACION: Record<string, string> = { hogar: "H", empleado: "EM", pensionado: "P", estudiante: "ES", independiente: "I", desempleado: "D" };
const CODIGO_GENERO: Record<string, string> = { cis_masculino: "M", cis_femenino: "F", transgenero: "T", bisexual: "B", gay: "G", lesbiana: "L", pansexual: "P", otro: "O" };
const numeroEn = (o: Record<string, string>, k: unknown) => String(Object.keys(o).indexOf(String(k)) + 1 || "");

const miles = (v: unknown) => (typeof v === "number" ? v.toLocaleString("es-CO") : "");
const fecha = (iso: unknown) => {
  const [a = "", m = "", d = ""] = typeof iso === "string" ? iso.slice(0, 10).split("-") : [];
  return { d, m, a };
};
const telefono = (v: unknown) => (typeof v === "string" ? v.replace(/^\+57/, "") : "");
const str = (v: unknown) => (v === null || v === undefined ? "" : String(v));

export function operacionesFormato(p: EntradaFormato): Operacion[] {
  const ops: Operacion[] = [];
  const s = p.solicitante as Record<string, unknown>;
  const po = p.postulacion;

  /** Text in a range; `desde` = absolute x where the text starts (cells whose label is printed inside). */
  const t = (rango: string, valor: unknown, o: { desde?: number; centro?: boolean; tam?: number; negrita?: boolean; arriba?: number } = {}) => {
    const texto = str(valor).trim();
    if (!texto) return;
    const c = celda(rango);
    const x = o.desde ?? c.x + 1.5;
    const y = o.arriba ?? c.y;
    ops.push({ tipo: "texto", pagina: c.pagina, x, y, w: c.x + c.w - x - 1.5, h: c.y + c.h - y, texto, alinear: o.centro ? "centro" : "izquierda", tam: o.tam ?? 6.5, negrita: o.negrita });
  };
  /** Text in an absolute box (values written over the template's "_____" blanks). */
  const abs = (pagina: number, x0: number, y0: number, x1: number, y1: number, valor: unknown) => {
    const texto = str(valor).trim();
    if (texto) ops.push({ tipo: "texto", pagina, x: x0, y: y0, w: x1 - x0, h: y1 - y0, texto, alinear: "izquierda", tam: 6.5 });
  };
  const marca = (punto: readonly [number, number] | undefined, pagina = 0) => punto && ops.push({ tipo: "marca", pagina, x: punto[0], y: punto[1] });
  /** X inside a labeled cell, near its right edge (options without a check box). */
  const marcaEn = (rango: string | undefined) => {
    if (!rango) return;
    const c = celda(rango);
    ops.push({ tipo: "marca", pagina: c.pagina, x: Math.round((c.x + c.w - 5) * 10) / 10, y: Math.round((c.y + c.h / 2) * 10) / 10 });
  };
  const fechaEn = (iso: unknown, dia: string, mes: string, anio: string) => {
    const f = fecha(iso);
    t(dia, f.d, { centro: true });
    t(mes, f.m, { centro: true });
    t(anio, f.a, { centro: true });
  };
  const siNo = (v: unknown, casillas: { si: readonly [number, number]; no: readonly [number, number] }) => {
    if (v === true) marca(casillas.si);
    else if (v === false) marca(casillas.no);
  };

  t("K5:T5", p.radicado, { desde: 400, tam: 9, negrita: true });

  // 1. Datos del solicitante
  t("A7:I7", s.nombres, { desde: 52 });
  t("J7:T7", s.apellidos, { desde: 315 });
  t("C8:F9", s.tipo_documento === "ce" ? `C.E. ${str(s.numero_documento)}` : s.numero_documento, { centro: true });
  t("I8:N9", s.lugar_expedicion_nombre);
  fechaEn(s.fecha_expedicion, "Q9", "R9:S9", "T9");
  fechaEn(s.fecha_nacimiento, "C11", "D11", "E11");
  t("H10:N11", s.lugar_nacimiento_nombre);
  t("R10:T11", typeof s.ingreso_mensual === "number" ? `$ ${miles(s.ingreso_mensual)}` : "");
  marca(CASILLAS.genero[s.genero as keyof typeof CASILLAS.genero]);
  if (s.genero === "otro") abs(0, 209, 191, 241.5, 203.5, s.genero_otro);
  marca(CASILLAS.ocupacion[s.ocupacion as keyof typeof CASILLAS.ocupacion]);
  t("N12:T12", s.direccion);
  t("A13:E13", s.nombre_barrio_vereda, { desde: 40 });
  abs(0, 181, 209.5, 207.5, 218, s.nombre_division);
  abs(0, 252, 212.5, 284, 221, s.estrato);
  abs(0, 325, 212.5, 398.5, 221, s.anios_residencia);
  t("O13:T13", telefono(s.telefono));
  t("C14:H14", s.correo);
  t("K14:N14", s.empresa);
  t("Q14:T14", telefono(s.telefono_empresa));
  siNo(s.notificacion_electronica, CASILLAS.notificacion);
  siNo(s.caja_compensacion, CASILLAS.caja);
  t("E16:H16", s.caja_cual);
  siNo(s.sisben, CASILLAS.sisben);
  t("O16:P16", s.sisben_grupo, { centro: true });
  t("S16:T16", s.sisben_subgrupo, { centro: true });
  for (const c of (s.condiciones_especiales as string[] | undefined) ?? []) marcaEn(CELDA_CONDICION[c]);

  // 2. Grupo familiar (10 rows from row 22)
  p.hogar.integrantes.forEach((m, i) => {
    const f = 22 + i;
    t(`B${f}:G${f}`, m.nombres_apellidos);
    fechaEn(m.fecha_nacimiento, `H${f}`, `I${f}`, `J${f}`);
    t(`K${f}`, str(m.tipo_documento).toUpperCase(), { centro: true });
    t(`L${f}:M${f}`, m.numero_documento, { centro: true });
    t(`N${f}`, m.condiciones_especiales.filter((c) => c !== "ninguna").map((c) => numeroEn(CONDICIONES_ESPECIALES, c)).join(","), { centro: true, tam: 5.5 });
    t(`O${f}`, numeroEn(PARENTESCOS, m.parentesco), { centro: true });
    t(`P${f}`, CODIGO_ESTADO_CIVIL[m.estado_civil ?? ""], { centro: true });
    t(`Q${f}`, CODIGO_OCUPACION[m.ocupacion ?? ""], { centro: true });
    t(`R${f}`, CODIGO_GENERO[m.identidad_genero ?? ""], { centro: true });
    t(`S${f}:T${f}`, miles(m.ingresos), { centro: true });
  });
  t("S32:T32", miles(p.hogar.total_ingresos), { desde: 559 });

  // 3. Modalidad
  marcaEn(CELDA_MODALIDAD[po.modalidad]);

  // 4. Obligación (modality 10) and 4.1 authorization
  const o = po.obligacion;
  if (o) {
    marca(CASILLAS.entidad[o.entidad_acreedora as keyof typeof CASILLAS.entidad]);
    t("J37:L37", o.numero_obligacion);
    t("O37:T37", o.programa);
    t("C38:E38", miles(o.saldo_adeudado));
    marca(CASILLAS.estado[o.estado as keyof typeof CASILLAS.estado]);
    if (o.autoriza_giro === true) marca([497, 614.8]);
  }

  // 5. Proyecto (modalities 1 and 2): only the value of the chosen VIS/VIP type
  const pr = po.proyecto;
  if (pr) {
    t("A42:K42", pr.nombre, { desde: 134 });
    t("L42:T42", pr.constructora, { desde: 417 });
    if (pr.tipo_vivienda === "vis") t("A43:K43", miles(pr.valor_vis), { desde: 139 });
    if (pr.tipo_vivienda === "vip") t("L43:T43", miles(pr.valor_vip), { desde: 467 });
  }

  // 5.1 Recursos
  for (const f of po.fuentes as FuenteRecurso[]) {
    const r = po.recursos[f];
    const fila = FILA_FUENTE[f];
    if (!r || !fila) continue;
    t(`D${fila}:F${fila}`, miles(r.valor), { desde: 110 });
    t(`K${fila}:T${fila}`, r.entidad);
    if (f === "subsidio_familiar") t("K46:T46", r.resolucion);
  }
  t("D52:F52", miles(po.total_aportes), { desde: 110 });

  // 6. Declaración: signature and document of the head of household (under each title)
  const firma = celda("A56:F56");
  ops.push({ tipo: "firma", cual: "solicitante", pagina: firma.pagina, x: firma.x + 4, y: 174, w: firma.w - 8, h: firma.y + firma.h - 175 });
  t("G56:K56", s.numero_documento, { centro: true, arriba: 174, tam: 8 });

  // 7. Recepción by the official who validated
  const v = p.validacion;
  if (v) {
    t("A58:H58", v.funcionario_nombre, { arriba: 211 });
    t("M59:N60", v.folios_anexos, { centro: true });
    fechaEn(v.validado_en, "T60", "Q60:S60", "O60:P60");
    ops.push({ tipo: "firma", cual: "funcionario", pagina: 1, x: 75, y: 220, w: 165, h: 18 });
  }
  return ops;
}
