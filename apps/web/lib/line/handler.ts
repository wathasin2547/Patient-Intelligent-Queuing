import type { LineEvent, LineMessage } from "@/lib/line/client";
import { prisma } from "@/lib/prisma";
import { callTriage } from "@/lib/triage/client";
import { formatTriageResult } from "@/lib/triage/format";
import {
  answeredRedFlag,
  buildQuestionMessage,
  decodeAnswers,
  findNextQuestion,
} from "@/lib/triage/questions";
import { blockMessage, queueLimitFor, saveScreening } from "@/lib/triage/save";

const LIFF_ID = process.env.NEXT_PUBLIC_LIFF_ID ?? process.env.LIFF_ID;
const LIFF_PAGES: Record<string, string> = { "สถานะคิว": "queue", "รับยา": "medicine", "ข้อมูลของฉัน": "register" };
const START_WORDS = ["รับคิว", "ตรวจ"];

async function isRegistered(lineUserId?: string): Promise<boolean> {
  if (!lineUserId) return true;
  const patient = await prisma.patient.findUnique({ where: { lineUserId } });
  return Boolean(patient?.ageGroup);
}

const registerPrompt = (): LineMessage => ({
  type: "text",
  text: `ยินดีต้อนรับครับ กรุณาลงทะเบียนก่อนรับคิว${LIFF_ID ? `\nhttps://liff.line.me/${LIFF_ID}/register` : ""}`,
});

export async function buildReply(event: LineEvent): Promise<LineMessage[] | null> {
  if (event.type === "follow") {
    if (await isRegistered(event.source?.userId)) {
      return [{ type: "text", text: 'ยินดีต้อนรับกลับครับ พิมพ์ "รับคิว" เพื่อเริ่มซักประวัติอาการ' }];
    }
    return [registerPrompt()];
  }

  if (event.type === "message" && event.message?.type === "text") {
    const t = event.message?.text?.trim() ?? "";

    if (START_WORDS.includes(t)) {
      const lineUserId = event.source?.userId;
      if (!(await isRegistered(lineUserId))) return [registerPrompt()];

      const blocked = lineUserId ? await queueLimitFor(lineUserId) : null;
      if (blocked) return [{ type: "text", text: blockMessage(blocked) }];

      const q = await findNextQuestion([]);
      if (!q) return [{ type: "text", text: "ยังไม่มีคำถามในระบบ" }];
      return [buildQuestionMessage(q, [])];
    }

    if (LIFF_PAGES[t]) {
      return [{ type: "text", text: LIFF_ID ? `เปิดเมนู "${t}" ได้ที่ https://liff.line.me/${LIFF_ID}/${LIFF_PAGES[t]}` : `เมนู "${t}" ยังไม่พร้อมใช้งาน` }];
    }

    return [{ type: "text", text: 'พิมพ์ "รับคิว" เพื่อเริ่มซักประวัติอาการครับ' }];
  }

  if (event.type === "postback" && event.postback?.data) {
    const answers = decodeAnswers(new URLSearchParams(event.postback.data).get("a"));
    if (answers.length === 0) return null;

    try {
      const next = (await answeredRedFlag(answers)) ? null : await findNextQuestion(answers);
      if (next) return [buildQuestionMessage(next, answers)];

      const result = await callTriage({ closedAnswers: answers });
      let text = await formatTriageResult(result);

      const lineUserId = event.source?.userId;
      if (lineUserId) {
        try {
          const saved = await saveScreening(lineUserId, answers, result);
          if (saved.queueNumber) text += `\n\nเลขคิวของคุณ: ${saved.queueNumber}`;
          else if (saved.blocked) text += `\n\n${blockMessage(saved.blocked)}`;
        } catch (err) {
          console.error("save screening error", err);
        }
      }
      return [{ type: "text", text }];
    } catch (err) {
      console.error("triage flow error", err);
      return [{ type: "text", text: 'ขออภัย ระบบขัดข้องชั่วคราว ลองพิมพ์ "รับคิว" ใหม่อีกครั้งครับ' }];
    }
  }

  return null;
}