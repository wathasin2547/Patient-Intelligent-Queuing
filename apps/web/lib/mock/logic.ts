// Queue rules from report §3.4 (UC10 queue management, UC13 calling patients).
// Mirrors apps/algorithm/triage/{scheduling,queueing}.py so the mock screens
// behave like the real system. When the API is wired up, these move server-side.

import { bkkDate, MINUTE, minutesSince } from "./time";
import type { Appointment, Level, MockState, Queue, Shift } from "./types";

// P = B[level] + α·W (eq. 3.2). Defaults match apps/algorithm/.env.example.
export const BASE_SCORE: Record<Level, number> = { 1: 1000, 2: 1000, 3: 600, 4: 300, 5: 200 };
export const ALPHA = 2;
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

export function queueScore(q: Queue, s: MockState, now: number): number {
  return BASE_SCORE[q.priorityLevel] + ALPHA * waitingMinutes(q, s, now);
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
  const upcoming = s.appointments.filter((a) => {
    if (a.doctorId !== doctorId || a.status !== "SCHEDULED") return false;
    const t = new Date(a.appointmentTime).getTime();
    return t >= now && t < now + LOAD_WINDOW_MINUTES * MINUTE;
  }).length;
  return { waiting, upcoming, total: waiting + upcoming };
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

/**
 * UC13 — the system calls patients by itself. Runs after every state change and on every clock tick:
 * 1. a CALLED patient who has not come in for NO_SHOW_MINUTES is marked NO_SHOW;
 * 2. every doctor on shift who is free gets the highest-P waiting patient;
 * 3. the patient PRE_NOTIFY_AHEAD places away is warned via LINE.
 * Not tied to UC09 — anything that frees a doctor (exam done, no-show, shift start) triggers it.
 */
export function runAutoCall(s: MockState, now: number): MockState {
  let queues = s.queues;
  const notifications = [...s.notifications];
  const callEvents = [...s.callEvents];
  const at = new Date(now).toISOString();
  const nameOf = (doctorId: string) => s.doctors.find((d) => d.id === doctorId)?.name ?? "";

  for (const q of queues) {
    if (q.status === "CALLED" && q.calledTime && minutesSince(q.calledTime, now) >= NO_SHOW_MINUTES) {
      queues = queues.map((x) => (x.id === q.id ? { ...x, status: "NO_SHOW", finishedTime: at } : x));
      callEvents.push({ id: newId("ev"), queueId: q.id, doctorId: q.doctorId ?? "", kind: "NO_SHOW", at });
      notifications.push({ id: newId("n"), patientId: q.patientId, at, text: `คิว ${q.queueNumber} ถูกบันทึกว่าไม่มาตามเวลาที่เรียก กรุณาติดต่อเจ้าหน้าที่ ณ จุดบริการ` });
    }
  }

  let next: MockState = { ...s, queues };
  for (const doc of s.doctors) {
    if (!shiftNow(next, doc.id, now) || isDoctorBusy(next, doc.id)) continue;
    const line = rankedWaiting(next, doc.id, now);
    const pick = line[0];
    if (!pick) continue;
    queues = next.queues.map((x) => (x.id === pick.id ? { ...x, status: "CALLED", calledTime: at } : x));
    callEvents.push({ id: newId("ev"), queueId: pick.id, doctorId: doc.id, kind: "CALL", at });
    notifications.push({ id: newId("n"), patientId: pick.patientId, at, text: `ถึงคิวของคุณแล้ว หมายเลข ${pick.queueNumber} เชิญที่ห้องตรวจ ${nameOf(doc.id)}` });
    const warn = line[PRE_NOTIFY_AHEAD];
    if (warn) {
      notifications.push({ id: newId("n"), patientId: warn.patientId, at, text: `อีก ${PRE_NOTIFY_AHEAD} คิวจะถึงคิวของคุณ (${warn.queueNumber}) กรุณาเตรียมตัวใกล้จุดบริการ` });
    }
    next = { ...next, queues };
  }

  return { ...next, notifications, callEvents };
}
