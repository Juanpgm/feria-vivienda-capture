import Link from "next/link";
import { tieneRol } from "@/modules/auth/domain/roles";
import { sesionOLogin } from "@/modules/auth/server/guard";
import { MODALIDADES, type Modalidad } from "@/modules/postulacion/domain/catalogos";
import { listarPostulaciones } from "@/modules/postulacion/server/postulaciones.repo";
import { BotonBorrar } from "@/modules/postulacion/ui/BotonBorrar";
import { EstadoBadge } from "@/modules/postulacion/ui/DetallePostulacion";
import { fechaHoraBogota } from "@/shared/tiempo";
import { controlClass } from "@/shared/ui/Field";
import { IconoImpresora } from "@/shared/ui/Iconos";

export const metadata = { title: "Postulaciones al subsidio" };

const enlace = "font-semibold text-primary underline underline-offset-2";

/** S18/S19: staff-only list of postulaciones with their validation state. */
export default async function Postulaciones({ searchParams }: { searchParams: Promise<{ q?: string; estado?: string }> }) {
  const sesion = await sesionOLogin();
  const esAdmin = tieneRol(sesion.rol, "admin");
  const { q = "", estado = "" } = await searchParams;
  const filas = await listarPostulaciones({ q, estado });
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold text-primary-strong">Postulaciones al subsidio</h1>
        <div className="flex flex-wrap items-center gap-4">
          <Link href="/dashboard/postulaciones" className={enlace}>Métricas</Link>
          <Link href="/postulaciones/qr" className={enlace}>Código QR</Link>
          <Link href="/postulaciones/nueva" className="inline-flex min-h-11 items-center rounded-lg bg-primary px-4 font-semibold text-on-primary">
            Nueva postulación
          </Link>
        </div>
      </div>
      <form className="flex flex-wrap items-end gap-3" role="search">
        <label className="flex w-full flex-col gap-1 text-sm font-semibold sm:w-auto">
          Buscar
          <input name="q" defaultValue={q} placeholder="Radicado, documento o nombre" className={`${controlClass} w-full sm:w-72`} />
        </label>
        <label className="flex flex-col gap-1 text-sm font-semibold">
          Estado
          <select name="estado" defaultValue={estado} className={`${controlClass} w-44`}>
            <option value="">Todos</option>
            <option value="sin_validar">Sin validar</option>
            <option value="valido">Válido</option>
          </select>
        </label>
        <button className="min-h-11 rounded-lg border border-border px-4 font-semibold">Filtrar</button>
      </form>
      <p className="text-sm text-muted" role="status">{filas.length} postulación(es)</p>
      {filas.length > 0 && (
        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full text-left text-sm">
            <thead className="bg-surface">
              <tr>{["Radicado", "Postulante", "Documento", "Modalidad", "Estado", "Faltantes", "Registrada", "Acciones"].map((h) => <th key={h} className="p-2">{h}</th>)}</tr>
            </thead>
            <tbody>
              {filas.map((f) => (
                <tr key={f.id} className="border-t border-border">
                  <td className="p-2 tabular-nums"><Link href={`/postulaciones/${f.id}`} className={enlace}>{f.radicado}</Link>{f.prueba && <span className="ml-2 rounded bg-surface px-1.5 py-0.5 text-xs font-semibold text-muted">Prueba</span>}</td>
                  <td className="p-2 font-medium">{f.nombre}</td>
                  <td className="p-2 tabular-nums">{f.documento}</td>
                  <td className="p-2">{MODALIDADES[f.modalidad as Modalidad] ?? f.modalidad}</td>
                  <td className="p-2"><EstadoBadge estado={f.estado} /></td>
                  <td className={`p-2 ${f.faltantes ? "font-semibold text-warning-text" : "text-success"}`}>{f.faltantes || "Completa"}</td>
                  <td className="p-2">{f.creado_en ? fechaHoraBogota(f.creado_en) : ""}</td>
                  <td className="p-2">
                    <div className="flex items-center gap-3">
                      {f.estado === "valido" && (
                        <a href={`/api/postulaciones/${f.id}/pdf`} target="_blank" rel="noreferrer" className={`inline-flex min-h-11 items-center gap-1 ${enlace}`} aria-label={`Imprimir la postulación ${f.radicado} (PDF)`}>
                          <IconoImpresora className="size-4" />
                          Imprimir
                        </a>
                      )}
                      {esAdmin && <BotonBorrar id={f.id} radicado={f.radicado} nombre={f.nombre} compacto />}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
