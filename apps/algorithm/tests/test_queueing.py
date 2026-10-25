import pytest

from tests.helpers import MORNING, queue
from triage.config import DEFAULT_ALPHA, DEFAULT_BASE_SCORES
from triage.queueing import pick_next, priority_score, rank_queues

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
