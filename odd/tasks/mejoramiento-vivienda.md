# Feature: mejoramiento-vivienda
Objective: inspector field-visit form (format MMDS01.02.04.P003.F003) capturing work quantities with APUs, photos/signatures/croquis in S3, Inspector role, user account module.
Branch: feat/mejoramiento-vivienda · Delivery: ask-on-risk → stacked-to-main (2026-11-20), work-unit commits; slices: PR1 T1 (6b4920d..3a67e66), PR2 T3+T6 (955b8b1..d765456), next slices from T2 on · Tests: Vitest (domain/routes) + Playwright (e2e).
Plan: C:\Users\User\.claude\plans\compressed-petting-mccarthy-of-22edbf52-868f-4355-9144-dcd55fdc751c.md · Source prompt: context/PROMPT-MEJORAMIENTO-VIVIENDA.txt (gitignored).

## Specs
- S1 "Crea un formulario con las mismos tokens de diseño y UI que tiene la aplicación actualmente, debe estar orientado no solamente a identificar el tipo de mejoramiento sino a poder capturar sus cantidades." Fields from the FORMATO (aplica Si/No, alcance "TIPO" o "ADECUACIÓN", sections with Existen Si/No + estado B/R/M).
- S2 APU database from sheet "LISTADO DE PRECIOS" in Firebase collection "APUS", loaded "desde la API": ITEM (unique code), DESCRIPCION, UND, COSTO UNITARIO. "un botón para agregar actividades al listado, crear capítulos según los ejemplos que hay en la hoja "PRESUPUESTO TOPOP"". Row: ITEM, DESCRIPCION, UND, COSTO UNITARIO, CANTIDAD; "al multiplicar esa cantidad por el COSTO UNITARIO, da el COSTO DIRECTO". Items "pueden ser repetidas para generar una memoria de cálculo".
- S3 Owner data: "Nombre del propietario", "Tipo de documento", "Número de documento", "Teléfono de contacto", "Correo electrónico", "Número de años habitando el predio" y demás. Date/time automatic; coordinate taken on submit; "intersección geográfica entre los "basemaps" para encontrar la comuna_corregimiento y el barrio_vereda según las coordenadas, sin preguntarlo"; large "Observaciones"; signatures of who attends (nombre completo, parentesco) with options "(Propietario, Arrendatario, Familiar u otro y si selecciona otro dar la posibilidad de escribir cual)"; "la firma del funcionario que hace la visita"; "cada registro debe tener un código de registro que lo haga único por vivienda o unidad habitacional".
- S4 S3 bucket "mejoramiento-vivienda": folder "visitas-profesionales"/{código de visita}/ with "registro-fotográfico" (photos named "con el prefijo del código de visita, código ITEM y el consecutivo"; "mímino de 6 fotos por visita y un máximo de 30"), "firma-ciudadano" ("código de la visita, seguido por la numero de documento y el consecutivo"; "Solo se puede tener una firma-ciudadano por visita"), "croquis-visita" ("código de la visita como prefijo y el consecutivo"; "máximo cargar 4 archivos por visita"). Presigned URLs; never expose AWS secrets to the client.
- S5 "tiene_croquis" boolean default False showing "Sin croquis"; visits list per professional with "Cargar croquis" button when false → modal drag and drop; after saving → true and "Croquis cargado" in green.
- S6 Photos per activity row, "máximo de 6 fotos por item", prefixed with registro number and ITEM, stored in S3.
- S7 Role "Inspector" creates visits; "cada inspector solo podrá ver sus registros"; "admin" or "superadmin" see all and in Usuarios "deberán poder escalar privilegios o cambiar de rol"; "Crear cuenta" creates "Usuario" by default.
- S8 When converted to inspector the active session is closed; on next login ask for a handwritten signature only if missing; stored in S3 folder "inspectores"/{inspector}/.
- S9 User module: "9.1. Solicitar escalada de privilegios. 9.2. Cambiar contraseña. 9.3. Editar sus datos como nombre, celular o cedula (o completarlos si no los tiene). 9.4. Obtener un listado de todas sus visitas e un informe en pdf de todos los registros para efectos de evidencia."
- Decisions 2026-11-20: visit independent of postulaciones; materials = quantities and costs per APU only; totals = direct cost only (no AIU/tope); IAM user "s3-mejoramiento-vivienda-app" with policy "Policy-S3-MejoramientoVivienda", configure with AWS CLI; bucket CORS PUT/GET from frontend domains.
- Assumptions: code MV-000001 (test accounts from MV-020001); only exact role inspector creates; "No aplica" visits need no quantities nor photo minimum; location required to submit; "Tipo de documento" added.

## Tasks
- T1 S7 roles: inspector + change role (claims + revoke) + selector in Usuarios — inline — Risk item 2 — done 6b4920d, 3a67e66 (verifier pass; native review approved review-37e9a677621a8560)
- T2 S9.1-9.3 Mi cuenta: data (+cargo for the format signature), password (client re-auth + updatePassword), escalation request (+ resolution in Usuarios) — inline — Risk item 2 — done
- T3 S2 APU import script + GET /api/apus — inline — done (dry run: 3842 APUs, 1 repeated ITEM 240201; Firestore write pending authorization)
- T4 S4 S3 base (shared/s3.ts, env, CORS, CSP), AWS profile — inline — Risk items 2,5 — pending
- T5 S8 inspector signature + layout gate — inline — Risk item 2 — pending
- T6 S1-S3,S6 visit domain: schema, cantidad, costos, fotos, geo + limites.json — inline — done
- T7 S1-S3,S6 visit form UI (5 steps) + local draft — inline — pending
- T8 S3,S4,S7 submit API + confirm + MV code — inline — Risk item 2 — pending
- T9 S5 list, detail, croquis modal — inline — pending
- T10 S9.4 my visits + PDF — inline — pending

## Log
- L1 (2026-11-20) User request: "/plan usa el archivo prompt en context/PROMPT-MEJORAMIENTO-VIVIENDA.txt, para planear el diseño de ese flujo de trabajo e interfaz y sus actividades con ODD y si tienes dudas o necesitas tomar decisiones, pregúntame". Prompt content quoted in Specs.
- L2 (2026-11-20) Answers: postulación link "Independiente"; insumos "Cantidades y costos"; AIU/tope "Solo costo directo". User: "cree un usuario en el bucket con la politica "Policy-S3-MejoramientoVivienda" y el usuario se llama "s3-mejoramiento-vivienda-app" dentro del bucket "mejoramiento-vivienda" para que lo configures con amazon CLI"; "recuerda configurar ... CORS ... para permitir peticiones PUT y GET desde el dominio de tu frontend". Plan approved.
- L3 (2026-11-20) Delivery answer: "stacked-to-main". Progress: T1, T3, T6 done (see Tasks).
- L4 (2026-11-20) Slice 3a67e66..d765456 (T3+T6) assessed medium/under_budget, closed before the high-risk T2 unit so T2 is reviewed alone.
