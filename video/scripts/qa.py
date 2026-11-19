# QA helper for a tutorial: one frame near the end of every narrated sentence (cut-adjusted times), tiled 2x3 per sheet.
# Usage: python -I video/scripts/qa.py <id> <output-dir>
import json, pathlib, subprocess, sys, imageio_ffmpeg

root = pathlib.Path(__file__).resolve().parent.parent
vid, out = sys.argv[1], pathlib.Path(sys.argv[2])
out.mkdir(parents=True, exist_ok=True)
ff = imageio_ffmpeg.get_ffmpeg_exe()
meta = json.loads((root / "tutoriales" / vid / "meta.json").read_text(encoding="utf-8"))
tl = json.loads((root / "work" / vid / "timeline.json").read_text())
cortes = sorted(tuple(c) for c in tl.get("cortes", []))
ajustar = lambda t: t - sum(min(b, t) - a for a, b in cortes if a < t)
files = []
for n, it in enumerate(tl["items"]):
    f = out / f"f{n:02d}.png"
    t = ajustar(it["start"]) + it["dur"] * 0.85
    subprocess.run([ff, "-v", "error", "-y", "-ss", f"{t:.2f}", "-i", str(root / meta["archivo"]), "-frames:v", "1", str(f)], check=True)
    files.append(f)
for k in range(0, len(files), 6):
    g = files[k:k + 6]
    args = [ff, "-v", "error", "-y"]
    for f in g:
        args += ["-i", str(f)]
    if len(g) == 1:
        fc = "[0]scale=640:-1"
    else:
        fc = "".join(f"[{j}]scale=640:-1[s{j}];" for j in range(len(g))) + "".join(f"[s{j}]" for j in range(len(g))) + f"xstack=inputs={len(g)}:layout=" + "|".join(f"{(j % 2) * 640}_{(j // 2) * 360}" for j in range(len(g)))
    subprocess.run(args + ["-filter_complex", fc, str(out / f"sheet{k // 6}.png")], check=True)
print(f"{len(files)} frames -> {out}")
