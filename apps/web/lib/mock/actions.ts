// State transitions for the mock store. Each function is pure: (state, now, payload) -> state.
// They mirror what the Next.js API routes will do once the database is wired up.

import { APPOINTMENT_LEVEL, newId, nextQueueNumber, nextShiftStart, pickDoctor, shiftNow } from "./logic";
import { addDays, bkkDate } from "./time";
import type {
  Appointment, Delivery, DeliveryMethod, DeliveryStatus, Department, Doctor, Level, MockState, Patient,
  PrescriptionItem, Question, Queue, Screening, Shift, SymptomCode, User,
} from "./types";

const iso = (now: number) => new Date(now).toISOString();

function notify(s: MockState, patientId: string, now: number, text: string): MockState {
  return { ...s, notifications: [...s.notifications, { id: newId("n"), patientId, at: iso(now), text }] };
}

const deptName = (s: MockState, id: string | null) => s.departments.find((d) => d.id === id)?.name ?? "-";

// ── UC02 ──

export function login(s: MockState, username: string): { state: MockState; error?: string } {
  const u = s.users.find((x) => x.username === username.trim());
  if (!u) return { state: s, error: "ไม่พบชื่อผู้ใช้นี้ในระบบ" };
  if (!u.isActive) return { state: s, error: "บัญชีนี้ถูกระงับการใช้งาน กรุณาติดต่อผู้ดูแลระบบ" };
  return { state: { ...s, sessionUserId: u.id } };
}

// ── UC08 ──

export function editScreening(s: MockState, now: number, p: { queueId: string; departmentId: string; priorityLevel: Level; userId: string }): MockState {
  const q = s.queues.find((x) => x.id === p.queueId);
  if (!q) return s;
  const moved = q.departmentId !== p.departmentId;
  const doctorId = moved ? pickDoctor(s, p.departmentId, now) : q.doctorId;
  const queueNumber = moved ? nextQueueNumber(s, p.departmentId, now) : q.queueNumber;
  const updated: Queue = { ...q, departmentId: p.departmentId, doctorId, queueNumber, priorityLevel: p.priorityLevel, editedBy: p.userId, editedAt: iso(now) };
  const next = { ...s, queues: s.queues.map((x) => (x.id === q.id ? updated : x)) };
  return moved
    ? notify(next, q.patientId, now, `เจ้าหน้าที่ปรับแผนกของคุณเป็น ${deptName(s, p.departmentId)} หมายเลขคิวใหม่ ${queueNumber}`)
    : next;
}

// ── queue status changes made by staff at the exam room ──

export function startExam(s: MockState, queueId: string): MockState {
  return { ...s, queues: s.queues.map((q) => (q.id === queueId && q.status === "CALLED" ? { ...q, status: "IN_PROGRESS" } : q)) };
}

export function markNoShow(s: MockState, now: number, queueId: string): MockState {
  const q = s.queues.find((x) => x.id === queueId);
  if (!q) return s;
  return {
    ...s,
    queues: s.queues.map((x) => (x.id === queueId ? { ...x, status: "NO_SHOW", finishedTime: iso(now) } : x)),
    callEvents: [...s.callEvents, { id: newId("ev"), queueId, doctorId: q.doctorId ?? "", kind: "NO_SHOW", at: iso(now) }],
  };
}

// ── UC09 ── (does not call anyone: the freed doctor triggers UC13 on its own)

export function recordResult(s: MockState, now: number, p: { queueId: string; items: PrescriptionItem[]; daysSupply: number }): MockState {
  const q = s.queues.find((x) => x.id === p.queueId);
  if (!q) return s;
  let next: MockState = { ...s, queues: s.queues.map((x) => (x.id === q.id ? { ...x, status: "DONE", finishedTime: iso(now) } : x)) };
  const items = p.items.filter((i) => i.name.trim());
  if (items.length === 0) return next; // UC09 exception: no medicine -> no prescription, no UC06 message

  const rxId = newId("rx");
  next = { ...next, prescriptions: [...next.prescriptions, { id: rxId, queueId: q.id, items, daysSupply: p.daysSupply, issuedAt: iso(now) }] };
  const patient = s.patients.find((x) => x.id === q.patientId);
  if (patient?.isChronic && p.daysSupply > 3) {
    next = {
      ...next,
      refills: [...next.refills, { id: newId("rf"), patientId: q.patientId, prescriptionId: rxId, dueDate: addDays(bkkDate(now), p.daysSupply - 3), remindedAt: null, status: "PENDING" }],
    };
  }
  return notify(next, q.patientId, now, "แพทย์สั่งจ่ายยาแล้ว กรุณาเลือกวิธีรับยา: รับที่โรงพยาบาล หรือจัดส่งถึงบ้าน");
}

export function updateDeliveryStatus(s: MockState, now: number, deliveryId: string, status: DeliveryStatus): MockState {
  const d = s.deliveries.find((x) => x.id === deliveryId);
  if (!d) return s;
  const next = { ...s, deliveries: s.deliveries.map((x) => (x.id === deliveryId ? { ...x, status, updatedAt: iso(now) } : x)) };
  const rx = s.prescriptions.find((r) => r.id === d.prescriptionId);
  const pid = s.queues.find((q) => q.id === rx?.queueId)?.patientId;
  return pid ? notify(next, pid, now, `สถานะยา: ${DELIVERY_LABEL[status]}`) : next;
}

export const DELIVERY_LABEL: Record<DeliveryStatus, string> = {
  PENDING: "รอดำเนินการ",
  PREPARING: "กำลังจัดยา",
  READY: "พร้อมให้รับที่ห้องยา",
  SHIPPED: "จัดส่งแล้ว",
  COMPLETED: "ได้รับยาเรียบร้อย",
};

// ── UC10 (walk-in path, used by the "simulate a LINE patient" button) ──

export type WalkInResult = { state: MockState; message: string; queueId?: string };

export function issueWalkIn(s: MockState, now: number, screening: Omit<Screening, "id" | "patientId" | "createdAt">, patientNo: number): WalkInResult {
  const patientId = `pt_sim_${patientNo}`;
  const patient: Patient = {
    id: patientId, lineUserId: `U-sim-${patientNo}`, fullName: `ผู้ป่วยทดสอบ S${patientNo}`, ageGroup: "18-59", gender: "ไม่ระบุ",
    healthCoverage: "บัตรทอง", isChronic: false, address: null, createdAt: iso(now),
  };
  const scr: Screening = { ...screening, id: newId("scr"), patientId, createdAt: iso(now) };
  let next: MockState = { ...s, patients: [...s.patients, patient], screenings: [...s.screenings, scr] };

  if (scr.isRedFlag) {
    next = notify(next, patientId, now, "อาการที่แจ้งต้องได้รับการดูแลโดยเร็ว กรุณาไปที่จุดบริการฉุกเฉินทันที หรือโทร 1669");
    return { state: next, message: "พบอาการฉุกเฉิน: ระบบไม่ออกคิว แจ้งผู้ป่วยให้ไปจุดฉุกเฉิน และแจ้งเตือนเจ้าหน้าที่แล้ว" };
  }
  const dept = scr.assignedDepartment!;
  const doctorId = pickDoctor(next, dept, now);
  if (!doctorId) {
    const at = nextShiftStart(next, dept, now);
    const when = at ? `${new Date(at).toLocaleString("th-TH", { timeZone: "Asia/Bangkok", weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })} น.` : "ยังไม่มีกำหนด";
    next = notify(next, patientId, now, `ขณะนี้ไม่มีแพทย์แผนก${deptName(s, dept)}ปฏิบัติงาน รอบบริการถัดไป ${when}`);
    return { state: next, message: `ไม่มีแพทย์แผนก${deptName(s, dept)}ในเวร ระบบแจ้งรอบบริการถัดไป (${when}) แทนการออกคิว` };
  }
  const q: Queue = {
    id: newId("q"), patientId, screeningId: scr.id, appointmentId: null, departmentId: dept, doctorId,
    queueNumber: nextQueueNumber(next, dept, now), visitType: "ONSITE", priorityLevel: scr.priorityLevel, status: "WAITING",
    checkInTime: iso(now), calledTime: null, finishedTime: null, editedBy: null, editedAt: null,
  };
  next = notify({ ...next, queues: [...next.queues, q] }, patientId, now, `ได้รับคิวแล้ว หมายเลข ${q.queueNumber} แผนก${deptName(s, dept)}`);
  const doctor = s.doctors.find((d) => d.id === doctorId)?.name;
  return { state: next, message: `ออกคิว ${q.queueNumber} ให้ ${doctor} (ภาระงานน้อยที่สุดในแผนก)`, queueId: q.id };
}

// ── UC05 (patient side) ──

export function cancelQueue(s: MockState, now: number, queueId: string): { state: MockState; error?: string } {
  const q = s.queues.find((x) => x.id === queueId);
  if (!q) return { state: s };
  if (q.status !== "WAITING") return { state: s, error: "คิวถูกเรียกเข้าตรวจแล้ว ยกเลิกผ่าน LINE ไม่ได้ กรุณาติดต่อเจ้าหน้าที่ ณ จุดบริการ" };
  const next = { ...s, queues: s.queues.map((x) => (x.id === queueId ? { ...x, status: "CANCELLED" as const, finishedTime: iso(now) } : x)) };
  return { state: notify(next, q.patientId, now, `ยกเลิกคิว ${q.queueNumber} เรียบร้อยแล้ว`) };
}

// ── UC01 ──

/** Stand-in for the LINE userId that LIFF would provide for a first-time user. */
export const LIFF_USER_PREFIX = "U-liff-";

export function registerPatient(s: MockState, now: number, p: Omit<Patient, "id" | "createdAt" | "lineUserId">): MockState {
  const id = newId("pt");
  const patient: Patient = { ...p, id, lineUserId: `${LIFF_USER_PREFIX}${id}`, createdAt: iso(now) };
  return { ...s, patients: [...s.patients, patient], liffPatientId: patient.id };
}

export function updatePatient(s: MockState, id: string, p: Partial<Omit<Patient, "id" | "lineUserId" | "createdAt">>): MockState {
  return { ...s, patients: s.patients.map((x) => (x.id === id ? { ...x, ...p } : x)) };
}

// ── UC06 ──

export function chooseDelivery(s: MockState, now: number, p: { prescriptionId: string; method: DeliveryMethod; address: string | null }): MockState {
  const delivery: Delivery = { id: newId("dl"), prescriptionId: p.prescriptionId, method: p.method, address: p.address, status: "PENDING", updatedAt: iso(now) };
  let next: MockState = { ...s, deliveries: [...s.deliveries.filter((d) => d.prescriptionId !== p.prescriptionId), delivery] };
  const rx = s.prescriptions.find((r) => r.id === p.prescriptionId);
  const pid = s.queues.find((q) => q.id === rx?.queueId)?.patientId;
  if (pid && p.method === "SHIP" && p.address) {
    next = { ...next, patients: next.patients.map((x) => (x.id === pid ? { ...x, address: p.address } : x)) };
  }
  return pid ? notify(next, pid, now, p.method === "SHIP" ? "บันทึกการจัดส่งยาถึงบ้านแล้ว ระบบจะแจ้งเมื่อจัดส่ง" : "บันทึกการรับยาที่โรงพยาบาลแล้ว ระบบจะแจ้งเมื่อยาพร้อม") : next;
}

// ── UC11 ──

export function shiftOverlaps(s: MockState, doctorId: string, startTime: string, endTime: string, ignoreId?: string): boolean {
  return s.shifts.some((sh) => sh.id !== ignoreId && sh.doctorId === doctorId && sh.status === "ACTIVE" && sh.startTime < endTime && startTime < sh.endTime);
}

export function addShift(s: MockState, p: Omit<Shift, "id" | "status">): MockState {
  return { ...s, shifts: [...s.shifts, { ...p, id: newId("sh"), status: "ACTIVE" }] };
}

/** Patients affected by cancelling a shift: appointments inside it + people waiting for that doctor if it is running now. */
export function shiftImpact(s: MockState, shift: Shift, now: number) {
  const appts = s.appointments.filter((a) => a.doctorId === shift.doctorId && a.status === "SCHEDULED" && a.appointmentTime >= shift.startTime && a.appointmentTime < shift.endTime);
  const running = new Date(shift.startTime).getTime() <= now && now < new Date(shift.endTime).getTime();
  const waiting = running ? s.queues.filter((q) => q.doctorId === shift.doctorId && q.status === "WAITING") : [];
  return { appts, waiting };
}

/** Cancel a shift; waiting patients move to the least-loaded colleague in the same department. */
export function cancelShift(s: MockState, now: number, shiftId: string): MockState {
  const shift = s.shifts.find((x) => x.id === shiftId);
  if (!shift) return s;
  let next: MockState = { ...s, shifts: s.shifts.map((x) => (x.id === shiftId ? { ...x, status: "CANCELLED" } : x)) };
  const { waiting } = shiftImpact(s, shift, now);
  const deptId = s.doctors.find((d) => d.id === shift.doctorId)?.departmentId;
  for (const q of waiting) {
    const to = deptId ? pickDoctor(next, deptId, now) : null;
    next = { ...next, queues: next.queues.map((x) => (x.id === q.id ? { ...x, doctorId: to } : x)) };
  }
  return next;
}

export function addAppointment(s: MockState, now: number, p: Omit<Appointment, "id" | "status" | "createdAt">): MockState {
  const a: Appointment = { ...p, id: newId("ap"), status: "SCHEDULED", createdAt: iso(now) };
  const doctor = s.doctors.find((d) => d.id === p.doctorId)?.name;
  return notify({ ...s, appointments: [...s.appointments, a] }, p.patientId, now, `มีนัดหมายกับ ${doctor} วันที่ ${new Date(p.appointmentTime).toLocaleString("th-TH", { timeZone: "Asia/Bangkok", dateStyle: "medium", timeStyle: "short" })} น.`);
}

export function setAppointmentStatus(s: MockState, id: string, status: Appointment["status"]): MockState {
  return { ...s, appointments: s.appointments.map((a) => (a.id === id ? { ...a, status } : a)) };
}

/** UC10 appointment path: patient confirms arrival -> queue with the booked doctor. */
export function checkInAppointment(s: MockState, now: number, appointmentId: string): { state: MockState; error?: string } {
  const a = s.appointments.find((x) => x.id === appointmentId);
  if (!a || a.status !== "SCHEDULED") return { state: s };
  const doctor = s.doctors.find((d) => d.id === a.doctorId);
  if (!doctor) return { state: s };
  if (!shiftNow(s, a.doctorId, now)) return { state: s, error: "แพทย์ที่นัดไว้ไม่ได้อยู่ในเวรขณะนี้ กรุณาเลื่อนนัดหรือย้ายไปแพทย์ท่านอื่น" };
  const q: Queue = {
    id: newId("q"), patientId: a.patientId, screeningId: null, appointmentId: a.id, departmentId: doctor.departmentId, doctorId: a.doctorId,
    queueNumber: nextQueueNumber(s, doctor.departmentId, now), visitType: "ONSITE", priorityLevel: APPOINTMENT_LEVEL, status: "WAITING",
    checkInTime: iso(now), calledTime: null, finishedTime: null, editedBy: null, editedAt: null,
  };
  const next = { ...setAppointmentStatus(s, a.id, "ARRIVED"), queues: [...s.queues, q] };
  return { state: notify(next, a.patientId, now, `ยืนยันการมาถึงแล้ว หมายเลขคิว ${q.queueNumber}`) };
}

// ── UC12 ──

export const upsert = <T extends { id: string }>(list: T[], item: T) =>
  list.some((x) => x.id === item.id) ? list.map((x) => (x.id === item.id ? item : x)) : [...list, item];

export function saveDepartment(s: MockState, d: Department): MockState {
  return { ...s, departments: upsert(s.departments, d) };
}
export function saveDoctor(s: MockState, d: Doctor): MockState {
  return { ...s, doctors: upsert(s.doctors, d) };
}
export function saveSymptomCode(s: MockState, c: SymptomCode): MockState {
  return { ...s, symptomCodes: upsert(s.symptomCodes, c) };
}
export function saveQuestion(s: MockState, q: Question): MockState {
  return { ...s, questions: upsert(s.questions, q) };
}
export function saveUser(s: MockState, u: User): MockState {
  return { ...s, users: upsert(s.users, u) };
}
