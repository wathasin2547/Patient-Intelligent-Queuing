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


def pick_doctor(doctor_ids: list[str], waiting: list[WaitingQueue]) -> str | None:
    """Doctor with the fewest WAITING patients, so workload stays even."""
    if not doctor_ids:
        return None
    load = Counter(q.doctor_id for q in waiting)
    return min(doctor_ids, key=lambda d: (load[d], d))


def average_wait_minutes(waiting: list[WaitingQueue], department_id: str, now: datetime) -> float:
    mins = [(now - q.check_in_time).total_seconds() / 60
            for q in waiting if q.department_id == department_id]
    return sum(mins) / len(mins) if mins else 0.0
