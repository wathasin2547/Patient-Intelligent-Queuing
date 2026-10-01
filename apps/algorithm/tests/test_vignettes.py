"""Safety checks over the vignette set.

Accuracy is NOT asserted here on purpose: the expected answers are written independently
of the weights, and the accuracy figure is a result for chapter 4, not a test target.
Run `python -m scripts.evaluate_vignettes` to see it.
"""

from tests.helpers import MORNING
from triage.evaluation import load_vignettes, run_vignettes, summarize


def test_every_vignette_matches_the_questionnaire():
    assert len(run_vignettes(MORNING)) == len(load_vignettes())


def test_red_flags_ticked_in_closed_answers_are_always_caught():
    for x in run_vignettes(MORNING):
        ticked = any(order == 2 and label != "ไม่มีอาการเหล่านี้"
                     for order, label in next(c for c in load_vignettes() if c["id"] == x.id)["answers"])
        if ticked:
            assert x.result.is_red_flag, x.id


def test_red_flag_and_unassigned_cases_are_never_offered_online():
    for x in run_vignettes(MORNING):
        if x.result.is_red_flag or x.result.assigned_department is None:
            assert not x.result.online_eligible, x.id


def test_summary_runs():
    s = summarize(run_vignettes(MORNING))
    assert s["cases"] == len(load_vignettes())
