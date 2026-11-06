import { pushMessage } from "@/lib/line/client";
import { prisma } from "@/lib/prisma";

const REAL_LINE_USER = /^U[0-9a-f]{32}$/;

export async function sendToPatient(patientId: string, text: string): Promise<boolean> {
  try {
    const token = process.env.LINE_CHANNEL_ACCESS_TOKEN;
    if (!token) return false;
    const patient = await prisma.patient.findUnique({ where: { id: patientId } });
    if (!patient || !REAL_LINE_USER.test(patient.lineUserId)) return false;
    await pushMessage(patient.lineUserId, [{ type: "text", text }], token);
    return true;
  } catch (err) {
    console.error("LINE push failed", err);
    return false;
  }
}
