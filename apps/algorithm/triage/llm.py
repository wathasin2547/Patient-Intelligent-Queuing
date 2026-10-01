"""Free text -> symptomCode[] via the LLM (thesis §3.4.4, SPEC.md §4). Real client comes in phase 5.

The LLM only maps text to codes. It must not choose a department, a priority or a disease.
The pipeline filters every returned code against the catalog before using it.
"""

from typing import Protocol

from .models import SymptomCode


class SymptomExtractor(Protocol):
    def extract(self, text: str, catalog: list[SymptomCode]) -> tuple[list[str], str]:
        """Return (codes, status) where status is "ok" or "failed". Must not raise."""
        ...


class NoLLM:
    """Used until the LLM is wired up, and for the rule-only baseline in experiment 3."""

    def extract(self, text: str, catalog: list[SymptomCode]) -> tuple[list[str], str]:
        return [], "skipped"
