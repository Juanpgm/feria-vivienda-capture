# QA helper: extracts frames at chosen offsets of each sentence and tiles them into contact sheets (2x3, 640 px wide each).
import json, pathlib, subprocess, sys, imageio_ffmpeg
root = pathlib.Path(__file__).resolve().parent.parent
out = pathlib.Path(sys.argv[1]); out.mkdir(parents=True, exist_ok=True)
ff = imageio_ffmpeg.get_ffmpeg_exe()
tl = {(i["scene"], i["i"]): i for i in json.loads((root / "work" / "timeline.json").read_text())["items"]}
picks = [("intro",1,1.5),("login",0,4.5),("login",1,3.5),("admin",1,3),("admin",2,3.2),("nuevo",1,1.5),("p1",0,6),("p1",1,2.5),("p1",3,4),("p2",0,6),("p2",1,1.5),("p3",0,4.5),("p3",1,4.5),("p4",0,5),("p5",0,2.5),("p5",1,3.5),("p6",0,4.5),("p6",1,4),("p6",2,2.4),("registros",0,2.5),("registros",0,5),("dashboard",0,4),("reco",2,4),("reco",5,3)]
files = []
for n, (s, i, o) in enumerate(picks):
    f = out / f"q{n:02d}.png"
    subprocess.run([ff, "-v", "error", "-y", "-ss", str(tl[(s, i)]["start"] + o), "-i", str(root / "tutorial-feria-vivienda.mp4"), "-frames:v", "1", str(f)], check=True)
    files.append(f)
for k in range(0, len(files), 6):
    grp = files[k:k+6]
    args = [ff, "-v", "error", "-y"]
    for f in grp: args += ["-i", str(f)]
    fc = "".join(f"[{j}]scale=640:-1[s{j}];" for j in range(len(grp))) + "".join(f"[s{j}]" for j in range(len(grp))) + f"xstack=inputs={len(grp)}:layout=" + "|".join(f"{(j%2)*640}_{(j//2)*360}" for j in range(len(grp)))
    subprocess.run(args + ["-filter_complex", fc, str(out / f"sheet{k//6}.png")], check=True)
print("ok")
