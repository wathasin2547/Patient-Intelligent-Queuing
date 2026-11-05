import heapq
import math
import random
import statistics as st
from dataclasses import dataclass, replace

from .models import WaitingQueue
from .queueing import pick_next
from .scheduling import pick_doctor
from .simulation import Patient, SimConfig, _as_dt, generate_patients, lognormal, mean_ci, percentile, pick


@dataclass
class Visit:
    id: str
    patient: Patient
    dept: str
    consult_time: float
    call_delay: float
    enter: float | None = None
    start: float | None = None
    end: float | None = None


def experiment_config(cfg: SimConfig) -> SimConfig:
    return replace(cfg, appointment_prob=0.0, online_uptake=0.0)


def second_department_load(mix: dict[str, float], dept: str, share: float) -> float:
    return share * sum(m * mix[dept] / (1 - m) for d, m in mix.items() if d != dept)


def bottleneck_rho(cfg: SimConfig, share: float) -> float:
    s = cfg.consult_minutes[0]
    rhos = []
    for dept, m in cfg.dept_mix.items():
        doctors = sum(d == dept for d, _, _ in cfg.doctors)
        visits_per_hour = cfg.arrivals_per_hour * (m + second_department_load(cfg.dept_mix, dept, share))
        rhos.append(visits_per_hour * s / 60 / doctors)
    return max(rhos)


def at_rho(cfg: SimConfig, rho: float, share: float) -> SimConfig:
    return replace(cfg, arrivals_per_hour=cfg.arrivals_per_hour * rho / bottleneck_rho(cfg, share))


def generate_visits(cfg: SimConfig, patients: list[Patient], share: float, seed: int) -> dict[str, list[Visit]]:
    rng = random.Random(seed * 104729 + 3)
    plans = {}
    for p in patients:
        plan = [Visit(f"{p.id}-1", p, p.dept, p.consult_time, p.call_delay_auto)]
        needs_second = rng.random() < share
        others = {d: m for d, m in cfg.dept_mix.items() if d != p.dept}
        second = pick(rng, others)
        consult = lognormal(rng, *cfg.consult_minutes)
        delay = lognormal(rng, *cfg.auto_call_minutes)
        if needs_second:
            plan.append(Visit(f"{p.id}-2", p, second, consult, delay))
        plans[p.id] = plan
    return plans


def simulate_visits(cfg: SimConfig, plans: dict[str, list[Visit]], parallel: bool) -> dict[str, list[Visit]]:
    visits = {pid: [replace(v) for v in plan] for pid, plan in plans.items()}
    doctors = [(f"{d}-{i}", d, s, e) for i, (d, s, e) in enumerate(cfg.doctors)]
    queue: dict[str, list[Visit]] = {d[0]: [] for d in doctors}
    room: dict[str, Visit | None] = {d[0]: None for d in doctors}
    busy_patients: set[str] = set()
    events: list[tuple[float, int, str, object]] = []
    seq = 0

    def push(t, kind, payload):
        nonlocal seq
        seq += 1
        heapq.heappush(events, (t, seq, kind, payload))

    def on_shift(dept, t):
        return [d[0] for d in doctors if d[1] == dept and d[2] * 60 - 480 <= t < d[3] * 60 - 480]

    def join(v: Visit, t: float) -> bool:
        ids = on_shift(v.dept, t)
        if not ids:
            return False
        waiting = [WaitingQueue(x.id, v.dept, did, x.patient.level, _as_dt(x.enter), x.patient.id)
                   for did in ids for x in queue[did]]
        doc = pick_doctor(ids, waiting, {d for d in ids if room[d] is not None})
        v.enter = t
        queue[doc].append(v)
        push(t, "free", doc)
        return True

    def join_next(pid: str, t: float) -> None:
        for v in visits[pid]:
            if v.enter is None and v.start is None and join(v, t):
                return

    for pid, plan in visits.items():
        arrival = plan[0].patient.arrival
        push(arrival, "arrive", pid)

    while events:
        t, _, kind, payload = heapq.heappop(events)
        if kind == "arrive":
            if parallel:
                for v in visits[payload]:
                    join(v, t)
            else:
                join_next(payload, t)
        elif kind == "free":
            doc = payload
            if room[doc] is not None or not queue[doc]:
                continue
            waiting = [WaitingQueue(x.id, "", doc, x.patient.level, _as_dt(x.enter), x.patient.id,
                                    x.patient.age_group, x.patient.is_chronic) for x in queue[doc]]
            ranked = pick_next(waiting, _as_dt(t), cfg.base, cfg.alpha, busy_patients, cfg.risk)
            if ranked is None:
                continue
            v = next(x for x in queue[doc] if x.id == ranked.queue.id)
            queue[doc].remove(v)
            v.start = t + v.call_delay
            v.end = v.start + v.consult_time
            room[doc] = v
            busy_patients.add(v.patient.id)
            push(v.end, "done", doc)
        elif kind == "done":
            doc = payload
            v = room[doc]
            room[doc] = None
            busy_patients.remove(v.patient.id)
            if not parallel:
                join_next(v.patient.id, t)
            for d in doctors:
                push(t, "free", d[0])
    return visits


def time_in_hospital(plan: list[Visit]) -> float:
    return max(v.end for v in plan) - plan[0].patient.arrival


def completed(plan: list[Visit]) -> bool:
    return all(v.end is not None for v in plan)


def compare_run(cfg: SimConfig, share: float, seed: int) -> dict:
    patients = generate_patients(cfg, seed)
    plans = generate_visits(cfg, patients, share, seed)
    seq, par = simulate_visits(cfg, plans, False), simulate_visits(cfg, plans, True)
    multi = [pid for pid, plan in plans.items() if len(plan) == 2]
    both = [pid for pid in multi if completed(seq[pid]) and completed(par[pid])]
    single = [pid for pid, plan in plans.items() if len(plan) == 1 and seq[pid][0].start is not None]

    def waits(result):
        return [result[pid][0].start - result[pid][0].enter for pid in single]

    wait_seq, wait_par = waits(seq), waits(par)
    return {
        "multiPatients": len(multi),
        "multiHospitalSequential": st.mean(time_in_hospital(seq[pid]) for pid in both) if both else math.nan,
        "multiHospitalParallel": st.mean(time_in_hospital(par[pid]) for pid in both) if both else math.nan,
        "multiFinishedSequential": sum(completed(seq[pid]) for pid in multi) / len(multi) if multi else math.nan,
        "multiFinishedParallel": sum(completed(par[pid]) for pid in multi) / len(multi) if multi else math.nan,
        "singleMeanSequential": st.mean(wait_seq),
        "singleMeanParallel": st.mean(wait_par),
        "singleP90Sequential": percentile(wait_seq, 0.9),
        "singleP90Parallel": percentile(wait_par, 0.9),
        "singleMaxSequential": max(wait_seq),
        "singleMaxParallel": max(wait_par),
    }


def compare_policies(cfg: SimConfig, share: float, runs: int = 50) -> dict[str, tuple[float, float]]:
    rows = [compare_run(cfg, share, s) for s in range(1, runs + 1)]
    out = {k: mean_ci([r[k] for r in rows]) for k in rows[0]}
    for name in ("multiHospital", "singleMean", "singleP90", "singleMax", "multiFinished"):
        out[f"{name}Diff"] = mean_ci([r[f"{name}Parallel"] - r[f"{name}Sequential"] for r in rows])
    return out
