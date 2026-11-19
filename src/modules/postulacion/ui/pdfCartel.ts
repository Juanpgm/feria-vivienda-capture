// Printable PDF (letter) with the QR of the public postulación form and plain instructions. The link itself is never
// written: people reach the form only by scanning. Built in the browser, so the QR points at this deployment.
import QRCode from "qrcode";
import { DOCUMENTACION, DOCUMENTACION_TITULO } from "../domain/texto";

const AZUL: [number, number, number] = [0, 54, 95];
const DORADO: [number, number, number] = [213, 177, 108];
const TEXTO: [number, number, number] = [34, 34, 33];
const GRIS: [number, number, number] = [77, 77, 77];

export const PASOS_CARTEL = [
  "Abra la cámara de su celular y apunte al código.",
  "Toque el aviso que aparece en la pantalla para abrir el formulario.",
  "Tenga a mano su documento de identidad: le pediremos una foto del frente y otra del reverso.",
  "Responda los tres pasos y envíe. Recibirá un número de registro.",
  "Al terminar, permanezca en el sitio y espere el llamado para entregar su documentación. Si no se presenta, su registro no será validado ni contará dentro de la postulación.",
] as const;

async function aDataUrl(ruta: string): Promise<string | null> {
  try {
    const blob = await (await fetch(ruta)).blob();
    return await new Promise((ok) => {
      const r = new FileReader();
      r.onload = () => ok(String(r.result));
      r.onerror = () => ok(null);
      r.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

/** "jueves 26 de noviembre de 2026" in Bogota. */
export const fechaVence = (exp: number) =>
  new Intl.DateTimeFormat("es-CO", { timeZone: "America/Bogota", weekday: "long", day: "numeric", month: "long", year: "numeric" }).format(new Date(exp * 1000));

/** Downloads `postulacion-subsidio-qr.pdf`. `destino` (encoded in the QR only) carries an access code valid until `exp`. */
export async function descargarCartel(destino: string, exp: number) {
  const [{ jsPDF }, qr, logo] = await Promise.all([
    import("jspdf"),
    QRCode.toDataURL(destino, { errorCorrectionLevel: "H", margin: 1, width: 1200 }),
    aDataUrl("/brand/logo-alcaldia.png"),
  ]);
  const doc = new jsPDF({ unit: "mm", format: "letter" });
  const ancho = doc.internal.pageSize.getWidth();
  const m = 20;

  // Header: brand band with the gold seam of the identity manual.
  doc.setFillColor(...AZUL);
  doc.rect(0, 0, ancho, 34, "F");
  doc.setFillColor(...DORADO);
  doc.rect(0, 34, ancho, 1.6, "F");
  if (logo) {
    doc.setFillColor(255, 255, 255);
    doc.roundedRect(m, 7, 26, 20, 2, 2, "F");
    doc.addImage(logo, "PNG", m + 2, 8, 22, 18);
  }
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(11);
  doc.text("Alcaldía de Santiago de Cali", m + 32, 16);
  doc.setFont("helvetica", "bold");
  doc.text("Secretaría de Vivienda Social y Hábitat", m + 32, 22);

  // Title.
  doc.setTextColor(...AZUL);
  doc.setFontSize(26);
  doc.text(doc.splitTextToSize("Postúlese al Subsidio Distrital de Vivienda", ancho - 2 * m), ancho / 2, 52, { align: "center" });
  doc.setTextColor(...GRIS);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(13);
  doc.text("Escanee el código con la cámara de su celular para abrir el formulario.", ancho / 2, 76, { align: "center" });

  // QR, framed.
  const lado = 68;
  const x = (ancho - lado) / 2;
  const y = 84;
  doc.setDrawColor(...AZUL);
  doc.setLineWidth(1.2);
  doc.roundedRect(x - 5, y - 5, lado + 10, lado + 10, 4, 4, "S");
  doc.addImage(qr, "PNG", x, y, lado, lado);
  // Discreet validity under the QR: anyone looking at the sheet can tell whether it is still current.
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.setTextColor(...GRIS);
  doc.text(`Vigente hasta el ${fechaVence(exp)}`, ancho / 2, y + lado + 10, { align: "center" });

  // Two columns under the QR: the steps (a real sequence, numbered) and the documentation to have ready.
  const arriba = y + lado + 21;
  const col = (ancho - 2 * m - 10) / 2;
  let yy = arriba;
  doc.setTextColor(...AZUL);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.text("Cómo postularse", m, yy);
  yy += 7;
  doc.setFontSize(10);
  PASOS_CARTEL.forEach((paso, i) => {
    doc.setFillColor(...AZUL);
    doc.circle(m + 3, yy - 1.2, 3, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFont("helvetica", "bold");
    doc.text(String(i + 1), m + 3, yy, { align: "center" });
    doc.setTextColor(...TEXTO);
    doc.setFont("helvetica", "normal");
    const lineas = doc.splitTextToSize(paso, col - 9);
    doc.text(lineas, m + 9, yy);
    yy += lineas.length * 4.4 + 2.6;
  });

  const x2 = m + col + 10;
  // Measure first, so the background box fits its text exactly.
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  const titulo = doc.splitTextToSize(DOCUMENTACION_TITULO, col - 4);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9.5);
  const items = DOCUMENTACION.map((d) => doc.splitTextToSize(d, col - 9) as string[]);
  const altoCaja = 7 + titulo.length * 4.8 + 2 + 5 + items.reduce((t, l) => t + l.length * 4.3 + 1.8, 0) + 2;
  doc.setFillColor(244, 245, 249);
  doc.roundedRect(x2 - 4, arriba - 7, col + 4, altoCaja, 3, 3, "F");
  let y2 = arriba;
  doc.setTextColor(...AZUL);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text(titulo, x2, y2);
  y2 += titulo.length * 4.8 + 2;
  doc.setTextColor(...GRIS);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9.5);
  doc.text("Se le pedirá:", x2, y2);
  y2 += 5;
  doc.setTextColor(...TEXTO);
  for (const lineas of items) {
    doc.text("•", x2, y2);
    doc.text(lineas, x2 + 4, y2);
    y2 += lineas.length * 4.3 + 1.8;
  }

  // Footer.
  const alto = doc.internal.pageSize.getHeight();
  doc.setDrawColor(...DORADO);
  doc.setLineWidth(0.6);
  doc.line(m, alto - 22, ancho - m, alto - 22);
  doc.setTextColor(...GRIS);
  doc.setFontSize(10.5);
  doc.text("El formulario es gratuito. No entregue dinero ni sus datos a intermediarios.", ancho / 2, alto - 15, { align: "center" });
  doc.text("Si tiene dudas, acérquese a la Secretaría de Vivienda Social y Hábitat con su documento.", ancho / 2, alto - 10, { align: "center" });

  doc.save("postulacion-subsidio-qr.pdf");
}
