"use client";

import Link from "next/link";
import { queueScore, waitingMinutes } from "@/lib/mock/logic";
import { useMock } from "@/lib/mock/store";
import type { Queue } from "@/lib/mock/types";
import { LevelDot, LEVEL, StatusChip, Tag } from "./ui";

function QueueTags({ q }: { q: Queue }) {
  const { state } = useMock();
  const screening = state.screenings.find((s) => s.id === q.screeningId);
  return (
    <>
      {q.appointmentId && <Tag tone="lime">นัดหมาย</Tag>}
      {q.visitType === "ONLINE" && <Tag tone="sky">ออนไลน์</Tag>}
      {q.editedBy && <Tag>แก้ไขแล้ว</Tag>}
      {screening?.llmStatus === "failed" && <Tag tone="amber">LLM ล้มเหลว</Tag>}
    </>
  );
}

/** One patient in a doctor's waiting line, ranked by P. */
export function QueueRow({ q, rank }: { q: Queue; rank: number }) {
  const { state, now } = useMock();
  return (
    <Link href={`/staff/queues/${q.id}`} className="flex items-center gap-3 rounded-2xl px-3 py-2.5 transition hover:bg-subtle">
      <span className="w-4 text-right text-xs tabular-nums text-ink-3">{rank}</span>
      <LevelDot level={q.priorityLevel} />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="font-mono text-sm font-semibold tracking-tight">{q.queueNumber}</span>
          <QueueTags q={q} />
        </div>
        <div className="text-xs text-ink-3">
          {LEVEL[q.priorityLevel].name} · รอ {Math.round(waitingMinutes(q, state, now))} นาที
        </div>
      </div>
      <span className="text-right">
        <span className="block text-sm font-medium tabular-nums">{Math.round(queueScore(q, state, now))}</span>
        <span className="block text-[10px] text-ink-3">P</span>
      </span>
    </Link>
  );
}

/** The patient with the doctor now (called or in the exam room). */
export function CurrentPatient({ q }: { q: Queue }) {
  return (
    <Link href={`/staff/queues/${q.id}`} className={`flex items-center justify-between gap-3 rounded-2xl px-4 py-3 transition ${q.status === "CALLED" ? "bg-lime/70 hover:bg-lime" : "bg-subtle hover:bg-[#ecede8]"}`}>
      <div className="min-w-0">
        <div className="font-mono text-2xl font-semibold tracking-tight">{q.queueNumber}</div>
        <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-xs text-ink-2">
          <LevelDot level={q.priorityLevel} className="h-2 w-2" />
          {LEVEL[q.priorityLevel].name}
          <QueueTags q={q} />
        </div>
      </div>
      <StatusChip status={q.status} />
    </Link>
  );
}

export function PFormula() {
  return (
    <p className="text-xs leading-relaxed text-ink-3">
      ลำดับเรียงตาม P = B<sub>ระดับ</sub> + α × นาทีที่รอ (B = 1000 / 600 / 300 / 200 สำหรับระดับ 2–5, α = 2) ·
      ผู้ป่วยที่มีนัดเริ่มนับเวลารอจากเวลานัด · ผู้ป่วยระดับเขียวที่รอนานจะขยับขึ้นเอง
    </p>
  );
}
