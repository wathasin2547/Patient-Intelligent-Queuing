"""Score the case vignettes. Rule-only mode for now (closed answers only, LLM skipped).

Usage (from apps/algorithm):
    python -m scripts.evaluate_vignettes            # table + summary
    python -m scripts.evaluate_vignettes --json     # machine-readable, for chapter 4
"""

import argparse
import json
import sys
from datetime import datetime, timedelta, timezone

from triage.evaluation import run_vignettes, summarize

# Fixed clock (10:00 Bangkok) so every run gives the same result
NOW = datetime(2026, 10, 1, 10, 0, tzinfo=timezone(timedelta(hours=7))).astimezone(timezone.utc)


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--json", action="store_true")
    args = parser.parse_args()
    sys.stdout.reconfigure(encoding="utf-8")

    results = run_vignettes(NOW)
    summary = summarize(results)

    if args.json:
        print(json.dumps({
            "mode": "rule-only",
            "summary": summary,
            "cases": [{"id": x.id, "mismatches": x.mismatches,
                       "department": x.result.assigned_department,
                       "priorityLevel": x.result.priority_level,
                       "isRedFlag": x.result.is_red_flag,
                       "onlineEligible": x.result.online_eligible} for x in results],
        }, ensure_ascii=False, indent=2))
        return

    for x in results:
        mark = "OK  " if not x.mismatches else "MISS"
        print(f"{mark} {x.id} [{x.group}] {x.description}")
        for m in x.mismatches:
            print(f"       - {m}")
    print()
    print("mode: rule-only (LLM skipped)")
    for k, v in summary.items():
        print(f"{k}: {v}")


if __name__ == "__main__":
    main()
