"""Shift check and doctor assignment (thesis §3.4.8, algorithm steps 9-10)."""

from collections import Counter
from datetime import datetime

from .models import Shift, WaitingQueue


def doctors_on_shift(shifts: list[Shift], department_id: str, now: datetime) -> list[str]:
    return sorted(
        {s.doctor_id for s in shifts
         if s.department_id == department_id and s.start_time <= now < s.end_time}
    )


def next_shift_start(shifts: list[Shift], department_id: str, now: datetime) -> datetime | None:
    upcoming = [s.start_time for s in shifts
                if s.department_id == department_id and s.start_time > now]
    return min(upcoming, default=None)


def pick_doctor(
    doctor_ids: list[str],
    waiting: list[WaitingQueue],
    busy: set[str] | frozenset[str] = frozenset(),
    upcoming: dict[str, int] | None = None,
) -> str | None:
    """Least-loaded doctor: waiting patients + the patient in the room + appointments due within the hour.

    Counting the patient in the room matters: with waiting patients only, two doctors with empty
    queues tie and the busy one may be picked while the other sits idle (found in the simulation).
    """
    if not doctor_ids:
        return None
    load = Counter(q.doctor_id for q in waiting)
    upcoming = upcoming or {}
    return min(doctor_ids, key=lambda d: (load[d] + (d in busy) + upcoming.get(d, 0), d))


def average_wait_minutes(waiting: list[WaitingQueue], department_id: str, now: datetime) -> float:
    mins = [(now - q.check_in_time).total_seconds() / 60
            for q in waiting if q.department_id == department_id]
    return sum(mins) / len(mins) if mins else 0.0
