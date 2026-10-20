from dataclasses import replace

from triage.simulation import BASELINE, PIQ, Features, SimConfig, generate_patients, simulate, summarize

CFG = SimConfig()


def test_same_seed_same_patients():
    assert generate_patients(CFG, 3) == generate_patients(CFG, 3)


def test_every_patient_is_accounted_for():
    patients = generate_patients(CFG, 1)
    for f in (BASELINE, PIQ):
        out = simulate(CFG, patients, f, 1)
        assert len(out) == len(patients)
        for o in out:
            assert o.online or o.start is None or o.start >= o.patient.arrival


def test_no_one_seen_by_a_doctor_off_shift():
    # ENT works 08:00-12:00: nobody arriving after 12:00 should be queued for ENT
    patients = [p for p in generate_patients(CFG, 2) if p.dept == "ENT" and p.arrival > 240]
    out = simulate(CFG, patients, PIQ, 2)
    assert all(o.start is None or o.online for o in out)


def test_priority_helps_orange_patients():
    cfg = replace(CFG, level_mix={2: 0.2, 4: 0.8})
    fcfs, prio = [], []
    for s in range(1, 11):
        patients = generate_patients(cfg, s)
        fcfs.append(summarize(simulate(cfg, patients, Features(pre_screen=True), s))["meanWaitByLevel"][2])
        prio.append(summarize(simulate(cfg, patients, Features(pre_screen=True, priority_aging=True), s))["meanWaitByLevel"][2])
    assert sum(prio) < sum(fcfs)


def test_full_piq_waits_less_than_baseline():
    base, piq = [], []
    for s in range(1, 11):
        patients = generate_patients(CFG, s)
        base.append(summarize(simulate(CFG, patients, BASELINE, s))["meanWait"])
        piq.append(summarize(simulate(CFG, patients, PIQ, s))["meanWait"])
    assert sum(piq) < sum(base)
