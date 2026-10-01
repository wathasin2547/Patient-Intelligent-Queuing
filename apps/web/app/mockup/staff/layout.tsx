import Link from "next/link";
import { MockBanner } from "../_ui";

const NAV = [
  { href: "/mockup/staff", label: "ติดตามคิว", icon: "▦" },
  { href: "/mockup/staff/shifts", label: "ตารางเวรแพทย์", icon: "◷", admin: true },
  { href: "/mockup/staff", label: "ข้อมูลพื้นฐานระบบ", icon: "⚙", admin: true, disabled: true },
  { href: "/mockup/staff", label: "รายงานสถิติ", icon: "◔", admin: true, disabled: true },
];

export default function StaffLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col bg-zinc-50">
      <MockBanner />
      <div className="flex flex-1">
        <aside className="hidden w-60 shrink-0 flex-col border-r border-zinc-200 bg-white md:flex">
          <div className="flex items-center gap-2 px-5 py-5">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-teal-600 font-bold text-white">P</div>
            <div>
              <div className="text-sm font-semibold leading-tight">PIQ</div>
              <div className="text-xs text-zinc-500">ระบบจัดการคิวผู้ป่วย</div>
            </div>
          </div>
          <nav className="flex flex-col gap-0.5 px-3">
            {NAV.map((n) => (
              <Link
                key={n.label}
                href={n.href}
                className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm ${
                  n.disabled ? "pointer-events-none text-zinc-400" : "text-zinc-700 hover:bg-zinc-100"
                }`}
              >
                <span className="w-4 text-center">{n.icon}</span>
                {n.label}
                {n.admin && <span className="ml-auto rounded bg-zinc-100 px-1.5 text-[10px] text-zinc-500">ADMIN</span>}
              </Link>
            ))}
          </nav>
          <div className="mt-auto border-t border-zinc-200 px-5 py-4 text-sm">
            <div className="font-medium">admin</div>
            <div className="text-xs text-zinc-500">ผู้ดูแลระบบ</div>
            <Link href="/mockup/login" className="mt-2 inline-block text-xs text-teal-700 hover:underline">
              ออกจากระบบ
            </Link>
          </div>
        </aside>
        <main className="flex-1 overflow-x-hidden">{children}</main>
      </div>
    </div>
  );
}
