import { NextResponse } from "next/server";
import { autoCallTick } from "@/lib/db/auto-call";

export async function POST() {
  return NextResponse.json(await autoCallTick());
}
