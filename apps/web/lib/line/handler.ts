import type { LineEvent, LineMessage } from "@/lib/line/client";
import { callTriage } from "@/lib/triage/client";
import { formatTriageResult } from "@/lib/triage/format";
import {
  buildQuestionMessage,
  decodeAnswers,
  findNextQuestion,
} from "@/lib/triage/questions";
import { saveScreening } from "@/lib/triage/save";

export async function buildReply(event: LineEvent): Promise<LineMessage[] | null> {
  if (event.type === "follow") {
    return [{ type: "text", text: 'ยินดีต้อนรับครับ พิมพ์ "ตรวจ" เพื่อเริ่มคัดกรองอาการ' }];
  }

  if (event.type === "message" && event.message?.type === "text") {
    if (event.message?.text?.trim() === "ตรวจ") {
      const q = await findNextQuestion([]);
      if (!q) return [{ type: "text", text: "ยังไม่มีคำถามในระบบ" }];
      return [buildQuestionMessage(q, [])];
    }
    return [{ type: "text", text: 'พิมพ์ "ตรวจ" เพื่อเริ่มคัดกรองอาการครับ' }];
  }

  if (event.type === "postback" && event.postback?.data) {
    const answers = decodeAnswers(new URLSearchParams(event.postback.data).get("a"));
    if (answers.length === 0) return null;

    try {
      const next = await findNextQuestion(answers);
      if (next) return [buildQuestionMessage(next, answers)];

      const result = await callTriage({ closedAnswers: answers });
let text = await formatTriageResult(result);

// บันทึกลงฐานข้อมูล ถ้าบันทึกพัง ยังตอบผลคัดกรองให้คนไข้ตามปกติ
const lineUserId = event.source?.userId;
if (lineUserId) {
  try {
    const saved = await saveScreening(lineUserId, answers, result);
    if (saved.queueNumber) text += `\n\nเลขคิวของคุณ: ${saved.queueNumber}`;
  } catch (err) {
    console.error("save screening error", err);
  }
}
return [{ type: "text", text }];
    } catch (err) {
      console.error("triage flow error", err);
      return [{ type: "text", text: "ขออภัย ระบบขัดข้องชั่วคราว ลองพิมพ์ \"ตรวจ\" ใหม่อีกครั้งครับ" }];
    }
  }

  return null;
}