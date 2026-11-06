import type { LineEvent, LineMessage } from "@/lib/line/client";
import { callTriage, type TriageResult } from "@/lib/triage/client";
import { formatTriageResult } from "@/lib/triage/format";
import {
  answeredRedFlag,
  buildQuestionMessage,
  decodeAnswers,
  encodeAnswers,
  type Answer,
  findNextQuestion,
} from "@/lib/triage/questions";
import { blockMessage, queueLimitFor, saveScreening } from "@/lib/triage/save";

const LIFF_ID = process.env.NEXT_PUBLIC_LIFF_ID ?? process.env.LIFF_ID;
const LIFF_PAGES: Record<string, string> = { "สถานะคิว": "queue", "รับยา": "medicine", "ข้อมูลของฉัน": "register" };

function offerOnline(answers: Answer[], text: string): LineMessage {
  const choice = (label: string, visit: "ONLINE" | "ONSITE") => ({
    type: "action" as const,
    action: { type: "postback" as const, label, data: `a=${encodeAnswers(answers)}&v=${visit}`, displayText: label },
  });
  return {
    type: "text",
    text: `${text}\n\nอาการของคุณเข้าเกณฑ์ตรวจออนไลน์ได้ กรุณาเลือกวิธีรับบริการ`,
    quickReply: { items: [choice("ตรวจออนไลน์", "ONLINE"), choice("มาตรวจที่โรงพยาบาล", "ONSITE")] },
  };
}

const canOfferOnline = (r: TriageResult) => r.onlineEligible && !r.isRedFlag && Boolean(r.doctorId);

export async function buildReply(event: LineEvent): Promise<LineMessage[] | null> {
  if (event.type === "follow") {
    return [{ type: "text", text: 'ยินดีต้อนรับครับ พิมพ์ "ตรวจ" เพื่อเริ่มคัดกรองอาการ' }];
  }

  if (event.type === "message" && event.message?.type === "text") {
    if (event.message?.text?.trim() === "ตรวจ") {
      const lineUserId = event.source?.userId;
      const blocked = lineUserId ? await queueLimitFor(lineUserId) : null;
      if (blocked) return [{ type: "text", text: blockMessage(blocked) }];

      const q = await findNextQuestion([]);
      if (!q) return [{ type: "text", text: "ยังไม่มีคำถามในระบบ" }];
      return [buildQuestionMessage(q, [])];
    }

    const t = event.message?.text?.trim();
    if (t && LIFF_PAGES[t]) {
      return [{ type: "text", text: LIFF_ID ? `เปิดเมนู "${t}" ได้ที่ https://liff.line.me/${LIFF_ID}/${LIFF_PAGES[t]}` : `เมนู "${t}" ยังไม่พร้อมใช้งาน` }];
    }
    
    return [{ type: "text", text: 'พิมพ์ "ตรวจ" เพื่อเริ่มคัดกรองอาการครับ' }];
  }

  if (event.type === "postback" && event.postback?.data) {
    const params = new URLSearchParams(event.postback.data);
    const answers = decodeAnswers(params.get("a"));
    const visit = params.get("v");
    if (answers.length === 0) return null;

    try {
      const next = (await answeredRedFlag(answers)) ? null : await findNextQuestion(answers);
      if (next) return [buildQuestionMessage(next, answers)];

      const result = await callTriage({ closedAnswers: answers });
      let text = await formatTriageResult(result);
      if (canOfferOnline(result) && !visit) return [offerOnline(answers, text)];

      const lineUserId = event.source?.userId;
      if (lineUserId) {
        try {
          const visitType = visit === "ONLINE" && canOfferOnline(result) ? "ONLINE" : "ONSITE";
          const saved = await saveScreening(lineUserId, answers, result, visitType);
          if (saved.queueNumber) text += `\n\nเลขคิวของคุณ: ${saved.queueNumber}`;
          else if (saved.blocked) text += `\n\n${blockMessage(saved.blocked)}`;
          if (LIFF_ID && saved.queueNumber && !saved.registered) {
            text += `\n\nลงทะเบียนอายุและโรคประจำตัวได้ที่ https://liff.line.me/${LIFF_ID}/register เพื่อให้ระบบนำไปใช้จัดลำดับคิว`;
          }
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