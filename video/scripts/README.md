# Tutorial video (Spanish, ~2:50)

Everything runs from the repo root. Requirements: Node (with the repo's `@playwright/test` + Chromium installed), Python with `imageio_ffmpeg`, Windows PowerShell with the SAPI voice "Microsoft Sabina Desktop".
Nothing here edits app code. The recording runs against a deployed URL and answers EVERY `/api/**` call with in-memory doubles (unknown ones get 501), and aborts requests to other hosts, so no real data is read or written.

1. Narration text: `video/scripts/scenes.json` (caption `t`, optional spoken variant `s`).
2. Voice (one WAV per sentence in `video/work/audio`, then durations):
   `powershell -NoProfile -ExecutionPolicy Bypass -File video/scripts/audio.ps1 -Rate 2`
   `python -I video/scripts/durations.py`
3. Demo payloads (dashboard + registro detail, built with the app's real domain code):
   `node video/scripts/gen-mocks.mjs`
4. Record (needs a valid session; see below):
   `node video/scripts/record.mjs`
   Other deployment: `BASE_URL=https://other.example node video/scripts/record.mjs`
   Check the session only: `PROBE=1 node video/scripts/record.mjs`
5. Assemble (voice track, SRT, caption bar, H.264/AAC) -> `video/tutorial-feria-vivienda.mp4`, `subtitulos.srt`, `guion.md`:
   `python -I video/scripts/build.py`
6. QA contact sheets: `python -I video/scripts/frames.py <output-dir>`

Session: the authenticated pages are guarded by the `sesion` cookie. `record.mjs` reads it IN MEMORY from `.auth/state.json` (or `AUTH_STATE=<file>`, a Playwright storageState; created by `npm run e2e:login`) and sets it for `BASE_URL`; no copy is written anywhere. If the deployment redirects to /login, log in again to refresh `.auth/state.json`.

Notes: the header email is replaced by `funcionario@alcaldia.demo` and dev badges are hidden by an init script; all people, documents and photos are fictitious. The page is recorded at 1280x624 and `build.py` adds a 96 px caption bar (1280x720 final). If the total exceeds 180 s, lower the narration or raise `-Rate` in step 2 and repeat 2-5.

## Short tutorials (postulaciones), 2026-11

Four videos, each in `video/tutoriales/<id>/` (`scenes.json` narration, `meta.json` output file and scene notes, `guion.md` generated):
`validacion` -> `01-validar-postulaciones.mp4`, `registro` -> `02-registrar-postulacion.mp4`, `evento` -> `03-iniciar-evento-qr.mp4`, `general` -> `04-guia-general.mp4` (each with its `.srt`).

They record against the LOCAL dev server with the test account (`.auth/state.json`): `E2E_POSTULACION_ABIERTA=1 npm run dev`.
Shared recorder: `video/scripts/lib.mjs` (cursor, privacy masks for the test account and the PSE-02/VAL-02 test series, per-video API doubles, long server waits cut automatically by `build.py`).

Per video (`<id>` as above):
1. `powershell -NoProfile -ExecutionPolicy Bypass -File video/scripts/audio.ps1 -Rate 1 -Video <id>` then `python -I video/scripts/durations.py <id>`
2. Only `validacion` (and `general`, which shows that record validated): `node --env-file=.env video/scripts/demo-postulacion.mjs` creates the fictitious demo postulación (document 9990000180). Validating is one-shot: to record again run `node --env-file=.env context/limpiar-postulaciones.mjs --borrar` and `node --env-file=.env context/serie-pruebas.mjs` first, then create it again.
3. `node video/scripts/v-<id>.mjs`, then `python -I video/scripts/build.py <id>`; QA sheets: `python -I video/scripts/qa.py <id> <dir>`.
4. When done: `node --env-file=.env context/limpiar-postulaciones.mjs --borrar` and `node --env-file=.env context/serie-pruebas.mjs`.

What is real vs simulated is written in each `meta.json` (`nota`) and in the header of each `v-<id>.mjs`.
