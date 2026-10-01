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
    queues: list[WaitingQueue], now: datetime, base: dict[int, float], alpha: float
) -> RankedQueue | None:
    ranked = rank_queues(queues, now, base, alpha)
    return ranked[0] if ranked else None
