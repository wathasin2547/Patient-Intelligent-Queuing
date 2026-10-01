from tests.helpers import AFTERNOON, MORNING, answer, inp, queue, repo
from triage.pipeline import triage

ADULT = (1, "18-59 ปี")
NO_RED_FLAG = (2, "ไม่มีอาการเหล่านี้")


class SpyLLM:
    def __init__(self, codes=None, status="ok"):
        self.codes, self.status, self.calls = codes or [], status, 0

    def extract(self, text, catalog):
        self.calls += 1
        return self.codes, self.status


def run(*answers, now=MORNING, waiting=None, extractor=None, **kw):
    r = repo(now, waiting)
    return triage(inp(*(answer(r, o, l) for o, l in answers), **kw), r, now, extractor)


# ── red flag ──

def test_red_flag_stops_before_llm():
    llm = SpyLLM(["fever"])
    res = run(ADULT, (2, "เจ็บแน่นหน้าอกรุนแรง"), free_text="ไข้", extractor=llm)
    assert res.is_red_flag and res.priority_level == 1
    assert res.red_flag_codes == ["chest_pain_severe"]
    assert res.assigned_department is None and res.doctor_id is None
    assert llm.calls == 0  # CLAUDE.md rule 2


def test_red_flag_from_llm_escalates():
    res = run(ADULT, NO_RED_FLAG, (3, "ไอ"), free_text="หายใจไม่ทัน",
              extractor=SpyLLM(["dyspnea_severe"]))
    assert res.is_red_flag and res.llm_codes == ["dyspnea_severe"]


# ── LLM handling ──

def test_llm_codes_outside_catalog_are_dropped():
    res = run(ADULT, NO_RED_FLAG, (3, "ไอ"), free_text="ไอ เป็นปอดบวม",
              extractor=SpyLLM(["pneumonia", "fever"]))
    assert res.llm_codes == ["fever"]
    assert "pneumonia" not in res.symptom_codes


def test_llm_failure_falls_back_to_closed_answers():
    res = run(ADULT, NO_RED_FLAG, (3, "ไอ"), free_text="ไอมาก",
              extractor=SpyLLM([], status="failed"))
    assert res.llm_status == "failed"
    assert res.symptom_codes == ["cough"]
    assert res.assigned_department == "MED"


def test_no_free_text_skips_llm():
    llm = SpyLLM(["fever"])
    res = run(ADULT, NO_RED_FLAG, (3, "ไอ"), free_text="   ", extractor=llm)
    assert llm.calls == 0 and res.llm_status == "skipped"


# ── department + reason ──

def test_scoring_picks_highest_and_explains_why():
    # abdominal_pain_general MED 4 / SURG 2  +  abdominal_pain_rlq SURG 6 / MED 2
    res = run(ADULT, NO_RED_FLAG, (3, "ปวดท้อง"), (5, "ปวดท้องด้านขวาล่าง"))
    assert res.department_scores == {"MED": 6, "SURG": 8}
    assert res.assigned_department == "SURG"
    assert [r.code for r in res.reason] == ["abdominal_pain_rlq", "abdominal_pain_general"]


def test_age_moves_child_to_pediatrics():
    res = run((1, "0-5 ปี"), NO_RED_FLAG, (3, "มีไข้"))
    assert res.assigned_department == "PED"


def test_tie_goes_to_department_with_shorter_average_wait():
    # back_pain: MED 2 / SURG 2
    r = repo()
    from triage.rules import compute_department_scores, pick_department
    scores, _ = compute_department_scores(["back_pain"], r.symptom_codes())
    assert scores == {"MED": 2, "SURG": 2}
    waits = {"MED": 40, "SURG": 5}
    assert pick_department(scores, lambda t: min(t, key=waits.get)) == "SURG"


def test_nothing_scored_needs_staff():
    res = run(ADULT, NO_RED_FLAG)
    assert res.assigned_department is None and res.warnings
    assert not res.online_eligible  # unknown case must not be sent home


# ── priority + online ──

def test_priority_uses_most_urgent_hint():
    res = run(ADULT, NO_RED_FLAG, (3, "ปวดท้อง"), (5, "ปวดรุนแรงจนเดินไม่ไหว"))
    assert res.priority_level == 2


def test_plain_symptom_is_green_and_online_eligible():
    res = run(ADULT, NO_RED_FLAG, (3, "ผื่นคัน"))
    assert res.priority_level == 4 and res.online_eligible


def test_onsite_only_code_blocks_online():
    res = run(ADULT, NO_RED_FLAG, (3, "ปวดหู"))
    assert res.priority_level == 4 and not res.online_eligible


def test_stable_chronic_follow_up_is_white_and_online():
    res = run(ADULT, NO_RED_FLAG, (3, "มารับยาโรคประจำตัว"),
              is_chronic_follow_up=True, symptom_changed=False)
    assert res.priority_level == 5 and res.online_eligible


def test_changed_chronic_follow_up_must_come_onsite():
    res = run(ADULT, NO_RED_FLAG, (3, "มารับยาโรคประจำตัว"),
              is_chronic_follow_up=True, symptom_changed=True)
    assert res.priority_level == 4 and not res.online_eligible


# ── shift + doctor ──

def test_doctor_with_fewer_waiting_patients_gets_the_case():
    waiting = [queue("a", 4, 10, doctor="MED-1"), queue("b", 4, 5, doctor="MED-1")]
    res = run(ADULT, NO_RED_FLAG, (3, "ไอ"), waiting=waiting)
    assert res.doctor_id == "MED-2"
    assert res.queue_score == 300  # B[4] with W = 0


def test_no_doctor_on_shift_returns_next_round():
    res = run(ADULT, NO_RED_FLAG, (3, "ปวดหู"), now=AFTERNOON)
    assert res.assigned_department == "ENT"
    assert res.no_doctor_on_shift and res.doctor_id is None
    assert res.next_shift_start is not None and res.next_shift_start > AFTERNOON


def test_bad_answers_are_reported_not_crashing():
    r = repo()
    from triage.models import ClosedAnswer
    res = triage(inp(ClosedAnswer("nope", 0), ClosedAnswer("q3", 99)), r, MORNING)
    assert len(res.warnings) >= 2
