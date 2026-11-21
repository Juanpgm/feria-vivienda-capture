// "Informe de visitas" PDF of one inspector (S9 9.4): every visit as evidence. Built in the browser with jspdf.
import type { FilaVisita } from "../server/visitas.repo";
import { fechaBogota, fechaHoraBogota } from "@/shared/tiempo";
import { formatoCop } from "./armado";

export const ETIQUETA_ESTADO = { registrada: "Registrada", archivos_pendientes: "Archivos pendientes" } as const;
export const etiquetaCroquis = (tiene: boolean) => (tiene ? "Croquis cargado" : "Sin croquis");
export const zonaDe = (f: Pick<FilaVisita, "comuna" | "barrio">) => [f.comuna, f.barrio].filter(Boolean).join(" / ") || "Sin ubicar";

export const COLUMNAS_INFORME = ["Código", "Fecha y hora", "Propietario y documento", "Dirección", "Comuna / barrio", "Estado", "Croquis", "Costo directo"];

export const filasInforme = (filas: FilaVisita[]): string[][] =>
  filas.map((f) => [
    f.codigo,
    fechaHoraBogota(f.fecha_visita),
    `${f.propietario.nombre}\n${f.propietario.documento}`,
    f.direccion,
    zonaDe(f),
    ETIQUETA_ESTADO[f.estado],
    etiquetaCroquis(f.tiene_croquis),
    formatoCop(f.costo_directo_total),
  ]);

export const resumenInforme = (filas: FilaVisita[]) => ({ cantidad: filas.length, total: filas.reduce((s, f) => s + f.costo_directo_total, 0) });

const AZUL: [number, number, number] = [0, 54, 95];
const ANCHOS = [24, 32, 52, 50, 40, 26, 24, 31]; // mm, landscape letter minus margins

/** Downloads `informe-visitas-{fecha}.pdf`. */
export async function descargarInforme(inspector: { nombre: string; cargo: string | null }, filas: FilaVisita[]) {
  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF({ unit: "mm", format: "letter", orientation: "landscape" });
  const alto = doc.internal.pageSize.getHeight();
  const m = 10;
  const ahora = new Date().toISOString();
  const { cantidad, total } = resumenInforme(filas);

  doc.setTextColor(...AZUL);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.text("Informe de visitas de mejoramiento de vivienda", m, 16);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(34, 34, 33);
  doc.text(`Inspector: ${inspector.nombre}${inspector.cargo ? ` · ${inspector.cargo}` : ""}`, m, 23);
  doc.text(`Generado: ${fechaHoraBogota(ahora)} (hora de Bogotá)`, m, 28);
  doc.text(`Visitas: ${cantidad} · Costo directo total: ${formatoCop(total)}`, m, 33);

  let y = 40;
  const encabezado = () => {
    doc.setFillColor(...AZUL);
    doc.rect(m, y, ANCHOS.reduce((s, a) => s + a, 0), 7, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    let x = m;
    COLUMNAS_INFORME.forEach((c, i) => {
      doc.text(c, x + 1.5, y + 4.7);
      x += ANCHOS[i];
    });
    y += 7;
    doc.setTextColor(34, 34, 33);
    doc.setFont("helvetica", "normal");
  };
  encabezado();
  for (const fila of filasInforme(filas)) {
    const lineas = fila.map((t, i) => doc.splitTextToSize(t, ANCHOS[i] - 3) as string[]);
    const h = Math.max(...lineas.map((l) => l.length)) * 3.6 + 3;
    if (y + h > alto - m) {
      doc.addPage();
      y = m;
      encabezado();
    }
    let x = m;
    lineas.forEach((l, i) => {
      doc.text(l, x + 1.5, y + 4);
      x += ANCHOS[i];
    });
    y += h;
    doc.setDrawColor(200, 200, 200);
    doc.line(m, y, m + ANCHOS.reduce((s, a) => s + a, 0), y);
  }
  if (!filas.length) doc.text("No hay visitas registradas.", m, y + 6);
  doc.save(`informe-visitas-${fechaBogota()}.pdf`);
}
