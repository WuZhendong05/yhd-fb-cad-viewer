"""Benchmark STEP -> GLB via cadgen.step_artifact.

Usage:
  python bench_step2glb.py [step_root]

  step_root: directory of STEP files to convert (default: <repo>/step).
             Overridable with $STEP_REPO_ROOT. The CAD Python is $CAD_PYTHON
             (default: the .workbuddy cadgen venv).
"""
import os
import subprocess
import sys
import time

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
REPO_ROOT = os.path.dirname(SCRIPT_DIR)

PY = os.environ.get("CAD_PYTHON", "").strip()
if not PY:
    raise SystemExit(
        "CAD_PYTHON env var is required: path to a Python with OCP/build123d/cadgen "
        "(e.g. the project CAD venv). Example: set CAD_PYTHON=C:/path/to/python.exe"
    )
STEP_ROOT = (
    os.environ.get("STEP_REPO_ROOT")
    or (sys.argv[1] if len(sys.argv) > 1 else "")
    or os.path.join(REPO_ROOT, "step")
)
FILES = [
    "GBAE03-03-02-02-A皮带支撑块.step",
    "TB62A01-G02-02-1A底部轴承座.STEP",
    "DC26025-0611-10-05A横拉筋板A.step",
    "JA07D-16-162A1.step",
]

print(f"repo_root: {REPO_ROOT}")
print(f"step_root: {STEP_ROOT}")
print(f"cad python: {PY}")

for f in FILES:
    print(f"===== {f} =====")
    t0 = time.perf_counter()
    r = subprocess.run(
        [PY, "-m", "cadgen.step_artifact", "--repo-root", STEP_ROOT, "--step", f, "--verbose"],
        capture_output=True, text=True, encoding="utf-8", errors="replace",
        cwd=STEP_ROOT,
    )
    elapsed = time.perf_counter() - t0
    for line in (r.stdout + r.stderr).splitlines():
        if "completed in" in line:
            print("  ", line)
    print(f"  总耗时: {elapsed:.2f}s  exit={r.returncode}")
    print()
