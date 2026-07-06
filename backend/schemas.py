from pydantic import BaseModel, Field


class MetricsRequest(BaseModel):
    head_forward: float = Field(ge=0, le=20)
    torso_length: float = Field(ge=0, le=20)
    shoulder_tilt: float = Field(ge=-20, le=20)
    visibility: float = Field(ge=0, le=1)
    calibration_id: str | None = None
    session_id: str | None = None


class CalibrationStart(BaseModel):
    name: str = Field(default="My setup", min_length=1, max_length=60)
    sensitivity: float = Field(default=1.0, ge=0.5, le=2.0)
