"use client";

// UC05 track queue status (and cancel while still waiting).

import { BellRing, Ticket } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { LEVEL, Notice } from "@/components/ui";
import { cancelQueue } from "@/lib/mock/actions";
import { ACTIVE, positionInLine } from "@/lib/mock/logic";
import { useLookups, useMock } from "@/lib/mock/store";
import { bkkDate, fmtTime } from "@/lib/mock/time";

const STATUS_TEXT = {
  WAITING: "รอเรียก",
  CALLED: "ถึงคิวแล้ว เชิญที่ห้องตรวจ",
  IN_PROGRESS: "กำลังตรวจ",
  DONE: "ตรวจเสร็จแล้ว",
  NO_SHOW: "ไม่มาตามเวลาที่เรียก",
  CANCELLED: "ยกเลิกแล้ว",
} as const;

export default function QueueStatusPage() {
  const { state, now, update } = useMock();
  const { dept, doctor } = useLookups();
  const [asking, setAsking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const mine = state.queues
    .filter((q) => q.patientId === state.liffPatientId && bkkDate(q.checkInTime) === bkkDate(now))
    .sort((a, b) => b.checkInTime.localeCompare(a.checkInTime));
  const q = mine.find((x) => ACTIVE.includes(x.status)) ?? mine[0];

  if (!q) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-4 p-6 text-center">
        <span className="flex h-14 w-14 items-center justify-center rounded-full bg-surface"><Ticket size={24} strokeWidth={1.6} /></span>
        <p className="text-sm text-ink-3">วันนี้คุณยังไม่มีคิว</p>
        <Link href="/liff/chat" className="w-full rounded-full bg-ink py-3.5 font-medium text-white">รับคิว</Link>
      </div>
    );
  }

  const ahead = (positionInLine(state, q, now) ?? 1) - 1;
  const done = !ACTIVE.includes(q.status);
  const called = q.status === "CALLED";

  function cancel() {
    const r = cancelQueue(state, now, q.id);
    setAsking(false);
    if (r.error) return setError(r.error);
    update(() => r.state);
  }

  return (
    <div className="flex flex-1 flex-col gap-3 p-4">
      <div className={`rounded-card p-6 ${called ? "bg-lime text-lime-ink" : done ? "bg-surface" : "bg-ink text-white"}`}>
        <div className={`text-sm ${called ? "text-lime-ink/70" : done ? "text-ink-3" : "text-white/60"}`}>หมายเลขคิวของคุณ</div>
        <div className={`mt-2 font-mono text-6xl font-semibold tracking-tight ${q.status === "CANCELLED" ? "text-ink-3 line-through" : !called && !done ? "text-lime" : ""}`}>{q.queueNumber}</div>
        <div className="mt-4 text-lg font-medium">{STATUS_TEXT[q.status]}</div>
        {q.status === "WAITING" && (
          <div className="mt-5 flex items-end gap-2">
            <span className="text-5xl font-light leading-none tabular-nums">{ahead}</span>
            <span className="pb-1 text-sm text-white/60">คนรออยู่ก่อนหน้า</span>
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 gap-2 rounded-card bg-surface p-2">
        <Info label="แผนก" value={dept.get(q.departmentId)?.name ?? "-"} />
        <Info label="ระดับ" value={LEVEL[q.priorityLevel].name} dot={LEVEL[q.priorityLevel].dot} />
        <Info label="แพทย์" value={q.doctorId ? doctor.get(q.doctorId)?.name ?? "-" : "รอจัดแพทย์"} />
        <Info label="รับคิวเมื่อ" value={`${fmtTime(q.checkInTime)} น.`} />
      </div>

      {!done && (
        <div className="flex gap-3 rounded-card bg-surface p-4 text-sm text-ink-2">
          <BellRing size={18} strokeWidth={1.8} className="shrink-0 text-ink" />
          ระบบส่งข้อความทาง LINE เมื่อเหลืออีก 3 คิว และอีกครั้งเมื่อถึงคิวของคุณ ไม่ต้องเฝ้าหน้าจอ
        </div>
      )}
      <p className="px-2 text-xs leading-relaxed text-ink-3">
        ลำดับอาจเปลี่ยนได้ เพราะผู้ป่วยที่มีอาการเร่งด่วนกว่าจะได้ตรวจก่อน แต่ระบบจะเลื่อนลำดับให้ผู้ที่รอนานขึ้นมาเรื่อย ๆ · ระบบแนะนำแผนกจากอาการที่แจ้ง ไม่ใช่การวินิจฉัยโรค
      </p>
      {error && <Notice tone="rose">{error}</Notice>}

      <div className="mt-auto pt-4">
        {q.status === "WAITING" && !asking && (
          <button onClick={() => setAsking(true)} className="w-full rounded-full bg-surface py-3.5 text-sm text-rose-700">ยกเลิกคิว</button>
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
          <p className="text-center text-xs text-ink-3">คิวถูกเรียกเข้าตรวจแล้ว หากต้องการยกเลิก กรุณาติดต่อเจ้าหน้าที่ ณ จุดบริการ</p>
        )}
      </div>
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
