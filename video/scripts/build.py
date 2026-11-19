"""Assembles the tutorial: voice track (sentence WAVs placed at their recorded start), SRT, 96 px caption bar
burned with libass, H.264/AAC mp4. Also writes guion.md and subtitulos.srt next to the mp4.

Run (from the repo root):  python -I video/scripts/build.py
Needs: work/raw.webm + work/timeline.json (record.mjs), work/audio/*.wav (audio.ps1), imageio_ffmpeg.
"""
import json
import pathlib
import sys
import re
import subprocess
import wave

import imageio_ffmpeg

ROOT = pathlib.Path(__file__).resolve().parent.parent
# Optional argv[1]: tutorial id under video/tutoriales/<id> (scenes.json + meta.json there; work in video/work/<id>).
VID = sys.argv[1] if len(sys.argv) > 1 else ""
TUT = ROOT / "tutoriales" / VID if VID else None
META = json.loads((TUT / "meta.json").read_text(encoding="utf-8")) if TUT else {}
WORK = ROOT / "work" / VID if VID else ROOT / "work"
FF = imageio_ffmpeg.get_ffmpeg_exe()
MP4 = ROOT / META["archivo"] if TUT else ROOT / "tutorial-feria-vivienda.mp4"
SRT_OUT = MP4.with_suffix(".srt") if TUT else ROOT / "subtitulos.srt"
GUION_OUT = TUT / "guion.md" if TUT else ROOT / "guion.md"
SCENES = json.loads(((TUT or ROOT / "scripts") / "scenes.json").read_text(encoding="utf-8"))
TL = json.loads((WORK / "timeline.json").read_text(encoding="utf-8"))
LEAD = float(TL.get("lead", 0.0))  # seconds between the recording clock and the first video frame (calibration)
# Waits on slow server answers recorded by lib.mjs: removed from the video; everything after them moves earlier.
CORTES = sorted((a + LEAD, b + LEAD) for a, b in TL.get("cortes", []) if b > a)


def ajustar(t):
    return t - sum(min(b, t) - a for a, b in CORTES if a < t)


DESCRIPCION = {k: tuple(v) for k, v in META.get("escenas", {}).items()} if TUT else {
    "intro": ("Tarjeta de título", "Título de la guía."),
    "login": ("Ingreso y crear cuenta", "Pantalla de ingreso con correo, contraseña y Google; luego Crear cuenta."),
    "admin": ("Administración de usuarios", "Pendientes, Aprobar, No aprobar con motivo, No aprobados y Crear usuario."),
    "nuevo": ("Nuevo registro y borradores", "Lista de registros, Nuevo registro, Borradores en curso y barra Siguiente/Atrás."),
    "p1": ("Paso 1: Solicitante", "Nombre, documento, aviso de duplicado, teléfono con indicativo, correo, nacimiento, estado civil."),
    "p2": ("Paso 2: Hogar", "Personas, adultos mayores y edades, ingreso con rango SMLMV, especial protección."),
    "p3": ("Paso 3: Vivienda", "Dirección, comuna y barrio de la lista, estrato, RUD, dictamen, titularidad, matrícula, única propiedad."),
    "p4": ("Paso 4: Cierre financiero", "Fuentes, seguro, aseguradora y observaciones."),
    "p5": ("Paso 5: Autorización y documento", "Consentimiento de datos y las dos fotos del documento (frente y reverso)."),
    "p6": ("Paso 6: Revisión y firma", "Resumen con Editar, firma dibujada, Enviar registro y confirmación con el radicado."),
    "registros": ("Registros", "Búsqueda por documento y detalle (documentos visibles para administradores)."),
    "dashboard": ("Dashboard", "Totales y gráficos por día, comuna, barrio, estrato, ingresos, revisión y funcionario."),
    "reco": ("Recomendaciones", "Tarjetas: fotos del documento y trabajo en la feria."),
}


def wav_info(p):
    with wave.open(str(p)) as w:
        return w.getframerate(), w.getsampwidth(), w.getnchannels(), w.readframes(w.getnframes())


def fmt(t):
    t = max(0.0, t)
    ms = int(round(t * 1000))
    return f"{ms // 3600000:02d}:{ms // 60000 % 60:02d}:{ms // 1000 % 60:02d},{ms % 1000:03d}"


def trozos(texto, maximo=66):
    """Splits a caption into chunks of at most `maximo` characters (at punctuation or spaces)."""
    partes = re.split(r"(?<=[.;:,])\s+", texto)
    out, cur = [], ""
    for p in partes:
        if cur and len(cur) + 1 + len(p) > maximo:
            out.append(cur)
            cur = p
        else:
            cur = f"{cur} {p}".strip()
    if cur:
        out.append(cur)
    res = []
    for o in out:  # very long chunk without punctuation: split at the middle space
        while len(o) > maximo:
            i = o.rfind(" ", 0, maximo)
            res.append(o[:i])
            o = o[i + 1:]
        res.append(o)
    return res


# ---- voice track + SRT + guion.md rows
items = TL["items"]
rate = sampw = ch = None
placed = []
cues = []
for it in items:
    r, sw, c, data = wav_info(WORK / "audio" / f"{it['scene']}_{it['i']}.wav")
    rate, sampw, ch = r, sw, c
    placed.append((ajustar(it["start"] + LEAD), data))
    texto = SCENES[it["scene"]][it["i"]]["t"]
    ts = trozos(texto)
    total_chars = sum(len(x) for x in ts)
    t = ajustar(it["start"] + LEAD)
    for x in ts:
        d = it["dur"] * len(x) / total_chars
        cues.append((t, t + d, x))
        t += d

_m = re.search(r"Duration: (\d+):(\d+):([\d.]+)", subprocess.run([FF, "-i", str(WORK / "raw.webm")], capture_output=True, text=True).stderr)
video_dur = int(_m[1]) * 3600 + int(_m[2]) * 60 + float(_m[3]) - sum(b - a for a, b in CORTES)
total = max(video_dur, max(s + len(d) / (rate * sampw * ch) for s, d in placed) + 0.3)
buf = bytearray(int(total * rate) * sampw * ch)
for s, d in placed:
    o = int(s * rate) * sampw * ch
    buf[o : o + len(d)] = d
with wave.open(str(WORK / "voz.wav"), "wb") as w:
    w.setnchannels(ch)
    w.setsampwidth(sampw)
    w.setframerate(rate)
    w.writeframes(bytes(buf))

srt = "\n".join(f"{i}\n{fmt(a)} --> {fmt(b)}\n{x}\n" for i, (a, b, x) in enumerate(cues, 1))
(WORK / "subs.srt").write_text(srt, encoding="utf-8")
SRT_OUT.write_text(srt, encoding="utf-8")

# ---- guion.md
rows = []
for name in SCENES:
    its = [i for i in items if i["scene"] == name]
    a = ajustar(its[0]["start"] + LEAD)
    b = ajustar(its[-1]["start"] + LEAD) + its[-1]["dur"]
    narr = " ".join(SCENES[name][i["i"]]["t"] for i in its)
    titulo, visto = DESCRIPCION.get(name, (name, ""))
    rows.append(f"| {int(a // 60)}:{a % 60:04.1f} - {int(b // 60)}:{b % 60:04.1f} | **{titulo}**. {visto} | {narr} |")
guion = (
    "# Guion: tutorial de la Feria de Vivienda\n\n"
    f"Duración total: {total:.1f} s. Voz: Microsoft Sabina Desktop (es-MX). Grabado contra producción con datos ficticios y respuestas simuladas.\n\n"
    "| Tiempo | Qué se muestra | Narración |\n|---|---|---|\n" + "\n".join(rows) + "\n"
)
GUION_OUT.write_text(guion, encoding="utf-8")

# ---- mp4 (cwd = work so the subtitles path needs no drive-letter escaping)
corte = "".join(f"+between(t,{a:.3f},{b:.3f})" for a, b in CORTES)
vf = (
    (f"fps=30,select='not(0{corte})',setpts=N/30/TB," if CORTES else "fps=30,") + "pad=1280:720:0:0:black,"
    "subtitles=subs.srt:original_size=1280x720:force_style='FontName=Arial,FontSize=13,Bold=1,PrimaryColour=&H00FFFFFF,"
    "OutlineColour=&H00000000,BorderStyle=1,Outline=0,Shadow=0,Alignment=2,MarginV=12,MarginL=40,MarginR=40,WrapStyle=0'"
)
cmd = [
    FF, "-y", "-v", "error", "-i", "raw.webm", "-i", "voz.wav",
    "-vf", vf, "-af", "loudnorm=I=-16:TP=-1.5:LRA=11,aresample=44100", "-ac", "2",
    "-c:v", "libx264", "-crf", "23", "-preset", "medium", "-pix_fmt", "yuv420p", "-r", "30",
    "-c:a", "aac", "-b:a", "128k", "-t", f"{total:.2f}", "-movflags", "+faststart", str(MP4),
]
subprocess.run(cmd, cwd=WORK, check=True)
print(f"ok {MP4} ({total:.1f} s)")
