from dataclasses import replace

import pytest

from tests.helpers import MORNING, queue
from triage.config import DEFAULT_ALPHA, DEFAULT_BASE_SCORES
from triage.queueing import NO_BONUS, RiskBonus, max_safe_bonus, pick_next, priority_score, rank_queues

B, A = DEFAULT_BASE_SCORES, DEFAULT_ALPHA


def test_formula():
    assert priority_score(4, 30, B, A) == 300 + 2.0 * 30


def test_higher_level_called_first_when_both_just_arrived():
    nxt = pick_next([queue("green", 4, 1), queue("yellow", 3, 0)], MORNING, B, A)
    assert nxt.queue.id == "yellow"


def test_aging_lets_a_long_waiting_green_overtake_yellow():
    # gap B[3] - B[4] = 300 points; alpha 2/min -> green needs 150 more minutes than yellow
    assert pick_next([queue("green", 4, 149), queue("yellow", 3, 0)], MORNING, B, A).queue.id == "yellow"
    assert pick_next([queue("green", 4, 151), queue("yellow", 3, 0)], MORNING, B, A).queue.id == "green"


def test_equal_score_goes_to_earlier_check_in():
    ranked = rank_queues([queue("late", 4, 10), queue("early", 4, 10.0001)], MORNING, B, 0.0)
    assert [r.queue.id for r in ranked] == ["early", "late"]


def test_empty_queue():
    assert pick_next([], MORNING, B, A) is None


def test_patient_busy_in_another_queue_is_skipped_but_keeps_the_place():
    line = [queue("held", 3, 30, patient="pt-1"), queue("next", 4, 5, patient="pt-2")]
    assert pick_next(line, MORNING, B, A, busy_patients={"pt-1"}).queue.id == "next"
    # once the other exam is over the held patient is first again (W kept counting)
    assert pick_next(line, MORNING, B, A).queue.id == "held"


def test_everyone_busy_means_nobody_is_called():
    assert pick_next([queue("a", 4, 10, patient="pt-1")], MORNING, B, A, busy_patients={"pt-1"}) is None


def test_red_never_enters_queue():
    with pytest.raises(ValueError):
        priority_score(1, 0, B, A)


# ---- D_j: head start for older age and chronic disease (defaults 30 + 20 minutes)

def test_risk_minutes_are_added_to_waiting_time():
    assert priority_score(4, 10, B, A, bonus=30) == 300 + 2.0 * (10 + 30)
    elderly_chronic = replace(queue("a", 4, 0), age_group="60+", is_chronic=True)
    assert RiskBonus().minutes(elderly_chronic) == 45
    assert RiskBonus().minutes(queue("b", 4, 0)) == 0


def test_elderly_goes_before_an_adult_who_came_a_little_earlier():
    adult = queue("adult", 4, 20)
    elderly = replace(queue("elderly", 4, 0), age_group="60+")
    assert pick_next([adult, elderly], MORNING, B, A).queue.id == "elderly"
    # without the bonus it is plain aging: whoever waited longer
    assert pick_next([adult, elderly], MORNING, B, A, risk=NO_BONUS).queue.id == "adult"


def test_head_start_never_jumps_a_whole_urgency_level():
    # 45 minutes of head start is far less than the 150 minutes between green and yellow
    risky_green = replace(queue("green", 4, 0), age_group="60+", is_chronic=True)
    assert pick_next([risky_green, queue("yellow", 3, 0)], MORNING, B, A).queue.id == "yellow"


def test_head_start_stays_below_the_narrowest_gap():
    # white -> green is only 100 points = 50 min at alpha 2; with 30 + 20 a risky white tied a new green
    assert RiskBonus().max_minutes < max_safe_bonus(B, A)
    risky_white = replace(queue("white", 5, 0), age_group="60+", is_chronic=True)
    ranked = rank_queues([risky_white, queue("green", 4, 0)], MORNING, B, A)
    assert ranked[0].queue.id == "green" and ranked[0].score > ranked[1].score


def test_age_groups_come_from_the_settings():
    child = replace(queue("child", 4, 0), age_group="0-5")
    assert RiskBonus().minutes(child) == 0
    assert RiskBonus(age_groups=frozenset({"0-5", "60+"})).minutes(child) == 30
