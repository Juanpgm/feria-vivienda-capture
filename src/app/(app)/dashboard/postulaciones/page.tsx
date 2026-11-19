import Link from "next/link";
import { sesionOLogin } from "@/modules/auth/server/guard";
import { formatoCop } from "@/modules/cierre-financiero/domain/smlmv";
import { Barras, entero, Seccion, SerieDiaria } from "@/modules/dashboard/ui/Graficos";
import { agregarPostulaciones } from "@/modules/postulacion/domain/metricas";
import { filasMetricas } from "@/modules/postulacion/server/postulaciones.repo";
import { fechaBogota } from "@/shared/tiempo";

export const metadata = { title: "Métricas de postulaciones" };

function Cifra({ titulo, valor, nota }: { titulo: string; valor: string; nota?: string }) {
  return (
    <div className="rounded-xl border border-border bg-surface p-3 sm:p-4">
      <p className="text-sm font-semibold leading-tight text-muted">{titulo}</p>
      <p className="mt-1 text-2xl font-bold tabular-nums text-primary-strong sm:text-3xl">{valor}</p>
      {nota && <p className="text-xs text-muted sm:text-sm">{nota}</p>}
    </div>
  );
}

/** S8: how the process is going and who the applicants are. No personal data, only counts. */
export default async function MetricasPostulaciones() {
  await sesionOLogin();
  const m = agregarPostulaciones(await filasMetricas(), fechaBogota());
  const pct = (n: number) => (m.total ? `${Math.round((n / m.total) * 100)} %` : "0 %");
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-bold leading-tight text-primary-strong sm:text-2xl">Postulaciones al Subsidio Distrital de Vivienda</h1>
        <Link href="/postulaciones" className="font-semibold text-primary underline underline-offset-2">Ver postulaciones</Link>
      </div>
      <p className="text-sm text-muted">Datos actualizados cada minuto.</p>
      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <Cifra titulo="Postulaciones" valor={entero(m.total)} nota={`${entero(m.publicas)} por el formulario público`} />
        <Cifra titulo="Validadas" valor={entero(m.validas)} nota={`${pct(m.validas)} del total · ${entero(m.sin_validar)} sin validar`} />
        <Cifra titulo="Con datos completos" valor={entero(m.completas)} nota={`${pct(m.completas)} listas para validar o validadas`} />
        <Cifra titulo="Personas en los hogares" valor={entero(m.personas)} nota={`Aportes declarados: ${formatoCop(m.aportes_total)}`} />
      </div>
      <Seccion titulo="Postulaciones por día" nota="Últimos 30 días">
        <SerieDiaria serie={m.serie} tabla={false} />
      </Seccion>
      <div className="grid gap-6 lg:grid-cols-2">
        <Seccion titulo="Estado del proceso"><Barras items={m.por_estado} colores={{ valido: "bg-success", sin_validar: "bg-accent" }} /></Seccion>
        <Seccion titulo="Datos que más faltan" nota="Lo que impide validar más postulaciones">
          {m.top_faltantes.length ? <Barras items={m.top_faltantes} /> : <p>No hay datos faltantes.</p>}
        </Seccion>
        <Seccion titulo="Modalidad solicitada"><Barras items={m.por_modalidad} /></Seccion>
        <Seccion titulo="Ingresos del hogar (SMLMV)"><Barras items={m.por_ingresos} /></Seccion>
        <Seccion titulo="Comuna o corregimiento" nota="Las 12 con más postulaciones"><Barras items={m.por_comuna} /></Seccion>
        <Seccion titulo="Estrato"><Barras items={m.por_estrato} /></Seccion>
        <Seccion titulo="Tamaño del hogar"><Barras items={m.por_hogar} /></Seccion>
        <Seccion titulo="Condición especial del solicitante" nota="Una persona puede tener varias">
          {m.por_condicion.length ? <Barras items={m.por_condicion} /> : <p>Sin registros.</p>}
        </Seccion>
        <Seccion titulo="Género del solicitante"><Barras items={m.por_genero} /></Seccion>
        <Seccion titulo="Sisbén IV"><Barras items={m.por_sisben} /></Seccion>
        <Seccion titulo="Afiliación a caja de compensación"><Barras items={m.por_caja} /></Seccion>
        <Seccion titulo="Fuentes de recursos (cierre financiero)" nota="Hogares que declaran cada fuente y monto total">
          <Barras items={m.recursos.map((r) => ({ clave: r.clave, etiqueta: r.etiqueta, detalle: formatoCop(r.monto), n: r.n }))} />
        </Seccion>
        <Seccion titulo="Validaciones por funcionario">
          {m.por_validador.length ? <Barras items={m.por_validador} /> : <p>Aún no hay validaciones.</p>}
        </Seccion>
      </div>
    </div>
  );
}
