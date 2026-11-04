"""Experiment 4 (thesis sec:evaluation-design): rule-only vs LLM-only vs hybrid on the mock vignettes.

    python -m scripts.compare_methods                  # 5 runs of each method
    python -m scripts.compare_methods --delay 5        # seconds between LLM calls (free tier limits)

Accuracy and speed are measured apart. Calls get a long timeout and retries so a busy free tier is
not scored as a wrong answer; the real latency, and how many calls would miss the service's own
5 second timeout, are reported next to the accuracy.

LLM-only exists only to be compared here. It breaks CLAUDE.md rule 1 by design, so nothing in the
service may import it. Vignettes only: KTAS records are real patient data (see evaluate_ktas.py).
"""

import argparse
import json
import os
import sys
import time
from collections.abc import Callable
from datetime import datetime, timedelta, timezone
from statistics import median

from dotenv import load_dotenv

from triage.evaluation import CaseResult, compare, load_vignettes, run_vignettes, summarize
from triage.llm import TIMEOUT_SECONDS, LLMExtractor, NoLLM, gemini_call
from triage.models import TriageResult
from triage.repository import CatalogRepository

# Same fixed clock as evaluate_vignettes
NOW = datetime(2026, 10, 1, 10, 0, tzinfo=timezone(timedelta(hours=7))).astimezone(timezone.utc)
EXPERIMENT_TIMEOUT_SECONDS = 60.0
ATTEMPTS = 4
# More failures than this in one run means quota or an outage: stop and score the finished runs
MAX_FAILED_PER_RUN = 3

LLM_ONLY_PROMPT = """คุณคือระบบคัดกรองผู้ป่วยนอก อ่านข้อมูลผู้ป่วยแล้วตัดสินแผนกและระดับความเร่งด่วน

แผนก: {departments}
ระดับความเร่งด่วน: 1 ฉุกเฉินทันที, 2 เร่งด่วน, 3 ค่อนข้างเร่งด่วน, 4 ไม่เร่งด่วนมาก, 5 ไม่เร่งด่วน
ถ้าเป็นเคสฉุกเฉินให้ isRedFlag เป็น true, priorityLevel เป็น 1 และ department เป็น null

ตอบกลับเป็น JSON รูปแบบนี้เท่านั้น:
{{"department": "MED", "priorityLevel": 4, "isRedFlag": false}}"""


class TimedCall:
    """Retries a busy provider and records how long each successful call really took."""

    def __init__(self, call: Callable[[str, str], str], delay: float, backoff: float):
        self.call, self.delay, self.backoff = call, delay, backoff
        self.seconds: list[float] = []

    def __call__(self, system: str, text: str) -> str:
        for attempt in range(ATTEMPTS):
            t0 = time.perf_counter()
            try:
                reply = self.call(system, text)
            except Exception:
                if attempt == ATTEMPTS - 1:
                    raise
                time.sleep(self.backoff)
                continue
            self.seconds.append(time.perf_counter() - t0)
            time.sleep(self.delay)
            return reply
        raise AssertionError("unreachable")


class CountingExtractor:
    def __init__(self, inner: LLMExtractor):
        self.inner, self.failed = inner, 0

    def extract(self, text, catalog):
        codes, status = self.inner.extract(text, catalog)
        self.failed += status == "failed"
        return codes, status


def llm_only_result(call: Callable[[str, str], str], system: str, case: dict) -> TriageResult | None:
    """One LLM-only decision. None when the call or its reply is unusable (counted as failed)."""
    text = "\n".join([f"{order}. {label}" for order, label in case["answers"]] + [case.get("freeText", "")])
    try:
        d = json.loads(call(system, text))
        return TriageResult(
            symptom_codes=[], llm_codes=[], llm_status="ok",
            is_red_flag=bool(d["isRedFlag"]), red_flag_codes=[], department_scores={},
            assigned_department=d["department"], priority_level=int(d["priorityLevel"]),
            online_eligible=False, reason=[],
        )
    except Exception:
        return None


def run_llm_only(call: Callable[[str, str], str]) -> tuple[list[CaseResult], int]:
    repo = CatalogRepository(day=NOW)
    departments = ", ".join(f"{d['key']} = {d['name']} ({d['scopeOfCare']})" for d in repo.data["departments"])
    system = LLM_ONLY_PROMPT.format(departments=departments)
    out, failed = [], 0
    for c in load_vignettes():
        r = llm_only_result(call, system, c)
        if r is None:
            failed += 1
            continue
        out.append(CaseResult(c["id"], c["group"], c["description"], c["expected"], r, compare(c["expected"], r)))
    return out, failed


def score(runs: list[list[CaseResult]], seconds: list[float], failed: int) -> dict:
    """First run for accuracy (same as evaluate_vignettes), all runs for consistency."""
    answers: dict[str, set] = {}
    for run in runs:
        for x in run:
            answers.setdefault(x.id, set()).add((x.result.is_red_flag, x.result.assigned_department, x.result.priority_level))
    s = summarize(runs[0])
    return {
        "casesScored": len(runs[0]),
        "departmentAccuracy": s["departmentAccuracy"],
        "departmentAccuracyCI95": s["departmentAccuracyCI95"],
        "priorityAccuracy": s["priorityAccuracy"],
        "redFlagRecall": s["redFlagRecall"],
        "consistentAcrossRuns": round(sum(len(v) == 1 for v in answers.values()) / len(answers), 3),
        "secondsMedian": round(median(seconds), 3) if seconds else None,
        "timedCalls": len(seconds),
        "callsOverServiceTimeout": sum(t > TIMEOUT_SECONDS for t in seconds),
        "failedCalls": failed,
    }


def compare_methods(call: Callable[[str, str], str], runs: int, delay: float, backoff: float = 20.0) -> dict:
    cases = len(load_vignettes())
    rule_runs, hybrid_runs, llm_runs, rule_seconds = [], [], [], []
    hybrid_call, llm_call = TimedCall(call, delay, backoff), TimedCall(call, delay, backoff)
    hybrid_failed = llm_failed = 0
    stopped_early = False
    for i in range(runs):
        extractor = CountingExtractor(LLMExtractor(hybrid_call, retries=0))
        hybrid = run_vignettes(NOW, extractor)
        llm, failed = run_llm_only(llm_call)
        print(f"run {i + 1}/{runs}: hybrid failed {extractor.failed}, llm-only failed {failed}", file=sys.stderr, flush=True)
        if extractor.failed + failed > MAX_FAILED_PER_RUN:
            stopped_early = True
            break
        t0 = time.perf_counter()
        rule_runs.append(run_vignettes(NOW, NoLLM()))
        rule_seconds.append((time.perf_counter() - t0) / cases)
        hybrid_runs.append(hybrid)
        llm_runs.append(llm)
        hybrid_failed += extractor.failed
        llm_failed += failed
    if not rule_runs:
        raise SystemExit("no run finished: the LLM provider kept failing (quota or outage)")
    return {
        "runsFinished": len(rule_runs),
        "stoppedEarly": stopped_early,
        "ruleOnly": score(rule_runs, rule_seconds, 0),
        "llmOnly": score(llm_runs, llm_call.seconds, llm_failed),
        "hybrid": score(hybrid_runs, hybrid_call.seconds, hybrid_failed),
    }


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--runs", type=int, default=5)
    parser.add_argument("--delay", type=float, default=0.0)
    args = parser.parse_args()
    sys.stdout.reconfigure(encoding="utf-8")

    load_dotenv()
    key, model = os.getenv("LLM_API_KEY"), os.getenv("LLM_MODEL")
    if not key or not model:
        sys.exit("LLM_API_KEY and LLM_MODEL must be set in apps/algorithm/.env")

    result = compare_methods(gemini_call(key, model, EXPERIMENT_TIMEOUT_SECONDS), args.runs, args.delay)
    print(json.dumps({"model": model, "timeoutSeconds": EXPERIMENT_TIMEOUT_SECONDS, **result}, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
