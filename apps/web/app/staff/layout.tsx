"use client";

import { Activity, ArrowUpRight, CalendarDays, Clock3, LayoutGrid, ListOrdered, LogOut, RotateCcw, SlidersHorizontal, Stethoscope, type LucideIcon } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";
import { MockBadge } from "@/components/ui";
import { homeOf, ROLE_LABEL } from "@/lib/mock/actions";
import { NO_SHOW_MINUTES } from "@/lib/mock/logic";
import { useMock } from "@/lib/mock/store";
import { fmtDate, fmtTime } from "@/lib/mock/time";
import type { Role } from "@/lib/mock/types";

const NAV: { href: string; label: string; uc: string; icon: LucideIcon; roles: Role[] }[] = [
  { href: "/staff/doctor", label: "คิวของฉัน", uc: "UC09", icon: Stethoscope, roles: ["DOCTOR"] },
  { href: "/staff", label: "ภาพรวมคิว", uc: "UC07", icon: LayoutGrid, roles: ["STAFF", "ADMIN"] },
  { href: "/staff/queues", label: "จัดการคิว", uc: "UC10", icon: ListOrdered, roles: ["STAFF", "ADMIN"] },
  { href: "/staff/schedule", label: "ตารางเวรและนัดหมาย", uc: "UC11", icon: CalendarDays, roles: ["STAFF", "ADMIN"] },
  { href: "/staff/master", label: "ข้อมูลพื้นฐาน", uc: "UC12", icon: SlidersHorizontal, roles: ["ADMIN"] },
];

/** A doctor may open only their own page and the detail of a queue; the rest belongs to staff. */
function allowed(role: Role, pathname: string) {
  const doctorPath = pathname.startsWith("/staff/doctor") || /^\/staff\/queues\/[^/]+$/.test(pathname);
  return role === "DOCTOR" ? doctorPath : !pathname.startsWith("/staff/doctor");
}

export default function StaffLayout({ children }: { children: React.ReactNode }) {
  const { state, now, update, advance, reset } = useMock();
  const router = useRouter();
  const pathname = usePathname();
  const user = state.users.find((u) => u.id === state.sessionUserId);
  const ok = user ? allowed(user.role, pathname) : false;

  useEffect(() => {
    if (!user) router.replace("/login");
    else if (!ok) router.replace(homeOf(user.role));
  }, [user, ok, router]);

  if (!user || !ok) return null;

  const deptName = state.departments.find((d) => d.id === user.departmentId)?.name;
  const doctorName = user.doctorId ? state.doctors.find((d) => d.id === user.doctorId)?.name : null;
  const nav = NAV.filter((n) => n.roles.includes(user.role));
  const home = homeOf(user.role);
  const active = (href: string) => (href === "/staff" ? pathname === "/staff" : pathname.startsWith(href));
  const redFlags = state.screenings.filter((s) => s.isRedFlag && !state.acknowledgedRedFlags.includes(s.id)).length;
  const logout = () => {
    update((s) => ({ ...s, sessionUserId: null }));
    router.push("/login");
  };

  return (
    <div className="flex min-h-screen">
      <aside className="sticky top-0 hidden h-screen w-[260px] shrink-0 flex-col px-5 py-7 lg:flex">
        <Link href={home} className="flex items-center gap-3 px-2">
          <span className="flex h-10 w-10 items-center justify-center rounded-full bg-ink text-lime">
            <Activity size={19} strokeWidth={2.2} />
          </span>
          <span>
            <span className="block text-[15px] font-semibold leading-tight">PIQ</span>
            <span className="block text-xs text-ink-3">ระบบจัดการคิวผู้ป่วย</span>
          </span>
        </Link>

        <nav className="mt-10 flex flex-col gap-1">
          {nav.map((n) => {
            const on = active(n.href);
            return (
              <Link
                key={n.href}
                href={n.href}
                className={`flex items-center gap-3 rounded-2xl px-3.5 py-2.5 text-sm transition ${on ? "bg-surface font-medium text-ink shadow-[0_1px_2px_rgba(21,22,19,0.05),0_8px_20px_-12px_rgba(21,22,19,0.18)]" : "text-ink-2 hover:bg-surface/60 hover:text-ink"}`}
              >
                <n.icon size={18} strokeWidth={1.8} />
                <span className="flex-1">{n.label}</span>
                {n.href === "/staff" && redFlags > 0 && <span className="rounded-full bg-red-500 px-1.5 text-[11px] font-medium text-white">{redFlags}</span>}
              </Link>
            );
          })}
        </nav>

        <div className="mt-8 px-3.5 text-[11px] font-medium uppercase tracking-wider text-ink-3">ระบบ</div>
        <Link href="/display" target="_blank" className="mt-2 flex items-center gap-3 rounded-2xl px-3.5 py-2.5 text-sm text-ink-2 hover:bg-surface/60 hover:text-ink">
          <ArrowUpRight size={18} strokeWidth={1.8} />
          จอเรียกคิว
        </Link>

        <div className="mt-auto flex items-center gap-3 rounded-3xl bg-surface p-3 shadow-[0_1px_2px_rgba(21,22,19,0.04)]">
          <span className="flex h-10 w-10 items-center justify-center rounded-full bg-ink text-xs font-semibold uppercase text-white">
            {user.username.slice(0, 2)}
          </span>
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm font-medium">{user.username}</div>
            <div className="truncate text-xs text-ink-3">{ROLE_LABEL[user.role]}{deptName ? ` · ${deptName}` : ""}</div>
            {doctorName && <div className="truncate text-xs text-ink-3">{doctorName}</div>}
          </div>
          <button onClick={logout} title="ออกจากระบบ" className="flex h-9 w-9 items-center justify-center rounded-full text-ink-3 hover:bg-subtle hover:text-ink">
            <LogOut size={17} strokeWidth={1.8} />
          </button>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex flex-wrap items-center justify-between gap-3 px-4 pb-2 pt-5 sm:px-8 lg:pt-7">
          <Link href={home} className="flex items-center gap-2 lg:hidden">
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-ink text-lime"><Activity size={17} strokeWidth={2.2} /></span>
            <span className="font-semibold">PIQ</span>
          </Link>
          <div className="hidden text-sm text-ink-3 lg:block">{fmtDate(now)}</div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="hidden sm:block"><MockBadge /></span>
            <div
              className="flex items-center gap-1 rounded-full bg-surface p-1 pl-3.5 ring-1 ring-line"
              title={`เวลาจำลองของระบบ — ผู้ป่วยที่ถูกเรียกแล้วไม่เข้าห้องตรวจภายใน ${NO_SHOW_MINUTES} นาทีจะถูกบันทึกว่าไม่มา`}
            >
              <Clock3 size={15} strokeWidth={1.8} className="text-ink-3" />
              <span className="mx-1.5 text-sm font-semibold tabular-nums">{fmtTime(now)} น.</span>
              <button onClick={() => advance(5)} className="rounded-full px-2.5 py-1 text-xs text-ink-2 hover:bg-subtle hover:text-ink">+5 นาที</button>
              <button onClick={() => advance(15)} className="rounded-full px-2.5 py-1 text-xs text-ink-2 hover:bg-subtle hover:text-ink">+15 นาที</button>
            </div>
            <button
              onClick={() => window.confirm("รีเซ็ตข้อมูลสมมติทั้งหมดกลับเป็นค่าเริ่มต้น?") && reset()}
              title="รีเซ็ตข้อมูลสมมติ"
              className="flex h-10 w-10 items-center justify-center rounded-full bg-surface text-ink-2 ring-1 ring-line hover:text-ink"
            >
              <RotateCcw size={16} strokeWidth={1.8} />
            </button>
            <button onClick={logout} title="ออกจากระบบ" className="flex h-10 w-10 items-center justify-center rounded-full bg-ink text-white lg:hidden">
              <LogOut size={16} strokeWidth={1.8} />
            </button>
          </div>
          <nav className="-mx-1 flex w-full gap-1.5 overflow-x-auto pb-1 [scrollbar-width:none] lg:hidden">
            {nav.map((n) => (
              <Link key={n.href} href={n.href} className={`flex shrink-0 items-center gap-1.5 rounded-full px-3.5 py-2 text-xs ${active(n.href) ? "bg-ink text-white" : "bg-surface text-ink-2 ring-1 ring-line"}`}>
                <n.icon size={14} strokeWidth={1.8} />
                {n.label}
              </Link>
            ))}
          </nav>
        </header>
        <main className="min-w-0 flex-1 px-4 pb-10 pt-4 sm:px-8">{children}</main>
      </div>
    </div>
  );
}
