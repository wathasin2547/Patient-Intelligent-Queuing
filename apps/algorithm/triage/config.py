import json
import os

DEFAULT_BASE_SCORES: dict[int, float] = {2: 1000, 3: 600, 4: 300, 5: 200}
DEFAULT_ALPHA = 2.0
DEFAULT_AGE_BONUS_MINUTES = 30.0
DEFAULT_CHRONIC_BONUS_MINUTES = 15.0
DEFAULT_PRIORITY_AGE_GROUPS: tuple[str, ...] = ("60+",)
LOAD_WINDOW_MINUTES = 60
FALLBACK_DEPARTMENT_CODE = "GEN"


def base_scores() -> dict[int, float]:
    raw = os.getenv("QUEUE_BASE_SCORES")
    if not raw:
        return dict(DEFAULT_BASE_SCORES)
    return {int(k): float(v) for k, v in json.loads(raw).items()}


def alpha() -> float:
    return float(os.getenv("QUEUE_ALPHA", DEFAULT_ALPHA))
