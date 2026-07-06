from posture_detection.history import HistoryStore


def test_history_batches_and_round_trips(tmp_path):
    path = tmp_path / "history.csv"
    store = HistoryStore(path, flush_every=2)
    store.append(12.5, "good", 0.9)
    assert not path.exists()
    store.append(70.0, "slouching", 0.8)
    events = store.read()
    assert [event.state for event in events] == ["good", "slouching"]
    assert events[0].score == 12.5

