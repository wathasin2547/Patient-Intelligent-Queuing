from triage.multi_queue_sim import (
    at_rho,
    bottleneck_rho,
    compare_policies,
    completed,
    experiment_config,
    generate_visits,
    simulate_visits,
    time_in_hospital,
)
from triage.simulation import SimConfig, generate_patients

CFG = at_rho(experiment_config(SimConfig()), 0.85, 0.2)


def runs(seeds=range(1, 6)):
    for s in seeds:
        plans = generate_visits(CFG, generate_patients(CFG, s), 0.2, s)
        yield plans, simulate_visits(CFG, plans, False), simulate_visits(CFG, plans, True)


def intervals(result, key):
    groups = {}
    for plan in result.values():
        for v in plan:
            if v.start is not None:
                groups.setdefault(key(v), []).append((v.start, v.end))
    return groups


def test_a_patient_is_never_in_two_rooms_at_once():
    for _, seq, par in runs():
        for result in (seq, par):
            for spans in intervals(result, lambda v: v.patient.id).values():
                spans.sort()
                assert all(a[1] <= b[0] for a, b in zip(spans, spans[1:]))


def test_an_exam_is_never_cut_short():
    for _, seq, par in runs():
        for result in (seq, par):
            for plan in result.values():
                for v in plan:
                    if v.start is not None:
                        assert v.end == v.start + v.consult_time


def test_sequential_joins_the_second_department_after_the_first_exam():
    for plans, seq, _ in runs():
        for pid, plan in seq.items():
            if len(plan) == 2 and completed(plan):
                first, second = sorted(plan, key=lambda v: v.enter)
                assert second.enter >= first.end


def test_parallel_joins_every_open_department_at_arrival():
    for _, _, par in runs():
        for plan in par.values():
            for v in plan:
                if v.enter is not None:
                    assert v.enter == v.patient.arrival


def test_policies_see_the_same_patients():
    for plans, seq, par in runs():
        assert seq.keys() == par.keys() == plans.keys()
        for pid in plans:
            assert [v.consult_time for v in seq[pid]] == [v.consult_time for v in par[pid]]


def test_second_visits_count_towards_the_target_load():
    assert abs(bottleneck_rho(CFG, 0.2) - 0.85) < 1e-9


def test_parallel_shortens_the_day_of_two_department_patients():
    r = compare_policies(CFG, 0.2, runs=20)
    assert r["multiHospitalDiff"][0] < 0


def test_time_in_hospital_runs_from_arrival_to_the_last_exam():
    for _, seq, _ in runs(range(1, 2)):
        plan = next(p for p in seq.values() if len(p) == 2 and completed(p))
        assert time_in_hospital(plan) == max(v.end for v in plan) - plan[0].patient.arrival
