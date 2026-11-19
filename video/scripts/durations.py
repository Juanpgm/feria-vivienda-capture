# Measures every work/audio/<scene>_<n>.wav and writes work/durations.json {scene:[seconds,...]} (order from scenes.json).
# Optional argv[1]: tutorial id under video/tutoriales/<id> (work dir video/work/<id>).
import json, sys, wave, pathlib
root = pathlib.Path(__file__).resolve().parent.parent
vid = sys.argv[1] if len(sys.argv) > 1 else ""
work = root / "work" / vid if vid else root / "work"
scenes = json.loads(((root / "tutoriales" / vid) if vid else (root / "scripts")).joinpath("scenes.json").read_text(encoding="utf-8"))
out, total, words = {}, 0.0, 0
for name, frases in scenes.items():
    ds = []
    for i, f in enumerate(frases):
        with wave.open(str(work / "audio" / f"{name}_{i}.wav")) as w:
            ds.append(round(w.getnframes() / w.getframerate(), 3))
        words += len((f.get("s") or f["t"]).split())
    out[name] = ds
    total += sum(ds)
(work / "durations.json").write_text(json.dumps(out), encoding="utf-8")
print(f"words={words} speech={total:.1f}s sentences={sum(len(v) for v in out.values())}")
for k, v in out.items(): print(k, round(sum(v), 1))
