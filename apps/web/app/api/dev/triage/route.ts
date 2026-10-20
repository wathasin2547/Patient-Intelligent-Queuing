import { NextResponse } from "next/server";
import { callTriage } from "@/lib/triage/client";

// ใช้ทดสอบตอนพัฒนาเท่านั้น ลบทิ้งก่อน deploy
export async function GET(req: Request) {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }
  const questionId = new URL(req.url).searchParams.get("questionId");
  if (!questionId) {
    return NextResponse.json({ error: "add ?questionId=..." }, { status: 400 });
  }
  const result = await callTriage({
    closedAnswers: [{ questionId, optionIndex: 0 }],
  });
  return NextResponse.json(result);
}