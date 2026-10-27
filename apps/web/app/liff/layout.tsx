"use client";

// LIFF pages open inside LINE. On desktop they are shown in a phone-sized frame.
// UC02 for patients: LINE identifies the user automatically — the mock lets you switch test users.

import { ChevronLeft, House, MoreHorizontal } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { MockBadge } from "@/components/ui";
import { LIFF_USER_PREFIX } from "@/lib/mock/actions";
import { useMock } from "@/lib/mock/store";

const DEMO_USERS = [
  { id: "pt_14", label: "ผู้ป่วยทดสอบ 14 — มีคิวรออยู่" },
  { id: "pt_01", label: "ผู้ป่วยทดสอบ 01 — มี 2 คิว (MED นัด + ENT) + ยารอเลือก" },
  { id: "pt_16", label: "ผู้ป่วยทดสอบ 16 — ตรวจออนไลน์" },
  { id: "", label: "ผู้ใช้ LINE ใหม่ — ยังไม่ลงทะเบียน" },
];

export default function LiffLayout({ children }: { children: React.ReactNode }) {
  const { state, update } = useMock();
  const pathname = usePathname();
  // patients registered through /liff/register during this demo
  const fresh = state.patients.filter((p) => p.lineUserId.startsWith(LIFF_USER_PREFIX));
  const options = [...DEMO_USERS, ...fresh.map((p) => ({ id: p.id, label: `${p.fullName} — ลงทะเบียนใหม่` }))];

  return (
    <div className="flex min-h-screen flex-col items-center sm:py-6">
      <div className="flex w-full max-w-[420px] flex-wrap items-center justify-between gap-2 px-4 py-3 sm:px-0">
        <Link href="/dev" className="flex h-9 w-9 items-center justify-center rounded-full bg-surface text-ink-2 ring-1 ring-line hover:text-ink" title="หน้ารวมสำหรับผู้พัฒนา">
          <House size={16} strokeWidth={1.8} />
        </Link>
        <select
          value={state.liffPatientId ?? ""}
          onChange={(e) => update((s) => ({ ...s, liffPatientId: e.target.value || null }))}
          className="pill min-w-0 flex-1 text-xs"
          title="ทดสอบในฐานะผู้ใช้ LINE"
        >
          {options.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
        </select>
        <MockBadge />
      </div>

      <div className="flex w-full max-w-[420px] flex-1 flex-col overflow-hidden bg-canvas sm:flex-none sm:rounded-[44px] sm:bg-brand sm:p-2.5 sm:shadow-[0_30px_70px_-30px_rgba(3,4,94,0.45)]">
        <div className="flex min-h-[760px] flex-1 flex-col overflow-hidden bg-canvas sm:rounded-[36px]">
          <div className="flex items-center gap-2 bg-surface px-4 py-3.5">
            {pathname !== "/liff" ? (
              <Link href="/liff" className="-ml-1 flex h-8 w-8 items-center justify-center rounded-full hover:bg-subtle"><ChevronLeft size={20} strokeWidth={1.8} /></Link>
            ) : (
              <span className="w-1" />
            )}
            <span className="flex-1 text-sm font-semibold">โรงพยาบาลตัวอย่าง</span>
            <MoreHorizontal size={18} strokeWidth={1.8} className="text-ink-3" />
          </div>
          <div className="flex flex-1 flex-col">{children}</div>
        </div>
      </div>
    </div>
  );
}
