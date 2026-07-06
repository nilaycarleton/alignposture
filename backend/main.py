"""FastAPI application for the Posture Coach."""

from __future__ import annotations

import os
from collections import defaultdict, deque
from pathlib import Path
from uuid import uuid4

from fastapi import Depends, FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from posture_detection.core import CalibrationProfile, PostureAnalyzer
from posture_detection.core import PostureMetrics

from .database import Database
from .auth import require_user
from .schemas import CalibrationStart, MetricsRequest


def default_database_path() -> Path:
    configured_path = os.getenv("POSTURE_DATABASE_PATH")
    if configured_path:
        return Path(configured_path)
    if os.getenv("VERCEL"):
        return Path("/tmp/posture.db")
    return Path("data/posture.db")


def create_app(database_path: str | Path | None = None) -> FastAPI:
    app = FastAPI(
        title="Posture Coach API",
        version="3.0.0",
        description="Local calibration, pose analysis, and posture history.",
    )
    app.add_middleware(
        CORSMiddleware,
        allow_origins=[
            "http://localhost:5173",
            "http://127.0.0.1:5173",
            "https://alignposture.online",
            "https://www.alignposture.online",
        ],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )
    app.state.database = Database(database_path or default_database_path())
    app.state.calibrations = defaultdict(lambda: deque(maxlen=90))
    app.state.calibration_settings = {}

    @app.get("/api/health")
    def health():
        return {"status": "ok", "service": "alignposture.online"}

    @app.get("/api/status")
    def status(user_id: str = Depends(require_user)):
        return {
            "profile_ready": app.state.database.active_profile(user_id) is not None
        }

    @app.post("/api/calibrations")
    def start_calibration(
        settings: CalibrationStart, user_id: str = Depends(require_user)
    ):
        calibration_id = str(uuid4())
        app.state.calibration_settings[calibration_id] = {
            "settings": settings,
            "user_id": user_id,
        }
        return {"id": calibration_id, "required_frames": 60}

    @app.post("/api/metrics")
    def analyze_metrics(
        request: MetricsRequest, user_id: str = Depends(require_user)
    ):
        metrics = PostureMetrics(
            head_forward=request.head_forward,
            torso_length=request.torso_length,
            shoulder_tilt=request.shoulder_tilt,
            visibility=request.visibility,
        )

        if request.calibration_id:
            calibration = app.state.calibration_settings.get(request.calibration_id)
            if not calibration or calibration["user_id"] != user_id:
                raise HTTPException(status_code=404, detail="Calibration not found.")
            samples = app.state.calibrations[request.calibration_id]
            accepted = metrics.visibility >= 0.45
            if accepted:
                samples.append(metrics)
            return {
                "mode": "calibration",
                "progress": min(100, round(len(samples) / 60 * 100)),
                "captured_frames": len(samples),
                "accepted": accepted,
                "visibility": round(metrics.visibility, 2),
                "message": (
                    None
                    if accepted
                    else "Keep your face and both shoulders clearly visible."
                ),
            }

        profile = app.state.database.active_profile(user_id)
        if profile is None:
            raise HTTPException(status_code=409, detail="Complete calibration first.")
        result = PostureAnalyzer(profile).analyze(metrics)
        if request.session_id and result.state != "no_pose":
            app.state.database.add_event(
                user_id,
                request.session_id,
                result.score,
                result.state,
                result.confidence,
            )
        return result.__dict__

    @app.post("/api/calibrations/{calibration_id}/complete")
    def complete_calibration(
        calibration_id: str, user_id: str = Depends(require_user)
    ):
        calibration = app.state.calibration_settings.get(calibration_id)
        samples = app.state.calibrations.get(calibration_id, [])
        if not calibration or calibration["user_id"] != user_id:
            raise HTTPException(status_code=404, detail="Calibration not found.")
        if len(samples) < 60:
            raise HTTPException(
                status_code=409, detail=f"Capture {60 - len(samples)} more clear frames."
            )
        settings = calibration["settings"]
        profile = CalibrationProfile.from_samples(samples, settings.sensitivity)
        saved = app.state.database.save_profile(user_id, profile, settings.name)
        app.state.calibrations.pop(calibration_id, None)
        app.state.calibration_settings.pop(calibration_id, None)
        return saved

    @app.post("/api/sessions")
    def start_session(user_id: str = Depends(require_user)):
        if app.state.database.active_profile(user_id) is None:
            raise HTTPException(status_code=409, detail="Complete calibration first.")
        return app.state.database.start_session(user_id)

    @app.post("/api/sessions/{session_id}/complete")
    def complete_session(session_id: str, user_id: str = Depends(require_user)):
        if not app.state.database.end_session(user_id, session_id):
            raise HTTPException(status_code=404, detail="Active session not found.")
        return {"status": "complete"}

    @app.get("/api/history")
    def history(limit: int = 500, user_id: str = Depends(require_user)):
        return app.state.database.history(user_id, min(max(limit, 1), 2_000))

    frontend = Path(__file__).parents[1] / "frontend" / "dist"
    if frontend.exists():
        app.mount("/", StaticFiles(directory=frontend, html=True), name="frontend")
    return app


app = create_app()


def run() -> None:
    import uvicorn

    uvicorn.run("backend.main:app", host="127.0.0.1", port=8000, reload=True)


if __name__ == "__main__":
    run()
