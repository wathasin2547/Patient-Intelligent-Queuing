// Scenario checks for multi-queue patients (one patient, several departments).
// Run: npx tsx scripts/check-multi-queue.ts  — exits non-zero if a rule is broken.

import assert from "node:assert/strict";
import { referQueue } from "../lib/mock/actions";
import { estimateCallTime, queueLimitError, runAutoCall } from "../lib/mock/logic";
import { buildSeed } from "../lib/mock/seed";
import type { MockState, Queue } from "../lib/mock/types";

const base = buildSeed(Date.now());
const now = Date.now() + base.clockOffsetMs;
const set = (s: MockState, id: string, patch: Partial<Queue>): MockState => ({ ...s, queues: s.queues.map((q) => (q.id === id ? { ...q, ...patch } : q)) });
const get = (s: MockState, id: string) => s.queues.find((q) => q.id === id)!;

const pt01 = base.queues.filter((q) => q.patientId === "pt_01" && q.status === "WAITING");
const med = pt01.find((q) => q.departmentId === "dept_MED")!;
const ent = pt01.find((q) => q.departmentId === "dept_ENT")!;
assert.ok(med && ent, "seed: pt_01 waits for MED and ENT");

/** Leave only the given waiting queues for the two doctors, both doctors free. */
function isolate(s: MockState, keep: string[]): MockState {
  const doctors = new Set([med.doctorId, ent.doctorId]);
  return {
    ...s,
    queues: s.queues.map((q) =>
      doctors.has(q.doctorId) && q.status !== "DONE" && !keep.includes(q.id) ? { ...q, status: "CANCELLED" as const } : q,
    ),
  };
}

// 1. collision: both doctors free, pt_01 first in both lines → called once; appointment (MED) wins
{
  const s = runAutoCall(isolate(base, [med.id, ent.id]), now);
  assert.equal(get(s, med.id).status, "CALLED");
  assert.equal(get(s, ent.id).status, "WAITING", "never called by two doctors at once");
  console.log("ok  collision → one call, appointment queue first");
}

// 2. hold: pt_01 is in the ENT room, MED doctor frees up → skips pt_01, calls the next patient
{
  const other = base.queues.find((q) => q.doctorId === med.doctorId && q.status === "WAITING" && q.patientId !== "pt_01")!;
  let s = isolate(base, [med.id, ent.id, other.id]);
  s = set(s, ent.id, { status: "IN_PROGRESS", calledTime: new Date(now).toISOString() });
  s = set(s, other.id, { priorityLevel: 5, checkInTime: new Date(now).toISOString() }); // ranked below pt_01
  s = runAutoCall(s, now);
  assert.equal(get(s, other.id).status, "CALLED", "doctor is not left idle");
  assert.equal(get(s, med.id).status, "WAITING", "pt_01 keeps the place");
  assert.ok(s.callEvents.some((e) => e.kind === "HOLD" && e.queueId === med.id), "HOLD recorded");
  assert.ok(estimateCallTime(s, get(s, med.id), now)! > now, "ETA waits for the ENT exam");

  // ENT exam ends, MED finishes the other patient → pt_01 is called next (nobody was pushed back)
  s = set(s, ent.id, { status: "DONE", finishedTime: new Date(now).toISOString() });
  s = set(s, other.id, { status: "DONE", finishedTime: new Date(now).toISOString() });
  s = runAutoCall(s, now);
  assert.equal(get(s, med.id).status, "CALLED");
  console.log("ok  hold → next patient called, held patient returns at the next free slot");
}

// 3. limits and referral: one queue per department, at most N; referral waits from now
{
  assert.equal(queueLimitError(base, "pt_01", "dept_MED"), "ผู้ป่วยมีคิวแผนกนี้อยู่แล้ว");
  const r = referQueue(base, now, { fromQueueId: med.id, departmentId: "dept_SURG", priorityLevel: 4 });
  assert.ok(!r.error, r.error);
  const created = r.state.queues.at(-1)!;
  assert.equal(created.referredFromQueueId, med.id);
  assert.equal(new Date(created.checkInTime).getTime(), now, "no head start over people already waiting");
  assert.match(queueLimitError(r.state, "pt_01", "dept_PED") ?? "", /สูงสุด 3 คิว/);
  console.log("ok  limits → same department rejected, max 3; referral waits from the referral time");
}
