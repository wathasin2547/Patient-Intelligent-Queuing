import { NextResponse } from "next/server";
import { loadState, stateForDisplay } from "@/lib/db/state";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json(stateForDisplay(await loadState()));
}
