"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef } from "react";
import { TIPOS_DOCUMENTO } from "@/shared/constantes";
import { fechaHoraBogota } from "@/shared/tiempo";
import { Button } from "@/shared/ui/Button";
import { enmascararDocumento } from "../domain/enmascarar";

export type DatosConfirmacion = {
  id: string;
  radicado: string;
  /** ISO instant stored by the server; null when it could not be read back. */
  registrado_en: string | null;
  nombre: string;
  tipo_documento: string;
  numero_documento: string;
  /** Radicados of earlier registros with the same document (a warning, never a block). */
  duplicados: string[];
};

const linkBoton = "inline-flex min-h-11 items-center justify-center rounded-lg px-4 text-base font-semibold";

/**
 * Shown after a successful submit. Built to be photographed from the phone and handed over: one clear radicado,
 * the date and time in Bogota, the name and a partly hidden document number. Nothing to print, no QR.
 */
export function Confirmacion({ datos }: { datos: DatosConfirmacion }) {
  const router = useRouter();
  const titulo = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    titulo.current?.focus();
    window.scrollTo({ top: 0 });
  }, []);
  const tipo = datos.tipo_documento in TIPOS_DOCUMENTO ? TIPOS_DOCUMENTO[datos.tipo_documento as keyof typeof TIPOS_DOCUMENTO] : datos.tipo_documento;

  return (
    <section aria-labelledby="conf-titulo" className="mx-auto flex max-w-xl flex-col gap-6 py-4">
      <div>
        <h2 id="conf-titulo" ref={titulo} tabIndex={-1} className="text-2xl font-bold text-primary-strong outline-none">
          Registro enviado
        </h2>
        <p role="status" className="mt-1 text-muted">
          La postulación quedó registrada y los archivos se guardaron.
        </p>
      </div>

      <div className="border-l-4 border-accent pl-4">
        <p className="text-sm font-semibold text-muted">Número de radicado</p>
        <p data-testid="radicado" className="text-5xl font-bold tabular-nums text-primary-strong sm:text-6xl">
          {datos.radicado}
        </p>
      </div>

      <dl className="grid gap-x-6 gap-y-1 sm:grid-cols-[11rem_minmax(0,1fr)]">
        <div className="contents">
          <dt className="text-sm text-muted sm:py-1">Fecha y hora</dt>
          <dd className="mb-2 sm:mb-0 sm:py-1">{datos.registrado_en ? `${fechaHoraBogota(datos.registrado_en)} (hora de Colombia)` : "No disponible"}</dd>
        </div>
        <div className="contents">
          <dt className="text-sm text-muted sm:py-1">Solicitante</dt>
          <dd className="mb-2 sm:mb-0 sm:py-1">{datos.nombre}</dd>
        </div>
        <div className="contents">
          <dt className="text-sm text-muted sm:py-1">Documento</dt>
          <dd className="mb-2 sm:mb-0 sm:py-1">
            {tipo} {enmascararDocumento(datos.numero_documento)}
          </dd>
        </div>
      </dl>

      <p>Anote este número o tome una captura de esta pantalla y entréguela al solicitante. Con el radicado se puede consultar el registro.</p>

      {datos.duplicados.length > 0 && (
        <p className="rounded-lg bg-warning-bg p-3 text-warning-text">
          Este documento ya aparece en {datos.duplicados.length === 1 ? "otro registro" : "otros registros"}: {datos.duplicados.join(", ")}. El registro se guardó de todas formas; el equipo de revisión lo verificará.
        </p>
      )}

      <div className="flex flex-wrap gap-3">
        <Button onClick={() => router.push(`/registros/nuevo?borrador=${crypto.randomUUID()}`)}>Registrar otra persona</Button>
        <Link href={`/registros/${datos.id}`} className={`${linkBoton} border border-border bg-bg text-text hover:bg-surface`}>
          Ver registro
        </Link>
      </div>
    </section>
  );
}
