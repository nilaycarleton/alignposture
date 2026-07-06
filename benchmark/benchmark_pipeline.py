"""Reproduce the logging/dashboard bottleneck benchmark.

This measures the application pipeline only; pose-model and camera FPS depend on
hardware and must be measured separately with a real webcam.
"""

from __future__ import annotations

import argparse
import csv
import json
import platform
import sys
import tempfile
import time
from pathlib import Path

from posture_detection.history import HistoryStore


def legacy_pipeline(frames: int, path: Path) -> float:
    start = time.perf_counter()
    for index in range(frames):
        with path.open("a", newline="", encoding="utf-8") as handle:
            csv.writer(handle).writerow((index, index % 100, index % 3 == 0))
        with path.open(newline="", encoding="utf-8") as handle:
            list(csv.reader(handle))  # main.py did this through pandas every frame
    return frames / (time.perf_counter() - start)


def buffered_pipeline(frames: int, path: Path) -> float:
    store = HistoryStore(path, flush_every=20)
    start = time.perf_counter()
    for index in range(frames):
        store.append(index % 100, "good", 0.95)
    store.flush()
    return frames / (time.perf_counter() - start)


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--frames", type=int, default=2_000)
    parser.add_argument("--output", type=Path)
    args = parser.parse_args()
    with tempfile.TemporaryDirectory() as directory:
        root = Path(directory)
        legacy = legacy_pipeline(args.frames, root / "legacy.csv")
        buffered = buffered_pipeline(args.frames, root / "buffered.csv")
    result = {
        "scope": "CSV logging and history-update pipeline; excludes pose inference",
        "system": {
            "platform": platform.platform(),
            "processor": platform.processor() or platform.machine(),
            "python": sys.version.split()[0],
        },
        "frames": args.frames,
        "legacy_fps": round(legacy, 2),
        "buffered_fps": round(buffered, 2),
        "speedup": round(buffered / legacy, 2),
    }
    print(json.dumps(result, indent=2))
    if args.output:
        args.output.parent.mkdir(parents=True, exist_ok=True)
        args.output.write_text(json.dumps(result, indent=2) + "\n", encoding="utf-8")


if __name__ == "__main__":
    main()
