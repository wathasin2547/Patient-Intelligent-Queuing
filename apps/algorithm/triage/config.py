"""Tunable queue parameters (SPEC.md §5). Real values come from the aging experiment in chapter 4."""

import json
import os

# Base score per priority level. Level 1 never enters the queue (sent to emergency).
DEFAULT_BASE_SCORES: dict[int, float] = {2: 1000, 3: 600, 4: 300, 5: 200}
DEFAULT_ALPHA = 2.0
# Head start (minutes of waiting) for patients more likely to deteriorate while waiting.
# Older age and comorbidity raise 30-day mortality of ED patients (Aguirre et al. 2024).
# The live values are in SystemSetting so the admin can change them.
DEFAULT_AGE_BONUS_MINUTES = 30.0
DEFAULT_CHRONIC_BONUS_MINUTES = 15.0
# 30 + 15 = 45 min < 50 min, the narrowest level gap at alpha 2 (white 200 -> green 300).
# With 20 the total hit 50 and a white patient with both factors tied a new green one.
DEFAULT_PRIORITY_AGE_GROUPS: tuple[str, ...] = ("60+",)
# Appointments due within this window count as doctor load (same as LOAD_WINDOW_MINUTES in the web app).
LOAD_WINDOW_MINUTES = 60


def base_scores() -> dict[int, float]:
    raw = os.getenv("QUEUE_BASE_SCORES")
    if not raw:
        return dict(DEFAULT_BASE_SCORES)
    return {int(k): float(v) for k, v in json.loads(raw).items()}


def alpha() -> float:
    return float(os.getenv("QUEUE_ALPHA", DEFAULT_ALPHA))
