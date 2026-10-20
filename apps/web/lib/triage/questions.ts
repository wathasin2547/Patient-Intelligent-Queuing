import { prisma } from "@/lib/prisma";
import type { LineTextMessage } from "@/lib/line/client";

export type Answer = { questionId: string; optionIndex: number };
type Option = { label: string; symptomCode: string | null };

// รูปแบบในปุ่ม: "id:0,id:2"
export function encodeAnswers(a: Answer[]): string {
  return a.map((x) => `${x.questionId}:${x.optionIndex}`).join(",");
}

export function decodeAnswers(s: string | null): Answer[] {
  if (!s) return [];
  return s
    .split(",")
    .map((p) => {
      const [questionId, o] = p.split(":");
      return { questionId, optionIndex: Number(o) };
    })
    .filter((x) => x.questionId && Number.isInteger(x.optionIndex));
}

// dependsOn: null = ถามเสมอ, {symptomCode: "fever"} = ถามเมื่อเคยเลือกอาการนี้
function matches(dependsOn: unknown, codes: Set<string>): boolean {
  if (!dependsOn) return true;
  const want = (dependsOn as { symptomCode?: string | string[] }).symptomCode;
  if (!want) return true;
  return (Array.isArray(want) ? want : [want]).some((c) => codes.has(c));
}

// หาคำถามข้อถัดไป (คืน null = ถามครบแล้ว)
export async function findNextQuestion(answers: Answer[]) {
  const all = await prisma.question.findMany({
    where: { isActive: true },
    orderBy: { order: "asc" },
  });
  const byId = new Map(all.map((q) => [q.id, q]));

  const codes = new Set<string>();
  for (const a of answers) {
    const opts = byId.get(a.questionId)?.options as Option[] | undefined;
    const code = opts?.[a.optionIndex]?.symptomCode;
    if (code) codes.add(code);
  }

  const done = new Set(answers.map((a) => a.questionId));
  return all.find((q) => !done.has(q.id) && matches(q.dependsOn, codes)) ?? null;
}

// สร้างข้อความคำถาม + ปุ่ม โดยแต่ละปุ่มพกคำตอบเดิม + คำตอบใหม่ไปด้วย
export function buildQuestionMessage(
  q: { id: string; questionText: string; options: unknown },
  answers: Answer[],
): LineTextMessage {
  const opts = (q.options as Option[]).slice(0, 13);
  return {
    type: "text",
    text: q.questionText,
    quickReply: {
      items: opts.map((o, i) => ({
        type: "action",
        action: {
          type: "postback",
          label: o.label.slice(0, 20),
          data: `a=${encodeAnswers([...answers, { questionId: q.id, optionIndex: i }])}`,
          displayText: o.label,
        },
      })),
    },
  };
}