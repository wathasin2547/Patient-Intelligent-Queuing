"""Queueing-theory reading of the Kaggle dataset and the preliminary experiments (thesis §3 data analysis).

    python -m scripts.queueing_analysis --kaggle "../../../docs/datasets/kaggle/Hospital Wait  TIme Data.csv"
    python -m scripts.queueing_analysis --validate   # simulator vs M/M/c and M/G/c formulas
    python -m scripts.queueing_analysis --load       # baseline vs PIQ at several utilizations
    python -m scripts.queueing_analysis --alpha      # alpha sweep at rho = 0.85
    python -m scripts.queueing_analysis --risk       # with vs without D_j at rho = 0.85

The Kaggle CSV stays in docs/datasets (MIT licence); this script only reads it from the given path.
"""

import argparse
import csv
import random
import statistics as st
import sys
from collections import Counter, defaultdict
from dataclasses import replace

from triage.queueing import NO_BONUS
from triage.simulation import (
    BASELINE,
    PIQ,
    Features,
    SimConfig,
    generate_patients,
    mean_ci,
    run_replications,
    simulate,
    summarize,
)
from triage.theory import (
    arrivals_for_utilization,
    little_queue_length,
    mgc_wait,
    mmc_wait,
    utilization,
)

LEVELS = (2, 3, 4, 5)


def kaggle(path: str) -> None:
    rows = list(csv.DictReader(open(path, encoding="utf-8-sig")))
    days = len({r["VisitDate"] for r in rows})
    open_hours = [h for h in range(8, 16)]
    lam = sum(int(r["ArrivalHour"]) in open_hours for r in rows) / days / len(open_hours)
    consult = [float(r["ConsultationDurationTime"]) for r in rows]
    s, sd = st.mean(consult), st.pstdev(consult)
    wait = [float(r["TriageToProviderStartTime"]) for r in rows]
    print(f"rows {len(rows)} · days {days} · {len(rows) / days:.1f} visits/day")
    print(f"lambda (08-16) = {lam:.2f} /h · service mean {s:.1f} sd {sd:.1f} min (cs^2 {(sd / s) ** 2:.2f})")
    print(f"observed wait triage->doctor: mean {st.mean(wait):.1f} median {st.median(wait):.1f} min")
    print("triage mix", {k: f"{v / len(rows):.3f}" for k, v in Counter(r["TriageCategory"] for r in rows).items()})
    print("arrival mix", {k: f"{v / len(rows):.3f}" for k, v in Counter(r["ArrivalMethod"] for r in rows).items()})
    print("age mix", {k: f"{v / len(rows):.3f}" for k, v in Counter(r["AgeGroup"] for r in rows).items()})

    by_c = defaultdict(list)
    for r in rows:
        by_c[int(r["ProvidersOnShift"])].append(float(r["TriageToProviderStartTime"]))
    print(f"\n{'doctors c':>9s} {'rho':>6s} {'M/M/c Wq':>9s} {'M/G/c Wq':>9s} {'observed':>9s} {'Lq=λWq obs':>10s}")
    for c in sorted(by_c):
        obs = st.mean(by_c[c])
        print(f"{c:9d} {utilization(lam, s, c):6.2f} {mmc_wait(lam, s, c):9.1f} {mgc_wait(lam, s, sd, c):9.1f} "
              f"{obs:9.1f} {little_queue_length(lam, obs):10.1f}")


def long_run(lam: float, doctors: int, f: Features, runs: int, exponential: bool) -> list[float]:
    """One department, FCFS, no nurse desk, no call delay, 400 h: the steady state the formulas describe."""
    s, sd = SimConfig().consult_minutes
    cfg = SimConfig(arrivals_per_hour=lam, arrival_hours=400, dept_mix={"MED": 1.0},
                    doctors=[("MED", 8, 1000)] * doctors, appointment_prob=0.0, online_uptake=0.0)
    waits = []
    for seed in range(1, runs + 1):
        rng = random.Random(seed)
        ps = [replace(p, call_delay_auto=0.0,
                      consult_time=rng.expovariate(1 / s) if exponential else p.consult_time)
              for p in generate_patients(cfg, seed)]
        waits.append(summarize(simulate(cfg, ps, replace(f, pre_screen=True, auto_call=True), seed))["meanWait"])
    return waits


def validate(runs: int) -> None:
    s, sd = SimConfig().consult_minutes
    print(f"(1) one doctor, exponential service vs M/M/1 (exact) · {runs} runs × 400 h")
    print(f"{'rho':>5s} {'M/M/1':>8s} {'sim':>14s}")
    for rho in (0.5, 0.7, 0.85):
        lam = arrivals_for_utilization(rho, s, 1)
        print(f"{rho:5.2f} {mmc_wait(lam, s, 1):8.1f} {fmt(long_run(lam, 1, BASELINE, runs, True)):>14s}")

    print(f"\n(2) two doctors, Kaggle service time ({s} ± {sd} min)")
    print("    random doctor = two separate M/G/1 queues (Pollaczek-Khinchine, exact);"
          " pooled M/G/2 (Allen-Cunneen) is the best any assignment can do")
    print(f"{'rho':>5s} {'2×M/G/1':>8s} {'sim random':>14s} {'M/G/2':>8s} {'sim load-bal.':>14s}")
    for rho in (0.5, 0.7, 0.85):
        lam = arrivals_for_utilization(rho, s, 2)
        rnd = long_run(lam, 2, BASELINE, runs, False)
        bal = long_run(lam, 2, Features(load_balance=True), runs, False)
        print(f"{rho:5.2f} {mgc_wait(lam / 2, s, sd, 1):8.1f} {fmt(rnd):>14s} {mgc_wait(lam, s, sd, 2):8.1f} {fmt(bal):>14s}")


def fmt(values: list[float]) -> str:
    m, h = mean_ci(values)
    return f"{m:6.1f} ±{h:4.1f}"


def bottleneck_rho(cfg: SimConfig) -> float:
    """Utilization of the busiest department (internal medicine: 50% of patients, 2 doctors)."""
    s = cfg.consult_minutes[0]
    return max(utilization(cfg.arrivals_per_hour * share, s, sum(d == dept for d, _, _ in cfg.doctors))
               for dept, share in cfg.dept_mix.items())


def at_rho(cfg: SimConfig, rho: float) -> SimConfig:
    return replace(cfg, arrivals_per_hour=cfg.arrivals_per_hour * rho / bottleneck_rho(cfg))


def report(results: dict[str, list[dict]]) -> None:
    head = " ".join(f"{'L' + str(lv) + ' mean/max':>14s}" for lv in LEVELS)
    print(f"{'scenario':34s} {'mean':>12s} {'P90':>12s} {head} {'risk/other':>12s}")
    for name, rs in results.items():
        cells = []
        for lv in LEVELS:
            m = mean_ci([r["meanWaitByLevel"].get(lv, float("nan")) for r in rs])[0]
            mx = mean_ci([r["maxWaitByLevel"].get(lv, float("nan")) for r in rs])[0]
            cells.append(f"{m:5.1f}/{mx:6.1f}")
        risk = mean_ci([r["meanWaitRisk"] for r in rs])[0]
        other = mean_ci([r["meanWaitOthers"] for r in rs])[0]
        print(f"{name:34s} {fmt([r['meanWait'] for r in rs]):>12s} {fmt([r['p90Wait'] for r in rs]):>12s} "
              + " ".join(f"{c:>14s}" for c in cells) + f" {risk:5.1f}/{other:5.1f}")


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--kaggle")
    parser.add_argument("--validate", action="store_true")
    parser.add_argument("--load", action="store_true")
    parser.add_argument("--alpha", action="store_true")
    parser.add_argument("--risk", action="store_true")
    parser.add_argument("--runs", type=int, default=50)
    args = parser.parse_args()
    sys.stdout.reconfigure(encoding="utf-8")
    cfg = SimConfig()

    if args.kaggle:
        kaggle(args.kaggle)
    if args.validate:
        validate(max(1, args.runs // 10))
    if args.load:
        print(f"Kaggle arrival rate gives bottleneck rho = {bottleneck_rho(cfg):.2f}")
        for rho in (bottleneck_rho(cfg), 0.7, 0.85, 0.95):
            c = at_rho(cfg, rho)
            print(f"\n== rho {rho:.2f} · {c.arrivals_per_hour:.1f} patients/h · {args.runs} runs ==")
            report(run_replications(c, {
                "เดิม": BASELINE,
                "จัดลำดับ + aging อย่างเดียว": Features(priority_aging=True),
                "PIQ ครบทุกกลไก": PIQ,
            }, args.runs))
    if args.alpha:
        c = at_rho(cfg, 0.85)
        results = run_replications(c, {"PIQ ไม่จัดลำดับ (FCFS)": replace(PIQ, priority_aging=False)}, args.runs)
        for a in (0.0, 0.5, 1.0, 2.0, 4.0, 8.0):
            results.update(run_replications(replace(c, alpha=a), {f"PIQ alpha = {a}": PIQ}, args.runs))
        print(f"alpha sweep · rho 0.85 · {c.arrivals_per_hour:.1f} patients/h · {args.runs} runs")
        report(results)
    if args.risk:
        c = at_rho(cfg, 0.85)
        results = run_replications(replace(c, risk=NO_BONUS), {"PIQ ไม่มี D": PIQ}, args.runs)
        results.update(run_replications(c, {"PIQ มี D (30/15 นาที)": PIQ}, args.runs))
        print(f"risk bonus · rho 0.85 · {args.runs} runs")
        report(results)


if __name__ == "__main__":
    main()
