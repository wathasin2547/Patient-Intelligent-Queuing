"""Queue ordering with aging: P = B[level] + alpha * waitingMinutes (SPEC.md §5).

P is computed on demand whenever the system auto-calls the next patient; it is never stored.
"""
