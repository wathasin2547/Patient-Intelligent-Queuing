"use client";

// UC10 Queue Management + UC13 calling patients — what staff see of the system-run queue.
// Staff do not pick who goes next: the system calls the highest-P patient when a doctor is free.

import { Hourglass, MessageCircle, Megaphone, Search, UserX, Zap, type LucideIcon } from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { CalledActions, CurrentPatient, PFormula, QueueRow } from "@/components/queue";
import { Avatar, btn, Card, doctorInitials, Empty, LevelChip, Notice, PageHeader, PillSelect, QUEUE_STATUS, Segmented, StatusChip, Tag } from "@/components/ui";
import { issueWalkIn } from "@/lib/mock/actions";
import { doctorLoad, doctorsOnShift, rankedWaiting, shiftNow, waitingMinutes } from "@/lib/mock/logic";
import { PRESETS, simulateScreening } from "@/lib/mock/simulate";
import { useLookups, useMock } from "@/lib/mock/store";
import { bkkDate, fmtTime } from "@/lib/mock/time";
import type { CallEvent, QueueStatus } from "@/lib/mock/types";

const EVENT: Record<CallEvent["kind"], { label: string; icon: LucideIcon; cls: string }> = {
  CALL: { label: "เรียก", icon: Megaphone, cls: "bg-lime text-lime-ink" },
  NO_SHOW: { label: "บันทึกไม่มา", icon: UserX, cls: "bg-rose-50 text-rose-700" },
  HOLD: { label: "ข้ามชั่วคราว (ติดตรวจแผนกอื่น)", icon: Hourglass, cls: "bg-amber-50 text-amber-800" },
};

const ROWS = 12;

export default function QueuesPage() {
  return (
    <Suspense>
      <QueuesBoard />
    </Suspense>
  );
}

function QueuesBoard() {
  const { state, now, update } = useMock();
  const { dept: deptMap, doctor: doctorMap, patient: patientMap } = useLookups();
  const params = useSearchParams();
  const [dept, setDept] = useState(() => state.doctors.find((x) => x.id === params.get("doctor"))?.departmentId ?? "ALL");
  const [status, setStatus] = useState<QueueStatus | "ALL">("ALL");
  const [search, setSearch] = useState("");
  const [simMsg, setSimMsg] = useState<string | null>(null);
  const [showAll, setShowAll] = useState(false);
  const today = bkkDate(now);

  const departments = state.departments.filter((d) => d.isActive);
  const doctors = state.doctors.filter((d) => dept === "ALL" || d.departmentId === dept);
  const onShift = doctorsOnShift(state, now).filter((d) => dept === "ALL" || d.departmentId === dept);
  const offShift = doctors.filter((d) => !shiftNow(state, d.id, now));

  const todays = state.queues
    .filter((q) => bkkDate(q.checkInTime) === today && (dept === "ALL" || q.departmentId === dept))
    .filter((q) => status === "ALL" || q.status === status)
    .filter((q) => !search || q.queueNumber.toLowerCase().includes(search.toLowerCase()) || patientMap.get(q.patientId)?.fullName.includes(search))
    .sort((a, b) => b.checkInTime.localeCompare(a.checkInTime));

  const calls = [...state.callEvents].reverse().slice(0, 6);
  const unassigned = state.queues.filter((q) => q.status === "WAITING" && !q.doctorId);

  function simulate(i: number) {
    const r = issueWalkIn(state, now, simulateScreening(state, PRESETS[i]), state.patients.length + 1);
    update(() => r.state);
    setSimMsg(r.message);
  }

  return (
    <div className="mx-auto max-w-[1400px]">
      <PageHeader title="จัดการคิว" subtitle="ระบบจ่ายคิวให้แพทย์ที่มีภาระงานน้อยที่สุด และเรียกคิวเองเมื่อแพทย์ว่าง" />
      <div className="mb-5">
        <Segmented value={dept} onChange={setDept} options={[{ value: "ALL", label: "ทุกแผนก" }, ...departments.map((d) => ({ value: d.id, label: d.name }))]} />
      </div>

      <section className="mb-5 rounded-card bg-lime p-5 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-full bg-ink text-lime"><Zap size={18} strokeWidth={1.8} /></span>
            <div>
              <h2 className="text-[17px] font-semibold tracking-tight text-lime-ink">จำลองผู้ป่วยรับคิวจาก LINE</h2>
              <p className="text-xs text-lime-ink/70">ทดสอบ UC04 → UC10 · ในระบบจริงผลคัดกรองมาจาก Python service</p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {PRESETS.map((p, i) => (
              <button key={p.label} onClick={() => simulate(i)} className="rounded-full bg-surface/80 px-3.5 py-2 text-sm text-ink transition hover:bg-surface">
                + {p.label}
              </button>
            ))}
          </div>
        </div>
        {simMsg && <div className="mt-4 rounded-2xl bg-surface/80 px-4 py-3 text-sm">{simMsg}</div>}
      </section>

      {unassigned.length > 0 && (
        <div className="mb-5">
          <Notice tone="amber">มีผู้ป่วย {unassigned.length} รายที่ยังไม่มีแพทย์รับผิดชอบ (แพทย์ออกเวรหรือเวรถูกยกเลิก) — เปิดรายการแล้วย้ายแผนก หรือรอเวรถัดไป</Notice>
        </div>
      )}

      <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
        {onShift.length === 0 && <Empty>ไม่มีแพทย์อยู่ในเวรขณะนี้</Empty>}
        {onShift.map((doc) => {
          const current = state.queues.find((q) => q.doctorId === doc.id && (q.status === "IN_PROGRESS" || q.status === "CALLED"));
          const line = rankedWaiting(state, doc.id, now);
          const load = doctorLoad(state, doc.id, now);
          const sh = shiftNow(state, doc.id, now)!;
          return (
            <section key={doc.id} className="card flex flex-col">
              <header className="flex items-center gap-3">
                <Avatar text={doctorInitials(doc.name, deptMap.get(doc.departmentId)?.code)} dark />
                <div className="min-w-0 flex-1">
                  <div className="truncate font-medium">{doc.name}</div>
                  <div className="text-xs text-ink-3">{deptMap.get(doc.departmentId)?.name} · เวร {fmtTime(sh.startTime)}–{fmtTime(sh.endTime)}</div>
                </div>
                <span className="rounded-full bg-subtle px-3 py-1 text-xs text-ink-2" title="ผู้ป่วยรอ + นัดหมายในชั่วโมงถัดไป">ภาระงาน {load.total}</span>
              </header>

              <div className="mt-5">
                {current ? (
                  <>
                    <CurrentPatient q={current} />
                    {current.status === "CALLED" && <div className="mt-3"><CalledActions q={current} small /></div>}
                  </>
                ) : (
                  <Empty>ว่าง · ไม่มีผู้ป่วยรอ</Empty>
                )}
              </div>

              <div className="mt-5 flex-1">
                <div className="mb-1 flex items-center justify-between px-3 text-xs text-ink-3">
                  <span>ลำดับถัดไป · {line.length} ราย</span>
                  <span>คะแนน</span>
                </div>
                <div className="-mx-3 flex flex-col">
                  {line.length === 0 && <p className="px-3 py-2 text-sm text-ink-3">ไม่มีผู้ป่วยรอ</p>}
                  {line.map((q, i) => <QueueRow key={q.id} q={q} rank={i + 1} />)}
                </div>
              </div>
            </section>
          );
        })}
      </div>
      <div className="mt-4 flex flex-col gap-1 px-1">
        {offShift.length > 0 && <p className="text-xs text-ink-3">ไม่อยู่ในเวรขณะนี้: {offShift.map((d) => d.name).join(", ")}</p>}
        <PFormula />
      </div>

      <div className="mt-6 grid gap-5 2xl:grid-cols-[minmax(0,1fr)_400px]">
        <Card
          title="รายการคิววันนี้"
          note={`${todays.length} รายการ`}
          action={
            <div className="flex flex-wrap gap-2">
              <label className="relative">
                <Search size={15} strokeWidth={1.8} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-3" />
                <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="ค้นหาเลขคิว / ชื่อ" className="pill w-48 pl-9" />
              </label>
              <PillSelect value={status} onChange={(v) => setStatus(v as QueueStatus | "ALL")}>
                <option value="ALL">ทุกสถานะ</option>
                {Object.entries(QUEUE_STATUS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
              </PillSelect>
            </div>
          }
        >
          <div className="-mx-5 overflow-x-auto sm:-mx-6">
            <table className="w-full min-w-[720px] whitespace-nowrap text-sm">
              <thead>
                <tr className="text-left text-xs text-ink-3">
                  <th className="px-5 pb-3 font-normal sm:px-6">เลขคิว</th>
                  <th className="px-2 pb-3 font-normal">ผู้ป่วย</th>
                  <th className="px-2 pb-3 font-normal">แพทย์</th>
                  <th className="px-2 pb-3 font-normal">ระดับ</th>
                  <th className="px-2 pb-3 font-normal">สถานะ</th>
                  <th className="px-2 pb-3 font-normal">รับคิว</th>
                  <th className="px-5 pb-3 text-right font-normal sm:px-6">รอ (นาที)</th>
                </tr>
              </thead>
              <tbody>
                {(showAll ? todays : todays.slice(0, ROWS)).map((q) => (
                  <tr key={q.id} className="border-t border-subtle transition hover:bg-subtle/70">
                    <td className="px-5 py-3 sm:px-6">
                      <Link href={`/staff/queues/${q.id}`} className="font-mono font-semibold hover:underline">{q.queueNumber}</Link>
                    </td>
                    <td className="px-2 py-3">
                      <span className="mr-1.5">{patientMap.get(q.patientId)?.fullName}</span>
                      {q.appointmentId && <Tag tone="lime">นัดหมาย</Tag>}
                    </td>
                    <td className="px-2 py-3 text-ink-2">{q.doctorId ? doctorMap.get(q.doctorId)?.name : <span className="text-amber-700">ยังไม่มีแพทย์</span>}</td>
                    <td className="px-2 py-3"><LevelChip level={q.priorityLevel} short /></td>
                    <td className="px-2 py-3"><StatusChip status={q.status} /></td>
                    <td className="px-2 py-3 tabular-nums text-ink-2">{fmtTime(q.checkInTime)}</td>
                    <td className="px-5 py-3 text-right tabular-nums sm:px-6">{q.status === "WAITING" ? Math.round(waitingMinutes(q, state, now)) : "–"}</td>
                  </tr>
                ))}
                {todays.length === 0 && (
                  <tr><td colSpan={7} className="px-6 py-8 text-center text-ink-3">ไม่พบคิว</td></tr>
                )}
              </tbody>
            </table>
          </div>
          {todays.length > ROWS && (
            <button onClick={() => setShowAll((v) => !v)} className={`${btn.secondary} mt-4 w-full`}>
              {showAll ? "แสดงเฉพาะล่าสุด" : `แสดงทั้งหมด ${todays.length} รายการ`}
            </button>
          )}
        </Card>

        <div className="grid content-start gap-5 md:grid-cols-2 2xl:grid-cols-1">
          <Card title="ประวัติการเรียกคิว" note="UC13 · ระบบเรียกเอง">
            {calls.length === 0 && <p className="text-sm text-ink-3">ยังไม่มีการเรียกคิวในรอบนี้</p>}
            <ul className="flex flex-col gap-3.5">
              {calls.map((e) => {
                const q = state.queues.find((x) => x.id === e.queueId);
                const kind = EVENT[e.kind];
                return (
                  <li key={e.id} className="flex items-center gap-3">
                    <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${kind.cls}`}>
                      <kind.icon size={15} strokeWidth={1.8} />
                    </span>
                    <div className="min-w-0 flex-1 text-sm">
                      <div>{kind.label} <span className="font-mono font-semibold">{q?.queueNumber}</span></div>
                      <div className="truncate text-xs text-ink-3">{doctorMap.get(e.doctorId)?.name}</div>
                    </div>
                    <span className="text-xs tabular-nums text-ink-3">{fmtTime(e.at)}</span>
                  </li>
                );
              })}
            </ul>
          </Card>

          <Card title="ข้อความ LINE ที่ระบบส่ง" icon={MessageCircle} note="แทนการ push จริง">
            <ul className="flex flex-col gap-3">
              {[...state.notifications].reverse().slice(0, 5).map((n) => (
                <li key={n.id}>
                  <div className="mb-1 text-[11px] text-ink-3">{patientMap.get(n.patientId)?.fullName} · {fmtTime(n.at)}</div>
                  <div className="rounded-2xl rounded-tl-md bg-subtle px-3.5 py-2.5 text-sm text-ink-2">{n.text}</div>
                </li>
              ))}
            </ul>
            <Link href="/liff/queue" target="_blank" className={`${btn.secondary} mt-4 w-full`}>เปิดหน้าผู้ป่วย (LIFF)</Link>
          </Card>
        </div>
      </div>
    </div>
  );
}
