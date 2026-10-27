"""Discrete event simulation of one OPD working day (thesis §3.7, experiments on waiting time and alpha).

Two scenarios run on the SAME random patients so the difference comes only from the process:

BASELINE (current walk-in process)
  arrive -> wait for a nurse at the screening desk -> nurse screens (≈4.3 min)
  -> sent to a random doctor of the department on shift -> FCFS
  -> after each patient the staff calls the next one by hand (call delay)

PIQ (this project)
  screening is done on the phone before arrival, so the patient goes straight into a queue
  -> least-loaded doctor, counting the patient in the room (scheduling.pick_doctor)
  -> ordered by P = B + alpha * W (queueing.pick_next, the production code)
  -> the system calls the next patient automatically when the doctor records the result
  -> some online-eligible patients take the online option and never join the onsite queue

Parameters marked [Kaggle] come from the hospital wait-time dataset analysed in thesis §3
(docs/datasets/kaggle, 5,000 visits); scripts/queueing_analysis.py --kaggle prints them again.
Everything else is an ASSUMPTION. They live in SimConfig so they can be reported in the thesis and
changed for a sensitivity analysis.
"""

import heapq
import math
import random
from collections import defaultdict
from dataclasses import dataclass, field
from datetime import datetime, timedelta, timezone

from .config import DEFAULT_ALPHA, DEFAULT_BASE_SCORES
from .models import WaitingQueue
from .queueing import RiskBonus, pick_next
from .scheduling import pick_doctor

DAY_START = datetime(2026, 10, 1, 1, 0, tzinfo=timezone.utc)  # 08:00 Asia/Bangkok


@dataclass
class SimConfig:
    arrivals_per_hour: float = 6.1           # [Kaggle] flat 08:00-16:00; experiments raise it to a target rho
    arrival_hours: float = 8.0               # [Kaggle] patients arrive 08:00-16:00
    dept_mix: dict[str, float] = field(default_factory=lambda: {"MED": 0.50, "SURG": 0.20, "PED": 0.15, "ENT": 0.15})
    # [Kaggle] Emergency / Urgent / Semi-urgent / Non-urgent; Immediate (1.9%) goes to the ER, not the queue
    level_mix: dict[int, float] = field(default_factory=lambda: {2: 0.081, 3: 0.196, 4: 0.302, 5: 0.421})
    # doctors: (department, shift start hour, shift end hour) — same roster as data/catalog.json
    doctors: list[tuple[str, int, int]] = field(default_factory=lambda: [
        ("MED", 8, 16), ("MED", 8, 16), ("SURG", 8, 16), ("PED", 8, 16), ("ENT", 8, 12)])
    nurses: int = 2                           # assumption: screening desk staff
    nurse_minutes: tuple[float, float] = (4.0, 1.2)     # [Kaggle] nurse to triage complete
    consult_minutes: tuple[float, float] = (18.7, 9.1)  # [Kaggle] consultation duration
    appointment_prob: float = 0.70           # [Kaggle] 70.2% arrive for an appointment
    appointment_early: tuple[float, float] = (10.3, 15.3)  # [Kaggle] minutes before the slot (negative = late)
    manual_call_minutes: tuple[float, float] = (1.5, 0.8)  # assumption: staff notices, calls, patient walks in
    auto_call_minutes: tuple[float, float] = (0.5, 0.3)    # patient already warned 3 queues ahead, only walks in
    online_eligible_prob: dict[int, float] = field(default_factory=lambda: {4: 0.4, 5: 0.9})  # assumption
    online_uptake: float = 0.3               # assumption: share of eligible patients who accept online
    elderly_prob: float = 0.245              # [Kaggle] Senior (61+)
    chronic_prob: float = 0.30               # assumption: share with a chronic disease
    risk: RiskBonus = field(default_factory=RiskBonus)  # D_j; RiskBonus(0, 0) switches it off
    base: dict[int, float] = field(default_factory=lambda: dict(DEFAULT_BASE_SCORES))
    alpha: float = DEFAULT_ALPHA


@dataclass(frozen=True)
class Features:
    """Each PIQ mechanism can be switched on alone to see how much it contributes."""
    pre_screen: bool = False      # screening on LINE before arrival (skips the nurse desk)
    load_balance: bool = False    # doctor with the fewest waiting patients instead of a random one
    priority_aging: bool = False  # P = B + alpha*W instead of FCFS
    auto_call: bool = False       # system calls the next patient instead of staff by hand
    online: bool = False          # online-eligible patients may take the online option


BASELINE = Features()
PIQ = Features(True, True, True, True, True)
ABLATIONS = {
    "เดิม (FCFS + พยาบาลคัดกรอง)": BASELINE,
    "+ คัดกรองผ่าน LINE ล่วงหน้า": Features(pre_screen=True),
    "+ กระจายแพทย์ตามภาระงาน": Features(load_balance=True),
    "+ เรียกคิวอัตโนมัติ": Features(auto_call=True),
    "+ ตรวจออนไลน์": Features(online=True),
    "+ จัดลำดับความเร่งด่วน + aging": Features(priority_aging=True),
    "PIQ ครบทุกกลไก": PIQ,
}


@dataclass
class Patient:
    id: str
    arrival: float          # minutes after 08:00
    dept: str
    level: int
    nurse_time: float
    consult_time: float
    call_delay_manual: float
    call_delay_auto: float
    wants_online: bool
    age_group: str = "18-59"
    is_chronic: bool = False
    appointment: float | None = None   # slot time (minutes after 08:00); None for walk-in


@dataclass
class Outcome:
    patient: Patient
    start: float | None     # consult start (minutes), None if not seen (no doctor on shift)
    online: bool = False

    @property
    def wait(self) -> float | None:
        """From arrival, or from the slot when an appointment patient came early (thesis W_j rule)."""
        if self.start is None:
            return None
        return max(0.0, self.start - counted_from(self.patient, self.patient.arrival))


def counted_from(p: Patient, t: float) -> float:
    """W_j starts at the appointment slot if the patient is ready before it."""
    return t if p.appointment is None else max(t, p.appointment)


def lognormal(rng: random.Random, mean: float, sd: float) -> float:
    s2 = math.log(1 + (sd / mean) ** 2)
    return rng.lognormvariate(math.log(mean) - s2 / 2, math.sqrt(s2))


def pick(rng: random.Random, mix: dict) -> object:
    return rng.choices(list(mix), weights=list(mix.values()))[0]


def generate_patients(cfg: SimConfig, seed: int) -> list[Patient]:
    rng = random.Random(seed)
    risk_rng = random.Random(seed * 7907 + 1)
    out, t, i = [], 0.0, 0
    while True:
        t += rng.expovariate(cfg.arrivals_per_hour / 60)
        if t >= cfg.arrival_hours * 60:
            return out
        level = pick(rng, cfg.level_mix)
        i += 1
        appointment = None
        if risk_rng.random() < cfg.appointment_prob:
            appointment = t + risk_rng.gauss(*cfg.appointment_early)
        out.append(Patient(
            id=f"p{i:03d}",
            arrival=t,
            dept=pick(rng, cfg.dept_mix),
            level=level,
            nurse_time=lognormal(rng, *cfg.nurse_minutes),
            consult_time=lognormal(rng, *cfg.consult_minutes),
            call_delay_manual=lognormal(rng, *cfg.manual_call_minutes),
            call_delay_auto=lognormal(rng, *cfg.auto_call_minutes),
            # an appointment patient has already been booked onsite and is not offered the online option
            wants_online=rng.random() < cfg.online_eligible_prob.get(level, 0) * cfg.online_uptake
            and appointment is None,
            # separate stream: adding risk factors must not change the other draws of a seed
            age_group="60+" if risk_rng.random() < cfg.elderly_prob else "18-59",
            is_chronic=risk_rng.random() < cfg.chronic_prob,
            appointment=appointment,
        ))


def _as_dt(minutes: float) -> datetime:
    return DAY_START + timedelta(minutes=minutes)


def simulate(cfg: SimConfig, patients: list[Patient], f: Features, seed: int = 0) -> list[Outcome]:
    rng = random.Random(seed + 7919)
    doctors = [(f"{d}-{i}", d, s, e) for i, (d, s, e) in enumerate(cfg.doctors)]
    queue: dict[str, list[Patient]] = defaultdict(list)    # doctor id -> waiting patients
    enter_time: dict[str, float] = {}                       # patient id -> time joined doctor queue
    busy_until: dict[str, float] = {d[0]: 0.0 for d in doctors}
    busy: dict[str, bool] = {d[0]: False for d in doctors}
    outcomes = {p.id: Outcome(p, None) for p in patients}
    events: list[tuple[float, int, str, object]] = []
    seq = 0

    def push(t, kind, payload):
        nonlocal seq
        seq += 1
        heapq.heappush(events, (t, seq, kind, payload))

    def on_shift(dept, t):
        return [d[0] for d in doctors if d[1] == dept and d[2] * 60 - 480 <= t < d[3] * 60 - 480]

    def join_queue(p: Patient, t: float):
        ids = on_shift(p.dept, t)
        if not ids:
            return  # no doctor: patient told to come back next round (not counted as waiting)
        if f.load_balance:
            waiting = [WaitingQueue(x.id, p.dept, did, x.level, _as_dt(enter_time[x.id]))
                       for did in ids for x in queue[did]]
            doc = pick_doctor(ids, waiting, {d for d in ids if busy[d]})
        else:
            doc = rng.choice(ids)
        queue[doc].append(p)
        enter_time[p.id] = counted_from(p, t)
        if not busy[doc]:
            push(t, "free", doc)

    # without pre-screening every patient queues at the nurse desk first
    nurse_free = [0.0] * cfg.nurses
    for p in sorted(patients, key=lambda x: x.arrival):
        if f.online and p.wants_online:
            outcomes[p.id].online = True
            continue
        if f.pre_screen:
            push(p.arrival, "ready", p)
        else:
            k = min(range(cfg.nurses), key=lambda i: nurse_free[i])
            start = max(p.arrival, nurse_free[k])
            nurse_free[k] = start + p.nurse_time
            push(nurse_free[k], "ready", p)

    while events:
        t, _, kind, payload = heapq.heappop(events)
        if kind == "ready":
            join_queue(payload, t)
        elif kind == "free":
            doc = payload
            if busy[doc] or not queue[doc]:
                continue
            if f.priority_aging:
                waiting = [WaitingQueue(x.id, "", doc, x.level, _as_dt(enter_time[x.id]), x.id,
                                        x.age_group, x.is_chronic) for x in queue[doc]]
                nxt_id = pick_next(waiting, _as_dt(t), cfg.base, cfg.alpha, risk=cfg.risk).queue.id
                p = next(x for x in queue[doc] if x.id == nxt_id)
            else:
                p = queue[doc][0]
            delay = p.call_delay_auto if f.auto_call else p.call_delay_manual
            queue[doc].remove(p)
            start = t + delay
            outcomes[p.id].start = start
            busy[doc] = True
            busy_until[doc] = start + p.consult_time
            push(busy_until[doc], "done", doc)
        elif kind == "done":
            busy[payload] = False
            push(t, "free", payload)
    return list(outcomes.values())


def percentile(xs: list[float], q: float) -> float:
    if not xs:
        return float("nan")
    xs = sorted(xs)
    k = (len(xs) - 1) * q
    lo, hi = math.floor(k), math.ceil(k)
    return xs[lo] + (xs[hi] - xs[lo]) * (k - lo)


def summarize(outcomes: list[Outcome]) -> dict:
    seen = [o for o in outcomes if o.wait is not None]
    waits = [o.wait for o in seen]
    by_level = defaultdict(list)
    for o in seen:
        by_level[o.patient.level].append(o.wait)
    orange = by_level.get(2, [])
    # D_j targets these patients: report their wait apart from everyone else's
    risky = [o.wait for o in seen if o.patient.age_group == "60+" or o.patient.is_chronic]
    others = [o.wait for o in seen if not (o.patient.age_group == "60+" or o.patient.is_chronic)]
    return {
        "patients": len(outcomes),
        "seenOnsite": len(seen),
        "online": sum(o.online for o in outcomes),
        "meanWait": sum(waits) / len(waits) if waits else float("nan"),
        "p90Wait": percentile(waits, 0.9),
        "maxWait": max(waits, default=float("nan")),
        "meanWaitByLevel": {lv: sum(w) / len(w) for lv, w in sorted(by_level.items())},
        "maxWaitByLevel": {lv: max(w) for lv, w in sorted(by_level.items())},
        "orangeWithin10min": (sum(w <= 10 for w in orange) / len(orange)) if orange else float("nan"),
        "meanWaitRisk": sum(risky) / len(risky) if risky else float("nan"),
        "meanWaitOthers": sum(others) / len(others) if others else float("nan"),
    }


def run_replications(
    cfg: SimConfig, scenarios: dict[str, Features], runs: int = 50, first_seed: int = 1
) -> dict[str, list[dict]]:
    """Every scenario sees exactly the same patients in each run (common random numbers)."""
    out: dict[str, list[dict]] = {name: [] for name in scenarios}
    for s in range(first_seed, first_seed + runs):
        patients = generate_patients(cfg, s)
        for name, f in scenarios.items():
            out[name].append(summarize(simulate(cfg, patients, f, s)))
    return out


def mean_ci(values: list[float]) -> tuple[float, float]:
    """Mean and 95% half-width (normal approximation)."""
    xs = [v for v in values if not math.isnan(v)]
    if not xs:
        return float("nan"), float("nan")
    m = sum(xs) / len(xs)
    if len(xs) < 2:
        return m, 0.0
    sd = math.sqrt(sum((x - m) ** 2 for x in xs) / (len(xs) - 1))
    return m, 1.96 * sd / math.sqrt(len(xs))


