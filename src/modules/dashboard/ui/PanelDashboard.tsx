"use client";

import { useEffect, useState, type FormEvent } from "react";
import { fechaHoraBogota } from "@/shared/tiempo";
import { Button } from "@/shared/ui/Button";
import { Field, TextInput } from "@/shared/ui/Field";
import { Select } from "@/shared/ui/Select";
import type { Dashboard, DashboardCompleto, Item, Resumen } from "../domain/agregacion";
import { Barras, SerieDiaria, Seccion, TablaDatos, TablaItems, diaLargo, entero } from "./Graficos";

type Filtros = { desde: string; hasta: string; funcionario: string };
const VACIOS: Filtros = { desde: "", hasta: "", funcionario: "" };
type Pedido = { filtros: Filtros; refrescar: boolean; n: number };
type Respuesta = { n: number } & ({ datos: Dashboard } | { error: string });

const COLOR_REVISION = { pendiente_revision: "bg-primary", habilitado: "bg-success", no_habilitado: "bg-danger", pendiente_subsanacion: "bg-accent" };

function Cifras({ titulo, resumen, grande = true }: { titulo: string; resumen: Resumen; grande?: boolean }) {
  const periodos: [string, number][] = [
    ["Hoy", resumen.hoy],
    ["Últimos 7 días", resumen.ultimos_7],
    ["Últimos 30 días", resumen.ultimos_30],
  ];
  return (
    <div className="flex flex-wrap items-end gap-x-12 gap-y-4">
      <div>
        <p className="text-sm font-semibold text-muted">{titulo}</p>
        <p className={`${grande ? "text-5xl" : "text-4xl"} font-bold tabular-nums text-primary-strong`}>{entero(resumen.total)}</p>
      </div>
      <dl className="flex flex-wrap gap-x-8 gap-y-3">
        {periodos.map(([etiqueta, n]) => (
          <div key={etiqueta}>
            <dt className="text-sm text-muted">{etiqueta}</dt>
            <dd className="text-2xl font-semibold tabular-nums">{entero(n)}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

function Distribucion({ titulo, nota, items, tabla, colores, className }: { titulo: string; nota?: string; items: Item[]; tabla: boolean; colores?: Record<string, string>; className?: string }) {
  return (
    <Seccion titulo={titulo} nota={nota} className={className}>
      {tabla ? <TablaItems titulo={titulo} items={items} /> : <Barras items={items} colores={colores} />}
    </Seccion>
  );
}

function Funcionarios({ filas, tabla }: { filas: DashboardCompleto["por_funcionario"]; tabla: boolean }) {
  const ultimo = (f: string | null) => (f ? diaLargo(f) : "Sin fecha");
  return (
    <Seccion titulo="Registros por funcionario" nota="Funcionarios que registraron en el período, de más a menos registros." className="lg:col-span-2">
      {filas.length === 0 ? (
        <p className="text-muted">Ningún funcionario ha registrado en este período.</p>
      ) : tabla ? (
        <TablaDatos titulo="Registros por funcionario" columnas={["Funcionario", "Registros", "Último registro"]} filas={filas.map((f) => [`${f.nombre} (${f.correo})`, f.n, ultimo(f.ultimo_registro)])} />
      ) : (
        <>
          <div className="hidden overflow-x-auto md:block">
            <table className="w-full border-collapse text-left text-sm">
              <caption className="sr-only">Registros por funcionario</caption>
              <thead>
                <tr className="border-b border-border text-muted">
                  <th scope="col" className="px-2 py-2 font-semibold">Funcionario</th>
                  <th scope="col" className="px-2 py-2 text-right font-semibold">Registros</th>
                  <th scope="col" className="px-2 py-2 text-right font-semibold">Último registro</th>
                </tr>
              </thead>
              <tbody>
                {filas.map((f) => (
                  <tr key={f.uid} className="border-b border-border">
                    <th scope="row" className="px-2 py-2 font-normal">
                      <span className="font-semibold">{f.nombre}</span>
                      <br />
                      <span className="text-muted">{f.correo}</span>
                    </th>
                    <td className="px-2 py-2 text-right text-lg font-semibold tabular-nums">{entero(f.n)}</td>
                    <td className="px-2 py-2 text-right tabular-nums">{ultimo(f.ultimo_registro)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <ul className="divide-y divide-border border-y border-border md:hidden">
            {filas.map((f) => (
              <li key={f.uid} className="flex items-start justify-between gap-3 py-3">
                <div className="min-w-0">
                  <p className="font-semibold">{f.nombre}</p>
                  <p className="break-words text-sm text-muted">{f.correo}</p>
                  <p className="text-sm text-muted">Último registro: {ultimo(f.ultimo_registro)}</p>
                </div>
                <p className="text-2xl font-semibold tabular-nums">{entero(f.n)}</p>
              </li>
            ))}
          </ul>
        </>
      )}
    </Seccion>
  );
}

/** Dashboard shell: fetches GET /api/dashboard (aggregated numbers only) and renders what the payload's scope contains. */
export function PanelDashboard({ admin, superadmin = false }: { admin: boolean; superadmin?: boolean }) {
  const [borrador, setBorrador] = useState<Filtros>(VACIOS);
  const [pedido, setPedido] = useState<Pedido>({ filtros: VACIOS, refrescar: false, n: 0 });
  const [resp, setResp] = useState<Respuesta | null>(null);
  const [ultimos, setUltimos] = useState<Dashboard | null>(null);
  const [funcionarios, setFuncionarios] = useState<Record<string, string>>({});
  const [tabla, setTabla] = useState(false);

  useEffect(() => {
    const ac = new AbortController();
    const p = new URLSearchParams();
    for (const [k, v] of Object.entries(pedido.filtros)) if (v) p.set(k, v);
    if (pedido.refrescar) p.set("refrescar", "1");
    fetch(`/api/dashboard?${p}`, { signal: ac.signal })
      .then(async (res) => {
        const j = await res.json().catch(() => ({}));
        if (!res.ok) {
          const campo = j?.campos ? Object.values(j.campos as Record<string, string[]>)[0]?.[0] : undefined;
          throw new Error(campo ?? j?.error ?? "No se pudieron cargar las cifras");
        }
        const datos = j as Dashboard;
        setUltimos(datos);
        if (datos.alcance === "completo")
          setFuncionarios((prev) => ({ ...prev, ...Object.fromEntries(datos.por_funcionario.map((f) => [f.uid, f.nombre])) }));
        setResp({ n: pedido.n, datos });
      })
      .catch((e: Error) => {
        if (!ac.signal.aborted) setResp({ n: pedido.n, error: e instanceof TypeError ? "No hay conexión con el servidor" : e.message });
      });
    return () => ac.abort();
  }, [pedido]);

  const cargando = !resp || resp.n !== pedido.n;
  const error = resp && resp.n === pedido.n && "error" in resp ? resp.error : null;
  const datos = ultimos; // keep showing the last numbers while refreshing
  const filtrando = Object.values(pedido.filtros).some(Boolean);

  const aplicar = (f: Filtros) => setPedido((p) => ({ filtros: f, refrescar: false, n: p.n + 1 }));
  const enviar = (e: FormEvent) => {
    e.preventDefault();
    aplicar(borrador);
  };
  const limpiar = () => {
    setBorrador(VACIOS);
    aplicar(VACIOS);
  };
  const cambiar = (k: keyof Filtros) => (e: { target: { value: string } }) => setBorrador((b) => ({ ...b, [k]: e.target.value }));
  const opcionesFuncionario = Object.entries(funcionarios).map(([value, label]) => ({ value, label }));

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold text-primary-strong">Resumen de registros</h1>
        <div className="flex flex-wrap items-center gap-3">
          <span aria-live="polite" className="text-sm text-muted">
            {cargando ? "Actualizando…" : datos ? `Datos de las ${fechaHoraBogota(datos.generado_en).split(", ")[1] ?? ""}` : ""}
          </span>
          <Button variant="secondary" aria-pressed={tabla} onClick={() => setTabla((t) => !t)}>
            {tabla ? "Ver gráficos" : "Ver como tablas"}
          </Button>
          <Button variant="secondary" disabled={cargando} onClick={() => setPedido((p) => ({ ...p, refrescar: true, n: p.n + 1 }))}>
            Actualizar
          </Button>
          {superadmin && (
            <a href="/api/dashboard/exportar" download className="inline-flex min-h-11 items-center rounded-lg border border-border px-4 font-semibold">
              Descargar datos (.xlsx)
            </a>
          )}
        </div>
      </div>

      {admin && (
        <form aria-label="Filtros del resumen" onSubmit={enviar} className="flex flex-col gap-4 rounded-xl border border-border p-4">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <Field label="Desde">{(a) => <TextInput {...a} type="date" value={borrador.desde} onChange={cambiar("desde")} />}</Field>
            <Field label="Hasta">{(a) => <TextInput {...a} type="date" value={borrador.hasta} onChange={cambiar("hasta")} />}</Field>
            <Field label="Funcionario">
              {(a) => <Select {...a} options={opcionesFuncionario} placeholder="Todos" value={borrador.funcionario} onChange={cambiar("funcionario")} />}
            </Field>
          </div>
          <div className="flex flex-wrap gap-3">
            <Button type="submit">Aplicar</Button>
            {(filtrando || Object.values(borrador).some(Boolean)) && (
              <Button variant="secondary" onClick={limpiar}>
                Limpiar
              </Button>
            )}
          </div>
        </form>
      )}

      {error && (
        <div role="alert" className="flex flex-wrap items-center gap-3 text-danger">
          <p className="font-medium">{error}</p>
          <Button variant="secondary" onClick={() => setPedido((p) => ({ ...p, n: p.n + 1 }))}>
            Reintentar
          </Button>
        </div>
      )}

      {!datos && !error && <p className="text-muted">Cargando cifras…</p>}

      {datos && (
        <>
          <section aria-label="Cifras principales" className="flex flex-col gap-6 border-b border-border pb-6">
            <Cifras titulo={datos.alcance === "completo" ? (filtrando ? "Registros en el filtro" : "Registros en total") : "Registros del programa"} resumen={datos.resumen} />
            {datos.alcance === "usuario" && <Cifras titulo="Sus registros" resumen={datos.propios} grande={false} />}
            {datos.alcance === "lectura" && (
              <p className="text-sm text-muted">Estas son las cifras generales del programa. El detalle se habilita cuando un administrador apruebe su cuenta.</p>
            )}
          </section>

          {datos.alcance === "completo" && datos.resumen.total === 0 && (
            <div className="rounded-lg border border-border bg-surface p-4">
              {filtrando ? (
                <>
                  <p className="font-semibold">No hay registros con esos filtros.</p>
                  <p className="mt-1 text-muted">Pruebe con otro rango de fechas u otro funcionario.</p>
                  <Button variant="secondary" className="mt-3" onClick={limpiar}>
                    Quitar filtros
                  </Button>
                </>
              ) : (
                <>
                  <p className="font-semibold">Aún no hay registros.</p>
                  <p className="mt-1 text-muted">Cuando los funcionarios envíen registros, las cifras y los gráficos aparecerán aquí.</p>
                </>
              )}
            </div>
          )}
          {datos.alcance !== "completo" && datos.resumen.total === 0 && (
            <div className="rounded-lg border border-border bg-surface p-4">
              <p className="font-semibold">Aún no hay registros.</p>
              <p className="mt-1 text-muted">Las cifras aparecerán aquí cuando se envíen los primeros registros.</p>
            </div>
          )}

          {datos.alcance === "completo" && datos.resumen.total > 0 && (
            <div className="grid items-start gap-6 lg:grid-cols-2">
              <Seccion titulo="Registros por día" nota={`Del ${diaLargo(datos.serie_diaria[0].fecha)} al ${diaLargo(datos.serie_diaria.at(-1)!.fecha)}, fecha de Bogotá.`} className="lg:col-span-2">
                <SerieDiaria serie={datos.serie_diaria} tabla={tabla} />
              </Seccion>
              <Funcionarios filas={datos.por_funcionario} tabla={tabla} />
              <Distribucion titulo="Estado de revisión" items={datos.por_revision} tabla={tabla} colores={COLOR_REVISION} />
              <Distribucion titulo="Sector" items={datos.por_sector} tabla={tabla} />
              <Distribucion titulo="Comuna o corregimiento" items={datos.por_comuna} tabla={tabla} />
              <Distribucion titulo="Barrio o vereda" nota="Los 15 con más registros; el resto se agrupa en Otros." items={datos.por_barrio} tabla={tabla} />
              <Distribucion titulo="Estrato" items={datos.por_estrato} tabla={tabla} />
              <Distribucion titulo="Ingresos del hogar" items={datos.por_ingresos} tabla={tabla} />
              <Distribucion titulo="Tamaño del hogar" items={datos.por_hogar} tabla={tabla} />
              <Distribucion titulo="Adultos mayores en el hogar" items={datos.por_adulto_mayor} tabla={tabla} />
              <Distribucion titulo="Titularidad del inmueble" items={datos.por_titularidad} tabla={tabla} />
              <Distribucion titulo="Dictamen técnico" items={datos.por_dictamen} tabla={tabla} />
              <Distribucion titulo="Registro Único de Damnificados (RUD)" items={datos.por_rud} tabla={tabla} />
              <Distribucion titulo="Seguro del inmueble" items={datos.por_seguro} tabla={tabla} />
            </div>
          )}
        </>
      )}
    </div>
  );
}
