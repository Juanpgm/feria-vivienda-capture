import Link from "next/link";
import { sesionOLogin } from "@/modules/auth/server/guard";
import { listarUsuarios } from "@/modules/auth/server/usuarios.repo";
import { visitasVisibles } from "@/modules/mejoramiento/server/listado";
import { ListadoVisitas } from "@/modules/mejoramiento/ui/ListadoVisitas";
import { Button } from "@/shared/ui/Button";
import { Card } from "@/shared/ui/Card";
import { Select } from "@/shared/ui/Select";

export const metadata = { title: "Visitas de mejoramiento" };

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
        <h1 className="text-2xl font-bold text-primary-strong">{esInspector ? "Mis visitas" : "Visitas de mejoramiento"}</h1>
        {esInspector && (
          <Link href="/mejoramiento/nueva" className="inline-flex min-h-11 items-center rounded-lg bg-primary px-4 font-semibold text-on-primary hover:opacity-90">
            Nueva visita
          </Link>
        )}
      </div>
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
        {filas.length >= 500 && <p className="mt-3 text-sm text-muted">Se muestran las 500 visitas más recientes.</p>}
      </Card>
    </div>
  );
}
