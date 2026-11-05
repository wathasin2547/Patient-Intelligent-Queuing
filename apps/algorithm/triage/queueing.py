from dataclasses import dataclass, field
from datetime import datetime

from .config import DEFAULT_AGE_BONUS_MINUTES, DEFAULT_CHRONIC_BONUS_MINUTES, DEFAULT_PRIORITY_AGE_GROUPS
from .models import WaitingQueue


@dataclass(frozen=True)
class RiskBonus:
    age_minutes: float = DEFAULT_AGE_BONUS_MINUTES
    chronic_minutes: float = DEFAULT_CHRONIC_BONUS_MINUTES
    age_groups: frozenset[str] = field(default_factory=lambda: frozenset(DEFAULT_PRIORITY_AGE_GROUPS))

    def minutes(self, q: WaitingQueue) -> float:
        d = 0.0
        if q.age_group in self.age_groups:
            d += self.age_minutes
        if q.is_chronic:
            d += self.chronic_minutes
        return d

    @property
    def max_minutes(self) -> float:
        return self.age_minutes + self.chronic_minutes


NO_BONUS = RiskBonus(0.0, 0.0, frozenset())


def max_safe_bonus(base: dict[int, float], alpha: float) -> float:
    scores = sorted(base.values())
    return min(b - a for a, b in zip(scores, scores[1:])) / alpha


@dataclass
class RankedQueue:
    queue: WaitingQueue
    waiting_minutes: float
    score: float
    bonus_minutes: float = 0.0


def waiting_minutes(check_in: datetime, now: datetime) -> float:
    return max(0.0, (now - check_in).total_seconds() / 60)


def priority_score(level: int, minutes: float, base: dict[int, float], alpha: float, bonus: float = 0.0) -> float:
    if level not in base:
        raise ValueError(f"priority level {level} has no base score (level 1 never queues)")
    return base[level] + alpha * (minutes + bonus)


def rank_queues(
    queues: list[WaitingQueue], now: datetime, base: dict[int, float], alpha: float,
    risk: RiskBonus = RiskBonus(),
) -> list[RankedQueue]:
    ranked = []
    for q in queues:
        w, d = waiting_minutes(q.check_in_time, now), risk.minutes(q)
        ranked.append(RankedQueue(q, w, priority_score(q.priority_level, w, base, alpha, d), d))
    ranked.sort(key=lambda r: (-r.score, r.queue.check_in_time, r.queue.id))
    return ranked


def pick_next(
    queues: list[WaitingQueue],
    now: datetime,
    base: dict[int, float],
    alpha: float,
    busy_patients: frozenset[str] | set[str] = frozenset(),
    risk: RiskBonus = RiskBonus(),
) -> RankedQueue | None:
    for r in rank_queues(queues, now, base, alpha, risk):
        if r.queue.patient_id not in busy_patients:
            return r
    return None
