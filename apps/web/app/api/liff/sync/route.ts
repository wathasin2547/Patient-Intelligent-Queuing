import { NextResponse } from "next/server";
import { autoCallTick } from "@/lib/db/auto-call";
import { applyPatientChanges, type PatientChanges } from "@/lib/db/sync";
import { getLineUserId } from "@/lib/line/profile";

export async function POST(req: Request) {
  const token = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!token) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const lineUserId = await getLineUserId(token);
  if (!lineUserId) return NextResponse.json({ error: "invalid token" }, { status: 401 });

  const result = await applyPatientChanges(lineUserId, (await req.json()) as PatientChanges);
  if (result.error) return NextResponse.json({ error: result.error }, { status: result.status ?? 400 });

  await autoCallTick(true);
  return NextResponse.json({ ok: true });
}
