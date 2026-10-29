import { prisma } from "@/lib/prisma";
import { pushMessage } from "@/lib/line/client";

// สถานะที่เปลี่ยนต่อได้ (กันข้ามขั้น เช่น จาก WAITING ไป DONE ตรงๆ)
const ALLOWED: Record<string, string[]> = {
  WAITING: ["CALLED", "CANCELLED"],
  CALLED: ["IN_PROGRESS", "NO_SHOW", "DONE"],
  IN_PROGRESS: ["DONE"],
};

const BUSY = ["CALLED", "IN_PROGRESS"];

// สิ่งที่เบราว์เซอร์ส่งมาบอกว่าคิวนี้เปลี่ยนเป็นอะไร (ขั้นนี้รับแค่สถานะกับเวลา)
export type QueueChange = {
  id: string;
  status: string;
  calledTime: string | null;
  finishedTime: string | null;
};

/** ก่อนเรียก ต้องไม่ชนกัน: แพทย์คนเดียวตรวจได้ทีละคน และผู้ป่วยคนเดียวถูกเรียกได้ทีละห้อง */
async function whyCannotCall(q: { doctorId: string | null; patientId: string }): Promise<string | null> {
  if (!q.doctorId) return "คิวนี้ยังไม่มีแพทย์";
  const doctorBusy = await prisma.queue.count({ where: { doctorId: q.doctorId, status: { in: BUSY } } });
  if (doctorBusy > 0) return "แพทย์กำลังตรวจหรือเรียกผู้ป่วยอยู่";
  const patientBusy = await prisma.queue.count({ where: { patientId: q.patientId, status: { in: BUSY } } });
  if (patientBusy > 0) return "ผู้ป่วยกำลังตรวจอยู่อีกแผนก";
  return null;
}

/** ส่งข้อความหาผู้ป่วยว่าถึงคิวแล้ว ถ้าส่งไม่ได้ก็ไม่ให้การเรียกคิวล้มเหลว */
async function notifyCalled(queueId: string) {
  try {
    const token = process.env.LINE_CHANNEL_ACCESS_TOKEN;
    if (!token) return;
    const q = await prisma.queue.findUnique({ where: { id: queueId }, include: { patient: true, doctor: true } });
    // userId จริงของ LINE ขึ้นต้นด้วย U ตามด้วย 32 ตัวอักษร (ข้ามบัญชีทดสอบ)
    if (!q || !/^U[0-9a-f]{32}$/.test(q.patient.lineUserId)) return;

    const doctorName = q.doctor?.name ?? "แพทย์";
    const text =
      q.visitType === "ONLINE" && q.doctor?.meetingUrl
        ? `ถึงคิวตรวจออนไลน์ของคุณแล้ว หมายเลข ${q.queueNumber} กดลิงก์เพื่อเข้าห้องตรวจกับ ${doctorName}: ${q.doctor.meetingUrl}`
        : `ถึงคิวของคุณแล้ว หมายเลข ${q.queueNumber} เชิญที่ห้องตรวจ ${doctorName}`;
    await pushMessage(q.patient.lineUserId, [{ type: "text", text }], token);
  } catch (err) {
    console.error("notify called error", err);
  }
}

export async function applyQueueChanges(changes: QueueChange[]): Promise<{ error?: string }> {
  for (const c of changes) {
    const cur = await prisma.queue.findUnique({ where: { id: c.id } });
    if (!cur) return { error: "ไม่พบคิวนี้" };

    const changed = c.status !== cur.status;
    if (changed) {
      if (!ALLOWED[cur.status]?.includes(c.status)) {
        return { error: `เปลี่ยนสถานะจาก ${cur.status} เป็น ${c.status} ไม่ได้` };
      }
      if (c.status === "CALLED") {
        const why = await whyCannotCall(cur);
        if (why) return { error: why };
      }
    }

    await prisma.queue.update({
      where: { id: c.id },
      data: {
        status: c.status,
        calledTime: c.calledTime ? new Date(c.calledTime) : null,
        finishedTime: c.finishedTime ? new Date(c.finishedTime) : null,
      },
    });

    if (changed && c.status === "CALLED") await notifyCalled(c.id);
  }
  return {};
}