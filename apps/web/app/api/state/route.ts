import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { loadState } from "@/lib/db/state";

export const dynamic = "force-dynamic";

// หน้า staff เรียกทุก ๆ 5 วินาทีเพื่อเอาข้อมูลล่าสุดจาก DB (ต้องล็อกอินก่อน)
export async function GET() {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const state = await loadState();
  return NextResponse.json({ ...state, sessionUserId: session.user.id });
}