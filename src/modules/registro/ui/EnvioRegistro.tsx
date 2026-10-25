"use client";

import { useEffect, useRef, useState } from "react";
import { useFormContext, useWatch, type FieldValues } from "react-hook-form";
import { TIPOS_FOTO } from "@/modules/documentos/domain/imagen";
import { SeccionFirma } from "@/modules/firma/ui/SeccionFirma";
import { Button } from "@/shared/ui/Button";
import { ejecutarEnvio, ETIQUETA_ARCHIVO, progresoDe, type Archivo, type EstadoEnvio } from "../domain/envio";
import { registroSchema } from "../domain/schema";
import type { DatosConfirmacion } from "./Confirmacion";
import { ListaRequisitos } from "./ListaRequisitos";
import { armarEntrada, completarEnServidor, crearEnServidor, subirArchivo } from "./enviarApi";
import type { Valores } from "./pasos";
import { calcularRequisitos, type Requisitos } from "./requisitos";

type Props = {
  irAPaso: (id: string) => void;
  borradorId: string;
  /** Called once the server confirmed everything: the owner deletes the draft and shows the confirmation. */
  alEnviado?: (d: DatosConfirmacion) => void;
  /** True while a submit is running (the owner disables navigation and discarding). */
  alBloquear?: (ocupado: boolean) => void;
};

const textoProgreso = (e: EstadoEnvio, total: number): string => {
  if (e.fase !== "enviando") return "";
  if (e.etapa === "registro") return "Creando el registro…";
  if (e.etapa === "archivos") return `Subiendo archivos (${Math.min(e.subidos.length + 1, total)} de ${total}): ${e.subiendo ? ETIQUETA_ARCHIVO[e.subiendo].toLowerCase() : ""}…`;
  return "Verificando que todo quedó guardado…";
};

/** Last step: what is still pending, the applicant's signature and the "Enviar registro" action. */
export function EnvioRegistro({ irAPaso, borradorId, alEnviado, alBloquear }: Props) {
  const { control, getValues } = useFormContext<FieldValues>();
  const valores = useWatch({ control }) as Valores;
  const [req, setReq] = useState<Requisitos | null>(null);
  const [estado, setEstado] = useState<EstadoEnvio>({ fase: "inactivo" });
  const ocupado = useRef(false); // double-click guard that does not wait for a re-render

  useEffect(() => {
    let vivo = true;
    calcularRequisitos(valores).then((r) => vivo && setReq(r));
    return () => {
      vivo = false;
    };
  }, [valores]);

  const enviando = estado.fase === "enviando";
  useEffect(() => alBloquear?.(enviando), [enviando, alBloquear]);

  async function enviar() {
    if (ocupado.current) return;
    ocupado.current = true;
    try {
      const actuales = getValues() as Valores;
      const entrada = armarEntrada(borradorId, actuales);
      const analizado = registroSchema.safeParse(entrada);
      if (!analizado.success) {
        setEstado({ fase: "error", etapa: "registro", mensaje: "Hay datos incompletos o inválidos. Revise el resumen.", subidos: [], fallidos: [], sinConexion: false, conflicto: false });
        return;
      }
      // The signature image is only uploaded for a drawn signature.
      const archivos: Archivo[] = actuales.firma?.metodo_firma === "dibujada" ? [...TIPOS_FOTO, "firma"] : [...TIPOS_FOTO];
      const fin = await ejecutarEnvio(
        {
          id: borradorId,
          archivos,
          crear: () => crearEnServidor(entrada),
          subir: (a) => subirArchivo(borradorId, a, actuales),
          completar: () => completarEnServidor(borradorId),
        },
        progresoDe(estado),
        setEstado,
      );
      setEstado(fin);
      if (fin.fase === "listo") {
        const s = analizado.data.solicitante;
        alEnviado?.({
          id: fin.id,
          radicado: fin.radicado,
          registrado_en: fin.registrado_en,
          nombre: s.nombre_completo,
          tipo_documento: s.tipo_documento,
          numero_documento: s.numero_documento,
          duplicados: (fin.advertencias as { radicado?: string }[]).map((a) => a.radicado ?? "").filter(Boolean),
        });
      }
    } finally {
      ocupado.current = false;
    }
  }

  const total = (getValues("firma.metodo_firma") === "dibujada" ? TIPOS_FOTO.length + 1 : TIPOS_FOTO.length) as number;
  const error = estado.fase === "error" ? estado : null;
  const faltan = req?.items.filter((i) => !i.ok) ?? [];
  const listo = !!req?.listo;

  return (
    <div className="flex flex-col gap-8">
      <section aria-labelledby="req-titulo">
        <h3 id="req-titulo" className="mb-2 border-b border-border pb-1 text-lg font-bold text-primary-strong">
          Requisitos para enviar
        </h3>
        {!req ? (
          <p role="status">Revisando requisitos…</p>
        ) : (
          <ListaRequisitos items={req.items} irAPaso={irAPaso} />
        )}
      </section>

      <SeccionFirma />

      <section aria-labelledby="envio-titulo" className="flex flex-col gap-3">
        <h3 id="envio-titulo" className="border-b border-border pb-1 text-lg font-bold text-primary-strong">
          Enviar
        </h3>
        {!listo && req && <p className="text-muted">El botón se activa cuando todos los requisitos están listos.{faltan.length ? ` Falta: ${faltan.map((f) => f.titulo.toLowerCase()).join(", ")}.` : ""}</p>}

        <div aria-live="polite" role="status" className="min-h-6 text-muted">
          {textoProgreso(estado, total)}
        </div>

        {error && (
          <div role="alert" className="flex flex-col gap-2 rounded-lg border border-danger p-3">
            <p className="font-semibold text-danger">
              {error.etapa === "registro" ? "No se pudo enviar el registro." : `El registro ya se creó con el radicado ${error.radicado}, pero no se completó el envío.`}
            </p>
            {error.fallidos.length > 0 && (
              <>
                <p>No se subieron estos archivos:</p>
                <ul className="list-disc pl-5">
                  {error.fallidos.map((a) => (
                    <li key={a}>{ETIQUETA_ARCHIVO[a]}</li>
                  ))}
                </ul>
              </>
            )}
            <p>{error.mensaje}</p>
            <p className="text-sm text-muted">
              {error.radicado
                ? "Pulse Reintentar: se usa el mismo radicado y no se crea un registro nuevo. El borrador se conserva."
                : "El borrador se conserva. Puede reintentar cuando la conexión se restablezca."}
            </p>
          </div>
        )}

        <div>
          <Button onClick={enviar} disabled={!listo || enviando} aria-busy={enviando}>
            {error ? "Reintentar" : enviando ? "Enviando…" : "Enviar registro"}
          </Button>
        </div>
      </section>
    </div>
  );
}
