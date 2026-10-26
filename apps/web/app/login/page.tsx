"use client";

// UC02 — staff sign in with username + password. Mock: the username is checked
// against the user list (active/suspended); the password is not verified yet.

import { Activity, ArrowRight, ListOrdered, Stethoscope } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { btn, MockBadge, Notice } from "@/components/ui";
import { login } from "@/lib/mock/actions";
import { useMock } from "@/lib/mock/store";

const DEMO = [
  { username: "admin", label: "ผู้ดูแลระบบ" },
  { username: "staff.med", label: "เจ้าหน้าที่อายุรกรรม" },
  { username: "staff.old", label: "บัญชีถูกระงับ" },
];

export default function LoginPage() {
  const router = useRouter();
  const { state, update } = useMock();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!username.trim() || !password) return setError("กรุณากรอกชื่อผู้ใช้และรหัสผ่าน");
    const r = login(state, username);
    if (r.error) return setError(r.error);
    update(() => r.state);
    router.push("/staff");
  }

  return (
    <div className="flex min-h-screen items-center justify-center p-4 sm:p-6">
      <div className="grid w-full max-w-5xl overflow-hidden rounded-[32px] bg-surface shadow-[0_24px_60px_-30px_rgba(21,22,19,0.3)] lg:grid-cols-[1.1fr_1fr]">
        <div className="relative hidden flex-col justify-between bg-ink p-10 text-white lg:flex">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-full bg-lime text-ink"><Activity size={19} strokeWidth={2.2} /></span>
            <span className="font-semibold">PIQ</span>
          </div>
          <div>
            <h2 className="text-[40px] font-medium leading-[1.15] tracking-tight">
              จัดคิว
              <span className="mx-2 inline-flex h-10 w-16 translate-y-1 items-center justify-center rounded-full bg-lime text-ink align-baseline"><ListOrdered size={20} strokeWidth={2} /></span>
              ผู้ป่วย
              <br />
              ตามความเร่งด่วน
              <span className="mx-2 inline-flex h-10 w-16 translate-y-1 items-center justify-center rounded-full bg-white/15 align-baseline"><Stethoscope size={20} strokeWidth={2} /></span>
            </h2>
            <p className="mt-5 max-w-sm text-sm leading-relaxed text-white/60">
              ระบบคัดกรองผ่าน LINE จำแนกแผนก และเรียกคิวเองเมื่อแพทย์ว่าง โดยไม่ให้ผู้ป่วยอาการเบารอนานเกินไป
            </p>
          </div>
          <p className="text-xs text-white/40">ระบบแนะนำแผนก ไม่ได้วินิจฉัยโรค</p>
        </div>

        <div className="p-8 sm:p-12">
          <div className="flex items-center justify-between">
            <span className="flex h-10 w-10 items-center justify-center rounded-full bg-ink text-lime lg:hidden"><Activity size={19} strokeWidth={2.2} /></span>
            <MockBadge />
          </div>
          <h1 className="mt-8 text-[32px] font-semibold tracking-tight">เข้าสู่ระบบ</h1>
          <p className="text-sm text-ink-3">สำหรับบุคลากรทางการแพทย์</p>

          <form onSubmit={submit} className="mt-8 flex flex-col gap-4">
            <label className="block">
              <span className="mb-1.5 block text-xs font-medium text-ink-2">ชื่อผู้ใช้</span>
              <input value={username} onChange={(e) => setUsername(e.target.value)} autoComplete="username" className="input py-3" placeholder="เช่น staff.med" />
            </label>
            <label className="block">
              <span className="mb-1.5 block text-xs font-medium text-ink-2">รหัสผ่าน</span>
              <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" className="input py-3" />
            </label>
            {error && <Notice tone="rose">{error}</Notice>}
            <button type="submit" className={`${btn.primary} mt-2 py-3`}>
              เข้าสู่ระบบ <ArrowRight size={16} strokeWidth={2} />
            </button>
          </form>
          <p className="mt-4 text-center text-xs text-ink-3">ไม่มีบัญชี? ติดต่อผู้ดูแลระบบเพื่อสร้างบัญชีให้</p>

          <div className="mt-8 border-t border-subtle pt-6">
            <div className="text-xs text-ink-3">บัญชีทดลอง · รหัสผ่านใส่อะไรก็ได้ในโหมดข้อมูลสมมติ</div>
            <div className="mt-3 flex flex-wrap gap-2">
              {DEMO.map((d) => (
                <button key={d.username} type="button" onClick={() => setUsername(d.username)} className="rounded-full bg-subtle px-3.5 py-2 text-left text-xs hover:bg-[#e9eae4]">
                  <span className="font-mono font-medium">{d.username}</span> <span className="text-ink-3">· {d.label}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
