import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { ageGroupOf } from "@/lib/age";
import { prisma } from "@/lib/prisma";
import { callTriage } from "@/lib/triage/client";
import { answeredRedFlag, findNextQuestion, type Answer } from "@/lib/triage/questions";
import { saveScreening } from "@/lib/triage/save";

const AGES = [4, 12, 25, 40, 67, 72];
const pick = <T,>(xs: T[]): T => xs[Math.floor(Math.random() * xs.length)];

async function randomAnswers(): Promise<Answer[]> {
  for (let attempt = 0; attempt < 5; attempt++) {
    const answers: Answer[] = [];
    for (let step = 0; step < 15; step++) {
      const q = await findNextQuestion(answers);
      if (!q) break;
      const n = (q.options as unknown[]).length;
      answers.push({ questionId: q.id, optionIndex: Math.floor(Math.random() * n) });
    }
    if (answers.length > 0 && !(await answeredRedFlag(answers))) return answers;
  }
  return [];
}

export async function POST(req: Request) {
  if (process.env.NODE_ENV === "production") return NextResponse.json({ error: "not found" }, { status: 404 });
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => null);
  const count = Math.min(Math.max(Number(body?.count) || 1, 1), 10);
  const results: { name: string; queueNumber: string | null; note: string | null }[] = [];

  for (let i = 0; i < count; i++) {
    try {
      const answers = await randomAnswers();
      if (answers.length === 0) {
        results.push({ name: "-", queueNumber: null, note: "ไม่มีคำถามให้ตอบ" });
        continue;
      }
      const age = pick(AGES);
      const tag = Math.random().toString(36).slice(2, 7);
      const patient = await prisma.patient.create({
        data: {
          lineUserId: `U-test-${Date.now()}-${tag}`,
          fullName: `ผู้ป่วยทดสอบ ${tag}`,
          age,
          ageGroup: ageGroupOf(age),
          gender: pick(["ชาย", "หญิง"]),
          healthCoverage: "บัตรทอง",
          isChronic: Math.random() < 0.3,
        },
      });
      const triage = await callTriage({ closedAnswers: answers });
      const saved = await saveScreening(patient.lineUserId, answers, triage);
      results.push({ name: patient.fullName ?? "-", queueNumber: saved.queueNumber, note: saved.blocked?.kind ?? null });
    } catch (err) {
      results.push({ name: "-", queueNumber: null, note: err instanceof Error ? err.message : "error" });
    }
  }
  return NextResponse.json({ results });
}