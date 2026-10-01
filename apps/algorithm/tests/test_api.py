from fastapi.testclient import TestClient

from main import app, get_now, get_repo
from tests.helpers import MORNING, queue, repo

client = TestClient(app)


def setup_module():
    waiting = [
        queue("q-green-old", 4, 200, doctor="MED-1"),
        queue("q-yellow-new", 3, 5, doctor="MED-1"),
        queue("q-other-doctor", 2, 1, doctor="MED-2"),
    ]
    app.dependency_overrides[get_repo] = lambda: repo(MORNING, waiting)
    app.dependency_overrides[get_now] = lambda: MORNING


def teardown_module():
    app.dependency_overrides.clear()


def test_health():
    assert client.get("/health").json() == {"status": "ok"}


def test_triage_matches_spec_shape():
    res = client.post("/triage", json={
        "patientId": "p1",
        "closedAnswers": [
            {"questionId": "q1", "optionIndex": 2},   # 18-59
            {"questionId": "q2", "optionIndex": 7},   # no red flag
            {"questionId": "q3", "optionIndex": 1},   # cough
        ],
        "freeText": "",
    })
    assert res.status_code == 200
    body = res.json()
    assert body["assignedDepartment"] == "MED"
    assert body["priorityLevel"] == 4
    assert body["llmStatus"] == "skipped"
    assert body["reason"][0]["code"] == "cough"
    assert body["doctorId"] == "MED-2"  # MED-1 already has two waiting


def test_queue_next_uses_aging():
    body = client.post("/queue/next", json={"doctorId": "MED-1"}).json()
    # green waited 200 min: 300 + 400 = 700 > yellow 600 + 10
    assert body["next"]["queueId"] == "q-green-old"
    assert [r["queueId"] for r in body["ranking"]] == ["q-green-old", "q-yellow-new"]
