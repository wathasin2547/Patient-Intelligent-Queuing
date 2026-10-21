"use client";

// UC07 Dashboard — extends UC10: the same queue data, shown as graphs + per-doctor lines.

import { ArrowRight, BarChart3, CalendarCheck, Megaphone, Siren, Stethoscope, Timer, TriangleAlert, Users } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { ColumnChart, HBarChart, LevelBreakdown } from "@/components/charts";
import { PFormula } from "@/components/queue";
import { Avatar, btn, Card, doctorInitials, LevelDot, PageHeader, PillSelect, StatusChip } from "@/components/ui";
import { doctorLoad, doctorsOnShift, rankedWaiting, shiftNow, waitingMinutes } from "@/lib/mock/logic";
import { useLookups, useMock } from "@/lib/mock/store";
import { bkkDate, bkkHour, fmtTime } from "@/lib/mock/time";
import type { Level } from "@/lib/mock/types";

const DENSE_PER_DOCTOR = 4; // waiting patients per on-shift doctor that counts as "crowded"
const HOURS = [8, 9, 10, 11, 12, 13, 14, 15];

export default function Dashboard() {
  const { state, now, update } = useMock();
  const { code, dept: deptMap, doctor: doctorMap } = useLookups();
  const [dept, setDept] = useState("ALL");
  const today = bkkDate(now);
  const nowIso = new Date(now).toISOString();

  const inDept = (departmentId: string) => dept === "ALL" || departmentId === dept;
  const todays = state.queues.filter((q) => bkkDate(q.checkInTime) === today && inDept(q.departmentId));
  const waiting = todays.filter((q) => q.status === "WAITING");
  const avgWait = waiting.length ? Math.round(waiting.reduce((s, q) => s + waitingMinutes(q, state, now), 0) / waiting.length) : 0;
  const onShift = doctorsOnShift(state, now).filter((d) => inDept(d.departmentId));
  const apptLeft = state.appointments.filter(
    (a) => a.status === "SCHEDULED" && bkkDate(a.appointmentTime) === today && a.appointmentTime >= nowIso && inDept(doctorMap.get(a.doctorId)?.departmentId ?? ""),
  ).length;
  const redFlagsToday = state.screenings.filter((s) => s.isRedFlag && bkkDate(s.createdAt) === today);
  const openAlerts = redFlagsToday.filter((s) => !state.acknowledgedRedFlags.includes(s.id));
  const longest = [...waiting].sort((a, b) => waitingMinutes(b, state, now) - waitingMinutes(a, state, now)).slice(0, 5);

  const activeDepts = state.departments.filter((d) => d.isActive);
  const perDept = activeDepts.map((d) => {
    const w = state.queues.filter((q) => q.departmentId === d.id && q.status === "WAITING");
    const docs = doctorsOnShift(state, now, d.id).length;
    const avg = w.length ? Math.round(w.reduce((s, q) => s + waitingMinutes(q, state, now), 0) / w.length) : 0;
    const dense = w.length > 0 && (docs === 0 || w.length / docs >= DENSE_PER_DOCTOR);
    return { key: d.id, label: d.name, value: w.length, detail: `แพทย์ในเวร ${docs} ท่าน · รอเฉลี่ย ${avg} นาที`, flag: dense ? (docs ? "หนาแน่น" : "ไม่มีแพทย์") : undefined };
  });

  const nowHour = bkkHour(now);
  const perHour = HOURS.map((h) => ({
    key: String(h).padStart(2, "0"),
    label: `${String(h).padStart(2, "0")}:00–${String(h + 1).padStart(2, "0")}:00`,
    value: h <= nowHour ? todays.filter((q) => bkkHour(q.checkInTime) === h).length : 0,
    future: h > nowHour,
  }));
  const levels = ([2, 3, 4, 5] as Level[]).map((l) => ({ level: l, value: waiting.filter((q) => q.priorityLevel === l).length }));
  const calls = [...state.callEvents].filter((e) => e.kind === "CALL").reverse().slice(0, 4);

  return (
    <div className="mx-auto max-w-[1400px]">
      <PageHeader title="ภาพรวมคิว" subtitle={`ข้อมูล ณ ${fmtTime(now)} น. · ปรับอัตโนมัติทุก 10 วินาที`}>
        <PillSelect value={dept} onChange={setDept}>
          <option value="ALL">ทุกแผนก</option>
          {activeDepts.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
        </PillSelect>
      </PageHeader>

      {openAlerts.map((s) => {
        const p = state.patients.find((x) => x.id === s.patientId);
        return (
          <div key={s.id} className="mb-5 flex flex-wrap items-center gap-4 rounded-card bg-red-50 px-5 py-4">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-red-500 text-white"><Siren size={20} strokeWidth={1.8} /></span>
            <div className="min-w-0 flex-1 text-sm">
              <div className="font-semibold text-red-900">ผู้ป่วยเข้าเกณฑ์อาการฉุกเฉิน · {fmtTime(s.createdAt)} น.</div>
              <div className="text-red-800/80">
                {p?.fullName} (อายุ {p?.ageGroup} ปี) แจ้งอาการ {s.symptomCodes.map((c) => code.get(c)?.label ?? c).join(", ")} — ระบบไม่ออกคิว และแนะนำให้ไปจุดบริการฉุกเฉินแล้ว
              </div>
            </div>
            <button onClick={() => update((st) => ({ ...st, acknowledgedRedFlags: [...st.acknowledgedRedFlags, s.id] }))} className={btn.primary}>
              รับทราบ
            </button>
          </div>
        );
      })}

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_380px]">
        <div className="flex min-w-0 flex-col gap-5">
          {/* overview */}
          <Card title="วันนี้" note={dept === "ALL" ? "ทุกแผนก" : deptMap.get(dept)?.name}>
            <div className="grid gap-2 rounded-[22px] bg-subtle p-2 sm:grid-cols-2">
              <div className="rounded-[18px] bg-surface p-5 shadow-[0_1px_2px_rgba(21,22,19,0.05),0_10px_24px_-16px_rgba(21,22,19,0.2)]">
                <div className="flex items-center gap-2 text-sm text-ink-2"><Users size={16} strokeWidth={1.8} /> รอเรียกตอนนี้</div>
                <div className="mt-3 flex items-end gap-3">
                  <span className="text-[52px] font-light leading-none tracking-tight tabular-nums">{waiting.length}</span>
                  <span className="pb-1.5 text-sm text-ink-3">ราย</span>
                </div>
              </div>
              <div className="p-5">
                <div className="flex items-center gap-2 text-sm text-ink-2"><Timer size={16} strokeWidth={1.8} /> เวลารอเฉลี่ย</div>
                <div className="mt-3 flex items-end gap-3">
                  <span className="text-[52px] font-light leading-none tracking-tight tabular-nums">{avgWait}</span>
                  <span className="pb-1.5 text-sm text-ink-3">นาที</span>
                </div>
              </div>
            </div>
            <div className="mt-3 grid grid-cols-3 gap-2">
              <MiniStat icon={Stethoscope} label="แพทย์ในเวร" value={onShift.length} unit="ท่าน" />
              <MiniStat icon={CalendarCheck} label="นัดที่ยังไม่มา" value={apptLeft} unit="ราย" />
              <MiniStat icon={TriangleAlert} label="ฉุกเฉินวันนี้" value={redFlagsToday.length} unit="ราย" alert={redFlagsToday.length > 0} />
            </div>

            <div className="mt-6">
              <div className="text-sm font-medium">รอนานที่สุด</div>
              <p className="text-xs text-ink-3">คะแนน P ของผู้ป่วยกลุ่มนี้เพิ่มขึ้นตามเวลารอ ระบบจะเรียกเองเมื่อแพทย์ว่าง</p>
              <div className="mt-4 flex flex-wrap items-start gap-4">
                {longest.length === 0 && <span className="text-sm text-ink-3">ไม่มีผู้ป่วยรอ</span>}
                {longest.map((q) => (
                  <Link key={q.id} href={`/staff/queues/${q.id}`} className="group flex w-[72px] flex-col items-center gap-1.5 text-center">
                    <span className="relative flex h-14 w-14 items-center justify-center rounded-full bg-subtle text-[11px] font-semibold tracking-tight transition group-hover:bg-ink group-hover:text-white">
                      {q.queueNumber.split("-")[1]}
                      <LevelDot level={q.priorityLevel} className="absolute right-0.5 top-0.5 h-3 w-3 ring-2 ring-surface" />
                    </span>
                    <span className="font-mono text-[11px] font-medium">{q.queueNumber}</span>
                    <span className="text-[11px] text-ink-3">{Math.round(waitingMinutes(q, state, now))} นาที</span>
                  </Link>
                ))}
                <Link href="/staff/queues" className="flex w-[72px] flex-col items-center gap-1.5 text-center">
                  <span className="flex h-14 w-14 items-center justify-center rounded-full ring-1 ring-line transition hover:bg-ink hover:text-white"><ArrowRight size={18} strokeWidth={1.8} /></span>
                  <span className="text-[11px] text-ink-2">ดูทั้งหมด</span>
                </Link>
              </div>
            </div>
          </Card>

          {/* arrivals per hour */}
          <Card title="ผู้ป่วยรับคิวรายชั่วโมง" icon={BarChart3} note="วันนี้ · แท่งสีเขียวคือชั่วโมงปัจจุบัน กรอบเส้นประคือชั่วโมงที่ยังมาไม่ถึง">
            <div className="grid items-end gap-6 sm:grid-cols-[150px_minmax(0,1fr)]">
              <div>
                <div className="text-[44px] font-light leading-none tracking-tight tabular-nums">{todays.length}</div>
                <div className="mt-1 text-sm text-ink-3">รายที่รับคิวแล้ววันนี้</div>
              </div>
              <ColumnChart data={perHour} highlight={String(nowHour).padStart(2, "0")} unit="ราย" />
            </div>
          </Card>

          <div className="grid gap-5 lg:grid-cols-2">
            <Card title="ผู้ป่วยรอแยกตามแผนก" note={`หนาแน่น = รอตั้งแต่ ${DENSE_PER_DOCTOR} รายต่อแพทย์ 1 ท่าน`}>
              <HBarChart data={perDept} unit="ราย" />
            </Card>
            <Card title="ความเร่งด่วนของผู้ที่รออยู่" note="แยกตามระดับสี">
              <LevelBreakdown counts={levels} />
            </Card>
          </div>
        </div>

        <div className="flex min-w-0 flex-col gap-5">
          <Card title="แพทย์ในเวร" action={<span className="rounded-full bg-subtle px-3 py-1 text-xs text-ink-2">{onShift.length} ท่าน</span>}>
            <ul className="-mx-2 flex flex-col">
              {onShift.length === 0 && <li className="px-2 text-sm text-ink-3">ไม่มีแพทย์อยู่ในเวรขณะนี้</li>}
              {onShift.map((doc) => {
                const current = state.queues.find((q) => q.doctorId === doc.id && (q.status === "IN_PROGRESS" || q.status === "CALLED"));
                const line = rankedWaiting(state, doc.id, now);
                const load = doctorLoad(state, doc.id, now);
                const sh = shiftNow(state, doc.id, now)!;
                return (
                  <li key={doc.id}>
                    <Link href={`/staff/queues?doctor=${doc.id}`} className="flex gap-3 rounded-2xl px-2 py-3 transition hover:bg-subtle">
                      <Avatar text={doctorInitials(doc.name, deptMap.get(doc.departmentId)?.code)} />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <div className="truncate text-sm font-medium">{doc.name}</div>
                            <div className="truncate text-xs text-ink-3">{deptMap.get(doc.departmentId)?.name} · ถึง {fmtTime(sh.endTime)} น.</div>
                          </div>
                          {current ? <StatusChip status={current.status} /> : <span className="rounded-full bg-subtle px-2.5 py-1 text-xs text-ink-3">ว่าง</span>}
                        </div>
                        <div className="mt-2 flex flex-wrap items-center gap-1.5 text-xs">
                          {current && <span className="rounded-full bg-ink px-2 py-0.5 font-mono text-[11px] text-white">{current.queueNumber}</span>}
                          {line.slice(0, 3).map((q) => (
                            <span key={q.id} className="inline-flex items-center gap-1 rounded-full bg-subtle px-2 py-0.5 font-mono text-[11px]">
                              <LevelDot level={q.priorityLevel} className="h-1.5 w-1.5" />{q.queueNumber}
                            </span>
                          ))}
                          <span className="ml-auto text-ink-3" title="ภาระงาน = ผู้ป่วยรอ + นัดหมายในชั่วโมงถัดไป">รอ {load.waiting} · นัด {load.upcoming}</span>
                        </div>
                      </div>
                    </Link>
                  </li>
                );
              })}
            </ul>
            <Link href="/staff/queues" className={`${btn.secondary} mt-3 w-full`}>ดูคิวทั้งหมด</Link>
          </Card>

          <Card title="เรียกคิวล่าสุด" note="ระบบเรียกเองเมื่อแพทย์ว่าง (UC13)">
            {calls.length === 0 && <p className="text-sm text-ink-3">ยังไม่มีการเรียกคิว</p>}
            <ul className="flex flex-col gap-4">
              {calls.map((e) => {
                const q = state.queues.find((x) => x.id === e.queueId);
                return (
                  <li key={e.id} className="flex gap-3">
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-lime text-lime-ink"><Megaphone size={16} strokeWidth={1.8} /></span>
                    <div className="min-w-0 text-sm">
                      <div><span className="font-mono font-semibold">{q?.queueNumber}</span> <span className="text-ink-3">เข้าห้องตรวจ</span></div>
                      <div className="truncate text-xs text-ink-3">{doctorMap.get(e.doctorId)?.name} · {fmtTime(e.at)} น.</div>
                    </div>
                  </li>
                );
              })}
            </ul>
          </Card>
          <div className="px-2"><PFormula /></div>
        </div>
      </div>
    </div>
  );
}

function MiniStat({ icon: Icon, label, value, unit, alert }: { icon: typeof Users; label: string; value: number; unit: string; alert?: boolean }) {
  return (
    <div className="rounded-[18px] bg-subtle px-4 py-3">
      <div className="flex items-center gap-1.5 text-xs text-ink-2"><Icon size={14} strokeWidth={1.8} /> {label}</div>
      <div className="mt-1 flex items-baseline gap-1.5">
        <span className={`text-2xl font-light tabular-nums ${alert ? "text-red-600" : ""}`}>{value}</span>
        <span className="text-xs text-ink-3">{unit}</span>
      </div>
    </div>
  );
}
