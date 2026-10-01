"""Compare our priority level with the expert KTAS level of the public dataset.

The data file is NOT in the repo (real de-identified patient records). Pass its path:
    python -m scripts.evaluate_ktas ../../../docs/datasets/ktas/pone.0216972.s001.xlsx

Rule-only for now: the chief complaint is free text, so most cases need the LLM (phase 5)
to be understood. Use this run as the baseline for experiment 3.
"""

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
    exact = sum(res.priority_level == rec.ktas_expert for rec, res in pairs)
    within1 = sum(abs(res.priority_level - rec.ktas_expert) <= 1 for rec, res in pairs)
    # higher number = less urgent, so ours > expert means under-triage
    under = sum(res.priority_level > rec.ktas_expert for rec, res in pairs)
    over = sum(res.priority_level < rec.ktas_expert for rec, res in pairs)
    critical = [(rec, res) for rec, res in pairs if rec.ktas_expert <= 2]
    critical_missed = sum(res.priority_level >= 3 for _, res in critical)
    critical_online = sum(res.online_eligible for _, res in critical)
    nurse_minutes = [r.triage_minutes for r in records if r.triage_minutes is not None]

    summary = {
        "mode": "rule-only (LLM skipped; chief complaint not read)",
        "records": n,
        "expertLevelDistribution": dict(sorted(Counter(r.ktas_expert for r in records).items())),
        "ourLevelDistribution": dict(sorted(Counter(res.priority_level for _, res in pairs).items())),
        "exactAgreement": round(exact / n, 3),
        "withinOneLevel": round(within1 / n, 3),
        "underTriageRate": round(under / n, 3),
        "overTriageRate": round(over / n, 3),
        "expertLevel1or2": len(critical),
        "expertLevel1or2SentToQueueAsLevel3to5": critical_missed,
        "expertLevel1or2OfferedOnline": critical_online,
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
