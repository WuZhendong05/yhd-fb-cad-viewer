import subprocess, time

PY = r"C:/Users/14418/.workbuddy/binaries/python/envs/cadgen/Scripts/python.exe"
FILES = [
    "GBAE03-03-02-02-A皮带支撑块.step",
    "TB62A01-G02-02-1A底部轴承座.STEP",
    "DC26025-0611-10-05A横拉筋板A.step",
    "JA07D-16-162A1.step",
]

for f in FILES:
    print(f"===== {f} =====")
    t0 = time.perf_counter()
    r = subprocess.run(
        [PY, "-m", "cadgen.step_artifact", "--repo-root", "D:/14418/step-viewer/step", "--step", f, "--verbose"],
        capture_output=True, text=True, encoding="utf-8", errors="replace",
        cwd="D:/14418/step-viewer/step",
    )
    elapsed = time.perf_counter() - t0
    for line in (r.stdout + r.stderr).splitlines():
        if "completed in" in line:
            print("  ", line)
    print(f"  总耗时: {elapsed:.2f}s  exit={r.returncode}")
    print()
