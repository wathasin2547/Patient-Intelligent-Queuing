"use client";

// UC05 track queue status (and cancel while still waiting).
// A patient may hold queues in several departments at once: the page lists all of them,
// ordered by when each is expected to be called, and says where to go first.

import { BellRing, Footprints, Ticket, Video } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { LEVEL, Notice } from "@/components/ui";
import { cancelQueue } from "@/lib/mock/actions";
import { ACTIVE, estimateCallTime, isCalledOrIn, positionInLine } from "@/lib/mock/logic";
import { useLookups, useMock } from "@/lib/mock/store";
import { bkkDate, fmtTime } from "@/lib/mock/time";
import type { Queue } from "@/lib/mock/types";

const STATUS_TEXT = {
  WAITING: "รอเรียก",
  CALLED: "ถึงคิวแล้ว เชิญที่ห้องตรวจ",
  IN_PROGRESS: "กำลังตรวจ",
  DONE: "ตรวจเสร็จแล้ว",
  NO_SHOW: "ไม่มาตามเวลาที่เรียก",
  CANCELLED: "ยกเลิกแล้ว",
} as const;

export default function QueueStatusPage() {
  const { state, now } = useMock();
  const { dept } = useLookups();
  const mine = state.queues
    .filter((q) => q.patientId === state.liffPatientId && bkkDate(q.checkInTime) === bkkDate(now))
    .sort((a, b) => b.checkInTime.localeCompare(a.checkInTime));
  const eta = (q: Queue) => estimateCallTime(state, q, now);
  // the queue being served first, then waiting ones by expected call time
  const active = mine
    .filter((q) => ACTIVE.includes(q.status))
    .sort((a, b) => Number(isCalledOrIn(b)) - Number(isCalledOrIn(a)) || (eta(a) ?? Infinity) - (eta(b) ?? Infinity));
  const primary = active[0] ?? mine[0];

  if (!primary) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-4 p-6 text-center">
        <span className="flex h-14 w-14 items-center justify-center rounded-full bg-surface"><Ticket size={24} strokeWidth={1.6} /></span>
        <p className="text-sm text-ink-3">วันนี้คุณยังไม่มีคิว</p>
        <Link href="/liff/chat" className="w-full rounded-full bg-ink py-3.5 font-medium text-white">รับคิว</Link>
      </div>
    );
  }

  const waiting = active.filter((q) => q.status === "WAITING");
  const next = waiting[0];
  const busy = active.find(isCalledOrIn);

  return (
    <div className="flex flex-1 flex-col gap-3 p-4">
      {active.length > 1 && next && (
        <div className="flex gap-3 rounded-card bg-surface p-4 text-sm">
          <Footprints size={18} strokeWidth={1.8} className="mt-0.5 shrink-0" />
          <div>
            {busy ? (
              <>ตรวจที่แผนก<b>{dept.get(busy.departmentId)?.name}</b>ให้เสร็จก่อน แล้วไปต่อที่แผนก<b>{dept.get(next.departmentId)?.name}</b></>
            ) : (
              <>ไปรอหน้าแผนก<b>{dept.get(next.departmentId)?.name}</b>ก่อน{eta(next) ? ` ประมาณ ${fmtTime(eta(next)!)} น.` : ""}</>
            )}
            <p className="mt-1 text-xs text-ink-3">ระบบเรียกคุณได้ทีละแผนก ถ้ากำลังตรวจอยู่ ระบบเก็บลำดับของอีกแผนกไว้ให้ ไม่ต้องกลัวพลาดคิว</p>
          </div>
        </div>
      )}

      <MainCard q={primary} />

      {active.length > 1 && (
        <>
          <div className="px-1 pt-1 text-xs font-medium text-ink-2">คิวอื่นของคุณวันนี้</div>
          {active.filter((q) => q.id !== primary.id).map((q) => <SideCard key={q.id} q={q} />)}
        </>
      )}

      <p className="px-2 text-xs leading-relaxed text-ink-3">
        เวลาโดยประมาณอาจเปลี่ยนได้ เพราะผู้ป่วยที่มีอาการเร่งด่วนกว่าจะได้ตรวจก่อน แต่ระบบจะเลื่อนลำดับให้ผู้ที่รอนานขึ้นมาเรื่อย ๆ · ระบบแนะนำแผนกจากอาการที่แจ้ง ไม่ใช่การวินิจฉัยโรค
      </p>
    </div>
  );
}

/** Big card: the queue that matters right now (called / in the room, or the next one expected). */
function MainCard({ q }: { q: Queue }) {
  const { state, now, update } = useMock();
  const { dept, doctor } = useLookups();
  const [asking, setAsking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const ahead = (positionInLine(state, q, now) ?? 1) - 1;
  const done = !ACTIVE.includes(q.status);
  const called = q.status === "CALLED";
  const online = q.visitType === "ONLINE";
  const meetingUrl = q.doctorId ? doctor.get(q.doctorId)?.meetingUrl : null;
  const eta = estimateCallTime(state, q, now);

  function cancel() {
    const r = cancelQueue(state, now, q.id);
    setAsking(false);
    if (r.error) return setError(r.error);
    update(() => r.state);
  }

  return (
    <>
      <div className={`rounded-card p-6 ${called ? "bg-accent text-accent-ink" : done ? "bg-surface" : "bg-ink text-white"}`}>
        <div className={`text-sm ${called ? "text-accent-ink/70" : done ? "text-ink-3" : "text-white/60"}`}>
          หมายเลขคิวของคุณ · {dept.get(q.departmentId)?.name}
        </div>
        <div className={`mt-2 font-mono text-6xl font-semibold tracking-tight ${q.status === "CANCELLED" ? "text-ink-3 line-through" : !called && !done ? "text-accent" : ""}`}>{q.queueNumber}</div>
        <div className="mt-4 text-lg font-medium">{online && called ? "ถึงคิวแล้ว เชิญเข้าห้องตรวจออนไลน์" : STATUS_TEXT[q.status]}</div>
        {online && called && meetingUrl && (
          <a href={meetingUrl} target="_blank" rel="noopener noreferrer" className="mt-4 flex items-center justify-center gap-2 rounded-full bg-ink py-3.5 font-medium text-accent">
            <Video size={18} strokeWidth={1.8} /> เข้าห้องตรวจออนไลน์
          </a>
        )}
        {q.status === "WAITING" && (
          <div className="mt-5 flex items-end justify-between gap-2">
            <div className="flex items-end gap-2">
              <span className="text-5xl font-light leading-none tabular-nums">{ahead}</span>
              <span className="pb-1 text-sm text-white/60">คนรออยู่ก่อนหน้า</span>
            </div>
            {eta && <span className="pb-1 text-sm text-white/80">ประมาณ {fmtTime(eta)} น.</span>}
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 gap-2 rounded-card bg-surface p-2">
        <Info label="แผนก" value={dept.get(q.departmentId)?.name ?? "-"} />
        <Info label={online ? "รูปแบบ" : "ระดับ"} value={online ? "ตรวจออนไลน์" : LEVEL[q.priorityLevel].name} dot={online ? undefined : LEVEL[q.priorityLevel].dot} />
        <Info label="แพทย์" value={q.doctorId ? doctor.get(q.doctorId)?.name ?? "-" : "รอจัดแพทย์"} />
        <Info label="รับคิวเมื่อ" value={`${fmtTime(q.checkInTime)} น.`} />
      </div>

      {!done && !(online && called) && (
        <div className="flex gap-3 rounded-card bg-surface p-4 text-sm text-ink-2">
          {online ? <Video size={18} strokeWidth={1.8} className="shrink-0 text-ink" /> : <BellRing size={18} strokeWidth={1.8} className="shrink-0 text-ink" />}
          {online
            ? "ตรวจออนไลน์ ไม่ต้องเดินทางมาโรงพยาบาล เมื่อถึงคิว ระบบส่งลิงก์ห้องตรวจทาง LINE กรุณาเตรียมโทรศัพท์และสัญญาณอินเทอร์เน็ตให้พร้อม"
            : "ระบบส่งข้อความทาง LINE เมื่อเหลืออีก 3 คิว และอีกครั้งเมื่อถึงคิวของคุณ ไม่ต้องเฝ้าหน้าจอ"}
        </div>
      )}
      {error && <Notice tone="rose">{error}</Notice>}

      {q.status === "WAITING" && !asking && (
        <button onClick={() => setAsking(true)} className="w-full rounded-full bg-surface py-3.5 text-sm text-rose-700">ยกเลิกคิว {q.queueNumber}</button>
      )}
      {q.status === "WAITING" && asking && (
        <div className="rounded-card bg-surface p-5">
          <div className="text-center font-medium">ยืนยันยกเลิกคิว {q.queueNumber}?</div>
          <div className="mt-4 grid grid-cols-2 gap-2">
            <button onClick={() => setAsking(false)} className="rounded-full bg-subtle py-3 text-sm">ไม่ยกเลิก</button>
            <button onClick={cancel} className="rounded-full bg-rose-600 py-3 text-sm font-medium text-white">ยืนยันยกเลิก</button>
          </div>
        </div>
      )}
      {(called || q.status === "IN_PROGRESS") && (
        <p className="text-center text-xs text-ink-3">คิวถูกเรียกเข้าตรวจแล้ว หากต้องการยกเลิก กรุณาติดต่อ{online ? "โรงพยาบาลทาง LINE" : "เจ้าหน้าที่ ณ จุดบริการ"}</p>
      )}
    </>
  );
}

/** Compact card for the patient's other queues. */
function SideCard({ q }: { q: Queue }) {
  const { state, now, update } = useMock();
  const { dept } = useLookups();
  const eta = estimateCallTime(state, q, now);
  const held = q.status === "WAITING" && state.queues.some((x) => x.patientId === q.patientId && x.id !== q.id && isCalledOrIn(x));

  function cancel() {
    if (!window.confirm(`ยกเลิกคิว ${q.queueNumber}?`)) return;
    update((s, n) => cancelQueue(s, n, q.id).state);
  }

  return (
    <div className="rounded-card bg-surface p-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="text-xs text-ink-3">{dept.get(q.departmentId)?.name}</div>
          <div className="font-mono text-2xl font-semibold tracking-tight">{q.queueNumber}</div>
        </div>
        <div className="text-right text-sm">
          <div className="font-medium">{STATUS_TEXT[q.status]}</div>
          {eta && <div className="text-xs text-ink-3">ประมาณ {fmtTime(eta)} น.</div>}
        </div>
      </div>
      {held && <p className="mt-2 rounded-2xl bg-subtle px-3 py-2 text-xs text-ink-2">คุณกำลังตรวจอีกแผนก ระบบเก็บลำดับคิวนี้ไว้ และจะเรียกต่อหลังตรวจเสร็จ</p>}
      {q.status === "WAITING" && <button onClick={cancel} className="mt-2 text-xs text-rose-700">ยกเลิกคิวนี้</button>}
    </div>
  );
}

function Info({ label, value, dot }: { label: string; value: string; dot?: string }) {
  return (
    <div className="rounded-[20px] bg-subtle px-4 py-3">
      <div className="text-xs text-ink-3">{label}</div>
      <div className="mt-0.5 flex items-center gap-1.5 truncate text-sm font-medium">
        {dot && <span className={`h-2 w-2 shrink-0 rounded-full ${dot}`} />}
        {value}
      </div>
    </div>
  );
}
