// อ่านข้อมูลจริงจากฐานข้อมูล แล้วแปลงให้อยู่ในรูปแบบเดียวกับที่หน้าเว็บใช้อยู่ (MockState)
// หน้าเว็บจึงแสดงข้อมูลจริงได้โดยไม่ต้องแก้โค้ดของหน้า

import { prisma } from "@/lib/prisma";
import { bkkDate } from "@/lib/mock/time";
import type { Level, MockState, Settings } from "@/lib/mock/types";

const DAY = 24 * 60 * 60 * 1000;
const ACTIVE = ["WAITING", "CALLED", "IN_PROGRESS"];
const DEFAULT_SETTINGS: Settings = { maxActiveQueues: 3, ageBonusMinutes: 30, chronicBonusMinutes: 15, priorityAgeGroups: ["60+"] };

export async function loadState(): Promise<MockState> {
  const now = Date.now();

  const [departments, doctors, shifts, patients, queues, users, setting] = await Promise.all([
    prisma.department.findMany(),
    prisma.doctor.findMany(),
    prisma.shift.findMany({ where: { startTime: { gte: new Date(now - 7 * DAY) } } }),
    prisma.patient.findMany(),
    prisma.queue.findMany({
      where: { OR: [{ status: { in: ACTIVE } }, { checkInTime: { gte: new Date(now - 14 * DAY) } }] },
    }),
    prisma.user.findMany(),
    prisma.systemSetting.findFirst(),
  ]);

  return {
    version: 0,
    clockOffsetMs: 0,
    sessionUserId: null,
    liffPatientId: null,
    departments: departments.map((d) => ({
      id: d.id,
      code: d.code ?? "Q",
      name: d.name,
      scopeOfCare: d.scopeOfCare ?? "",
      defaultServiceMinutes: d.defaultServiceMinutes,
      isActive: d.isActive,
    })),
    doctors: doctors.map((d) => ({ id: d.id, name: d.name, departmentId: d.departmentId, meetingUrl: d.meetingUrl })),
    shifts: shifts.map((s) => ({
      id: s.id,
      doctorId: s.doctorId,
      date: bkkDate(s.date.getTime()),
      startTime: s.startTime.toISOString(),
      endTime: s.endTime.toISOString(),
      status: s.status as "ACTIVE" | "CANCELLED",
    })),
    patients: patients.map((p) => ({
      id: p.id,
      lineUserId: p.lineUserId,
      fullName: p.fullName ?? "(ยังไม่ลงทะเบียน)",
      ageGroup: p.ageGroup ?? "",
      gender: p.gender ?? "",
      healthCoverage: p.healthCoverage ?? "",
      isChronic: p.isChronic,
      address: p.address,
      createdAt: p.createdAt.toISOString(),
    })),
    queues: queues.map((q) => ({
      id: q.id,
      patientId: q.patientId,
      screeningId: q.screeningId,
      appointmentId: q.appointmentId,
      departmentId: q.departmentId,
      doctorId: q.doctorId,
      queueNumber: q.queueNumber,
      visitType: q.visitType as "ONSITE" | "ONLINE",
      priorityLevel: q.priorityLevel as Level,
      status: q.status as "WAITING" | "CALLED" | "IN_PROGRESS" | "DONE" | "NO_SHOW" | "CANCELLED",
      checkInTime: q.checkInTime.toISOString(),
      calledTime: q.calledTime ? q.calledTime.toISOString() : null,
      finishedTime: q.finishedTime ? q.finishedTime.toISOString() : null,
      editedBy: q.editedBy,
      editedAt: q.editedAt ? q.editedAt.toISOString() : null,
      referredFromQueueId: q.referredFromQueueId,
    })),
    users: users.map((u) => ({
      id: u.id,
      username: u.username,
      role: u.role as "STAFF" | "ADMIN" | "DOCTOR",
      departmentId: u.departmentId,
      doctorId: u.doctorId,
      isActive: u.isActive,
    })),
    settings: setting
      ? {
          maxActiveQueues: setting.maxActiveQueues,
          ageBonusMinutes: setting.ageBonusMinutes,
          chronicBonusMinutes: setting.chronicBonusMinutes,
          priorityAgeGroups: setting.priorityAgeGroups,
        }
      : DEFAULT_SETTINGS,
    // ส่วนที่ยังไม่ดึงจาก DB (ขั้นถัดไปค่อยเพิ่ม) ใส่เป็นลิสต์ว่างไปก่อน
    appointments: [],
    screenings: [],
    prescriptions: [],
    deliveries: [],
    refills: [],
    symptomCodes: [],
    questions: [],
    notifications: [],
    callEvents: [],
    acknowledgedRedFlags: [],
  };
}