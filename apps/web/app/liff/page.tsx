"use client";

import { ArrowUpRight, CalendarCheck, MessageCircle, Pill, Ticket, UserRound, type LucideIcon } from "lucide-react";
import Link from "next/link";
import { LEVEL } from "@/components/ui";
import { ACTIVE, isCalledOrIn, positionInLine } from "@/lib/mock/logic";
import { useLookups, useMock } from "@/lib/mock/store";
import { fmtShortDate, fmtTime } from "@/lib/mock/time";

export default function LiffHome() {
  const { state, now } = useMock();
  const { doctor, dept } = useLookups();
  const patient = state.patients.find((p) => p.id === state.liffPatientId);

  // UC01 trigger: first visit from a LINE account the system does not know yet
  if (!patient) {
    return (
      <div className="flex flex-1 flex-col justify-end gap-4 p-5">
        <div className="rounded-card bg-ink p-6 text-white">
          <span className="flex h-12 w-12 items-center justify-center rounded-full bg-lime text-ink"><UserRound size={22} strokeWidth={1.8} /></span>
          <h1 className="mt-5 text-2xl font-medium tracking-tight">ยินดีต้อนรับ</h1>
          <p className="mt-1 text-sm text-white/60">ใช้งานครั้งแรก กรุณาลงทะเบียนก่อนรับคิว ใช้เวลาประมาณ 1 นาที</p>
          <Link href="/liff/register" className="mt-6 flex items-center justify-center rounded-full bg-lime py-3.5 font-medium text-ink">ลงทะเบียน</Link>
        </div>
      </div>
    );
  }

  const allActive = state.queues.filter((q) => q.patientId === patient.id && ACTIVE.includes(q.status));
  // show the queue being served first; the rest are listed on the queue page
  const active = allActive.find(isCalledOrIn) ?? allActive[0];
  const ahead = active ? Math.max(0, (positionInLine(state, active, now) ?? 1) - 1) : 0;
  const rxIds = new Set(state.queues.filter((q) => q.patientId === patient.id).map((q) => q.id));
  const pendingRx = state.prescriptions.filter((r) => rxIds.has(r.queueId) && !state.deliveries.some((d) => d.prescriptionId === r.id));
  const upcoming = state.appointments
    .filter((a) => a.patientId === patient.id && a.status === "SCHEDULED" && new Date(a.appointmentTime).getTime() > now)
    .sort((a, b) => a.appointmentTime.localeCompare(b.appointmentTime));
  const inbox = state.notifications.filter((n) => n.patientId === patient.id).slice(-3).reverse();

  return (
    <div className="flex flex-1 flex-col gap-3 p-4">
      <div className="px-1 pb-1 pt-2">
        <div className="text-sm text-ink-3">สวัสดี</div>
        <div className="text-2xl font-medium tracking-tight">{patient.fullName}</div>
      </div>

      {active && (
        <Link href="/liff/queue" className="rounded-card bg-ink p-5 text-white">
          <div className="flex items-center justify-between text-sm text-white/60">
            คิวของคุณวันนี้ <ArrowUpRight size={18} strokeWidth={1.8} />
          </div>
          <div className="mt-3 font-mono text-5xl font-semibold tracking-tight text-lime">{active.queueNumber}</div>
          <div className="mt-3 flex flex-wrap gap-1.5 text-xs">
            <span className="rounded-full bg-white/10 px-2.5 py-1">{dept.get(active.departmentId)?.name}</span>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-2.5 py-1"><span className={`h-2 w-2 rounded-full ${LEVEL[active.priorityLevel].dot}`} /> {LEVEL[active.priorityLevel].name}</span>
            <span className="rounded-full bg-white/10 px-2.5 py-1">{active.status === "WAITING" ? `รออยู่ก่อนหน้า ${ahead} ราย` : active.status === "CALLED" ? "ถึงคิวแล้ว" : "กำลังตรวจ"}</span>
            {allActive.length > 1 && <span className="rounded-full bg-lime px-2.5 py-1 text-lime-ink">อีก {allActive.length - 1} คิว</span>}
          </div>
        </Link>
      )}

      <div className="grid grid-cols-2 gap-3">
        <Tile href="/liff/chat" title="รับคิว" sub="ซักประวัติผ่านแชท" icon={MessageCircle} accent={!active} />
        <Tile href="/liff/queue" title="สถานะคิว" sub={allActive.length > 1 ? `${allActive.length} คิว` : active ? active.queueNumber : "ยังไม่มีคิว"} icon={Ticket} />
        <Tile href="/liff/medicine" title="รับยา" sub={pendingRx.length ? "รอเลือกวิธีรับยา" : "ไม่มีรายการ"} icon={Pill} badge={pendingRx.length || undefined} />
        <Tile href="/liff/register" title="ข้อมูลของฉัน" sub="แก้ไขข้อมูลพื้นฐาน" icon={UserRound} />
      </div>

      {upcoming.length > 0 && (
        <section className="rounded-card bg-surface p-5">
          <div className="flex items-center gap-2 text-sm font-semibold"><CalendarCheck size={16} strokeWidth={1.8} /> นัดหมายของฉัน</div>
          {upcoming.map((a) => (
            <div key={a.id} className="mt-3 flex items-center gap-3 rounded-2xl bg-subtle px-4 py-3">
              <div className="text-center">
                <div className="text-lg font-semibold tabular-nums leading-tight">{fmtTime(a.appointmentTime)}</div>
                <div className="text-[10px] text-ink-3">{fmtShortDate(a.appointmentTime)}</div>
              </div>
              <div className="min-w-0 text-sm">
                <div className="truncate font-medium">{a.reason}</div>
                <div className="truncate text-xs text-ink-3">{doctor.get(a.doctorId)?.name}</div>
              </div>
            </div>
          ))}
          <p className="mt-3 text-xs text-ink-3">เมื่อมาถึงโรงพยาบาล แจ้งเจ้าหน้าที่เพื่อยืนยันการมาถึงและเข้าคิว</p>
        </section>
      )}

      <section className="rounded-card bg-surface p-5">
        <div className="text-sm font-semibold">ข้อความจากโรงพยาบาล</div>
        {inbox.length === 0 && <p className="mt-2 text-sm text-ink-3">ยังไม่มีข้อความ</p>}
        <div className="mt-3 flex flex-col gap-2.5">
          {inbox.map((n) => (
            <div key={n.id}>
              <div className="rounded-2xl rounded-tl-md bg-subtle px-3.5 py-2.5 text-sm">{n.text}</div>
              <div className="mt-1 px-1 text-[10px] text-ink-3">{fmtShortDate(n.at)} · {fmtTime(n.at)} น.</div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

function Tile({ href, title, sub, icon: Icon, badge, accent }: { href: string; title: string; sub: string; icon: LucideIcon; badge?: number; accent?: boolean }) {
  return (
    <Link href={href} className={`relative flex flex-col rounded-card p-4 transition active:scale-[0.98] ${accent ? "bg-lime" : "bg-surface"}`}>
      <div className="flex items-start justify-between">
        <span className={`flex h-10 w-10 items-center justify-center rounded-full ${accent ? "bg-ink text-lime" : "bg-subtle text-ink"}`}><Icon size={18} strokeWidth={1.8} /></span>
        {badge ? <span className="rounded-full bg-red-500 px-2 py-0.5 text-[11px] font-medium text-white">{badge}</span> : <ArrowUpRight size={16} strokeWidth={1.8} className="text-ink-3" />}
      </div>
      <div className="mt-6 font-medium">{title}</div>
      <div className={`truncate text-xs ${accent ? "text-lime-ink/70" : "text-ink-3"}`}>{sub}</div>
    </Link>
  );
}
