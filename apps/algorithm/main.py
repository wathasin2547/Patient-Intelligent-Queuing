"""PIQ algorithm service. Called only by the Next.js backend, never by LIFF directly.

Reads from MongoDB, never writes: Next.js saves the screening/queue and notifies the patient.
"""

import os
from datetime import datetime, timezone
from functools import lru_cache

from dotenv import load_dotenv
from fastapi import Depends, FastAPI
from fastapi.responses import RedirectResponse
from pydantic import BaseModel, Field

from triage import config
from triage.models import ClosedAnswer, TriageInput
from triage.pipeline import triage
from triage.queueing import rank_queues
from triage.repository import MongoRepository, Repository

load_dotenv()

app = FastAPI(title="PIQ Algorithm Service")


@lru_cache
def get_repo() -> Repository:
    url = os.getenv("DATABASE_URL")
    if not url:
        raise RuntimeError("DATABASE_URL is not set (copy .env.example to .env)")
    return MongoRepository(url)


def get_now() -> datetime:
    return datetime.now(timezone.utc)


# ── request / response bodies (camelCase to match SPEC.md §3.1) ──

class ClosedAnswerIn(BaseModel):
    questionId: str
    optionIndex: int


class TriageRequest(BaseModel):
    patientId: str | None = None
    closedAnswers: list[ClosedAnswerIn] = Field(default_factory=list)
    freeText: str | None = None
    isChronicFollowUp: bool = False
    symptomChanged: bool | None = None


class ReasonOut(BaseModel):
    code: str
    weight: float
    department: str


class TriageResponse(BaseModel):
    symptomCodes: list[str]
    llmCodes: list[str]
    llmStatus: str
    isRedFlag: bool
    redFlagCodes: list[str]
    departmentScores: dict[str, float]
    assignedDepartment: str | None
    priorityLevel: int
    onlineEligible: bool
    reason: list[ReasonOut]
    doctorId: str | None
    queueScore: float | None
    noDoctorOnShift: bool
    nextShiftStart: datetime | None
    warnings: list[str]


class NextQueueRequest(BaseModel):
    doctorId: str


class RankedOut(BaseModel):
    queueId: str
    priorityLevel: int
    waitingMinutes: float
    score: float


class NextQueueResponse(BaseModel):
    next: RankedOut | None
    ranking: list[RankedOut]


@app.get("/", include_in_schema=False)
def root() -> RedirectResponse:
    return RedirectResponse("/docs")


@app.get("/health")
def health() -> dict:
    return {"status": "ok"}


@app.post("/triage", response_model=TriageResponse)
def triage_endpoint(
    body: TriageRequest,
    repo: Repository = Depends(get_repo),
    now: datetime = Depends(get_now),
) -> TriageResponse:
    r = triage(
        TriageInput(
            closed_answers=[ClosedAnswer(a.questionId, a.optionIndex) for a in body.closedAnswers],
            free_text=body.freeText,
            is_chronic_follow_up=body.isChronicFollowUp,
            symptom_changed=body.symptomChanged,
        ),
        repo,
        now,
    )
    return TriageResponse(
        symptomCodes=r.symptom_codes,
        llmCodes=r.llm_codes,
        llmStatus=r.llm_status,
        isRedFlag=r.is_red_flag,
        redFlagCodes=r.red_flag_codes,
        departmentScores=r.department_scores,
        assignedDepartment=r.assigned_department,
        priorityLevel=r.priority_level,
        onlineEligible=r.online_eligible,
        reason=[ReasonOut(code=i.code, weight=i.weight, department=i.department) for i in r.reason],
        doctorId=r.doctor_id,
        queueScore=r.queue_score,
        noDoctorOnShift=r.no_doctor_on_shift,
        nextShiftStart=r.next_shift_start,
        warnings=r.warnings,
    )


@app.post("/queue/next", response_model=NextQueueResponse)
def next_queue(
    body: NextQueueRequest,
    repo: Repository = Depends(get_repo),
    now: datetime = Depends(get_now),
) -> NextQueueResponse:
    """UC10 auto-call: Next.js calls this after a doctor marks DONE / NO_SHOW,
    then sets the returned queue to CALLED and pushes the LINE message."""
    mine = [q for q in repo.waiting_queues() if q.doctor_id == body.doctorId]
    ranked = [
        RankedOut(queueId=r.queue.id, priorityLevel=r.queue.priority_level,
                  waitingMinutes=round(r.waiting_minutes, 1), score=round(r.score, 1))
        for r in rank_queues(mine, now, config.base_scores(), config.alpha())
    ]
    return NextQueueResponse(next=ranked[0] if ranked else None, ranking=ranked)
