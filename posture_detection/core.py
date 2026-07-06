"""Camera-independent posture scoring and calibration."""

from __future__ import annotations

from dataclasses import asdict, dataclass
from statistics import median
from typing import Iterable


@dataclass(frozen=True)
class PostureMetrics:
    """Body-relative measurements from one pose frame."""

    head_forward: float
    torso_length: float
    shoulder_tilt: float
    visibility: float = 1.0


@dataclass(frozen=True)
class CalibrationProfile:
    """A user's neutral posture baseline."""

    head_forward: float
    torso_length: float
    shoulder_tilt: float
    sensitivity: float = 1.0

    def to_dict(self) -> dict[str, float]:
        return asdict(self)

    @classmethod
    def from_samples(
        cls, samples: Iterable[PostureMetrics], sensitivity: float = 1.0
    ) -> "CalibrationProfile":
        valid = [sample for sample in samples if sample.visibility >= 0.45]
        if len(valid) < 10:
            raise ValueError("Calibration needs at least 10 clearly visible frames.")
        return cls(
            head_forward=median(x.head_forward for x in valid),
            torso_length=median(x.torso_length for x in valid),
            shoulder_tilt=median(x.shoulder_tilt for x in valid),
            sensitivity=min(2.0, max(0.5, sensitivity)),
        )


@dataclass(frozen=True)
class PostureResult:
    score: float
    state: str
    confidence: float
    reasons: tuple[str, ...]


class PostureAnalyzer:
    """Compare a frame with a calibrated neutral baseline."""

    def __init__(self, profile: CalibrationProfile):
        self.profile = profile

    def analyze(self, metrics: PostureMetrics) -> PostureResult:
        if metrics.visibility < 0.45:
            return PostureResult(0.0, "no_pose", metrics.visibility, ("Move fully into frame",))

        eps = 1e-6
        head_delta = max(
            0.0,
            (metrics.head_forward - self.profile.head_forward)
            / max(abs(self.profile.head_forward), 0.08),
        )
        compression = max(
            0.0,
            (self.profile.torso_length - metrics.torso_length)
            / max(self.profile.torso_length, eps),
        )
        tilt_delta = max(
            0.0,
            abs(metrics.shoulder_tilt) - abs(self.profile.shoulder_tilt) - 0.025,
        )

        raw = (0.55 * head_delta) + (0.35 * compression) + (0.10 * tilt_delta * 5)
        score = min(100.0, raw * 180 * self.profile.sensitivity)
        state = "good" if score < 35 else "warning" if score < 65 else "slouching"

        reasons: list[str] = []
        if head_delta > 0.12:
            reasons.append("Head is forward of your baseline")
        if compression > 0.08:
            reasons.append("Torso appears compressed")
        if tilt_delta > 0.035:
            reasons.append("Shoulders are uneven")
        if not reasons:
            reasons.append("Posture is close to your baseline")

        return PostureResult(
            round(score, 1),
            state,
            round(min(1.0, metrics.visibility), 2),
            tuple(reasons),
        )
