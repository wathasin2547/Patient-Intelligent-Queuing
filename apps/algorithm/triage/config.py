"""Tunable queue parameters (SPEC.md §5). Real values come from the aging experiment in chapter 4."""

import json
import os

# Base score per priority level. Level 1 never enters the queue (sent to emergency).
DEFAULT_BASE_SCORES: dict[int, float] = {2: 1000, 3: 600, 4: 300, 5: 200}
DEFAULT_ALPHA = 2.0


def base_scores() -> dict[int, float]:
    raw = os.getenv("QUEUE_BASE_SCORES")
    if not raw:
        return dict(DEFAULT_BASE_SCORES)
    return {int(k): float(v) for k, v in json.loads(raw).items()}


def alpha() -> float:
    return float(os.getenv("QUEUE_ALPHA", DEFAULT_ALPHA))
