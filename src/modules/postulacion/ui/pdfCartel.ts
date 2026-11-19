// Printable PDF (letter) with the QR of the public postulación form and plain instructions. The link itself is never
// written: people reach the form only by scanning. Built in the browser, so the QR points at this deployment.
import QRCode from "qrcode";

const AZUL: [number, number, number] = [0, 54, 95];
const DORADO: [number, number, number] = [213, 177, 108];
const TEXTO: [number, number, number] = [34, 34, 33];
const GRIS: [number, number, number] = [77, 77, 77];

export const PASOS_CARTEL = [
  "Abra la cámara de su celular y apunte al código.",
  "Toque el aviso que aparece en la pantalla para abrir el formulario.",
  "Tenga a mano su documento de identidad: le pediremos una foto del frente y otra del reverso.",
  "Responda los tres pasos y envíe. Recibirá un número de registro.",
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

/** Downloads `postulacion-subsidio-qr.pdf`. `destino` is the public form URL (encoded in the QR only). */
export async function descargarCartel(destino: string) {
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
  const lado = 100;
  const x = (ancho - lado) / 2;
  const y = 84;
  doc.setDrawColor(...AZUL);
  doc.setLineWidth(1.2);
  doc.roundedRect(x - 6, y - 6, lado + 12, lado + 12, 4, 4, "S");
  doc.addImage(qr, "PNG", x, y, lado, lado);

  // Steps (a real sequence: numbered).
  let yy = y + lado + 20;
  doc.setTextColor(...AZUL);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.text("Cómo postularse", m, yy);
  yy += 8;
  doc.setFontSize(12);
  PASOS_CARTEL.forEach((paso, i) => {
    doc.setFillColor(...AZUL);
    doc.circle(m + 3.5, yy - 1.4, 3.5, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFont("helvetica", "bold");
    doc.text(String(i + 1), m + 3.5, yy, { align: "center" });
    doc.setTextColor(...TEXTO);
    doc.setFont("helvetica", "normal");
    const lineas = doc.splitTextToSize(paso, ancho - 2 * m - 12);
    doc.text(lineas, m + 11, yy);
    yy += lineas.length * 5.6 + 3.5;
  });

  // Footer.
  const alto = doc.internal.pageSize.getHeight();
  doc.setDrawColor(...DORADO);
  doc.setLineWidth(0.6);
  doc.line(m, alto - 26, ancho - m, alto - 26);
  doc.setTextColor(...GRIS);
  doc.setFontSize(10.5);
  doc.text("El formulario es gratuito. No entregue dinero ni sus datos a intermediarios.", ancho / 2, alto - 18, { align: "center" });
  doc.text("Si tiene dudas, acérquese a la Secretaría de Vivienda Social y Hábitat con su documento.", ancho / 2, alto - 12, { align: "center" });

  doc.save("postulacion-subsidio-qr.pdf");
}
