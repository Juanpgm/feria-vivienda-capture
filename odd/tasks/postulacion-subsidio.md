# Feature: postulacion-subsidio
Objective: new 3-step application form for the Subsidio Distrital de Vivienda (format MMDS01.02.03.P001.F001 v010), public via QR, staff view/validation, dashboard metrics.
Branch: feat/postulacion-subsidio · Delivery: stacked-to-main work-unit commits · Tests: Vitest (domain) + Playwright (e2e).
Plan: C:\Users\User\.claude\plans\purring-petting-nest.md

## Specs
- S0 Fields from `context/1. Formato_Postulacion_Subsidio_Distrital_de_Vivienda_v10-1.xlsx` (sections 1, 2, 3, 4, 4.1, 5, 5.1, 6; section 7 = staff validation).
- S1 Reuse existing components, design tokens, normalizers (names, phone, dates, document, address `normalizarDireccion`), photo capture, signature, consent.
- S3 "intenta obtener las coordenadas y el barrio, comuna y estrato ... si no logra encontrar esos datos, entonces solicítalos" — decision 2026-11-18: no geocoder; comuna/barrio/estrato picked from catalogs.
- S5 Three steps: solicitante; grupo familiar (add members); modalidad + proyecto + 5.1 recursos ("primero permitiendo seleccionar las diferentes fuentes y al seleccionarlas, poner el valor, todos los valores monetarios se normalizan a números sin comas ni caracteres especiales").
- S7 Stored in Firestore collection "postulantes_subsidios_emergencia".
- S8 Dashboard section with metrics; propose mandatory fields.
- S9 Registration number auto-generated and unique.
- S10 No redundant data. S11 Editable after creation; show added and missing data.
- S12 First a modal asking the identity document; existing → no new record, only view (public: status only — decision 2026-11-18).
- S13 Default "Sin validar"; logged official "Validar registro": responsibility warning, signature, keeps record code, official name (session), ISO 8601 timestamp, validation code in "validaciones_postulaciones_subsidio_emergencia"; state → válido; blocked when mandatory data missing; show ID front/back; checkbox confirms "recepción del paquete de documentación completo". Validator role: usuario+ (decision).
- S14 Printable QR to the public form. S15 "?" help per field. S16 No record without front and back ID photos.
- S17 Enable/disable like the citizen form. S18 Viewing and validation require login. S19 Dedicated records section unifying postulación + validación per person.

## Tasks
- T1 S0,S5,S9-S11,S16 domain: catálogos, schemas, faltantes, totals + Vitest — inline — done
- T2 S7,S9,S12,S16,S17 server repo + API (consulta, crear, editar, toggle) — inline — done
- T3 S1,S3,S5,S15 form UI (stepper, 3 steps, modal) + public/staff routes — inline — done
- T4 S13,S18,S19 staff list/detail + validation — inline — done
- T5 S14,S17 admin toggle + QR — inline — done
- T6 S8 dashboard section — inline — done
- T7 Playwright e2e (public flow, mocked API) — inline — done; staff flow e2e on real backend done (L6)

## Log
- L1 (2026-11-18) User request: see plan file Context and the /plan prompt (20 numbered points + "hazle pruebas o test al codigo y luego pruebalo con playwright cuando este listo para mi revisión me cuentas").
- L2 Decisions: public existing doc → status only; no geocoder; validator = usuario+.
- L3 Deviation from plan: dedicated lean stepper for postulación instead of generalizing registro `Stepper` (that one is coupled to registro drafts migration, Confirmacion and citizen routes); submission is ONE request (data + photos + signature, ~2.2 MB < 4.5 MB) so a record can never exist without photos (S16).
- L4 (2026-11-18) Verified: tsc, eslint (0 errors), vitest 494 passed, Playwright publico 13 passed (incl. publico-postulacion 2/2). Commits c9e99bf, d5a484b, f7910f0, a694cf3 + e2e commit.
- L5 Pending: staff list/detail/validation not exercised end to end (server components on real Firestore; .auth session expired; no emulator/Java). Needs user decision to run against real Firestore with test data.
- L6 (2026-11-18) User: "Si y usa el usuario de test (y dame las credenciales), para poder probarlo sin dañar nada". Created admin test account prueba.e2e.postulaciones@cali.gov.co (context/cuenta-prueba.mjs). e2e/admin-postulaciones.spec.ts 6/6 on real Firestore; stored data checked via Admin SDK; test data deleted with context/limpiar-postulaciones.mjs --borrar (0 left, PSE counter 0, public form disabled).
- L7 (2026-11-18) User: "aqui no intentó obtener la Comuna/Corregimiento ni el Barrio/Vereda ... debe intentarlo primero y hacer el prefill, si no lo logra, debe solicitarlos ... lugar de nacimiento y lugar de expedicion ... dropdown con searchbar, para todas las ciudades de Colombia"; "tampoco debe preguntar el estrato, eso debe obtenerlo a partir del barrio o vereda"; "revise ... el normalizador de direcciones". Done: geocoder of the Alcaldía (geocodificador.ia.cali.gov.co, same as atencionsismo_SGRED) -> barrio/comuna/estrato/coords/catastral; fallback barrio named in the text; else asked. Estrato from barrio (API or DAP 2015 estrato moda), asked only for veredas. Municipios DIVIPOLA (1,122) comboboxes. Nominatim discarded (road-level points gave wrong barrios). Real e2e 6/6, data cleaned.
- L8 (2026-11-18) User: comuna/barrio only shown when not found or prefilled, never without address; entidad financiera dropdown with all Colombian entities; VIS/VIP chosen first (other value 0); admin/superadmin delete in Postulaciones. Done with Superfinanciera (sr9n-792w) + Supersubsidio (ese3-e6sh) catalog of 121 entities; delete audited in auditoria_borrado_postulaciones before deleting. e2e público 2/2, funcionario 7/7 real. Pre-existing: e2e/registro-pasos-vivienda-revision.spec.ts stale (expects step 'Solicitante', app says 'Sus datos').
