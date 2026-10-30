import { NextResponse } from "next/server";
import { loadState } from "@/lib/db/state";
import { getLineUserId } from "@/lib/line/profile";

export const dynamic = "force-dynamic";

// หน้า LIFF เรียกด้วย Authorization: Bearer <LINE access token>
export async function GET(req: Request) {
  const token = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!token) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const lineUserId = await getLineUserId(token);
  if (!lineUserId) return NextResponse.json({ error: "invalid token" }, { status: 401 });

  const state = await loadState();
  const me = state.patients.find((p) => p.lineUserId === lineUserId) ?? null;

  return NextResponse.json({
    ...state,
    // ผู้ป่วยเห็นเฉพาะข้อมูลตัวเอง และไม่ส่งรายชื่อบัญชีเจ้าหน้าที่ไปให้
    patients: me ? [me] : [],
    users: [],
    sessionUserId: null,
    liffPatientId: me?.id ?? null,
    registered: me !== null,
  });
}