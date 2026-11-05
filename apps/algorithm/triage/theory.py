import math


def utilization(arrivals_per_hour: float, service_minutes: float, servers: int) -> float:
    return arrivals_per_hour * service_minutes / 60 / servers


def erlang_c(servers: int, offered_load: float) -> float:
    c, a = servers, offered_load
    if a >= c:
        return 1.0
    top = a ** c / math.factorial(c) * c / (c - a)
    return top / (sum(a ** k / math.factorial(k) for k in range(c)) + top)


def mmc_wait(arrivals_per_hour: float, service_minutes: float, servers: int) -> float:
    lam = arrivals_per_hour / 60
    mu = 1 / service_minutes
    if lam >= servers * mu:
        return math.inf
    return erlang_c(servers, lam / mu) / (servers * mu - lam)


def mgc_wait(arrivals_per_hour: float, service_minutes: float, service_sd: float, servers: int) -> float:
    cs2 = (service_sd / service_minutes) ** 2
    return mmc_wait(arrivals_per_hour, service_minutes, servers) * (1 + cs2) / 2


def little_queue_length(arrivals_per_hour: float, wait_minutes: float) -> float:
    return arrivals_per_hour / 60 * wait_minutes


def arrivals_for_utilization(rho: float, service_minutes: float, servers: int) -> float:
    return rho * servers * 60 / service_minutes
