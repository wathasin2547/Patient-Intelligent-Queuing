"""Rule-based triage: red flag check, department scoring and priority level (SPEC.md §3).

Red flags must be checked before anything else and must never call the LLM.
Weights, red flags and onsite-only flags are read from the DB, never hardcoded.
"""
