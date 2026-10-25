"""Queue ordering with aging: P_j = B[L_j] + alpha * W_j (thesis eq. 3.2, SPEC.md §5).

P is computed on demand whenever the system auto-calls the next patient; it is never stored.
"""

from dataclasses import dataclass
from datetime import datetime

from .models import WaitingQueue


@dataclass
class RankedQueue:
    queue: WaitingQueue
    waiting_minutes: float
    score: float


def waiting_minutes(check_in: datetime, now: datetime) -> float:
    return max(0.0, (now - check_in).total_seconds() / 60)


def priority_score(level: int, minutes: float, base: dict[int, float], alpha: float) -> float:
    if level not in base:
        raise ValueError(f"priority level {level} has no base score (level 1 never queues)")
    return base[level] + alpha * minutes


def rank_queues(
    queues: list[WaitingQueue], now: datetime, base: dict[int, float], alpha: float
) -> list[RankedQueue]:
    """Highest P first; ties go to whoever checked in earlier."""
    ranked = []
    for q in queues:
        w = waiting_minutes(q.check_in_time, now)
        ranked.append(RankedQueue(q, w, priority_score(q.priority_level, w, base, alpha)))
    ranked.sort(key=lambda r: (-r.score, r.queue.check_in_time, r.queue.id))
    return ranked


def pick_next(
    queues: list[WaitingQueue],
    now: datetime,
    base: dict[int, float],
    alpha: float,
    busy_patients: frozenset[str] | set[str] = frozenset(),
) -> RankedQueue | None:
    """Highest P among patients who are not being called or examined in another queue.

    A busy patient keeps their place (W keeps counting) and is picked at the doctor's next
    free slot. Nobody is pulled out of an exam, so the others are never called later than
    they would have been had that patient been present the whole time.
    """
    for r in rank_queues(queues, now, base, alpha):
        if r.queue.patient_id not in busy_patients:
            return r
    return None
