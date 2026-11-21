import Link from "next/link";
import { sesionOLogin } from "@/modules/auth/server/guard";
import { listarUsuarios } from "@/modules/auth/server/usuarios.repo";
import { visitasVisibles } from "@/modules/mejoramiento/server/listado";
import { ListadoVisitas } from "@/modules/mejoramiento/ui/ListadoVisitas";
import { Button } from "@/shared/ui/Button";
import { Card } from "@/shared/ui/Card";
import { Select } from "@/shared/ui/Select";

export const metadata = { title: "Levantamientos | Feria de Vivienda" };

/** Inspector: their own visits. Admin/superadmin: every visit, filterable by inspector (S5, S7). */
export default async function VisitasMejoramiento({ searchParams }: { searchParams: Promise<{ inspector?: string }> }) {
  const sesion = await sesionOLogin("inspector");
  const esInspector = sesion.rol === "inspector";
  const filtro = esInspector ? undefined : (await searchParams).inspector || undefined;
  const [filas, inspectores] = await Promise.all([
    visitasVisibles(sesion, filtro),
    esInspector ? [] : listarUsuarios(sesion.rol).then((us) => us.filter((u) => u.rol === "inspector")),
  ]);
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold text-primary-strong">{esInspector ? "Mis levantamientos" : "Levantamientos"}</h1>
        {esInspector && (
          <Link href="/mejoramiento/nueva" className="inline-flex min-h-11 items-center rounded-lg bg-primary px-4 font-semibold text-on-primary hover:opacity-90">
            Nuevo levantamiento
          </Link>
        )}
      </div>
      {!esInspector && (
        <p role="note" className="rounded-lg border border-border bg-surface p-3 text-sm">
          Aquí ve los levantamientos de todos los inspectores y puede abrir el detalle de cada uno. Los levantamientos los registra solo una
          cuenta con rol <span className="font-semibold">Inspector</span>; para dar ese rol use{" "}
          <Link href="/admin/usuarios" className="font-semibold underline">
            Usuarios
          </Link>
          .
        </p>
      )}
      {!esInspector && (
        <form method="get" className="flex flex-wrap items-end gap-3">
          <div className="flex min-w-64 flex-col gap-1">
            <label htmlFor="filtro-inspector" className="text-sm font-semibold">
              Inspector
            </label>
            <Select
              id="filtro-inspector"
              name="inspector"
              defaultValue={filtro ?? ""}
              placeholder="Todos los inspectores"
              options={inspectores.map((u) => ({ value: u.uid, label: u.nombre || u.correo }))}
            />
          </div>
          <Button type="submit" variant="secondary">
            Filtrar
          </Button>
        </form>
      )}
      <Card>
        <ListadoVisitas key={filtro ?? "todas"} filas={filas} mostrarInspector={!esInspector} />
        {filas.length >= 500 && <p className="mt-3 text-sm text-muted">Se muestran los 500 levantamientos más recientes.</p>}
      </Card>
    </div>
  );
}
