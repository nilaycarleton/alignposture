"""Buffered posture event storage and dashboard summaries."""

from __future__ import annotations

import csv
from dataclasses import asdict, dataclass
from datetime import datetime, timezone
from pathlib import Path


@dataclass(frozen=True)
class HistoryEvent:
    timestamp: str
    score: float
    state: str
    confidence: float


class HistoryStore:
    fieldnames = ("timestamp", "score", "state", "confidence")

    def __init__(self, path: str | Path = "data/posture_history.csv", flush_every: int = 20):
        self.path = Path(path)
        self.flush_every = flush_every
        self._buffer: list[HistoryEvent] = []

    def append(self, score: float, state: str, confidence: float) -> None:
        self._buffer.append(
            HistoryEvent(datetime.now(timezone.utc).isoformat(), score, state, confidence)
        )
        if len(self._buffer) >= self.flush_every:
            self.flush()

    def flush(self) -> None:
        if not self._buffer:
            return
        self.path.parent.mkdir(parents=True, exist_ok=True)
        exists = self.path.exists()
        with self.path.open("a", newline="", encoding="utf-8") as handle:
            writer = csv.DictWriter(handle, fieldnames=self.fieldnames)
            if not exists:
                writer.writeheader()
            writer.writerows(asdict(event) for event in self._buffer)
        self._buffer.clear()

    def read(self) -> list[HistoryEvent]:
        self.flush()
        if not self.path.exists():
            return []
        with self.path.open(newline="", encoding="utf-8") as handle:
            return [
                HistoryEvent(
                    timestamp=row["timestamp"],
                    score=float(row["score"]),
                    state=row["state"],
                    confidence=float(row["confidence"]),
                )
                for row in csv.DictReader(handle)
            ]

