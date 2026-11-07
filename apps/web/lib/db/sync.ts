import { randomBytes } from "crypto";
import { Prisma } from "@prisma/client";
import bcrypt from "bcryptjs";
import { issueQueueNumber } from "@/lib/db/queue-number";
import { sendToPatient } from "@/lib/line/notify";
import { callMessage } from "@/lib/mock/logic";
import type {
  Appointment, Delivery, Department, Doctor, Notification, Patient, Prescription, Question, Queue, RefillSchedule,
  Role, Settings, Shift, SymptomCode, User,
} from "@/lib/mock/types";
import { prisma } from "@/lib/prisma";

export type Changes = {
  departments?: Department[];
  doctors?: Doctor[];
  removedDoctors?: string[];
  shifts?: Shift[];
  appointments?: Appointment[];
  queues?: Queue[];
  prescriptions?: Prescription[];
  deliveries?: Delivery[];
  refills?: RefillSchedule[];
  symptomCodes?: SymptomCode[];
  questions?: Question[];
  users?: User[];
  settings?: Settings;
  notifications?: Notification[];
};

const ACCESS: Record<Role, (keyof Changes)[]> = {
  ADMIN: ["departments", "doctors", "removedDoctors", "shifts", "appointments", "queues", "prescriptions", "deliveries", "refills", "symptomCodes", "questions", "users", "settings", "notifications"],
  STAFF: ["shifts", "appointments", "queues", "deliveries", "notifications"],
  DOCTOR: ["queues", "prescriptions", "refills", "notifications"],
};

const ALLOWED_STATUS: Record<string, string[]> = {
  WAITING: ["CALLED", "CANCELLED"],
  CALLED: ["IN_PROGRESS", "NO_SHOW", "DONE"],
  IN_PROGRESS: ["DONE"],
};
const BUSY = ["CALLED", "IN_PROGRESS"];
const OBJECT_ID = /^[0-9a-f]{24}$/;
const toDate = (v: string) => new Date(v);
const toDay = (v: string) => new Date(`${v.slice(0, 10)}T00:00:00+07:00`);
const orNull = (v: string | null | undefined) => (v ? new Date(v) : null);

class SyncError extends Error {}

class Ids {
  private map = new Map<string, string>();
  of(id: string): string {
    if (OBJECT_ID.test(id)) return id;
    let real = this.map.get(id);
    if (!real) {
      real = randomBytes(12).toString("hex");
      this.map.set(id, real);
    }
    return real;
  }
  ofOptional(id: string | null | undefined): string | null {
    return id ? this.of(id) : null;
  }
}

async function whyCannotCall(q: { doctorId: string | null; patientId: string }): Promise<string | null> {
  if (!q.doctorId) return "คิวนี้ยังไม่มีแพทย์";
  if (await prisma.queue.count({ where: { doctorId: q.doctorId, status: { in: BUSY } } })) return "แพทย์กำลังตรวจหรือเรียกผู้ป่วยอยู่";
  if (await prisma.queue.count({ where: { patientId: q.patientId, status: { in: BUSY } } })) return "ผู้ป่วยกำลังตรวจอยู่อีกแผนก";
  return null;
}

async function saveQueue(q: Queue, ids: Ids, numbers: Map<string, string>) {
  const id = ids.of(q.id);
  const current = await prisma.queue.findUnique({ where: { id } });
  const departmentId = ids.of(q.departmentId);
  const moved = !current || current.departmentId !== departmentId;
  let queueNumber = current?.queueNumber ?? q.queueNumber;
  if (moved) {
    queueNumber = await issueQueueNumber(departmentId);
    numbers.set(q.queueNumber, queueNumber);
  }

  const fields = {
    departmentId,
    doctorId: ids.ofOptional(q.doctorId),
    queueNumber,
    visitType: q.visitType,
    priorityLevel: q.priorityLevel,
    status: q.status,
    calledTime: orNull(q.calledTime),
    finishedTime: orNull(q.finishedTime),
    editedBy: ids.ofOptional(q.editedBy),
    editedAt: orNull(q.editedAt),
  };

  if (!current) {
    await prisma.queue.create({
      data: {
        ...fields,
        id,
        patientId: ids.of(q.patientId),
        screeningId: ids.ofOptional(q.screeningId),
        appointmentId: ids.ofOptional(q.appointmentId),
        checkInTime: toDate(q.checkInTime),
        referredFromQueueId: ids.ofOptional(q.referredFromQueueId),
      },
    });
    return;
  }

  const statusChanged = current.status !== q.status;
  if (statusChanged) {
    if (!ALLOWED_STATUS[current.status]?.includes(q.status)) throw new SyncError(`เปลี่ยนสถานะจาก ${current.status} เป็น ${q.status} ไม่ได้`);
    if (q.status === "CALLED") {
      const why = await whyCannotCall(current);
      if (why) throw new SyncError(why);
    }
  }
  const { count } = await prisma.queue.updateMany({ where: { id, status: current.status }, data: fields });
  if (count === 0) throw new SyncError("คิวนี้ถูกเปลี่ยนสถานะไปแล้ว กรุณาลองใหม่");

  if (statusChanged && q.status === "CALLED" && fields.doctorId) {
    const doctor = await prisma.doctor.findUnique({ where: { id: fields.doctorId } });
    if (doctor) {
      const text = callMessage({ ...q, queueNumber }, { id: doctor.id, name: doctor.name, departmentId: doctor.departmentId, meetingUrl: doctor.meetingUrl });
      await sendToPatient(current.patientId, text);
    }
  }
}

async function saveMasterData(c: Changes, ids: Ids) {
  for (const d of c.departments ?? []) {
    const id = ids.of(d.id);
    const data = { name: d.name, code: d.code, scopeOfCare: d.scopeOfCare, defaultServiceMinutes: d.defaultServiceMinutes, isActive: d.isActive };
    await prisma.department.upsert({ where: { id }, create: { id, ...data }, update: data });
  }
  for (const d of c.doctors ?? []) {
    const id = ids.of(d.id);
    const data = { name: d.name, departmentId: ids.of(d.departmentId), meetingUrl: d.meetingUrl };
    await prisma.doctor.upsert({ where: { id }, create: { id, ...data }, update: data });
  }
  for (const id of c.removedDoctors ?? []) {
    if (!OBJECT_ID.test(id)) continue;
    const where = { doctorId: id };
    const used = await Promise.all([prisma.shift.count({ where }), prisma.queue.count({ where }), prisma.appointment.count({ where }), prisma.user.count({ where })]);
    if (used.some((n) => n > 0)) throw new SyncError("ลบแพทย์คนนี้ไม่ได้ เพราะมีเวร คิว นัดหมาย หรือบัญชีผู้ใช้ผูกอยู่");
    await prisma.doctor.deleteMany({ where: { id } });
  }
  for (const s of c.symptomCodes ?? []) {
    const id = ids.of(s.id);
    const data = {
      code: s.code, label: s.label, synonyms: s.synonyms, departmentWeights: s.departmentWeights,
      isRedFlag: s.isRedFlag, onsiteOnly: s.onsiteOnly, priorityHint: s.priorityHint, isActive: s.isActive,
    };
    await prisma.symptomCode.upsert({ where: { id }, create: { id, ...data }, update: data });
  }
  for (const q of c.questions ?? []) {
    const id = ids.of(q.id);
    const data = { questionText: q.questionText, group: q.group, order: q.order, options: q.options, dependsOn: q.dependsOn ?? null, isActive: q.isActive };
    await prisma.question.upsert({ where: { id }, create: { id, ...data }, update: data });
  }
  for (const u of c.users ?? []) {
    const id = ids.of(u.id);
    const data = { username: u.username, role: u.role, departmentId: ids.ofOptional(u.departmentId), doctorId: ids.ofOptional(u.doctorId), isActive: u.isActive };
    if (await prisma.user.findUnique({ where: { id } })) {
      await prisma.user.update({ where: { id }, data });
    } else {
      if (!u.password || u.password.length < 8) throw new SyncError("รหัสผ่านต้องมีอย่างน้อย 8 ตัวอักษร");
      await prisma.user.create({ data: { id, ...data, passwordHash: await bcrypt.hash(u.password, 10) } });
    }
  }
  if (c.settings) {
    const { maxActiveQueues, ageBonusMinutes, chronicBonusMinutes, priorityAgeGroups } = c.settings;
    const data = { maxActiveQueues, ageBonusMinutes, chronicBonusMinutes, priorityAgeGroups };
    const existing = await prisma.systemSetting.findFirst();
    if (existing) await prisma.systemSetting.update({ where: { id: existing.id }, data });
    else await prisma.systemSetting.create({ data });
  }
}

async function saveSchedules(c: Changes, ids: Ids) {
  for (const s of c.shifts ?? []) {
    const id = ids.of(s.id);
    const data = { doctorId: ids.of(s.doctorId), date: toDay(s.date), startTime: toDate(s.startTime), endTime: toDate(s.endTime), status: s.status };
    await prisma.shift.upsert({ where: { id }, create: { id, ...data }, update: data });
  }
  for (const a of c.appointments ?? []) {
    const id = ids.of(a.id);
    const data = { patientId: ids.of(a.patientId), doctorId: ids.of(a.doctorId), appointmentTime: toDate(a.appointmentTime), reason: a.reason, status: a.status };
    await prisma.appointment.upsert({ where: { id }, create: { id, ...data, createdBy: ids.of(a.createdBy) }, update: data });
  }
}

async function saveMedicine(c: Changes, ids: Ids) {
  for (const r of c.prescriptions ?? []) {
    const id = ids.of(r.id);
    const data = { queueId: ids.of(r.queueId), items: r.items, daysSupply: r.daysSupply };
    await prisma.prescription.upsert({ where: { id }, create: { id, ...data, issuedAt: toDate(r.issuedAt) }, update: data });
  }
  for (const d of c.deliveries ?? []) {
    const prescriptionId = ids.of(d.prescriptionId);
    const data = { method: d.method, address: d.address, status: d.status };
    await prisma.delivery.upsert({ where: { prescriptionId }, create: { prescriptionId, ...data }, update: data });
  }
  for (const r of c.refills ?? []) {
    const id = ids.of(r.id);
    const data = { patientId: ids.of(r.patientId), prescriptionId: ids.of(r.prescriptionId), dueDate: toDay(r.dueDate), remindedAt: orNull(r.remindedAt), status: r.status };
    await prisma.refillSchedule.upsert({ where: { id }, create: { id, ...data }, update: data });
  }
}

function friendlyError(err: unknown): string {
  if (err instanceof SyncError) return err.message;
  if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") return "ข้อมูลนี้มีอยู่แล้วในระบบ";
  console.error("sync failed", err);
  return "บันทึกไม่สำเร็จ";
}

export async function applyChanges(changes: Changes, role: Role): Promise<{ error?: string; status?: number }> {
  const denied = (Object.keys(changes) as (keyof Changes)[]).find((k) => changes[k] !== undefined && !ACCESS[role].includes(k));
  if (denied) return { error: "บัญชีนี้ไม่มีสิทธิ์แก้ไขข้อมูลส่วนนี้", status: 403 };

  try {
    const ids = new Ids();
    const numbers = new Map<string, string>();
    await saveMasterData(changes, ids);
    await saveSchedules(changes, ids);
    for (const q of changes.queues ?? []) await saveQueue(q, ids, numbers);
    await saveMedicine(changes, ids);
    for (const n of changes.notifications ?? []) {
      let text = n.text;
      for (const [draft, real] of numbers) text = text.replaceAll(draft, real);
      await sendToPatient(ids.of(n.patientId), text);
    }
    return {};
  } catch (err) {
    return { error: friendlyError(err), status: 400 };
  }
}

export type PatientChanges = {
  patients?: Patient[];
  queues?: Queue[];
  deliveries?: Delivery[];
  notifications?: Notification[];
};

export async function applyPatientChanges(lineUserId: string, c: PatientChanges): Promise<{ error?: string; status?: number }> {
  try {
    const profile = c.patients?.[0];
    if (profile) {
      if (!profile.fullName?.trim() || !profile.ageGroup || !profile.gender) throw new SyncError("กรุณากรอกข้อมูลให้ครบ");
      const data = {
        fullName: profile.fullName.trim(), ageGroup: profile.ageGroup, gender: profile.gender,
        healthCoverage: profile.healthCoverage, isChronic: Boolean(profile.isChronic), address: profile.address,
      };
      await prisma.patient.upsert({ where: { lineUserId }, create: { lineUserId, ...data }, update: data });
    }
    const me = await prisma.patient.findUnique({ where: { lineUserId } });
    if (!me) return profile ? {} : { error: "กรุณาลงทะเบียนก่อน", status: 400 };

    for (const q of c.queues ?? []) {
      if (q.status !== "CANCELLED") throw new SyncError("เปลี่ยนสถานะคิวนี้ไม่ได้");
      const { count } = await prisma.queue.updateMany({
        where: { id: q.id, patientId: me.id, status: "WAITING" },
        data: { status: "CANCELLED", finishedTime: new Date() },
      });
      if (count === 0) throw new SyncError("คิวถูกเรียกเข้าตรวจแล้ว ยกเลิกผ่าน LINE ไม่ได้ กรุณาติดต่อเจ้าหน้าที่ ณ จุดบริการ");
    }
    for (const d of c.deliveries ?? []) {
      const rx = await prisma.prescription.findUnique({ where: { id: d.prescriptionId }, include: { queue: true } });
      if (!rx || rx.queue.patientId !== me.id) throw new SyncError("ไม่พบใบสั่งยานี้");
      const data = { method: d.method, address: d.address, status: "PENDING" };
      await prisma.delivery.upsert({ where: { prescriptionId: rx.id }, create: { prescriptionId: rx.id, ...data }, update: data });
    }
    for (const n of c.notifications ?? []) await sendToPatient(me.id, n.text);
    return {};
  } catch (err) {
    return { error: friendlyError(err), status: 400 };
  }
}
