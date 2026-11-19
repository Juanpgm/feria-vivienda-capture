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

  // Postulación al Subsidio Distrital de Vivienda (formato MMDS01.02.03.P001.F001)
  Nombres: "Sus nombres tal como aparecen en el documento de identidad. Ejemplo: Ana María.",
  Apellidos: "Sus apellidos tal como aparecen en el documento de identidad. Ejemplo: Pérez Gómez.",
  "Tipo de documento del solicitante": "Quien se postula (jefe del hogar) debe ser mayor de edad: cédula de ciudadanía si es colombiano o cédula de extranjería si es extranjero.",
  "Lugar de expedición": "La ciudad donde le expidieron el documento. En la cédula aparece junto a la fecha de expedición.",
  "Lugar de nacimiento": "La ciudad o municipio donde nació, como aparece en su documento.",
  Género: "Elija cómo se identifica. «Cisgénero» es la persona que se identifica con el sexo que le asignaron al nacer.",
  "¿Cuál género?": "Escriba con sus palabras cómo se identifica.",
  "Teléfono o celular": "Número donde podamos llamarlo o escribirle sobre su postulación. El código de Colombia (+57) ya está seleccionado.",
  "¿En los términos del artículo 56 de la Ley 1437 de 2011, manifiesto expresamente mi autorización y acepto recibir información y ser notificado por medios electrónicos?":
    "Si responde Sí, la Secretaría puede enviarle las notificaciones de su postulación al correo electrónico o al celular que registró, en lugar de por correo físico.",
  "Dirección de domicilio actual": "La dirección donde vive hoy, como la conoce. Ejemplo: Calle 12 # 5-20, apto 301. La convertimos al formato catastral y le mostramos cómo quedará.",
  "Tiempo de residencia en Cali (años)": "Cuántos años completos lleva viviendo en el Distrito de Santiago de Cali. Para algunas modalidades se exigen más de 5 años.",
  Ocupación: "Su ocupación principal hoy. Si no es empleado, independiente ni pensionado, elija «Ninguna de las anteriores».",
  "Ingreso mensual del solicitante": "Lo que usted gana en un mes (salario, pensión o trabajo independiente). Escriba solo el número, sin puntos ni signo $. Ejemplo: 1500000.",
  "Empresa donde labora": "El nombre de la empresa o entidad donde trabaja.",
  "Teléfono de la empresa (opcional)": "Un teléfono de la empresa donde trabaja, si lo conoce.",
  "¿Está afiliado a una caja de compensación?": "Las cajas de compensación familiar son, por ejemplo, Comfandi o Comfenalco. Si su empleador le paga la caja, responda Sí.",
  "¿Cuál caja de compensación?": "El nombre de la caja a la que está afiliado. Ejemplo: Comfandi.",
  "¿Está afiliado al Sisbén?": "El Sisbén es la encuesta que clasifica a los hogares para los programas sociales. Si su hogar tiene encuesta del Sisbén IV, responda Sí.",
  "Grupo Sisbén IV": "La letra de su clasificación en el Sisbén IV (A, B, C o D). Aparece en la consulta del Sisbén, por ejemplo «A3».",
  "Subgrupo Sisbén IV": "El número que acompaña la letra en su clasificación del Sisbén IV, del 1 al 21. Por ejemplo, en «A3» el subgrupo es 3.",
  "Condición especial del solicitante": "Marque las condiciones que le apliquen a usted (por ejemplo, víctima del conflicto, persona con discapacidad o cabeza de hogar). Si no aplica ninguna, marque «Ninguna».",
  "Nombres y apellidos completos": "El nombre completo de esta persona, como aparece en su documento.",
  "Fecha de nacimiento del integrante": "Día, mes y año de nacimiento de esta persona.",
  "Parentesco con el jefe del hogar": "Qué es esta persona de usted: cónyuge, hijo, padre, hermano, etc.",
  "Tipo de documento (TD)": "Mayores de 18 años: C.C. o C.E. Menores: registro civil (R.C.), tarjeta de identidad (T.I.) o NUIP (M.E.).",
  "Número de documento del integrante": "El número del documento de esta persona, sin puntos ni espacios. Para menores, el NUIP o el número de la tarjeta de identidad.",
  "Ocupación del integrante": "A qué se dedica principalmente esta persona: hogar, empleado, pensionado, estudiante, independiente o desempleado.",
  "Identidad de género": "Cómo se identifica esta persona. Puede elegir «Otro» si ninguna opción le describe.",
  "Condición especial del integrante": "Si esta persona tiene alguna condición especial (por ejemplo discapacidad, adulto mayor o víctima del conflicto), elíjala. Si no, elija «Ninguna».",
  "Ingresos mensuales del integrante": "Lo que esta persona gana en un mes. Escriba 0 si no tiene ingresos.",
  "Modalidad a la que se postula": "El tipo de subsidio que solicita. Por ejemplo, para comprar vivienda nueva elija la 1; si debe un crédito al FEV o a la SVSH, elija la 10.",
  "Entidad acreedora": "La entidad a la que le debe la obligación: el Fondo Especial de Vivienda (FEV) o la Secretaría de Vivienda Social y Hábitat (SVSH).",
  "Número de obligación o crédito": "El número del crédito que aparece en sus extractos o en el documento de la deuda.",
  "Programa o proyecto de vivienda de la obligación": "El nombre del programa o proyecto con el que adquirió la deuda.",
  "Saldo total adeudado": "Cuánto debe hoy en total, en pesos. Solo números, sin puntos ni signo $.",
  "Estado de la obligación": "Cómo está la deuda hoy: al día, en mora, en cobro (persuasivo, coactivo o jurídico) o con una facilidad de pago vigente.",
  "Nombre del proyecto habitacional": "El nombre del proyecto de vivienda donde quiere comprar.",
  "Nombre de la constructora": "La empresa que construye o vende el proyecto.",
  "Valor de la solución de vivienda VIS": "Precio de la vivienda de interés social (VIS) en pesos. Solo números.",
  "Valor de la solución de vivienda VIP": "Precio de la vivienda de interés prioritario (VIP) en pesos. Solo números.",
  "Fuentes de recursos": "Con qué dinero cuenta para completar el valor de la vivienda (cierre financiero): subsidios, ahorro, cesantías, créditos u otros aportes.",
  "Valor de subsidio familiar de vivienda": "El valor del subsidio familiar de vivienda que ya le asignaron, en pesos.",
  "Valor de ahorro programado": "Cuánto tiene ahorrado en su cuenta de ahorro programado, en pesos.",
  "Valor de cesantías": "Cuánto tiene en cesantías para la vivienda, en pesos.",
  "Valor de créditos": "El valor del crédito aprobado o preaprobado, en pesos.",
  "Valor de aportes gubernamentales": "El valor de otros aportes del Estado, en pesos.",
  "Valor de otros": "El valor de otras fuentes de recursos, en pesos.",
  "Resolución o acta y fecha de expedición": "El número de la resolución o acta que le asignó el subsidio y su fecha.",
};

/** "Edad del adulto mayor 2" -> "Edad del adulto mayor". */
export const ayudaDe = (etiqueta: string): string | undefined => AYUDAS[etiqueta] ?? AYUDAS[etiqueta.replace(/\s+\d+$/, "")];
