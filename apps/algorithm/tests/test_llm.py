import json

import httpx

from scripts.compare_methods import compare_methods
from tests.helpers import MORNING, answer, inp, repo
from triage.llm import LLMExtractor, NoLLM, extractor_from_env, gemini_call, parse_codes, system_prompt
from triage.models import SymptomCode
from triage.pipeline import triage

CATALOG = [SymptomCode(code="fever", label="มีไข้", synonyms=["ตัวร้อน"],
                       department_weights={}, is_red_flag=False, onsite_only=False, priority_hint=None)]


def test_prompt_lists_every_code_and_forbids_medical_decisions():
    prompt = system_prompt(CATALOG)
    assert "fever" in prompt and "ตัวร้อน" in prompt
    assert "ห้ามระบุชื่อโรค การวินิจฉัย แผนก หรือระดับความเร่งด่วน" in prompt


def test_reply_must_be_a_codes_object():
    assert parse_codes('{"codes": ["fever"]}') == ["fever"]
    for bad in ('["fever"]', '{"department": "MED"}', '{"codes": "fever"}', '{"codes": [1]}', "ตัวร้อน"):
        try:
            parse_codes(bad)
        except ValueError:
            continue
        raise AssertionError(bad)


def test_retries_once_then_succeeds():
    calls = []

    def flaky(system, text):
        calls.append(text)
        if len(calls) == 1:
            raise TimeoutError
        return '{"codes": ["fever"]}'

    assert LLMExtractor(flaky).extract("ตัวร้อน", CATALOG) == (["fever"], "ok")
    assert len(calls) == 2


def test_gives_up_after_the_retry_without_raising():
    calls = []

    def down(system, text):
        calls.append(text)
        raise ConnectionError

    assert LLMExtractor(down).extract("ตัวร้อน", CATALOG) == ([], "failed")
    assert len(calls) == 2


def test_unparseable_reply_counts_as_failed():
    assert LLMExtractor(lambda s, t: "น่าจะเป็นไข้").extract("ตัวร้อน", CATALOG) == ([], "failed")


def test_pipeline_uses_the_extractor_and_drops_codes_outside_the_catalog():
    r = repo()
    extractor = LLMExtractor(lambda s, t: '{"codes": ["dyspnea_severe", "made_up"]}')
    res = triage(inp(answer(r, 1, "18-59 ปี"), answer(r, 2, "ไม่มีอาการเหล่านี้"), free_text="หายใจไม่ทัน"),
                 r, MORNING, extractor)
    assert res.is_red_flag and res.llm_codes == ["dyspnea_severe"] and res.llm_status == "ok"


def test_gemini_call_sends_key_in_a_header_and_joins_the_reply(monkeypatch):
    seen = {}

    def fake_post(url, headers, json, timeout):
        seen.update(url=url, headers=headers, body=json, timeout=timeout)
        return httpx.Response(
            200, request=httpx.Request("POST", url),
            json={"candidates": [{"content": {"parts": [{"text": '{"codes":'}, {"text": ' ["fever"]}'}]}}]},
        )

    monkeypatch.setattr(httpx, "post", fake_post)
    assert gemini_call("secret", "some-model")("system", "ตัวร้อน") == '{"codes": ["fever"]}'
    assert "secret" not in seen["url"] and "some-model" in seen["url"]
    assert seen["headers"] == {"x-goog-api-key": "secret"} and seen["timeout"] == 5.0
    assert seen["body"]["generationConfig"]["temperature"] == 0


def test_http_error_becomes_failed_status(monkeypatch):
    def rate_limited(url, headers, json, timeout):
        return httpx.Response(429, request=httpx.Request("POST", url))

    monkeypatch.setattr(httpx, "post", rate_limited)
    assert LLMExtractor(gemini_call("k", "m")).extract("ตัวร้อน", CATALOG) == ([], "failed")


def test_no_key_means_rule_only(monkeypatch):
    monkeypatch.delenv("LLM_API_KEY", raising=False)
    assert isinstance(extractor_from_env(), NoLLM)


def test_compare_methods_scores_all_three_and_counts_failures():
    def fake(system, text):
        if "ตัวแปลงข้อความอาการ" in system:
            return '{"codes": []}'
        if "หายใจไม่ทัน" in text:
            raise TimeoutError
        return json.dumps({"department": "MED", "priorityLevel": 4, "isRedFlag": False})

    out = compare_methods(fake, runs=2, delay=0, backoff=0)
    assert out["runsFinished"] == 2 and not out["stoppedEarly"] and out["llmOnly"]["failedCalls"] == 2
    assert out["ruleOnly"]["departmentAccuracy"] == out["hybrid"]["departmentAccuracy"]
    assert out["llmOnly"]["casesScored"] == out["ruleOnly"]["casesScored"] - 1
    assert out["llmOnly"]["consistentAcrossRuns"] == 1.0


def test_compare_methods_retries_a_busy_provider_and_stops_when_it_stays_down():
    attempts = {"n": 0}

    def busy_once_per_call(system, text):
        attempts["n"] += 1
        if attempts["n"] % 2:
            raise ConnectionError
        return '{"codes": []}' if "ตัวแปลงข้อความอาการ" in system else '{"department": "MED", "priorityLevel": 4, "isRedFlag": false}'

    out = compare_methods(busy_once_per_call, runs=1, delay=0, backoff=0)
    assert out["llmOnly"]["failedCalls"] == 0 and out["hybrid"]["failedCalls"] == 0

    def down(system, text):
        raise ConnectionError

    try:
        compare_methods(down, runs=2, delay=0, backoff=0)
    except SystemExit:
        return
    raise AssertionError("should stop when no run can finish")
