// Queue rules from report §3.4 (UC10 queue management, UC13 calling patients).
// Mirrors apps/algorithm/triage/{scheduling,queueing}.py so the mock screens
// behave like the real system. When the API is wired up, these move server-side.

import { bkkDate, MINUTE, minutesSince } from "./time";
import type { Appointment, Doctor, Level, MockState, Queue, Shift } from "./types";

// P = B[level] + α·(W + D) (eq. 3.2). Defaults match apps/algorithm/.env.example.
// D (risk head start) comes from s.settings, like SystemSetting in the real system.
export const BASE_SCORE: Record<Level, number> = { 1: 1000, 2: 1000, 3: 600, 4: 300, 5: 200 };
export const ALPHA = 2;

/** D must stay strictly below the narrowest level gap (white→green = 100 pts = 50 min) or a lower level ties a higher one. */
export function maxSafeBonusMinutes(): number {
  const scores = [2, 3, 4, 5].map((l) => BASE_SCORE[l as Level]).sort((a, b) => a - b);
  return Math.min(...scores.slice(1).map((b, i) => b - scores[i])) / ALPHA;
}
export const NO_SHOW_MINUTES = 10; // UC13 exception: patient does not show up after being called
export const PRE_NOTIFY_AHEAD = 3; // UC13 step 4: warn the patient 3 places away
export const LOAD_WINDOW_MINUTES = 60; // UC10 step 2: appointments in the next hour count as load
export const APPOINTMENT_LEVEL: Level = 4; // appointment patients skip screening; staff may edit

export const ACTIVE: Queue["status"][] = ["WAITING", "CALLED", "IN_PROGRESS"];

/** W starts at the appointment time when an appointment patient arrives early (UC10 exception 2). */
export function waitStart(q: Queue, appointments: Appointment[]): number {
  const checkIn = new Date(q.checkInTime).getTime();
  if (!q.appointmentId) return checkIn;
  const a = appointments.find((x) => x.id === q.appointmentId);
  return a ? Math.max(checkIn, new Date(a.appointmentTime).getTime()) : checkIn;
}

export function waitingMinutes(q: Queue, s: MockState, now: number): number {
  return Math.max(0, (now - waitStart(q, s.appointments)) / MINUTE);
}

/** D: minutes of head start for older age and chronic disease (mirrors queueing.RiskBonus). */
export function riskMinutes(q: Queue, s: MockState): number {
  const p = s.patients.find((x) => x.id === q.patientId);
  if (!p) return 0;
  const { ageBonusMinutes, chronicBonusMinutes, priorityAgeGroups } = s.settings;
  return (priorityAgeGroups.includes(p.ageGroup) ? ageBonusMinutes : 0) + (p.isChronic ? chronicBonusMinutes : 0);
}

export function queueScore(q: Queue, s: MockState, now: number): number {
  return BASE_SCORE[q.priorityLevel] + ALPHA * (waitingMinutes(q, s, now) + riskMinutes(q, s));
}

/** WAITING queues of one doctor, highest P first; ties go to whoever started waiting first. */
export function rankedWaiting(s: MockState, doctorId: string, now: number): Queue[] {
  return s.queues
    .filter((q) => q.doctorId === doctorId && q.status === "WAITING")
    .sort((a, b) => queueScore(b, s, now) - queueScore(a, s, now) || waitStart(a, s.appointments) - waitStart(b, s.appointments));
}

export function shiftNow(s: MockState, doctorId: string, now: number): Shift | undefined {
  return s.shifts.find(
    (sh) => sh.doctorId === doctorId && sh.status === "ACTIVE" && new Date(sh.startTime).getTime() <= now && now < new Date(sh.endTime).getTime(),
  );
}

export function doctorsOnShift(s: MockState, now: number, departmentId?: string) {
  return s.doctors.filter((d) => (!departmentId || d.departmentId === departmentId) && shiftNow(s, d.id, now));
}

/** Load = patients waiting + appointments in the next hour (report §3.4.8). */
export function doctorLoad(s: MockState, doctorId: string, now: number) {
  const waiting = s.queues.filter((q) => q.doctorId === doctorId && q.status === "WAITING").length;
  // the patient in the room counts too, otherwise an idle doctor and a busy one tie at 0
  const inRoom = isDoctorBusy(s, doctorId) ? 1 : 0;
  const upcoming = s.appointments.filter((a) => {
    if (a.doctorId !== doctorId || a.status !== "SCHEDULED") return false;
    const t = new Date(a.appointmentTime).getTime();
    return t >= now && t < now + LOAD_WINDOW_MINUTES * MINUTE;
  }).length;
  return { waiting, inRoom, upcoming, total: waiting + inRoom + upcoming };
}

export function nextShiftStart(s: MockState, departmentId: string, now: number): string | null {
  const ids = new Set(s.doctors.filter((d) => d.departmentId === departmentId).map((d) => d.id));
  const next = s.shifts
    .filter((sh) => ids.has(sh.doctorId) && sh.status === "ACTIVE" && new Date(sh.startTime).getTime() > now)
    .sort((a, b) => a.startTime.localeCompare(b.startTime))[0];
  return next?.startTime ?? null;
}

/** UC10 steps 1-3: least-loaded doctor on shift in the department, or null if nobody is on shift. */
export function pickDoctor(s: MockState, departmentId: string, now: number): string | null {
  const ranked = doctorsOnShift(s, now, departmentId)
    .map((d) => ({ id: d.id, load: doctorLoad(s, d.id, now).total }))
    .sort((a, b) => a.load - b.load || a.id.localeCompare(b.id));
  return ranked[0]?.id ?? null;
}

export function nextQueueNumber(s: MockState, departmentId: string, now: number): string {
  const dept = s.departments.find((d) => d.id === departmentId);
  const today = bkkDate(now);
  const count = s.queues.filter((q) => q.departmentId === departmentId && bkkDate(q.checkInTime) === today).length;
  return `${dept?.code ?? "Q"}-${String(count + 1).padStart(3, "0")}`;
}

export function isDoctorBusy(s: MockState, doctorId: string) {
  return s.queues.some((q) => q.doctorId === doctorId && (q.status === "CALLED" || q.status === "IN_PROGRESS"));
}

/** Position among the doctor's waiting patients (1 = next to be called), by current P. */
export function positionInLine(s: MockState, q: Queue, now: number): number | null {
  if (q.status !== "WAITING" || !q.doctorId) return null;
  return rankedWaiting(s, q.doctorId, now).findIndex((x) => x.id === q.id) + 1;
}

let seq = 0;
export const newId = (prefix: string) => `${prefix}_${Date.now().toString(36)}${(seq++).toString(36)}`;

// ── multi-queue patients: one patient may wait in several departments at once ──

export const isCalledOrIn = (q: Queue) => q.status === "CALLED" || q.status === "IN_PROGRESS";

/** The patient is with a doctor or on the way in: they can be called by only one doctor at a time. */
export function isPatientBusy(s: MockState, patientId: string) {
  return s.queues.some((q) => q.patientId === patientId && isCalledOrIn(q));
}

/** Rejects a new queue that breaks "one queue per department, at most N at once" (UC10). */
export function queueLimitError(s: MockState, patientId: string, departmentId: string): string | null {
  const active = s.queues.filter((q) => q.patientId === patientId && ACTIVE.includes(q.status));
  if (active.some((q) => q.departmentId === departmentId)) return "ผู้ป่วยมีคิวแผนกนี้อยู่แล้ว";
  if (active.length >= s.settings.maxActiveQueues) return `ผู้ป่วยถือคิวได้พร้อมกันสูงสุด ${s.settings.maxActiveQueues} คิว`;
  return null;
}

/**
 * Two free doctors want the same patient: the more urgent queue wins, then the appointment
 * (tied to the doctor's time), then the one waiting longer, then the one issued first.
 */
function collisionOrder(a: Queue, b: Queue, s: MockState) {
  return (
    a.priorityLevel - b.priorityLevel ||
    Number(Boolean(b.appointmentId)) - Number(Boolean(a.appointmentId)) ||
    waitStart(a, s.appointments) - waitStart(b, s.appointments) ||
    a.checkInTime.localeCompare(b.checkInTime)
  );
}

/** Average consultation minutes of the doctor today (called → finished), else the department default. */
export function serviceMinutes(s: MockState, doctorId: string, now: number): number {
  const today = bkkDate(now);
  const done = s.queues.filter((q) => q.doctorId === doctorId && q.status === "DONE" && q.calledTime && q.finishedTime && bkkDate(q.finishedTime) === today);
  if (done.length >= 3) {
    const total = done.reduce((sum, q) => sum + (new Date(q.finishedTime!).getTime() - new Date(q.calledTime!).getTime()) / MINUTE, 0);
    return Math.max(3, total / done.length);
  }
  const deptId = s.doctors.find((d) => d.id === doctorId)?.departmentId;
  return s.departments.find((d) => d.id === deptId)?.defaultServiceMinutes ?? 10;
}

/**
 * Estimated time a waiting queue gets called, so a multi-queue patient knows where to go first.
 * Only an estimate: an urgent arrival can still move ahead of them.
 */
export function estimateCallTime(s: MockState, q: Queue, now: number): number | null {
  if (q.status !== "WAITING" || !q.doctorId || !shiftNow(s, q.doctorId, now)) return null;
  const per = serviceMinutes(s, q.doctorId, now);
  const current = s.queues.find((x) => x.doctorId === q.doctorId && isCalledOrIn(x));
  const remaining = current?.calledTime ? Math.max(1, per - minutesSince(current.calledTime, now)) : 0;
  const ahead = (positionInLine(s, q, now) ?? 1) - 1;
  let eta = now + (remaining + ahead * per) * MINUTE;
  // cannot be called here before the exam in the other department ends
  const elsewhere = s.queues.find((x) => x.patientId === q.patientId && x.id !== q.id && isCalledOrIn(x));
  if (elsewhere?.doctorId && elsewhere.calledTime) {
    const end = new Date(elsewhere.calledTime).getTime() + serviceMinutes(s, elsewhere.doctorId, now) * MINUTE;
    eta = Math.max(eta, end, now + MINUTE);
  }
  return eta;
}

/** UC13 call message: onsite patients go to the room, online patients get the doctor's video link. */
export function callMessage(q: Queue, doc: Doctor) {
  return q.visitType === "ONLINE"
    ? `ถึงคิวตรวจออนไลน์ของคุณแล้ว หมายเลข ${q.queueNumber} กดลิงก์เพื่อเข้าห้องตรวจกับ ${doc.name}: ${doc.meetingUrl ?? "(รอเจ้าหน้าที่ส่งลิงก์)"}`
    : `ถึงคิวของคุณแล้ว หมายเลข ${q.queueNumber} เชิญที่ห้องตรวจ ${doc.name}`;
}

/**
 * UC13 — the system calls patients by itself. Runs after every state change and on every clock tick:
 * 1. a CALLED patient who has not come in for NO_SHOW_MINUTES is marked NO_SHOW;
 * 2. every doctor on shift who is free gets the highest-P waiting patient who is not busy in
 *    another queue. A busy patient keeps their place (W keeps counting) and is called at the
 *    doctor's next free slot. Nobody is pulled out of an exam, so no one else waits longer;
 * 3. the patient PRE_NOTIFY_AHEAD places away is warned via LINE.
 * Not tied to UC09 — anything that frees a doctor (exam done, no-show, shift start) triggers it.
 */
export function runAutoCall(s: MockState, now: number): MockState {
  let queues = s.queues;
  const notifications = [...s.notifications];
  const callEvents = [...s.callEvents];
  const at = new Date(now).toISOString();
  const deptName = (id: string) => s.departments.find((d) => d.id === id)?.name ?? "";

  for (const q of queues) {
    if (q.status === "CALLED" && q.calledTime && minutesSince(q.calledTime, now) >= NO_SHOW_MINUTES) {
      queues = queues.map((x) => (x.id === q.id ? { ...x, status: "NO_SHOW", finishedTime: at } : x));
      callEvents.push({ id: newId("ev"), queueId: q.id, doctorId: q.doctorId ?? "", kind: "NO_SHOW", at });
      const where = q.visitType === "ONLINE" ? "หากยังต้องการตรวจ กรุณารับคิวใหม่ทาง LINE" : "กรุณาติดต่อเจ้าหน้าที่ ณ จุดบริการ";
      notifications.push({ id: newId("n"), patientId: q.patientId, at, text: `คิว ${q.queueNumber} ถูกบันทึกว่าไม่มาตามเวลาที่เรียก ${where}` });
    }
  }

  let next: MockState = { ...s, queues };
  const busy = new Set(next.queues.filter(isCalledOrIn).map((q) => q.patientId));
  const free = new Set(s.doctors.filter((d) => shiftNow(next, d.id, now) && !isDoctorBusy(next, d.id)).map((d) => d.id));

  // each free doctor proposes their best available patient; when two want the same patient the
  // collision rule decides, and the other doctor proposes again without that patient
  while (free.size) {
    const proposals = [...free].map((id) => {
      const line = rankedWaiting(next, id, now);
      return { id, line, pick: line.find((q) => !busy.has(q.patientId)) };
    });
    for (const p of proposals) if (!p.pick) free.delete(p.id);
    const live = proposals.filter((p) => p.pick).sort((a, b) => collisionOrder(a.pick!, b.pick!, next));
    if (live.length === 0) break;
    const { id: doctorId, line } = live[0];
    const pick = live[0].pick!;
    const doc = s.doctors.find((d) => d.id === doctorId)!;
    free.delete(doctorId);
    busy.add(pick.patientId);

    queues = next.queues.map((x) => (x.id === pick.id ? { ...x, status: "CALLED", calledTime: at } : x));
    callEvents.push({ id: newId("ev"), queueId: pick.id, doctorId, kind: "CALL", at });
    notifications.push({ id: newId("n"), patientId: pick.patientId, at, text: callMessage(pick, doc) });

    // patients ranked above the pick were skipped only because they are busy elsewhere
    for (const held of line.slice(0, line.indexOf(pick))) {
      const firstHold = !callEvents.some((e) => e.kind === "HOLD" && e.queueId === held.id);
      callEvents.push({ id: newId("ev"), queueId: held.id, doctorId, kind: "HOLD", at });
      if (firstHold) {
        notifications.push({
          id: newId("n"), patientId: held.patientId, at,
          text: `แผนก${deptName(held.departmentId)}พร้อมเรียกคิว ${held.queueNumber} แล้ว แต่คุณกำลังตรวจอยู่อีกแผนก ระบบเก็บลำดับไว้ให้ ตรวจให้เสร็จก่อนได้เลย`,
        });
      }
    }

    const warn = line.filter((q) => q.id !== pick.id)[PRE_NOTIFY_AHEAD - 1];
    if (warn) {
      const prepare = warn.visitType === "ONLINE" ? "กรุณาเตรียมโทรศัพท์และสัญญาณอินเทอร์เน็ตให้พร้อม" : "กรุณาเตรียมตัวใกล้จุดบริการ";
      notifications.push({ id: newId("n"), patientId: warn.patientId, at, text: `อีก ${PRE_NOTIFY_AHEAD} คิวจะถึงคิว ${warn.queueNumber} แผนก${deptName(warn.departmentId)} ${prepare}` });
    }
    next = { ...next, queues };
  }

  return { ...next, notifications, callEvents };
}
