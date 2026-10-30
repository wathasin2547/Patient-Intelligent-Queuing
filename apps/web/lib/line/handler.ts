import type { LineEvent, LineMessage } from "@/lib/line/client";
import { callTriage } from "@/lib/triage/client";
import { formatTriageResult } from "@/lib/triage/format";
import {
  answeredRedFlag,
  buildQuestionMessage,
  decodeAnswers,
  findNextQuestion,
} from "@/lib/triage/questions";
import { blockMessage, queueLimitFor, saveScreening } from "@/lib/triage/save";

export async function buildReply(event: LineEvent): Promise<LineMessage[] | null> {
  if (event.type === "follow") {
    return [{ type: "text", text: 'ยินดีต้อนรับครับ พิมพ์ "ตรวจ" เพื่อเริ่มคัดกรองอาการ' }];
  }

  if (event.type === "message" && event.message?.type === "text") {
    if (event.message?.text?.trim() === "ตรวจ") {
      // ถือคิวครบแล้ว ไม่ต้องให้ตอบคำถามจนจบก่อนค่อยบอก
      const lineUserId = event.source?.userId;
      const blocked = lineUserId ? await queueLimitFor(lineUserId) : null;
      if (blocked) return [{ type: "text", text: blockMessage(blocked) }];

      const q = await findNextQuestion([]);
      if (!q) return [{ type: "text", text: "ยังไม่มีคำถามในระบบ" }];
      return [buildQuestionMessage(q, [])];
    }

    const t = event.message?.text?.trim();
    if (t === "สถานะคิว" || t === "รับยา" || t === "ข้อมูลของฉัน") {
      return [{ type: "text", text: `เมนู "${t}" กำลังพัฒนา เร็วๆ นี้ครับ` }];
    }
    
    return [{ type: "text", text: 'พิมพ์ "ตรวจ" เพื่อเริ่มคัดกรองอาการครับ' }];
  }

  if (event.type === "postback" && event.postback?.data) {
    const answers = decodeAnswers(new URLSearchParams(event.postback.data).get("a"));
    if (answers.length === 0) return null;

    try {
      // เจออาการฉุกเฉินแล้วไม่ต้องถามต่อ ส่งคัดกรองทันที
      const next = (await answeredRedFlag(answers)) ? null : await findNextQuestion(answers);
      if (next) return [buildQuestionMessage(next, answers)];

      const result = await callTriage({ closedAnswers: answers });
      let text = await formatTriageResult(result);

      // บันทึกลงฐานข้อมูล ถ้าบันทึกพัง ยังตอบผลคัดกรองให้คนไข้ตามปกติ
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
      return [{ type: "text", text: "ขออภัย ระบบขัดข้องชั่วคราว ลองพิมพ์ \"ตรวจ\" ใหม่อีกครั้งครับ" }];
    }
  }

  return null;
}