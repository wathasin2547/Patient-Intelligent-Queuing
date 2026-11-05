import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type { ClosedAnswer, TriageResult } from "@/lib/triage/client";
import { issueQueueNumber } from "@/lib/db/queue-number";

const ACTIVE = ["WAITING", "CALLED", "IN_PROGRESS"];

export type QueueBlock =
  | { kind: "SAME_DEPARTMENT"; queueNumber: string }
  | { kind: "LIMIT"; max: number }
  | { kind: "NO_DOCTOR"; nextShiftStart: string | null };

async function activeQueues(patientId: string) {
  return prisma.queue.findMany({
    where: { status: { in: ACTIVE }, patientId },
    select: { departmentId: true, queueNumber: true },
  });
}

async function maxActiveQueues(): Promise<number> {
  const setting = await prisma.systemSetting.findFirst();
  return setting?.maxActiveQueues ?? 3;
}

export async function queueLimitFor(lineUserId: string): Promise<QueueBlock | null> {
  const patient = await prisma.patient.findUnique({ where: { lineUserId } });
  if (!patient) return null;
  const [active, max] = await Promise.all([activeQueues(patient.id), maxActiveQueues()]);
  return active.length >= max ? { kind: "LIMIT", max } : null;
}

export async function saveScreening(
  lineUserId: string,
  answers: ClosedAnswer[],
  r: TriageResult,
): Promise<{ screeningId: string; queueNumber: string | null; blocked: QueueBlock | null }> {
  const patient = await prisma.patient.upsert({
    where: { lineUserId },
    update: {},
    create: { lineUserId },
  });

  const screening = await prisma.screening.create({
    data: {
      patientId: patient.id,
      answers: answers as unknown as Prisma.InputJsonValue,
      symptomCodes: r.symptomCodes,
      llmCodes: r.llmCodes,
      llmStatus: r.llmStatus,
      departmentScores: r.departmentScores,
      assignedDepartment: r.assignedDepartment,
      priorityLevel: r.priorityLevel,
      onlineEligible: r.onlineEligible,
      isRedFlag: r.isRedFlag,
      reason: { items: r.reason, warnings: r.warnings } as unknown as Prisma.InputJsonValue,
    },
  });

  if (!r.assignedDepartment) {
    return { screeningId: screening.id, queueNumber: null, blocked: null };
  }

  if (r.noDoctorOnShift || !r.doctorId) {
    return { screeningId: screening.id, queueNumber: null, blocked: { kind: "NO_DOCTOR", nextShiftStart: r.nextShiftStart } };
  }

  const [active, max] = await Promise.all([activeQueues(patient.id), maxActiveQueues()]);
  const same = active.find((q) => q.departmentId === r.assignedDepartment);
  if (same) {
    return { screeningId: screening.id, queueNumber: null, blocked: { kind: "SAME_DEPARTMENT", queueNumber: same.queueNumber } };
  }
  if (active.length >= max) {
    return { screeningId: screening.id, queueNumber: null, blocked: { kind: "LIMIT", max } };
  }

  const queueNumber = await issueQueueNumber(r.assignedDepartment);

  await prisma.queue.create({
    data: {
      patientId: patient.id,
      screeningId: screening.id,
      departmentId: r.assignedDepartment,
      doctorId: r.doctorId,
      queueNumber,
      visitType: "ONSITE",
      priorityLevel: r.priorityLevel,
    },
  });

  return { screeningId: screening.id, queueNumber, blocked: null };
}

export function blockMessage(b: QueueBlock): string {
  if (b.kind === "SAME_DEPARTMENT") return `คุณมีคิวของแผนกนี้อยู่แล้ว หมายเลข ${b.queueNumber} ระบบจึงไม่ออกคิวซ้ำ`;
  if (b.kind === "LIMIT") return `คุณถือคิวได้พร้อมกันสูงสุด ${b.max} คิว กรุณารอให้คิวเดิมเสร็จก่อน หรือติดต่อเจ้าหน้าที่`;
  const next = b.nextShiftStart
    ? new Date(b.nextShiftStart).toLocaleTimeString("th-TH", { timeZone: "Asia/Bangkok", hour: "2-digit", minute: "2-digit" })
    : null;
  return next ? `ขณะนี้ยังไม่มีแพทย์ในเวรของแผนกนี้ เปิดให้บริการรอบถัดไปเวลาประมาณ ${next} น.` : "ขณะนี้ยังไม่มีแพทย์ในเวรของแผนกนี้ กรุณาติดต่อเจ้าหน้าที่";
}
