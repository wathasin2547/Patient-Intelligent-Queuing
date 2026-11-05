from datetime import datetime

from . import config, rules, scheduling
from .config import LOAD_WINDOW_MINUTES
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

    codes, warnings = rules.map_closed_answers(questions, inp.closed_answers)
    unknown = [c for c in codes if c not in catalog]
    if unknown:
        warnings.append(f"inactive or unknown codes ignored: {unknown}")
    codes = rules.known_codes(codes, catalog)

    red = rules.find_red_flags(codes, catalog)
    if red:
        return _emergency(codes, [], "skipped", red, warnings)

    llm_codes: list[str] = []
    llm_status = "skipped"
    if inp.free_text and inp.free_text.strip():
        raw, llm_status = extractor.extract(inp.free_text, list(catalog.values()))
        llm_codes = rules.dedupe(rules.known_codes(raw, catalog))
        codes = rules.dedupe(codes + llm_codes)
        red = rules.find_red_flags(llm_codes, catalog)
        if red:
            return _emergency(codes, llm_codes, llm_status, red, warnings)

    scores, contributions = rules.compute_department_scores(codes, catalog)
    waiting = repo.waiting_queues()
    department = rules.pick_department(
        scores,
        tie_breaker=lambda tied: min(
            tied, key=lambda d: (scheduling.average_wait_minutes(waiting, d, now), d)
        ),
    )

    nothing_scored = department is None
    if nothing_scored:
        department = repo.fallback_department()

    level = rules.compute_priority_level(codes, catalog, inp)
    online = rules.check_online_eligible(codes, catalog, level, inp)
    if inp.free_text and inp.free_text.strip() and llm_status != "ok":
        online = False
        warnings.append("free text was not read; online not offered")

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
    if nothing_scored:
        result.online_eligible = False
        result.warnings.append("no department scored above zero; sent to the fallback department")
    if department is None:
        result.warnings.append("no fallback department configured; staff must assign one")
        return result

    shifts = repo.shifts()
    on_shift = scheduling.doctors_on_shift(shifts, department, now)
    if not on_shift:
        result.no_doctor_on_shift = True
        result.next_shift_start = scheduling.next_shift_start(shifts, department, now)
        return result
    dept_waiting = [q for q in waiting if q.department_id == department]
    result.doctor_id = scheduling.pick_doctor(
        on_shift, dept_waiting, repo.busy_doctor_ids(), repo.upcoming_appointments(now, LOAD_WINDOW_MINUTES))
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
        reason=[ReasonItem(code=c, weight=0, department="EMERGENCY") for c in red],
        warnings=warnings,
    )
