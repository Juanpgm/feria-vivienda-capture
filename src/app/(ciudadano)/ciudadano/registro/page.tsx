import { redirect } from "next/navigation";
import { estadoCiudadano, identidadDe } from "@/modules/ciudadano/server/registro";
import { CiudadanoError, requireCiudadano } from "@/modules/ciudadano/server/sesion";
import { BotonSalirCiudadano } from "@/modules/ciudadano/ui/BotonSalirCiudadano";
import { FormularioCiudadano } from "@/modules/ciudadano/ui/FormularioCiudadano";
import { fechaHoraBogota } from "@/shared/tiempo";
import { Card } from "@/shared/ui/Card";

export const metadata = { title: "Mi registro | Feria de Vivienda" };

const linkBoton = "inline-flex min-h-11 items-center justify-center rounded-lg bg-primary px-4 text-base font-semibold text-on-primary hover:opacity-90";

export default async function RegistroCiudadano({ searchParams }: { searchParams: Promise<{ editar?: string }> }) {
  let ciudadano;
  try {
    ciudadano = await requireCiudadano();
  } catch (e) {
    if (e instanceof CiudadanoError && e.status === 403) {
      return (
        <Card>
          <p role="status" className="mb-4">{e.message}.</p>
          <BotonSalirCiudadano />
        </Card>
      );
    }
    redirect("/ciudadano");
  }
  const estado = await estadoCiudadano(ciudadano);
  const { editar } = await searchParams;

  if (estado.tipo === "ya_registrado_otro") {
    return (
      <div className="mx-auto flex max-w-xl flex-col gap-4 py-6">
        <Card title={`Hola, ${ciudadano.nombre}`}>
          <p className="mb-4">
            Su documento ya tiene un registro en el sistema (radicado <strong>{estado.radicado}</strong>), por eso no es posible hacer otro.
          </p>
          <BotonSalirCiudadano />
        </Card>
      </div>
    );
  }

  if (estado.tipo === "registrado" && !(editar === "1" && estado.puedeEditar)) {
    return (
      <div className="mx-auto flex max-w-xl flex-col gap-4 py-6">
        <Card title="Su registro fue enviado">
          <p className="text-sm text-muted">Número de radicado</p>
          <p data-testid="radicado" className="mb-3 text-5xl font-bold tabular-nums text-primary-strong">{estado.radicado}</p>
          <p className="mb-1">{ciudadano.nombre}</p>
          {estado.registrado_en && <p className="mb-4 text-muted">Enviado el {fechaHoraBogota(estado.registrado_en)} (hora de Colombia).</p>}
          {estado.puedeEditar ? (
            <p className="mb-4">
              Puede modificar su registro <strong>una sola vez</strong>. Para hacerlo deberá volver a tomar las fotos del documento y firmar de nuevo.
            </p>
          ) : (
            <p className="mb-4">Ya no es posible modificar este registro.</p>
          )}
          <div className="flex flex-wrap gap-3">
            {estado.puedeEditar && (
              <a href="/ciudadano/registro?editar=1" className={linkBoton}>
                Modificar mi registro (única vez)
              </a>
            )}
            <BotonSalirCiudadano />
          </div>
        </Card>
      </div>
    );
  }

  const edicion = estado.tipo === "registrado";
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="font-semibold">
          {ciudadano.nombre} · Documento {ciudadano.documento}
        </p>
        <BotonSalirCiudadano />
      </div>
      {edicion && (
        <p role="status" className="rounded-lg bg-warning-bg p-3 font-medium text-warning-text">
          Está modificando su registro. Esta es la única oportunidad: al enviarlo, ya no podrá cambiarlo de nuevo.
        </p>
      )}
      <FormularioCiudadano
        documento={ciudadano.documento}
        registroId={estado.registroId}
        identidad={identidadDe(ciudadano)}
        edicion={edicion}
        valoresPrevios={edicion ? (estado.valores as Record<string, Record<string, unknown>> | null) : null}
      />
    </div>
  );
}
