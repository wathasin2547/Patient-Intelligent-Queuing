"""Run case vignettes through the pipeline and score them (thesis §3.7, experiments 1, 3 and 5)."""

import json
from dataclasses import dataclass, field
from datetime import datetime
from pathlib import Path

from .llm import SymptomExtractor
from .models import ClosedAnswer, TriageInput, TriageResult
from .pipeline import triage
from .repository import CatalogRepository, Repository

VIGNETTES_PATH = Path(__file__).resolve().parents[3] / "data" / "vignettes.json"


@dataclass
class CaseResult:
    id: str
    group: str
    description: str
    expected: dict
    result: TriageResult
    mismatches: list[str] = field(default_factory=list)


def load_vignettes(path: Path = VIGNETTES_PATH) -> list[dict]:
    return json.loads(path.read_text(encoding="utf-8"))["cases"]


def to_input(case: dict, repo: Repository) -> TriageInput:
    questions = {q.order: q for q in repo.questions().values()}
    answers = []
    for order, label in case["answers"]:
        q = questions[order]
        labels = [o.label for o in q.options]
        if label not in labels:
            raise ValueError(f"{case['id']}: option '{label}' not found in question {order}")
        answers.append(ClosedAnswer(q.id, labels.index(label)))
    return TriageInput(
        closed_answers=answers,
        free_text=case.get("freeText") or None,
        is_chronic_follow_up=case.get("isChronicFollowUp", False),
        symptom_changed=case.get("symptomChanged"),
    )


def compare(expected: dict, r: TriageResult) -> list[str]:
    actual = {
        "isRedFlag": r.is_red_flag,
        "department": r.assigned_department,
        "priorityLevel": r.priority_level,
        "onlineEligible": r.online_eligible,
    }
    exp = {"isRedFlag": False, **expected}
    return [f"{k}: expected {v}, got {actual[k]}" for k, v in exp.items() if actual[k] != v]


def run_vignettes(
    now: datetime,
    extractor: SymptomExtractor | None = None,
    repo: Repository | None = None,
    cases: list[dict] | None = None,
) -> list[CaseResult]:
    repo = repo or CatalogRepository(day=now)
    out = []
    for c in cases or load_vignettes():
        r = triage(to_input(c, repo), repo, now, extractor)
        out.append(CaseResult(c["id"], c["group"], c["description"], c["expected"], r,
                              compare(c["expected"], r)))
    return out


def summarize(results: list[CaseResult]) -> dict:
    def rate(hits, total):
        return round(hits / total, 3) if total else None

    dept_cases = [x for x in results if "department" in x.expected]
    red_cases = [x for x in results if x.expected.get("isRedFlag")]
    level_cases = [x for x in results if "priorityLevel" in x.expected]
    should_be_onsite = [x for x in results if x.expected.get("onlineEligible") is False]

    by_group: dict[str, list[CaseResult]] = {}
    for x in dept_cases:
        by_group.setdefault(x.group, []).append(x)

    return {
        "cases": len(results),
        "allCorrect": rate(sum(not x.mismatches for x in results), len(results)),
        "departmentAccuracy": rate(
            sum(x.result.assigned_department == x.expected["department"] for x in dept_cases),
            len(dept_cases)),
        "departmentAccuracyByGroup": {
            g: rate(sum(x.result.assigned_department == x.expected["department"] for x in xs), len(xs))
            for g, xs in by_group.items()
        },
        "priorityAccuracy": rate(
            sum(x.result.priority_level == x.expected["priorityLevel"] for x in level_cases),
            len(level_cases)),
        "redFlagRecall": rate(sum(x.result.is_red_flag for x in red_cases), len(red_cases)),
        # safety: cases that need an onsite visit but were offered online
        "onlineFalsePositives": [x.id for x in should_be_onsite if x.result.online_eligible],
        "onlineRate": rate(sum(x.result.online_eligible for x in results), len(results)),
    }
