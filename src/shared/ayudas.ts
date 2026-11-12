// Plain-language help for every question of the form, shown behind the "?" button next to its label.
// Keyed by the visible label/legend, so the field components pick it up without each screen passing it.

export const AYUDAS: Record<string, string> = {
  // Solicitante
  "Primer nombre": "Escriba su primer nombre tal como aparece en su cédula.",
  "Segundo nombre (opcional)": "Si tiene un segundo nombre, escríbalo. Si no tiene, déjelo vacío.",
  "Primer apellido": "Escriba su primer apellido tal como aparece en su cédula.",
  "Segundo apellido (opcional)": "Si tiene un segundo apellido, escríbalo. Si no tiene, déjelo vacío.",
  "Tipo de documento": "Es el documento con el que se identifica. C.C. es la cédula de ciudadanía (personas colombianas). C.E. es la cédula de extranjería. Elija «Otro» si tiene un documento distinto, por ejemplo PPT o pasaporte.",
  "Cuál documento": "Escriba el nombre del documento que tiene, por ejemplo «PPT» o «Pasaporte».",
  Nacionalidad: "El país del que es ciudadano. Si su documento es la cédula de ciudadanía, es Colombiana. Escriba el nombre del país para buscarlo en la lista.",
  "Número de documento": "Escriba solo el número de su documento, sin puntos, comas ni espacios. Ejemplo: 1234567890.",
  "Fecha de expedición": "Es la fecha en que le entregaron el documento. En la cédula aparece en el frente, junto a «Fecha y lugar de expedición». Escríbala como día/mes/año.",
  "Teléfono principal": "Número de celular o teléfono donde podamos localizarlo. Escríbalo sin el código del país: ya está seleccionado el de Colombia (+57). Cámbielo solo si el número es de otro país.",
  "Teléfono alterno (opcional)": "Otro número donde se pueda contactar a usted o a un familiar si no contestan el principal. Es opcional.",
  "Correo electrónico": "Un correo al que usted tenga acceso, para poder escribirle sobre su postulación. Ejemplo: nombre@correo.com.",
  "Fecha de nacimiento": "Día, mes y año en que nació, como aparece en su cédula. Para postularse debe ser mayor de 18 años.",
  "Estado civil": "Elija su situación actual: soltero/a, casado/a, en unión libre o viudo/a.",
  "Años de residencia": "Cuántos años lleva viviendo en la ciudad o en el territorio. Si son menos de un año, use decimales: 6 meses se escribe 0,5.",

  // Hogar
  "Personas que viven en el hogar": "Cuente a todas las personas que viven con usted en su hogar, incluyéndose a usted: adultos, niños y adultos mayores.",
  "¿Hay adultos mayores en el hogar?": "Adulto mayor es una persona de 60 años o más que vive en su hogar.",
  "Cuántos adultos mayores": "Número de personas de 60 años o más que viven en su hogar.",
  "Edad del adulto mayor": "La edad en años cumplidos de esta persona. Debe ser 60 o más.",
  "Ingreso mensual del hogar (COP)": "Sume lo que ganan en un mes todas las personas del hogar (salarios, pensiones, ayudas, trabajo por días). Escríbalo en pesos colombianos, aproximado si no sabe el valor exacto. Ejemplo: 1.500.000.",
  "Condiciones del solicitante o su hogar": "Marque las situaciones que le apliquen a usted o a alguien de su hogar; esto puede dar prioridad en la atención. Es información sensible y solo se guarda si usted lo autorizó. Si no aplica ninguna, marque «Ninguna».",

  // Vivienda
  "Dirección del inmueble": "La dirección del inmueble afectado, como se la conoce. Ejemplo: Calle 12 # 5-20, apto 301. Si es una zona rural, escriba la referencia que use.",
  "Comuna o corregimiento": "La zona de la ciudad donde queda el inmueble. Las comunas son urbanas y los corregimientos rurales. Escriba el número o el nombre para buscarla.",
  "Barrio o vereda": "El barrio (zona urbana) o la vereda (zona rural) donde queda el inmueble. Escriba el nombre para buscarlo.",
  Vereda: "La vereda donde queda el inmueble. Escriba el nombre para buscarla.",
  "Estrato socioeconómico": "El número del 1 al 6 que aparece en la factura de energía o de servicios públicos del inmueble, junto a «Estrato».",

  // Riesgo
  "¿Está registrado en el RUD?": "El RUD es el Registro Único de Damnificados. Si después de la emergencia usted fue a registrar su afectación y le dieron un número o un comprobante, responda Sí.",
  "Número de RUD": "El número que le dieron al registrarse en el RUD; aparece en el comprobante o formulario que le entregaron. Si no lo recuerda, marque «No lo sé».",
  "Resultado del dictamen técnico": "Es la conclusión de la visita técnica a su inmueble. Elija la que le informaron: colapso total (destruido), demolido, con orden de demolición, demolición en proceso o arreglos locativos. Si no coincide ninguna, elija «Otro».",
  "Cuál dictamen": "Escriba con sus palabras el resultado del dictamen técnico que le informaron.",

  // Titularidad
  "El solicitante es": "Elija si usted es el dueño del inmueble (tiene escritura o certificado de libertad y tradición) o si vivía allí como arrendatario.",
  "Número de matrícula (opcional)": "La matrícula inmobiliaria es el número que identifica el inmueble en la Oficina de Registro; aparece en la escritura o en el certificado de libertad y tradición. Si no lo tiene a la mano, déjelo vacío.",
  "¿Es su única propiedad residencial?": "Responda Sí si este inmueble es la única vivienda que usted tiene. Si tiene otras viviendas, responda No y elija la excepción que le aplique.",
  "Excepción que aplica": "Si tiene más de una vivienda, elija el motivo por el que aun así puede postularse.",
  "Describa la excepción": "Cuente con sus palabras por qué, teniendo más de una vivienda, puede postularse.",

  // Cierre financiero
  "Fuentes de financiación": "Marque con qué recursos contaría para comprar una vivienda nueva: crédito, subsidio, ahorros o cesantías, indemnización de un seguro o recursos propios. Puede marcar varias. Si no cuenta con ninguna, marque «Ninguna».",
  "¿El inmueble tenía seguro?": "Responda Sí si el inmueble afectado tenía una póliza de seguro vigente (por ejemplo, de incendio o de terremoto, o la que viene con un crédito hipotecario).",
  Aseguradora: "La compañía con la que tenía la póliza. Escriba su nombre para buscarla; si no está en la lista, elija «Otra».",
  "Nombre de la aseguradora": "Escriba el nombre de la compañía de seguros con la que tenía la póliza.",
  "Observaciones (opcional)": "Si hay algo importante que quiera agregar y no tuvo dónde escribirlo, anótelo aquí. Es opcional.",
};

/** "Edad del adulto mayor 2" -> "Edad del adulto mayor". */
export const ayudaDe = (etiqueta: string): string | undefined => AYUDAS[etiqueta] ?? AYUDAS[etiqueta.replace(/\s+\d+$/, "")];
