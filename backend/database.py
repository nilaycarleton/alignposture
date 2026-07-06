"""Small SQLite repository for profiles, sessions, and posture events."""

from __future__ import annotations

import json
import sqlite3
from contextlib import contextmanager
from datetime import datetime, timezone
from pathlib import Path
from typing import Iterator
from uuid import uuid4

from posture_detection.core import CalibrationProfile


def utc_now() -> str:
    return datetime.now(timezone.utc).isoformat()


class Database:
    def __init__(self, path: str | Path = "data/posture.db"):
        self.path = Path(path)
        self.path.parent.mkdir(parents=True, exist_ok=True)
        self.initialize()

    @contextmanager
    def connection(self) -> Iterator[sqlite3.Connection]:
        connection = sqlite3.connect(self.path)
        connection.row_factory = sqlite3.Row
        try:
            yield connection
            connection.commit()
        finally:
            connection.close()

    def initialize(self) -> None:
        with self.connection() as db:
            db.executescript(
                """
                CREATE TABLE IF NOT EXISTS profiles (
                    id TEXT PRIMARY KEY,
                    user_id TEXT NOT NULL DEFAULT 'legacy',
                    name TEXT NOT NULL,
                    metrics TEXT NOT NULL,
                    created_at TEXT NOT NULL,
                    active INTEGER NOT NULL DEFAULT 1
                );
                CREATE TABLE IF NOT EXISTS sessions (
                    id TEXT PRIMARY KEY,
                    user_id TEXT NOT NULL DEFAULT 'legacy',
                    started_at TEXT NOT NULL,
                    ended_at TEXT
                );
                CREATE TABLE IF NOT EXISTS events (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    session_id TEXT NOT NULL,
                    timestamp TEXT NOT NULL,
                    score REAL NOT NULL,
                    state TEXT NOT NULL,
                    confidence REAL NOT NULL,
                    FOREIGN KEY(session_id) REFERENCES sessions(id)
                );
                """
            )
            profile_columns = {
                row["name"] for row in db.execute("PRAGMA table_info(profiles)").fetchall()
            }
            if "user_id" not in profile_columns:
                db.execute(
                    "ALTER TABLE profiles ADD COLUMN user_id TEXT NOT NULL DEFAULT 'legacy'"
                )
            session_columns = {
                row["name"] for row in db.execute("PRAGMA table_info(sessions)").fetchall()
            }
            if "user_id" not in session_columns:
                db.execute(
                    "ALTER TABLE sessions ADD COLUMN user_id TEXT NOT NULL DEFAULT 'legacy'"
                )
            db.execute(
                "CREATE INDEX IF NOT EXISTS idx_profiles_user ON profiles(user_id, active)"
            )
            db.execute(
                "CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id)"
            )

    def save_profile(
        self, user_id: str, profile: CalibrationProfile, name: str = "My setup"
    ) -> dict:
        profile_id = str(uuid4())
        created_at = utc_now()
        with self.connection() as db:
            db.execute("UPDATE profiles SET active = 0 WHERE user_id = ?", (user_id,))
            db.execute(
                """
                INSERT INTO profiles (id, user_id, name, metrics, created_at, active)
                VALUES (?, ?, ?, ?, ?, 1)
                """,
                (profile_id, user_id, name, json.dumps(profile.to_dict()), created_at),
            )
        return {"id": profile_id, "name": name, "created_at": created_at}

    def active_profile(self, user_id: str) -> CalibrationProfile | None:
        with self.connection() as db:
            row = db.execute(
                """
                SELECT metrics FROM profiles
                WHERE active = 1 AND user_id = ?
                ORDER BY created_at DESC LIMIT 1
                """,
                (user_id,),
            ).fetchone()
        return CalibrationProfile(**json.loads(row["metrics"])) if row else None

    def start_session(self, user_id: str) -> dict:
        session = {"id": str(uuid4()), "started_at": utc_now()}
        with self.connection() as db:
            db.execute(
                "INSERT INTO sessions (id, user_id, started_at) VALUES (?, ?, ?)",
                (session["id"], user_id, session["started_at"]),
            )
        return session

    def end_session(self, user_id: str, session_id: str) -> bool:
        with self.connection() as db:
            cursor = db.execute(
                """
                UPDATE sessions SET ended_at = ?
                WHERE id = ? AND user_id = ? AND ended_at IS NULL
                """,
                (utc_now(), session_id, user_id),
            )
        return cursor.rowcount > 0

    def add_event(
        self,
        user_id: str,
        session_id: str,
        score: float,
        state: str,
        confidence: float,
    ) -> None:
        with self.connection() as db:
            db.execute(
                """
                INSERT INTO events (session_id, timestamp, score, state, confidence)
                SELECT ?, ?, ?, ?, ?
                WHERE EXISTS (
                    SELECT 1 FROM sessions WHERE id = ? AND user_id = ?
                )
                """,
                (
                    session_id,
                    utc_now(),
                    score,
                    state,
                    confidence,
                    session_id,
                    user_id,
                ),
            )

    def history(self, user_id: str, limit: int = 500) -> dict:
        with self.connection() as db:
            rows = db.execute(
                """
                SELECT e.timestamp, e.score, e.state, e.confidence, e.session_id
                FROM events e
                JOIN sessions s ON s.id = e.session_id
                WHERE s.user_id = ?
                ORDER BY e.timestamp DESC LIMIT ?
                """,
                (user_id, limit),
            ).fetchall()
            sessions = db.execute(
                "SELECT COUNT(*) AS count FROM sessions WHERE user_id = ?",
                (user_id,),
            ).fetchone()["count"]
        events = [dict(row) for row in reversed(rows)]
        total = len(events)
        good = sum(event["state"] == "good" for event in events)
        average = sum(event["score"] for event in events) / total if total else 0
        return {
            "events": events,
            "summary": {
                "samples": total,
                "sessions": sessions,
                "good_posture_percent": round(good / total * 100) if total else 0,
                "average_score": round(average, 1),
            },
        }
