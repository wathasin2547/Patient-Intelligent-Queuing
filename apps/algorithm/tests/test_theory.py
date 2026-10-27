import math

from triage.theory import (
    arrivals_for_utilization,
    erlang_c,
    little_queue_length,
    mgc_wait,
    mmc_wait,
    utilization,
)


def test_single_server_matches_mm1():
    # M/M/1: Wq = rho / (mu - lambda); lambda = 3/h, service 15 min -> rho 0.75, Wq = 45 min
    assert math.isclose(mmc_wait(3, 15, 1), 45.0)
    assert math.isclose(erlang_c(1, 0.75), 0.75)


def test_erlang_c_textbook_value():
    # c = 2, a = 1: C = 1/3, Wq = C / (c*mu - lambda) = (1/3) / (2 - 1) per service time
    assert math.isclose(erlang_c(2, 1.0), 1 / 3)
    assert math.isclose(mmc_wait(6, 10, 2), 10 / 3)


def test_unstable_queue_waits_forever():
    assert mmc_wait(10, 12, 2) == math.inf


def test_more_doctors_less_wait():
    waits = [mmc_wait(6.1, 18.7, c) for c in range(2, 9)]
    assert waits == sorted(waits, reverse=True)


def test_constant_service_halves_mm_wait():
    assert math.isclose(mgc_wait(6, 10, 0, 2), mmc_wait(6, 10, 2) / 2)


def test_utilization_round_trip_and_little():
    lam = arrivals_for_utilization(0.85, 18.7, 2)
    assert math.isclose(utilization(lam, 18.7, 2), 0.85)
    assert math.isclose(little_queue_length(6, 30), 3.0)
