"""Closed-form queueing formulas (thesis §2 queueing theory, §3 data analysis).

Used to read the Kaggle dataset through theory, to choose the load levels of the simulation, and to
check that the simulator agrees with M/M/c before trusting its other results.
"""

import math


def utilization(arrivals_per_hour: float, service_minutes: float, servers: int) -> float:
    """rho = lambda / (c * mu). The queue only settles when rho < 1."""
    return arrivals_per_hour * service_minutes / 60 / servers


def erlang_c(servers: int, offered_load: float) -> float:
    """Probability that an arriving customer has to wait in M/M/c (offered_load a = lambda / mu)."""
    c, a = servers, offered_load
    if a >= c:
        return 1.0
    top = a ** c / math.factorial(c) * c / (c - a)
    return top / (sum(a ** k / math.factorial(k) for k in range(c)) + top)


def mmc_wait(arrivals_per_hour: float, service_minutes: float, servers: int) -> float:
    """Mean wait in queue Wq (minutes) for M/M/c; inf when rho >= 1."""
    lam = arrivals_per_hour / 60
    mu = 1 / service_minutes
    if lam >= servers * mu:
        return math.inf
    return erlang_c(servers, lam / mu) / (servers * mu - lam)


def mgc_wait(arrivals_per_hour: float, service_minutes: float, service_sd: float, servers: int) -> float:
    """Allen-Cunneen approximation for M/G/c: Wq(M/M/c) * (1 + cs^2) / 2 with Poisson arrivals."""
    cs2 = (service_sd / service_minutes) ** 2
    return mmc_wait(arrivals_per_hour, service_minutes, servers) * (1 + cs2) / 2


def little_queue_length(arrivals_per_hour: float, wait_minutes: float) -> float:
    """Little's law Lq = lambda * Wq: mean number of people waiting."""
    return arrivals_per_hour / 60 * wait_minutes


def arrivals_for_utilization(rho: float, service_minutes: float, servers: int) -> float:
    """Inverse of utilization(): arrivals per hour that load `servers` to `rho`."""
    return rho * servers * 60 / service_minutes
