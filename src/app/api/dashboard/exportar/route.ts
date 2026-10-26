import { FieldValue } from "firebase-admin/firestore";
import { NextResponse } from "next/server";
import writeExcelFile from "write-excel-file/node";
import { conErrores } from "@/modules/auth/server/api";
import { requireSesion } from "@/modules/auth/server/sesion";
import { aFilas, aplanar } from "@/modules/dashboard/domain/exportar";
import { fechaBogota } from "@/shared/tiempo";
import { adminDb } from "@/shared/firebase/admin";

export const runtime = "nodejs";

/**
 * Full capture dump (.xlsx), superadmin only. Contains personal data, so no caching and no shared helper: this is the
 * only route that reads whole registro documents outside the detail view.
 * ponytail: single full-collection read, fine for low thousands of registros; stream/paginate if it grows.
 */
export function GET() {
  return conErrores(async () => {
    const sesion = await requireSesion("superadmin");
    const snap = await adminDb().collection("registros").orderBy("registrado_en", "asc").get();
    // Audit trail first: if it cannot be written, the personal data is not handed out.
    await adminDb().collection("auditoria_exportaciones").add({ uid: sesion.uid, correo: sesion.correo, filas: snap.size, en: FieldValue.serverTimestamp() });
    const filas = aFilas(snap.docs.map((d) => aplanar(d.data())));
    const hoja = filas.map((fila, i) => fila.map((value) => (i === 0 ? { value: String(value), fontWeight: "bold" as const } : { value: value ?? undefined })));
    const buffer = await writeExcelFile(hoja).toBuffer();
    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="registros-${fechaBogota()}.xlsx"`,
        "Cache-Control": "no-store",
      },
    });
  });
}
