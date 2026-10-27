"""Waiting-time simulation for chapter 4 (thesis §3.7: waiting time + alpha experiments).

    python -m scripts.simulate_queue                 # each mechanism on its own vs baseline
    python -m scripts.simulate_queue --alpha         # sweep alpha (starvation vs urgency)
    python -m scripts.simulate_queue --load          # Kaggle day (rho 0.48) up to rho 0.95
    python -m scripts.simulate_queue --runs 100      # more replications (default 50)

Every scenario uses the same simulated patients in each run, so differences come from the process.
"""

import argparse
import sys
from dataclasses import replace

from scripts.queueing_analysis import at_rho
from triage.simulation import ABLATIONS, BASELINE, PIQ, Features, SimConfig, mean_ci, run_replications


def fmt(values: list[float]) -> str:
    m, h = mean_ci(values)
    return f"{m:6.1f} ±{h:4.1f}"


def table(results: dict[str, list[dict]], baseline_name: str | None = None) -> None:
    base_mean = None
    if baseline_name:
        base_mean = mean_ci([r["meanWait"] for r in results[baseline_name]])[0]
    print(f"{'scenario':38s} {'mean wait':>13s} {'P90':>13s} {'max':>13s} {'orange≤10m':>11s} {'online':>7s} {'vs base':>8s}")
    for name, rs in results.items():
        mean = mean_ci([r["meanWait"] for r in rs])[0]
        diff = f"{(mean - base_mean) / base_mean * 100:+6.0f}%" if base_mean else ""
        orange = mean_ci([r["orangeWithin10min"] * 100 for r in rs])[0]
        online = mean_ci([r["online"] for r in rs])[0]
        print(f"{name:38s} {fmt([r['meanWait'] for r in rs]):>13s} {fmt([r['p90Wait'] for r in rs]):>13s} "
              f"{fmt([r['maxWait'] for r in rs]):>13s} {orange:10.0f}% {online:7.1f} {diff:>8s}")


def by_level(results: dict[str, list[dict]]) -> None:
    print(f"\n{'mean / max wait by level (min)':38s} {'ส้ม (2)':>15s} {'เหลือง (3)':>15s} {'เขียว (4)':>15s} {'ขาว (5)':>15s}")
    for name, rs in results.items():
        cells = []
        for lv in (2, 3, 4, 5):
            mean = mean_ci([r["meanWaitByLevel"].get(lv, float("nan")) for r in rs])[0]
            mx = mean_ci([r["maxWaitByLevel"].get(lv, float("nan")) for r in rs])[0]
            cells.append(f"{mean:5.1f} / {mx:5.1f}")
        print(f"{name:38s} " + " ".join(f"{c:>15s}" for c in cells))


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--runs", type=int, default=50)
    parser.add_argument("--alpha", action="store_true")
    parser.add_argument("--load", action="store_true")
    args = parser.parse_args()
    sys.stdout.reconfigure(encoding="utf-8")
    # the Kaggle arrival rate leaves the bottleneck at rho 0.48; compare mechanisms on a busy day
    cfg = at_rho(SimConfig(), 0.85)

    if args.alpha:
        scen = {"FCFS (ไม่จัดลำดับ)": Features(True, True, False, True, True)}
        results = run_replications(cfg, scen, args.runs)
        for a in (0.0, 0.5, 1.0, 2.0, 4.0, 8.0):
            r = run_replications(replace(cfg, alpha=a), {f"PIQ alpha = {a}": PIQ}, args.runs)
            results.update(r)
        print(f"alpha sweep · {args.runs} runs · {cfg.arrivals_per_hour:.0f} patients/h\n")
        table(results)
        by_level(results)
        return

    if args.load:
        for rho in (0.48, 0.70, 0.85, 0.95):
            c = at_rho(SimConfig(), rho)
            print(f"\n== rho {rho}: {c.arrivals_per_hour:.1f} patients/h · {args.runs} runs ==")
            table(run_replications(c, {"เดิม": BASELINE, "PIQ": PIQ}, args.runs), "เดิม")
        return

    results = run_replications(cfg, ABLATIONS, args.runs)
    print(f"each mechanism vs baseline · {args.runs} runs · {cfg.arrivals_per_hour:.0f} patients/h · minutes (mean ±95% CI)\n")
    table(results, "เดิม (FCFS + พยาบาลคัดกรอง)")
    by_level(results)


if __name__ == "__main__":
    main()
