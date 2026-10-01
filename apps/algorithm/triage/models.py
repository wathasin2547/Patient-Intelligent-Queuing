"""Plain data types used by the triage rules. Field names follow SPEC.md §2."""

from dataclasses import dataclass, field
from datetime import datetime


@dataclass(frozen=True)
class SymptomCode:
    code: str
    label: str
    synonyms: list[str]
    department_weights: dict[str, float]  # departmentId -> weight
    is_red_flag: bool = False
    onsite_only: bool = False
    priority_hint: int | None = None


@dataclass(frozen=True)
class Option:
    label: str
    symptom_code: str | None


@dataclass(frozen=True)
class Question:
    id: str
    question_text: str
    group: str
    order: int
    options: list[Option]


@dataclass(frozen=True)
class Shift:
    doctor_id: str
    department_id: str
    start_time: datetime
    end_time: datetime


@dataclass(frozen=True)
class WaitingQueue:
    id: str
    department_id: str
    doctor_id: str | None
    priority_level: int
    check_in_time: datetime


@dataclass(frozen=True)
class ClosedAnswer:
    question_id: str
    option_index: int


@dataclass
class TriageInput:
    closed_answers: list[ClosedAnswer]
    free_text: str | None = None
    is_chronic_follow_up: bool = False
    symptom_changed: bool | None = None


@dataclass
class ReasonItem:
    code: str
    weight: float
    department: str


@dataclass
class TriageResult:
    symptom_codes: list[str]
    llm_codes: list[str]
    llm_status: str  # "ok" | "skipped" | "failed"
    is_red_flag: bool
    red_flag_codes: list[str]
    department_scores: dict[str, float]
    assigned_department: str | None
    priority_level: int
    online_eligible: bool
    reason: list[ReasonItem]
    # Shift check and doctor assignment (report §3.4 steps 9-10)
    doctor_id: str | None = None
    queue_score: float | None = None
    no_doctor_on_shift: bool = False
    next_shift_start: datetime | None = None
    warnings: list[str] = field(default_factory=list)
