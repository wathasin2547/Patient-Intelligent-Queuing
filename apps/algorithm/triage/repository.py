"""Read-only data access. The algorithm service never writes: Next.js saves screenings and queues.

MongoRepository reads the collections Prisma created (collection name = model name).
CatalogRepository serves code/data/catalog.json for tests and offline evaluation,
so vignette runs use the same catalog that `npm run db:seed` puts in the DB.
"""

import json
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Protocol

from pymongo import MongoClient

from .models import Option, Question, Shift, SymptomCode, WaitingQueue

CATALOG_PATH = Path(__file__).resolve().parents[3] / "data" / "catalog.json"
BANGKOK = timezone(timedelta(hours=7))


class Repository(Protocol):
    def symptom_codes(self) -> dict[str, SymptomCode]: ...
    def questions(self) -> dict[str, Question]: ...
    def shifts(self) -> list[Shift]: ...
    def waiting_queues(self) -> list[WaitingQueue]: ...


def _options(raw: list[dict]) -> list[Option]:
    return [Option(label=o["label"], symptom_code=o.get("symptomCode")) for o in raw]


class MongoRepository:
    def __init__(self, url: str):
        self.client = MongoClient(url, tz_aware=True)
        self.db = self.client.get_default_database()

    def symptom_codes(self) -> dict[str, SymptomCode]:
        out = {}
        for d in self.db["SymptomCode"].find({"isActive": True}):
            out[d["code"]] = SymptomCode(
                code=d["code"],
                label=d["label"],
                synonyms=d.get("synonyms", []),
                department_weights={str(k): float(v) for k, v in (d.get("departmentWeights") or {}).items()},
                is_red_flag=d.get("isRedFlag", False),
                onsite_only=d.get("onsiteOnly", False),
                priority_hint=d.get("priorityHint"),
            )
        return out

    def questions(self) -> dict[str, Question]:
        out = {}
        for d in self.db["Question"].find({"isActive": True}):
            qid = str(d["_id"])
            out[qid] = Question(qid, d["questionText"], d["group"], d["order"], _options(d["options"]))
        return out

    def shifts(self) -> list[Shift]:
        dept_of = {d["_id"]: str(d["departmentId"]) for d in self.db["Doctor"].find()}
        out = []
        for s in self.db["Shift"].find({"status": "ACTIVE"}):
            if s["doctorId"] in dept_of:
                out.append(Shift(str(s["doctorId"]), dept_of[s["doctorId"]], s["startTime"], s["endTime"]))
        return out

    def waiting_queues(self) -> list[WaitingQueue]:
        return [
            WaitingQueue(
                id=str(q["_id"]),
                department_id=str(q["departmentId"]),
                doctor_id=str(q["doctorId"]) if q.get("doctorId") else None,
                priority_level=q["priorityLevel"],
                check_in_time=q["checkInTime"],
            )
            for q in self.db["Queue"].find({"status": "WAITING"})
        ]

    def ping(self) -> None:
        self.client.admin.command("ping")


class CatalogRepository:
    """In-memory repository built from catalog.json.

    IDs are readable: departments use their key ("MED"), questions use "q<order>",
    doctors use "<DEPT>-<n>". Shifts start on the day of `day` (Bangkok time), like the seed.
    """

    SHIFT_DAYS = 7

    def __init__(
        self,
        day: datetime | None = None,
        waiting: list[WaitingQueue] | None = None,
        path: Path = CATALOG_PATH,
    ):
        self.data = json.loads(path.read_text(encoding="utf-8"))
        self.day = (day or datetime.now(timezone.utc)).astimezone(BANGKOK)
        self._waiting = waiting or []

    def symptom_codes(self) -> dict[str, SymptomCode]:
        return {
            s["code"]: SymptomCode(
                code=s["code"],
                label=s["label"],
                synonyms=s["synonyms"],
                department_weights={k: float(v) for k, v in s["weights"].items()},
                is_red_flag=s.get("isRedFlag", False),
                onsite_only=s.get("onsiteOnly", False),
                priority_hint=s.get("priorityHint"),
            )
            for s in self.data["symptomCodes"]
        }

    def questions(self) -> dict[str, Question]:
        return {
            f"q{q['order']}": Question(f"q{q['order']}", q["questionText"], q["group"], q["order"],
                                       _options(q["options"]))
            for q in self.data["questions"]
        }

    def shifts(self) -> list[Shift]:
        out, count = [], {}
        start_day = self.day.replace(hour=0, minute=0, second=0, microsecond=0)
        for d in self.data["doctors"]:
            count[d["dept"]] = count.get(d["dept"], 0) + 1
            for i in range(self.SHIFT_DAYS):
                day = start_day + timedelta(days=i)
                out.append(Shift(
                    doctor_id=f"{d['dept']}-{count[d['dept']]}",
                    department_id=d["dept"],
                    start_time=day.replace(hour=d["startHour"]).astimezone(timezone.utc),
                    end_time=day.replace(hour=d["endHour"]).astimezone(timezone.utc),
                ))
        return out

    def waiting_queues(self) -> list[WaitingQueue]:
        return list(self._waiting)
