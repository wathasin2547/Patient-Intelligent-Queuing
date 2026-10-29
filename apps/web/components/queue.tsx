"use client";

import { UserX, Video } from "lucide-react";
import Link from "next/link";
import { markNoShow, startExam } from "@/lib/mock/actions";
import { ACTIVE, isCalledOrIn, NO_SHOW_MINUTES, queueScore, waitingMinutes } from "@/lib/mock/logic";
import { useMock } from "@/lib/mock/store";
import { minutesSince } from "@/lib/mock/time";
import type { Queue } from "@/lib/mock/types";
import { btn, LevelDot, LEVEL, Notice, StatusChip, Tag } from "./ui";

function QueueTags({ q }: { q: Queue }) {
  const { state } = useMock();
  const screening = state.screenings.find((s) => s.id === q.screeningId);
  const others = state.queues.filter((x) => x.patientId === q.patientId && x.id !== q.id && ACTIVE.includes(x.status));
  const heldElsewhere = q.status === "WAITING" && others.some(isCalledOrIn);
  return (
    <>
      {heldElsewhere && <Tag tone="amber">ติดตรวจแผนกอื่น · เก็บลำดับไว้</Tag>}
      {!heldElsewhere && others.length > 0 && <Tag>มีอีก {others.length} คิว</Tag>}
      {q.referredFromQueueId && <Tag>ส่งต่อ</Tag>}
      {q.appointmentId && <Tag tone="accent">นัดหมาย</Tag>}
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
    <Link href={`/staff/queues/${q.id}`} className={`flex items-center justify-between gap-3 rounded-2xl px-4 py-3 transition ${q.status === "CALLED" ? "bg-accent/70 hover:bg-accent" : "bg-subtle hover:bg-subtle-2"}`}>
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

/**
 * Actions once UC13 has called a patient. Onsite: the patient walks into the room.
 * Online: the patient already got the doctor's video link on LINE; the doctor opens the same room.
 */
export function CalledActions({ q, small }: { q: Queue; small?: boolean }) {
  const { state, now, update } = useMock();
  const doctor = state.doctors.find((d) => d.id === q.doctorId);
  const isDoctor = state.users.find((u) => u.id === state.sessionUserId)?.role === "DOCTOR";
  const online = q.visitType === "ONLINE";
  const left = q.calledTime ? Math.max(0, Math.ceil(NO_SHOW_MINUTES - minutesSince(q.calledTime, now))) : NO_SHOW_MINUTES;
  const size = small ? btn.small : "";

  function start() {
    // only the doctor's own click opens the room; staff just mark the visit as started
    if (online && isDoctor && doctor?.meetingUrl) window.open(doctor.meetingUrl, "_blank", "noopener");
    update((s) => startExam(s, q.id));
  }

  return (
    <div className="flex flex-col gap-2">
      {online && !doctor?.meetingUrl && <Notice tone="amber">แพทย์ยังไม่ได้ตั้งลิงก์ห้องตรวจออนไลน์ (ตั้งได้ที่ ข้อมูลพื้นฐาน → แพทย์)</Notice>}
      <div className="flex flex-wrap items-center gap-2">
        <button onClick={start} className={small ? btn.primarySmall : btn.primary}>
          {online && <Video size={small ? 13 : 16} strokeWidth={1.8} />}
          {online ? (isDoctor ? "เริ่มวิดีโอคอล" : "เริ่มตรวจออนไลน์") : "ผู้ป่วยเข้าห้องตรวจ"}
        </button>
        <button onClick={() => update((s, n) => markNoShow(s, n, q.id))} className={small ? `${size} bg-surface text-rose-700 ring-1 ring-rose-200 hover:bg-rose-50` : btn.danger}>
          <UserX size={small ? 13 : 16} strokeWidth={1.8} /> {online ? "ไม่เข้าร่วม" : "ไม่มา"}
        </button>
      </div>
      <span className="text-xs text-ink-3">
        {online ? "ส่งลิงก์ห้องตรวจให้ผู้ป่วยทาง LINE แล้ว · ไม่เข้าร่วม" : "ไม่มา"}ภายใน {left} นาที ระบบบันทึกว่าไม่มาเอง
      </span>
    </div>
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
