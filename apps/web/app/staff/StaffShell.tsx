"use client";

import { Activity, ArrowUpRight, CalendarDays, Clock3, LayoutGrid, ListOrdered, LogOut, RotateCcw, SlidersHorizontal, Stethoscope, type LucideIcon } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";
import { MockBadge, Notice } from "@/components/ui";
import { canOpen, homeOf, type Role } from "@/lib/auth/schema";
import { ROLE_LABEL } from "@/lib/mock/actions";
import { NO_SHOW_MINUTES } from "@/lib/mock/logic";
import { useMock } from "@/lib/mock/store";
import { fmtDate, fmtTime } from "@/lib/mock/time";

export type SessionUser = { username: string; role: Role };

const NAV: { href: string; label: string; uc: string; icon: LucideIcon; roles: Role[] }[] = [
  { href: "/staff/doctor", label: "คิวของฉัน", uc: "UC09", icon: Stethoscope, roles: ["DOCTOR"] },
  { href: "/staff", label: "ภาพรวมคิว", uc: "UC07", icon: LayoutGrid, roles: ["STAFF", "ADMIN"] },
  { href: "/staff/queues", label: "จัดการคิว", uc: "UC10", icon: ListOrdered, roles: ["STAFF", "ADMIN"] },
  { href: "/staff/schedule", label: "ตารางเวรและนัดหมาย", uc: "UC11", icon: CalendarDays, roles: ["STAFF", "ADMIN"] },
  { href: "/staff/master", label: "ข้อมูลพื้นฐาน", uc: "UC12", icon: SlidersHorizontal, roles: ["ADMIN"] },
];

/**
 * Who is signed in comes from NextAuth (the server layout passes it in) and is the authority for role checks.
 * The pages still run on the browser mock store, so the matching mock user (same username) is made the
 * mock session — remove this bridge once the pages read the database.
 */
export default function StaffShell({ user: sessionUser, logout, children }: { user: SessionUser; logout: () => Promise<void>; children: React.ReactNode }) {
  const { state, now, update, advance, reset } = useMock();
  const router = useRouter();
  const pathname = usePathname();
  const mockUser = state.users.find((u) => u.username === sessionUser.username);
  const ok = canOpen(sessionUser.role, pathname);

  useEffect(() => {
    if (mockUser && state.sessionUserId !== mockUser.id) update((s) => ({ ...s, sessionUserId: mockUser.id }));
  }, [mockUser, state.sessionUserId, update]);

  useEffect(() => {
    if (!ok) router.replace(homeOf(sessionUser.role)); // proxy.ts already redirects; this covers client navigation
  }, [ok, router, sessionUser.role]);

  if (!ok) return null;

  const user = { ...sessionUser, departmentId: mockUser?.departmentId ?? null, doctorId: mockUser?.doctorId ?? null };
  const synced = !!mockUser && state.sessionUserId === mockUser.id;
  const deptName = state.departments.find((d) => d.id === user.departmentId)?.name;
  const doctorName = user.doctorId ? state.doctors.find((d) => d.id === user.doctorId)?.name : null;
  const nav = NAV.filter((n) => n.roles.includes(user.role));
  const home = homeOf(user.role);
  const active = (href: string) => (href === "/staff" ? pathname === "/staff" : pathname.startsWith(href));
  const redFlags = state.screenings.filter((s) => s.isRedFlag && !state.acknowledgedRedFlags.includes(s.id)).length;

  return (
    <div className="flex min-h-screen">
      {/* Navy sidebar: white text 17.7:1, inactive items white/75 (9.9:1). */}
      <aside className="sticky top-0 hidden h-screen w-[264px] shrink-0 flex-col bg-brand px-4 py-7 text-white lg:flex">
        <Link href={home} className="flex items-center gap-3 rounded-xl px-2 py-1 hover:bg-white/5">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-cta text-ink ring-1 ring-cta-edge">
            <Activity size={19} strokeWidth={2.2} />
          </span>
          <span>
            <span className="block text-[15px] font-semibold leading-tight">PIQ</span>
            <span className="block text-xs text-white/70">ระบบจัดการคิวผู้ป่วย</span>
          </span>
        </Link>
        <div className="ocean-band mx-2 mt-6 h-1 rounded-full" aria-hidden />

        <nav className="mt-6 flex flex-col gap-1" aria-label="เมนูหลัก">
          {nav.map((n) => {
            const on = active(n.href);
            return (
              <Link
                key={n.href}
                href={n.href}
                aria-current={on ? "page" : undefined}
                className={`relative flex min-h-11 items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm transition ${on ? "bg-white/12 font-medium text-white before:absolute before:inset-y-2 before:left-0 before:w-1 before:rounded-full before:bg-cta" : "text-white/75 hover:bg-white/8 hover:text-white"}`}
              >
                <n.icon size={18} strokeWidth={1.8} className={on ? "text-cta" : ""} />
                <span className="flex-1">{n.label}</span>
                {n.href === "/staff" && redFlags > 0 && <span className="rounded-full bg-red-500 px-1.5 text-[11px] font-medium text-white">{redFlags}</span>}
              </Link>
            );
          })}
        </nav>

        <div className="mt-8 px-3.5 text-[11px] font-medium uppercase tracking-wider text-white/60">ระบบ</div>
        <Link href="/display" target="_blank" className="mt-2 flex min-h-11 items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm text-white/75 hover:bg-white/8 hover:text-white">
          <ArrowUpRight size={18} strokeWidth={1.8} />
          จอเรียกคิว
        </Link>

        <div className="mt-auto flex items-center gap-3 rounded-2xl bg-white/6 p-3 ring-1 ring-white/10">
          <span className="flex h-10 w-10 items-center justify-center rounded-full bg-accent text-xs font-semibold uppercase text-ink">
            {user.username.slice(0, 2)}
          </span>
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm font-medium">{user.username}</div>
            <div className="truncate text-xs text-white/70">{ROLE_LABEL[user.role]}{deptName ? ` · ${deptName}` : ""}</div>
            {doctorName && <div className="truncate text-xs text-white/70">{doctorName}</div>}
          </div>
          <form action={logout}>
            <button type="submit" title="ออกจากระบบ" aria-label="ออกจากระบบ" className="flex h-10 w-10 items-center justify-center rounded-full text-white/75 hover:bg-white/10 hover:text-white">
              <LogOut size={17} strokeWidth={1.8} />
            </button>
          </form>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex flex-wrap items-center justify-between gap-3 px-4 pb-2 pt-5 sm:px-8 lg:pt-7">
          <Link href={home} className="flex items-center gap-2 lg:hidden">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-cta text-ink ring-1 ring-cta-edge"><Activity size={17} strokeWidth={2.2} /></span>
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
            <form action={logout} className="lg:hidden">
              <button type="submit" title="ออกจากระบบ" aria-label="ออกจากระบบ" className="flex h-10 w-10 items-center justify-center rounded-full bg-ink text-white hover:bg-primary-strong">
                <LogOut size={16} strokeWidth={1.8} />
              </button>
            </form>
          </div>
          <nav className="-mx-1 flex w-full gap-1.5 overflow-x-auto pb-1 [scrollbar-width:none] lg:hidden">
            {nav.map((n) => (
              <Link key={n.href} href={n.href} className={`flex shrink-0 items-center gap-1.5 rounded-full px-3.5 py-2 text-xs ${active(n.href) ? "bg-ink text-white" : "bg-surface text-ink-2 ring-1 ring-line hover:bg-subtle hover:text-ink hover:ring-primary/40"}`}>
                <n.icon size={14} strokeWidth={1.8} />
                {n.label}
              </Link>
            ))}
          </nav>
        </header>
        <main className="min-w-0 flex-1 px-4 pb-10 pt-4 sm:px-8">
          {synced
            ? children
            : !mockUser && (
                <Notice tone="amber">
                  บัญชี <b>{user.username}</b> เข้าสู่ระบบแล้ว แต่ยังไม่มีในข้อมูลสมมติของหน้านี้ หน้าบุคลากรจะใช้งานได้เมื่อย้ายไปอ่านฐานข้อมูลจริง
                </Notice>
              )}
        </main>
      </div>
    </div>
  );
}
