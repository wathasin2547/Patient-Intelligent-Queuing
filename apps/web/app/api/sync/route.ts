import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { autoCallTick } from "@/lib/db/auto-call";
import { applyChanges, type Changes } from "@/lib/db/sync";
import type { Role } from "@/lib/auth/schema";

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const body = (await req.json()) as Changes;
  const result = await applyChanges(body, session.user.role as Role);
  if (result.error) return NextResponse.json({ error: result.error }, { status: result.status ?? 400 });

  await autoCallTick(true);
  return NextResponse.json({ ok: true });
}
