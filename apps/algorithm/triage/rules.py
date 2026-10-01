"""Rule-based triage: red flag check, department scoring, priority level and online eligibility.

Thesis chapter 3 §3.4.2-3.4.7 / SPEC.md §3. Every function here is pure: all criteria
(weights, red flags, onsite-only, priority hints) come in as arguments loaded from the DB.
Nothing in this module may call the LLM.
"""

from collections.abc import Callable, Iterable

from .models import ClosedAnswer, Question, ReasonItem, SymptomCode, TriageInput

Catalog = dict[str, SymptomCode]  # code -> SymptomCode

LEVEL_RED = 1
LEVEL_GREEN = 4
LEVEL_WHITE = 5
ONLINE_LEVELS = {LEVEL_GREEN, LEVEL_WHITE}


def dedupe(codes: Iterable[str]) -> list[str]:
    seen: set[str] = set()
    out = []
    for c in codes:
        if c not in seen:
            seen.add(c)
            out.append(c)
    return out


def map_closed_answers(
    questions: dict[str, Question], answers: list[ClosedAnswer]
) -> tuple[list[str], list[str]]:
    """Closed-ended answers -> symptom codes. Returns (codes, warnings)."""
    codes, warnings = [], []
    for a in answers:
        q = questions.get(a.question_id)
        if q is None:
            warnings.append(f"unknown questionId {a.question_id}")
            continue
        if not 0 <= a.option_index < len(q.options):
            warnings.append(f"optionIndex {a.option_index} out of range for {a.question_id}")
            continue
        code = q.options[a.option_index].symptom_code
        if code:
            codes.append(code)
    return dedupe(codes), warnings


def known_codes(codes: Iterable[str], catalog: Catalog) -> list[str]:
    """Drop anything not in the active catalog (also used to validate LLM output)."""
    return [c for c in codes if c in catalog]


def find_red_flags(codes: Iterable[str], catalog: Catalog) -> list[str]:
    return [c for c in codes if catalog[c].is_red_flag]


def compute_department_scores(
    codes: Iterable[str], catalog: Catalog
) -> tuple[dict[str, float], list[ReasonItem]]:
    """S_d = sum(w[i][d] * a[i]) — eq. 3.1. Also returns each code's contribution."""
    scores: dict[str, float] = {}
    contributions = []
    for c in codes:
        for dept, w in catalog[c].department_weights.items():
            if w == 0:
                continue
            scores[dept] = scores.get(dept, 0) + w
            contributions.append(ReasonItem(code=c, weight=w, department=dept))
    return scores, contributions


def pick_department(
    scores: dict[str, float], tie_breaker: Callable[[list[str]], str]
) -> str | None:
    """Highest score wins; ties are resolved by tie_breaker (shorter average wait)."""
    positive = {d: s for d, s in scores.items() if s > 0}
    if not positive:
        return None
    best = max(positive.values())
    tied = sorted(d for d, s in positive.items() if s == best)
    return tied[0] if len(tied) == 1 else tie_breaker(tied)


def reason_for(department: str, contributions: list[ReasonItem]) -> list[ReasonItem]:
    """Codes that pushed the chosen department, strongest first (CLAUDE.md rule 3)."""
    items = [r for r in contributions if r.department == department]
    return sorted(items, key=lambda r: (-r.weight, r.code))


def compute_priority_level(codes: Iterable[str], catalog: Catalog, inp: TriageInput) -> int:
    """Table 3.x: red flag = 1, otherwise the most urgent priorityHint,
    unchanged chronic follow-up = 5, everything else = 4."""
    codes = list(codes)
    if find_red_flags(codes, catalog):
        return LEVEL_RED
    hints = [catalog[c].priority_hint for c in codes if catalog[c].priority_hint is not None]
    if hints:
        return min(hints)
    if inp.is_chronic_follow_up and inp.symptom_changed is False:
        return LEVEL_WHITE
    return LEVEL_GREEN


def check_online_eligible(
    codes: Iterable[str], catalog: Catalog, level: int, inp: TriageInput
) -> bool:
    """All three conditions of §3.4.7 must hold. Only a suggestion — the patient may still come onsite."""
    if level not in ONLINE_LEVELS:
        return False
    if any(catalog[c].onsite_only for c in codes):
        return False
    if inp.is_chronic_follow_up and inp.symptom_changed is not False:
        return False
    return True
