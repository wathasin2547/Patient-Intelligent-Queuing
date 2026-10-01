from datetime import datetime, timedelta, timezone

from triage.models import ClosedAnswer, TriageInput, WaitingQueue
from triage.repository import CatalogRepository

BKK = timezone(timedelta(hours=7))
# 10:00 Bangkok: every department has a doctor on shift
MORNING = datetime(2026, 10, 1, 10, 0, tzinfo=BKK).astimezone(timezone.utc)
# 14:00 Bangkok: ENT has no doctor (its shift is 08:00-12:00)
AFTERNOON = datetime(2026, 10, 1, 14, 0, tzinfo=BKK).astimezone(timezone.utc)


def repo(now=MORNING, waiting=None) -> CatalogRepository:
    return CatalogRepository(day=now, waiting=waiting)


def answer(repo: CatalogRepository, order: int, label: str) -> ClosedAnswer:
    """Pick an option by its label so tests read like the questionnaire."""
    q = repo.questions()[f"q{order}"]
    labels = [o.label for o in q.options]
    return ClosedAnswer(q.id, labels.index(label))


def inp(*answers, **kw) -> TriageInput:
    return TriageInput(closed_answers=list(answers), **kw)


def queue(id, level, minutes_ago, now=MORNING, dept="MED", doctor="MED-1") -> WaitingQueue:
    return WaitingQueue(id, dept, doctor, level, now - timedelta(minutes=minutes_ago))
