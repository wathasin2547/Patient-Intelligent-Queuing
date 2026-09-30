"""PIQ algorithm service. Called only by the Next.js backend, never by LIFF directly."""

from fastapi import FastAPI

app = FastAPI(title="PIQ Algorithm Service")


@app.get("/health")
def health() -> dict:
    return {"status": "ok"}


# POST /triage is added in phase 2 (see SPEC.md §3).
