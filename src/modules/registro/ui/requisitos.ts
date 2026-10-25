// What must be true before a registro can be sent, derived from the form values (pure, async only because the
// section schemas load on demand). Used by the summary ("what is pending") and by the send step (button gating).
import { consentimientoSchema } from "@/modules/consentimiento/domain/schema";
import { documentosSchema } from "@/modules/documentos/domain/schema";
import { firmaFormSchema, firmaVigente } from "@/modules/firma/domain/schema";
import { evaluarRegistro, SECCIONES } from "./datosResumen";
import { entradaDeSeccion, type Valores } from "./pasos";

export type RequisitoId = "datos" | "consentimiento" | "documentos" | "firma";
export type Requisito = {
  id: RequisitoId;
  titulo: string;
  ok: boolean;
  /** One short sentence for the person. */
  detalle: string;
  /** Step that fixes it. */
  paso: string;
};

export type Requisitos = { items: Requisito[]; listo: boolean };

export async function calcularRequisitos(valores: Valores): Promise<Requisitos> {
  const evaluacion = await evaluarRegistro(valores);
  const fallan = SECCIONES.filter((s) => !evaluacion[s.id].ok);

  const consentimiento = consentimientoSchema.safeParse(entradaDeSeccion("consentimiento", valores));
  const documentos = documentosSchema.safeParse(valores.documentos ?? {});
  const firmada = firmaVigente(valores) && firmaFormSchema.safeParse(valores.firma ?? {}).success;

  const items: Requisito[] = [
    {
      id: "datos",
      titulo: "Datos del registro",
      ok: fallan.length === 0,
      detalle: fallan.length ? `Faltan datos en: ${fallan.map((s) => s.titulo).join(", ")}.` : "Completos.",
      paso: fallan[0]?.paso ?? "hogar",
    },
    {
      id: "consentimiento",
      titulo: "Autorización de tratamiento de datos",
      ok: consentimiento.success,
      detalle: consentimiento.success ? "Autorizada." : "Falta la autorización del titular.",
      paso: "consentimiento",
    },
    {
      id: "documentos",
      titulo: "Fotos del documento de identidad",
      ok: documentos.success,
      detalle: documentos.success ? "Frente y reverso capturados." : "Faltan las fotos del frente y el reverso.",
      paso: "documentos",
    },
    {
      id: "firma",
      titulo: "Firma del solicitante",
      ok: firmada,
      detalle: firmada
        ? valores.firma?.metodo_firma === "verificacion_manual" ? "Verificación manual registrada." : "Firmada."
        : "Se registra en el último paso, después de revisar el resumen.",
      paso: "firma",
    },
  ];
  return { items, listo: items.every((i) => i.ok) };
}
