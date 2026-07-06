from fastapi.testclient import TestClient

from backend.auth import require_user
from backend.main import create_app


def client(tmp_path):
    app = create_app(tmp_path / "test.db")
    app.dependency_overrides[require_user] = lambda: "user_test"
    return TestClient(app)


def test_health_reports_uncalibrated(tmp_path):
    api = client(tmp_path)
    response = api.get("/api/health")
    assert response.status_code == 200
    assert response.json()["status"] == "ok"
    assert api.get("/api/status").json()["profile_ready"] is False


def test_calibration_explains_rejected_low_visibility_frame(tmp_path):
    api = client(tmp_path)
    calibration = api.post("/api/calibrations", json={"name": "Desk"}).json()
    response = api.post(
        "/api/metrics",
        json={
            "head_forward": 0.3,
            "torso_length": 1.5,
            "shoulder_tilt": 0.01,
            "visibility": 0.2,
            "calibration_id": calibration["id"],
        },
    ).json()
    assert response["accepted"] is False
    assert response["progress"] == 0
    assert "shoulders" in response["message"]


def test_complete_calibration_and_record_session(tmp_path):
    api = client(tmp_path)
    calibration = api.post("/api/calibrations", json={"name": "Desk"}).json()
    for _ in range(60):
        response = api.post(
            "/api/metrics",
            json={
                "head_forward": 0.3,
                "torso_length": 1.5,
                "shoulder_tilt": 0.01,
                "visibility": 0.95,
                "calibration_id": calibration["id"],
            },
        )
        assert response.status_code == 200
    assert api.post(f"/api/calibrations/{calibration['id']}/complete").status_code == 200

    session = api.post("/api/sessions").json()
    analyzed = api.post(
        "/api/metrics",
        json={
            "head_forward": 0.3,
            "torso_length": 1.5,
            "shoulder_tilt": 0.01,
            "visibility": 0.95,
            "session_id": session["id"],
        },
    )
    assert analyzed.json()["state"] == "good"
    assert api.post(f"/api/sessions/{session['id']}/complete").status_code == 200

    history = api.get("/api/history").json()
    assert history["summary"]["sessions"] == 1
    assert history["summary"]["samples"] == 1


def test_history_is_isolated_between_clerk_users(tmp_path):
    app = create_app(tmp_path / "isolated.db")
    current_user = {"id": "user_one"}
    app.dependency_overrides[require_user] = lambda: current_user["id"]
    api = TestClient(app)

    calibration = api.post("/api/calibrations", json={"name": "Desk"}).json()
    payload = {
        "head_forward": 0.3,
        "torso_length": 1.5,
        "shoulder_tilt": 0.01,
        "visibility": 0.95,
        "calibration_id": calibration["id"],
    }
    for _ in range(60):
        api.post("/api/metrics", json=payload)
    api.post(f"/api/calibrations/{calibration['id']}/complete")
    api.post("/api/sessions")

    current_user["id"] = "user_two"
    assert api.get("/api/status").json()["profile_ready"] is False
    assert api.get("/api/history").json()["summary"]["sessions"] == 0
