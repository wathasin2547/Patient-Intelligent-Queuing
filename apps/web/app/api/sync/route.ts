import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { applyQueueChanges, type QueueChange } from "@/lib/db/queue-actions";

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const body = (await req.json()) as { queues?: QueueChange[] };
  const result = await applyQueueChanges(body.queues ?? []);
  if (result.error) return NextResponse.json({ error: result.error }, { status: 400 });
  return NextResponse.json({ ok: true });
}