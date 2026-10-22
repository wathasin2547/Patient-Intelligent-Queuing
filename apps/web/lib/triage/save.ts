import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type { ClosedAnswer, TriageResult } from "@/lib/triage/client";

// เที่ยงคืนของวันนี้ตามเวลาไทย (ไว้เริ่มนับเลขคิวใหม่ทุกวัน)
function startOfTodayBangkok(): Date {
  const bkk = new Date(Date.now() + 7 * 3600_000);
  bkk.setUTCHours(0, 0, 0, 0);
  return new Date(bkk.getTime() - 7 * 3600_000);
}

export async function saveScreening(
  lineUserId: string,
  answers: ClosedAnswer[],
  r: TriageResult,
): Promise<{ screeningId: string; queueNumber: string | null }> {
  // 1) หา/สร้างคนไข้จาก LINE userId
  const patient = await prisma.patient.upsert({
    where: { lineUserId },
    update: {},
    create: { lineUserId },
  });

  // 2) บันทึกผลคัดกรอง
  const screening = await prisma.screening.create({
    data: {
      patientId: patient.id,
      answers: answers as unknown as Prisma.InputJsonValue,
      symptomCodes: r.symptomCodes,
      llmCodes: [],
      llmStatus: "skipped",
      departmentScores: {},
      assignedDepartment: r.assignedDepartment,
      priorityLevel: r.priorityLevel,
      onlineEligible: r.onlineEligible,
      isRedFlag: r.isRedFlag,
      reason: { warnings: r.warnings },
    },
  });

  // 3) ไม่มีแผนก = ยังออกคิวไม่ได้ (เก็บผลคัดกรองไว้ก่อน)
  if (!r.assignedDepartment) {
    return { screeningId: screening.id, queueNumber: null };
  }

  // 4) ออกเลขคิว: รหัสแผนก + ลำดับของวันนี้ในแผนกนั้น
  const dept = await prisma.department.findUnique({
    where: { id: r.assignedDepartment },
  });
  const countToday = await prisma.queue.count({
    where: {
      departmentId: r.assignedDepartment,
      checkInTime: { gte: startOfTodayBangkok() },
    },
  });
  const queueNumber = `${dept?.code ?? "Q"}-${String(countToday + 1).padStart(3, "0")}`;

  await prisma.queue.create({
    data: {
      screeningId: screening.id,
      departmentId: r.assignedDepartment,
      doctorId: r.doctorId,
      queueNumber,
      visitType: "ONSITE",
      priorityLevel: r.priorityLevel,
    },
  });

  return { screeningId: screening.id, queueNumber };
}