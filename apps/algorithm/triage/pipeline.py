"""The full screening flow, in the exact order of thesis §3.4.10 / SPEC.md §3.2. Do not reorder.

1-2  closed answers -> codes
3    red flag (rules only, before the LLM)      -> stop
4    free text -> LLM -> validate -> merge      (falls back to closed answers on failure)
5-6  department scores, pick the highest
7    priority level
8    online eligibility (a suggestion only)
9-10 shift check, doctor with the fewest waiting patients, initial queue score
Step 11 (saving and notifying the patient) belongs to Next.js.
"""

from datetime import datetime

from . import config, rules, scheduling
from .llm import NoLLM, SymptomExtractor
from .models import ReasonItem, TriageInput, TriageResult
from .queueing import priority_score
from .repository import Repository


def triage(
    inp: TriageInput,
    repo: Repository,
    now: datetime,
    extractor: SymptomExtractor | None = None,
) -> TriageResult:
    extractor = extractor or NoLLM()
    catalog = repo.symptom_codes()
    questions = repo.questions()

    # ── steps 1-2 ──
    codes, warnings = rules.map_closed_answers(questions, inp.closed_answers)
    unknown = [c for c in codes if c not in catalog]
    if unknown:
        warnings.append(f"inactive or unknown codes ignored: {unknown}")
    codes = rules.known_codes(codes, catalog)

    # ── step 3: red flag, rules only, LLM never called ──
    red = rules.find_red_flags(codes, catalog)
    if red:
        return _emergency(codes, [], "skipped", red, warnings)

    # ── step 4: LLM, optional ──
    llm_codes: list[str] = []
    llm_status = "skipped"
    if inp.free_text and inp.free_text.strip():
        raw, llm_status = extractor.extract(inp.free_text, list(catalog.values()))
        llm_codes = rules.dedupe(rules.known_codes(raw, catalog))  # never trust raw LLM output
        codes = rules.dedupe(codes + llm_codes)
        red = rules.find_red_flags(llm_codes, catalog)
        if red:
            return _emergency(codes, llm_codes, llm_status, red, warnings)

    # ── steps 5-6 ──
    scores, contributions = rules.compute_department_scores(codes, catalog)
    waiting = repo.waiting_queues()
    department = rules.pick_department(
        scores,
        tie_breaker=lambda tied: min(
            tied, key=lambda d: (scheduling.average_wait_minutes(waiting, d, now), d)
        ),
    )

    # ── steps 7-8 ──
    level = rules.compute_priority_level(codes, catalog, inp)
    online = rules.check_online_eligible(codes, catalog, level, inp)

    result = TriageResult(
        symptom_codes=codes,
        llm_codes=llm_codes,
        llm_status=llm_status,
        is_red_flag=False,
        red_flag_codes=[],
        department_scores=scores,
        assigned_department=department,
        priority_level=level,
        online_eligible=online,
        reason=rules.reason_for(department, contributions) if department else [],
        warnings=warnings,
    )
    if department is None:
        # nothing to go on: never suggest online, let staff look at it
        result.online_eligible = False
        result.warnings.append("no department scored above zero; staff must assign one")
        return result

    # ── steps 9-10 ──
    shifts = repo.shifts()
    on_shift = scheduling.doctors_on_shift(shifts, department, now)
    if not on_shift:
        result.no_doctor_on_shift = True
        result.next_shift_start = scheduling.next_shift_start(shifts, department, now)
        return result
    dept_waiting = [q for q in waiting if q.department_id == department]
    result.doctor_id = scheduling.pick_doctor(on_shift, dept_waiting)
    result.queue_score = priority_score(level, 0, config.base_scores(), config.alpha())
    return result


def _emergency(codes, llm_codes, llm_status, red, warnings) -> TriageResult:
    return TriageResult(
        symptom_codes=codes,
        llm_codes=llm_codes,
        llm_status=llm_status,
        is_red_flag=True,
        red_flag_codes=red,
        department_scores={},
        assigned_department=None,
        priority_level=rules.LEVEL_RED,
        online_eligible=False,
        # the red flag codes are the explanation for an emergency result
        reason=[ReasonItem(code=c, weight=0, department="EMERGENCY") for c in red],
        warnings=warnings,
    )
