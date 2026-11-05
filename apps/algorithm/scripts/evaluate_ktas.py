import argparse
import json
import sys
import time
from collections import Counter
from datetime import datetime, timedelta, timezone
from pathlib import Path
from statistics import median

from triage.ktas import load_ktas, to_input
from triage.pipeline import triage
from triage.repository import CatalogRepository

NOW = datetime(2026, 10, 1, 10, 0, tzinfo=timezone(timedelta(hours=7))).astimezone(timezone.utc)


def agreement(levels: list[int], expert: list[int]) -> dict:
    n = len(expert)
    pairs = list(zip(levels, expert))
    return {
        "exactAgreement": round(sum(a == e for a, e in pairs) / n, 3),
        "withinOneLevel": round(sum(abs(a - e) <= 1 for a, e in pairs) / n, 3),
        "underTriageRate": round(sum(a > e for a, e in pairs) / n, 3),
        "overTriageRate": round(sum(a < e for a, e in pairs) / n, 3),
        "expertLevel1or2SentToQueueAsLevel3to5": sum(a >= 3 and e <= 2 for a, e in pairs),
    }


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("path", type=Path)
    parser.add_argument("--json", action="store_true")
    args = parser.parse_args()
    sys.stdout.reconfigure(encoding="utf-8")

    records = load_ktas(args.path)
    repo = CatalogRepository(day=NOW)
    pairs, elapsed = [], []
    for rec in records:
        t0 = time.perf_counter()
        res = triage(to_input(rec, repo), repo, NOW)
        elapsed.append((time.perf_counter() - t0) * 1000)
        pairs.append((rec, res))

    n = len(pairs)
    ours = [res.priority_level for _, res in pairs]
    expert = [rec.ktas_expert for rec, _ in pairs]
    critical = [(rec, res) for rec, res in pairs if rec.ktas_expert <= 2]
    critical_online = sum(res.online_eligible for _, res in critical)
    nurse_minutes = [r.triage_minutes for r in records if r.triage_minutes is not None]

    summary = {
        "mode": "rule-only (LLM skipped; chief complaint not read)",
        "records": n,
        "expertLevelDistribution": dict(sorted(Counter(r.ktas_expert for r in records).items())),
        "ourLevelDistribution": dict(sorted(Counter(res.priority_level for _, res in pairs).items())),
        "confusion": {e: dict(sorted(Counter(a for a, x in zip(ours, expert) if x == e).items()))
                      for e in sorted(set(expert))},
        **agreement(ours, expert),
        "referenceAlways3": agreement([3] * n, expert),
        "referenceAlways4": agreement([4] * n, expert),
        "referenceNurse": agreement([r.ktas_nurse for r in records], expert),
        "expertLevel1or2": len(critical),
        "expertLevel1or2OfferedOnline": critical_online,
        "emergency": sum(res.is_red_flag for _, res in pairs),
        "noDepartmentScored": sum(not res.is_red_flag and not res.department_scores for _, res in pairs),
        "nurseTriageMinutesMedian": round(median(nurse_minutes), 2),
        "ourProcessingMsMedian": round(median(elapsed), 3),
    }
    if args.json:
        print(json.dumps(summary, ensure_ascii=False, indent=2))
        return
    for k, v in summary.items():
        print(f"{k}: {v}")


if __name__ == "__main__":
    main()
