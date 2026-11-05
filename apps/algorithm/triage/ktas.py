from dataclasses import dataclass
from pathlib import Path

from .models import ClosedAnswer, TriageInput
from .repository import Repository


@dataclass
class KtasRecord:
    age: float
    mental: int
    chief_complaint: str
    ktas_expert: int
    ktas_nurse: int
    triage_minutes: float | None


def load_ktas(path: Path) -> list[KtasRecord]:
    import openpyxl

    wb = openpyxl.load_workbook(path, read_only=True)
    rows = list(wb.worksheets[0].iter_rows(values_only=True))
    header, data = rows[0], rows[1:]
    out = []
    for r in data:
        d = dict(zip(header, r))
        dur = d.get("KTAS duration_min")
        out.append(KtasRecord(
            age=float(d["Age"]),
            mental=int(d["Mental"]),
            chief_complaint=str(d["Chief_complain"]).strip(),
            ktas_expert=int(d["KTAS_expert"]),
            ktas_nurse=int(d["KTAS_RN"]),
            triage_minutes=float(dur) if isinstance(dur, (int, float)) else None,
        ))
    return out


def age_label(age: float) -> str:
    if age < 6:
        return "0-5 ปี"
    if age < 18:
        return "6-17 ปี"
    if age < 60:
        return "18-59 ปี"
    return "60 ปีขึ้นไป"


def to_input(rec: KtasRecord, repo: Repository) -> TriageInput:
    by_order = {q.order: q for q in repo.questions().values()}

    def pick(order: int, label: str) -> ClosedAnswer:
        q = by_order[order]
        return ClosedAnswer(q.id, [o.label for o in q.options].index(label))

    red = "ซึมลงหรือหมดสติ" if rec.mental >= 2 else "ไม่มีอาการเหล่านี้"
    return TriageInput(
        closed_answers=[pick(1, age_label(rec.age)), pick(2, red)],
        free_text=rec.chief_complaint,
    )
