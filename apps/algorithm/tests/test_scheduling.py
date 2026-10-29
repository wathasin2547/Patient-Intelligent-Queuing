from datetime import datetime, timezone

from triage.models import WaitingQueue
from triage.scheduling import pick_doctor

T = datetime(2026, 10, 1, 2, 0, tzinfo=timezone.utc)


def waiting(doctor: str, n: int) -> list[WaitingQueue]:
    return [WaitingQueue(f"{doctor}{i}", "MED", doctor, 4, T) for i in range(n)]


def test_fewest_waiting_wins():
    assert pick_doctor(["A", "B"], waiting("A", 2) + waiting("B", 1)) == "B"


def test_idle_doctor_beats_busy_one_when_queues_are_empty():
    # before the fix both had load 0 and A won the tie while B sat idle
    assert pick_doctor(["A", "B"], [], busy={"A"}) == "B"


def test_appointments_due_soon_count_as_load():
    assert pick_doctor(["A", "B"], waiting("B", 1), upcoming={"A": 2}) == "B"


def test_no_doctor_on_shift():
    assert pick_doctor([], []) is None
