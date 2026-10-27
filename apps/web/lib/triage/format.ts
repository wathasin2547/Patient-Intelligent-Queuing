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
  if (r.isRedFlag) {
    // emergency: no queue number — send the patient to the emergency point now
    return "พบอาการที่ควรได้รับการดูแลทันที\nกรุณาไปที่จุดบริการฉุกเฉินของโรงพยาบาล หรือโทร 1669 ระบบจะไม่ออกเลขคิวปกติให้";
  }
  // no-doctor text (with the next shift time) is added by blockMessage in lib/triage/save.ts
  return lines.join("\n");
}