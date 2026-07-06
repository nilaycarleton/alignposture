import pytest

from posture_detection.core import CalibrationProfile, PostureAnalyzer, PostureMetrics


def sample(head=0.30, torso=1.50, tilt=0.01, visibility=0.95):
    return PostureMetrics(head, torso, tilt, visibility)


def test_calibration_uses_median_and_ignores_low_visibility():
    samples = [sample(head=0.30)] * 10 + [sample(head=9.0, visibility=0.2)]
    profile = CalibrationProfile.from_samples(samples)
    assert profile.head_forward == pytest.approx(0.30)


def test_calibration_requires_enough_visible_frames():
    with pytest.raises(ValueError, match="10"):
        CalibrationProfile.from_samples([sample()] * 9)


def test_neutral_posture_is_good():
    result = PostureAnalyzer(CalibrationProfile(0.30, 1.50, 0.01)).analyze(sample())
    assert result.state == "good"
    assert result.score == 0


def test_forward_head_and_compression_are_slouching():
    analyzer = PostureAnalyzer(CalibrationProfile(0.30, 1.50, 0.01))
    result = analyzer.analyze(sample(head=0.55, torso=1.20))
    assert result.state == "slouching"
    assert len(result.reasons) >= 2


def test_low_visibility_does_not_guess():
    result = PostureAnalyzer(CalibrationProfile(0.30, 1.50, 0.01)).analyze(
        sample(visibility=0.2)
    )
    assert result.state == "no_pose"

