"""MediaPipe adapter. Heavy dependencies are loaded only when the demo runs."""

from __future__ import annotations

import math
from typing import Any

from .core import PostureMetrics


LEFT_EAR, RIGHT_EAR = 7, 8
LEFT_SHOULDER, RIGHT_SHOULDER = 11, 12
LEFT_HIP, RIGHT_HIP = 23, 24


def _distance(a: Any, b: Any) -> float:
    return math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2 + (a.z - b.z) ** 2)


def metrics_from_landmarks(landmarks: list[Any]) -> PostureMetrics:
    """Create scale-normalized metrics from MediaPipe's 33 pose landmarks."""

    ls, rs = landmarks[LEFT_SHOULDER], landmarks[RIGHT_SHOULDER]
    lh, rh = landmarks[LEFT_HIP], landmarks[RIGHT_HIP]
    le, re = landmarks[LEFT_EAR], landmarks[RIGHT_EAR]
    shoulder_width = max(_distance(ls, rs), 1e-6)

    shoulder_z = (ls.z + rs.z) / 2
    ear_z = (le.z + re.z) / 2
    shoulder_y = (ls.y + rs.y) / 2
    hip_y = (lh.y + rh.y) / 2
    visibility = min(
        getattr(point, "visibility", 1.0)
        for point in (ls, rs, lh, rh, le, re)
    )

    return PostureMetrics(
        head_forward=abs(ear_z - shoulder_z) / shoulder_width,
        torso_length=abs(hip_y - shoulder_y) / shoulder_width,
        shoulder_tilt=(ls.y - rs.y) / shoulder_width,
        visibility=visibility,
    )

