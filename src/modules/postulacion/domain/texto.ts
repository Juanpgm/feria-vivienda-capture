// Legal texts of the format, verbatim. Any wording change MUST bump its version: the server stores the version and
// the sha256 of the text with every record (same rule as modules/consentimiento/domain/texto.ts).

/** Bump on every change of DECLARACION ("AAAA-MM-vN"). */
export const DECLARACION_VERSION = "2026-11-v1";

export const DECLARACION_TITULO = "Declaramos bajo la gravedad de juramento que:";
export const DECLARACION: readonly string[] = [
  "Toda la información aquí suministrada es verídica y se entenderá presentada bajo la gravedad de juramento con su suscripción.",
  "Cumplimos con las condiciones para ser beneficiarios del subsidio distrital de vivienda de interés prioritario y social. No estamos incursos en inhabilidades para solicitarlo. Constituimos un hogar, nuestros ingresos familiares son iguales o inferiores a dos (2) salarios SMLMV para VIP o a cuatro (4) SMLMV para VIS, residimos en el Distrito de Santiago de Cali hace más de cinco (5) años para los casos en que aplique. Autorizamos para que por cualquier medio se verifiquen los datos aquí contenidos y en caso de falsedad se apliquen las sanciones contempladas en la Ley 3 de 1991, Ley 599 del 2000 Artículo 403A, el Acuerdo Distrital No. 0644 del 2026 y el Decreto reglamentario, las normas que lo modifiquen adicionen o sustituyan",
];

export const AUTORIZACION_GIRO =
  "En los términos del Artículo Quinto, Parágrafo Primero del Acuerdo Distrital No. 0644 de 2026, autorizo expresa e irrevocablemente que, de ser asignado el subsidio para adjudicatarios y/o deudores hipotecarios, su valor sea girado directamente a la entidad acreedora señalada arriba, y no a mi nombre, imputándose a la obligación sujeta del presente subsidio, conforme a la reglamentación vigente.";

export const NOTA_FORMATO =
  "La presentación del formato no otorga necesariamente el derecho al subsidio distrital. El desprendible de radicación no garantiza que el hogar cumpla con los requisitos de asignación. Este formulario es gratuito.";

/** Bump on every change of the validation warning below. */
export const VALIDACION_VERSION = "2026-11-v1";
export const AVISO_VALIDACION =
  "Al validar este registro usted, como funcionario(a) de la Secretaría de Vivienda Social y Hábitat, declara que revisó la información y los documentos de identidad del postulante y se hace responsable de la información validada. La validación queda firmada a su nombre, con fecha y hora, y no se puede deshacer desde la aplicación.";
export const CONFIRMACION_PAQUETE = "Confirmo la recepción del paquete de documentación completo del postulante";

export const textoDeclaracion = () => [DECLARACION_TITULO, ...DECLARACION].join("\n");
export const textoValidacion = () => [AVISO_VALIDACION, CONFIRMACION_PAQUETE].join("\n");

/** What to have ready before starting (entry modal, QR poster and its PDF): what the form will ask for. */
export const DOCUMENTACION_TITULO = "Asegúrese de tener toda la documentación de radicación preparada y completa";
export const DOCUMENTACION: readonly string[] = [
  "Su documento de identidad: le pediremos una foto del frente y otra del reverso.",
  "Los documentos de identidad de las personas de su hogar (números y fechas de nacimiento).",
  "Lo que gana al mes cada persona del hogar.",
  "Los valores y entidades de sus ahorros, cesantías, créditos o subsidios, si cuenta con ellos.",
  "Los datos del proyecto de vivienda (nombre, constructora y valor) o, si es deudor, los de su obligación.",
];
export const DOCUMENTACION_NOTA = "La Secretaría revisará esta documentación para validar su postulación.";

/** After sending (receipt and printed QR poster): the registration only counts once an official validates it in person. */
export const SIGUIENTES_PASOS_TITULO = "Siguientes pasos";
export const SIGUIENTES_PASOS: readonly string[] = [
  "Permanezca en el sitio y esté atento al llamado de un funcionario de la Secretaría.",
  "Cuando lo llamen, entregue su documentación para la validación de la postulación.",
  "Si no se presenta al llamado, su registro no será validado y no contará dentro de la postulación.",
];
