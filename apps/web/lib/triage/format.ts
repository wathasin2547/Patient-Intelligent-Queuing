import { prisma } from "@/lib/prisma";
import type { TriageResult } from "@/lib/triage/client";

const LEVEL_TEXT: Record<number, string> = {
  1: "ฉุกเฉินมาก",
  2: "เร่งด่วน",
  3: "ค่อนข้างเร่งด่วน",
  4: "ไม่เร่งด่วนมาก",
  5: "ไม่เร่งด่วน",
};

export async function formatTriageResult(r: TriageResult): Promise<string> {
  let deptName = "ยังระบุไม่ได้";
  if (r.assignedDepartment) {
    const d = await prisma.department.findUnique({
      where: { id: r.assignedDepartment },
    });
    deptName = d?.name ?? deptName;
  }

  const lines = [
    "ผลการคัดกรองเบื้องต้น",
    `แผนกที่แนะนำ: ${deptName}`,
    `ความเร่งด่วน: ระดับ ${r.priorityLevel} (${LEVEL_TEXT[r.priorityLevel] ?? "-"})`,
  ];
  if (r.isRedFlag) lines.push("พบอาการที่ควรพบแพทย์ทันที");
  if (r.noDoctorOnShift) lines.push("ขณะนี้ยังไม่มีแพทย์เข้าเวร");
  return lines.join("\n");
}