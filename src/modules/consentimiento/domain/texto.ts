// Authorization text for the treatment of personal data (Habeas Data: Ley 1581 de 2012, Decreto 1377 de 2013).
// SINGLE editable content file (REQ-CON-5). Any wording change MUST bump CONSENTIMIENTO_VERSION: the server stores
// the version and the sha256 of exactly this text with every registro, so a record can always be tied to the wording
// the person accepted.

/** Bump on every change of the text below ("AAAA-MM-vN"). */
export const CONSENTIMIENTO_VERSION = "2026-10-v1";

/** Shown at the top of the step until the Secretaría's legal area approves the wording. */
export const ESTADO_TEXTO = "Borrador pendiente de validación jurídica por la Secretaría.";

export const POLITICA_URL = "https://www.cali.gov.co/tic/publicaciones/171934/politica-de-tratamiento-de-datos-personales/";

/** Contact channels are not defined yet: the Secretaría must replace these placeholders before go-live. */
export const CANALES_CONTACTO = [
  "Dirección: [por definir por la Secretaría de Vivienda Social y Hábitat]",
  "Correo electrónico: [por definir por la Secretaría de Vivienda Social y Hábitat]",
  "Teléfono: [por definir por la Secretaría de Vivienda Social y Hábitat]",
] as const;

export type SeccionTexto = { id: string; titulo: string; parrafos: readonly string[]; lista?: readonly string[] };

export const SECCIONES_TEXTO: readonly SeccionTexto[] = [
  {
    id: "responsable",
    titulo: "Quién es el responsable de sus datos",
    parrafos: [
      "El responsable del tratamiento es el Distrito Especial de Santiago de Cali, a través de la Secretaría de Vivienda Social y Hábitat de la Alcaldía de Santiago de Cali.",
    ],
  },
  {
    id: "finalidades",
    titulo: "Para qué se usarán sus datos",
    parrafos: ["Sus datos personales se usarán únicamente para estas finalidades:"],
    lista: [
      "Gestionar su postulación a los bonos distritales de vivienda de emergencia.",
      "Verificar la información que usted declara frente al Registro Único de Damnificados (RUD), la información predial, las centrales de riesgo y los sistemas de subsidios de vivienda.",
      "Elaborar estadísticas y reportes sobre la atención, sin identificar a las personas.",
    ],
  },
  {
    id: "declaracion",
    titulo: "Declaración y verificación",
    parrafos: [
      "Declaro, bajo la gravedad de juramento, que la información que suministré es veraz y completa.",
      "Autorizo a la Secretaría de Vivienda Social y Hábitat para verificar esa información en el RUD, en las bases de información predial, en las centrales de riesgo y en los sistemas de subsidios.",
    ],
  },
  {
    id: "sensibles",
    titulo: "Datos sensibles",
    parrafos: [
      "Algunos datos que se le preguntan son sensibles, porque afectan su intimidad o pueden generar discriminación: discapacidad, condición de víctima del conflicto armado, víctima de violencia basada en género, proceso de reincorporación o ser cuidador de una persona con discapacidad.",
      "Autorizar el tratamiento de estos datos es opcional. Si no lo autoriza, su registro se recibe de igual manera, pero esta información no se guarda: en su lugar se anotará «no autorizado».",
    ],
  },
  {
    id: "derechos",
    titulo: "Sus derechos como titular",
    parrafos: ["Usted tiene derecho a:"],
    lista: [
      "Conocer, actualizar y rectificar sus datos personales.",
      "Solicitar prueba de esta autorización y ser informado del uso que se ha dado a sus datos.",
      "Solicitar la supresión de sus datos y revocar esta autorización, cuando no exista un deber legal o contractual que exija conservarlos.",
      "Presentar quejas ante la Superintendencia de Industria y Comercio (SIC) por infracciones a la ley de protección de datos.",
      "Acceder de forma gratuita a sus datos personales.",
    ],
  },
  {
    id: "contacto",
    titulo: "Cómo ejercer sus derechos",
    parrafos: ["Puede escribir o comunicarse con la Secretaría de Vivienda Social y Hábitat por estos canales:"],
    lista: CANALES_CONTACTO,
  },
] as const;

/** Plain text the hash is computed over (stable: titles, paragraphs and list items in order). */
export function textoPlano(): string {
  return SECCIONES_TEXTO.flatMap((s) => [s.titulo, ...s.parrafos, ...(s.lista ?? [])]).join("\n");
}

export const ETIQUETA_TRATAMIENTO = "El titular autoriza el tratamiento de sus datos personales";
export const ETIQUETA_SENSIBLES = "Autoriza el tratamiento de datos sensibles (opcional)";
