// UC02 — staff and doctors sign in with username + password (NextAuth Credentials, see auth.ts).

import { Activity } from "lucide-react";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { homeOf } from "@/lib/auth/schema";
import { LoginForm } from "./LoginForm";

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const session = await auth();
  if (session?.user) redirect(homeOf(session.user.role));
  const { callbackUrl } = await searchParams;

  return (
    <div className="flex min-h-screen items-center justify-center bg-[radial-gradient(ellipse_at_top_left,var(--color-ocean-100),transparent_55%),radial-gradient(ellipse_at_bottom_right,#e0f6fb,transparent_50%)] p-4 sm:p-6">
      <div className="grid w-full max-w-5xl overflow-hidden rounded-[28px] border border-line/70 bg-surface shadow-raised lg:grid-cols-[1.1fr_1fr]">
        {/* Brand panel: navy with the palette colours as stacked "queue" bars. */}
        <div className="relative hidden flex-col justify-between overflow-hidden bg-brand p-10 text-white lg:flex">
          <Logo />
          <div>
            <h2 className="text-[44px] font-semibold leading-[1.1] tracking-tight">
              Patient
              <br />
              Intelligent
              <br />
              <span className="text-accent">Queuing</span>
            </h2>
            <p className="mt-5 max-w-sm text-sm leading-relaxed text-white/80">
              ระบบคัดกรองผ่าน LINE จำแนกแผนก และเรียกคิวเองเมื่อแพทย์ว่าง โดยไม่ให้ผู้ป่วยอาการเบารอนานเกินไป
            </p>
            <div className="mt-8 flex flex-col gap-2" aria-hidden>
              {["w-full bg-primary", "w-10/12 bg-ocean-500", "w-8/12 bg-ocean-300", "w-6/12 bg-ocean-100"].map((c) => (
                <span key={c} className={`h-2.5 rounded-full ${c}`} />
              ))}
            </div>
          </div>
          <span aria-hidden />
        </div>

        <div className="flex flex-col justify-center p-8 sm:p-12">
          <div className="lg:hidden"><Logo /></div>
          <h1 className="mt-8 text-[32px] font-semibold tracking-tight text-ink lg:mt-0">เข้าสู่ระบบ</h1>
          <p className="mt-1 text-sm text-ink-3">สำหรับบุคลากรทางการแพทย์</p>
          <div className="ocean-band mt-5 h-1 w-24 rounded-full" aria-hidden />
          <LoginForm callbackUrl={typeof callbackUrl === "string" ? callbackUrl : undefined} />
          <p className="mt-4 text-center text-xs text-ink-3">ไม่มีบัญชี? ติดต่อผู้ดูแลระบบเพื่อสร้างบัญชีให้</p>
        </div>
      </div>
    </div>
  );
}

function Logo() {
  return (
    <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-accent text-ink" role="img" aria-label="Patient Intelligent Queuing">
      <Activity size={20} strokeWidth={2.2} />
    </span>
  );
}
