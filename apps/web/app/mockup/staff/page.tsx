"use client";

import Link from "next/link";
import { useState } from "react";
import { departments, doctors, emergencies, queues, score, type MockQueue } from "../_data";
import { LEVEL, LevelChip, StatusChip } from "../_ui";

export default function StaffDashboard() {
  const [dept, setDept] = useState<string>("ทั้งหมด");
  const [ackEmergency, setAckEmergency] = useState(false);

  const shownDoctors = doctors.filter((d) => dept === "ทั้งหมด" || d.department === dept);
  const waiting = queues.filter((q) => q.status === "WAITING");
  const avgWait = Math.round(waiting.reduce((s, q) => s + q.waitingMinutes, 0) / waiting.length);

  return (
    <div className="mx-auto max-w-7xl px-6 py-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">ติดตามภาพรวมคิว</h1>
          <p className="text-sm text-zinc-500">วันพฤหัสบดีที่ 1 ตุลาคม 2569 · อัปเดตล่าสุด 10:45 น.</p>
        </div>
        <div className="flex flex-wrap gap-1 rounded-lg bg-white p-1 ring-1 ring-zinc-200">
          {["ทั้งหมด", ...departments].map((d) => (
            <button
              key={d}
              onClick={() => setDept(d)}
              className={`rounded-md px-3 py-1.5 text-sm ${dept === d ? "bg-teal-600 text-white" : "text-zinc-600 hover:bg-zinc-100"}`}
            >
              {d}
            </button>
          ))}
        </div>
      </div>

      {!ackEmergency && emergencies.map((e) => (
        <div key={e.id} className="mt-5 flex flex-wrap items-center gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3">
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-red-600 text-white">!</span>
          <div className="flex-1 text-sm">
            <div className="font-semibold text-red-800">ผู้ป่วยเข้าเกณฑ์ฉุกเฉิน · {e.time} น.</div>
            <div className="text-red-700">ผู้ป่วย {e.ageGroup} แจ้งอาการ: {e.codes.join(", ")} — ระบบไม่ออกคิว และแนะนำให้ไปจุดบริการฉุกเฉินแล้ว</div>
          </div>
          <button onClick={() => setAckEmergency(true)} className="rounded-lg bg-red-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-red-700">
            รับทราบ
          </button>
        </div>
      ))}

      <div className="mt-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="รอเรียกทั้งหมด" value={`${waiting.length}`} unit="ราย" />
        <Stat label="เวลารอเฉลี่ย" value={`${avgWait}`} unit="นาที" />
        <Stat label="แพทย์ในเวรตอนนี้" value={`${doctors.length}`} unit="ท่าน" />
        <Stat label="เคสฉุกเฉินวันนี้" value={`${emergencies.length}`} unit="ราย" tone="red" />
      </div>

      <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {shownDoctors.map((doc) => {
          const mine = queues.filter((q) => q.doctor === doc.name);
          const current = mine.find((q) => q.status === "IN_PROGRESS" || q.status === "CALLED");
          const line = mine.filter((q) => q.status === "WAITING").sort((a, b) => score(b) - score(a));
          return (
            <section key={doc.name} className="rounded-xl bg-white ring-1 ring-zinc-200">
              <header className="flex items-start justify-between border-b border-zinc-100 px-4 py-3">
                <div>
                  <div className="font-medium">{doc.name}</div>
                  <div className="text-xs text-zinc-500">{doc.department} · เวร {doc.shift}</div>
                </div>
                <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs text-zinc-600">รอ {line.length}</span>
              </header>

              <div className="px-4 py-3">
                <div className="mb-1.5 text-xs font-medium text-zinc-500">กำลังให้บริการ</div>
                {current ? <QueueRow q={current} /> : <div className="rounded-lg border border-dashed border-zinc-200 py-3 text-center text-sm text-zinc-400">ว่าง</div>}
              </div>

              <div className="px-4 pb-4">
                <div className="mb-1.5 flex items-center justify-between text-xs font-medium text-zinc-500">
                  <span>ลำดับถัดไป (เรียงตามคะแนน P)</span>
                  <span>P</span>
                </div>
                <div className="flex flex-col gap-1.5">
                  {line.length === 0 && <div className="py-2 text-center text-sm text-zinc-400">ไม่มีผู้ป่วยรอ</div>}
                  {line.map((q, i) => <QueueRow key={q.id} q={q} rank={i + 1} />)}
                </div>
              </div>
            </section>
          );
        })}
      </div>

      <p className="mt-6 text-xs text-zinc-500">
        P = B<sub>ระดับ</sub> + α × นาทีที่รอ (B = 1000 / 600 / 300 / 200 สำหรับระดับ 2–5, α = 2) — ผู้ป่วยระดับเขียวที่รอนานจะขยับขึ้นมาเอง
      </p>
    </div>
  );
}

function Stat({ label, value, unit, tone }: { label: string; value: string; unit: string; tone?: "red" }) {
  return (
    <div className="rounded-xl bg-white px-4 py-3 ring-1 ring-zinc-200">
      <div className="text-xs text-zinc-500">{label}</div>
      <div className={`mt-1 text-2xl font-semibold ${tone === "red" ? "text-red-600" : ""}`}>
        {value} <span className="text-sm font-normal text-zinc-500">{unit}</span>
      </div>
    </div>
  );
}

function QueueRow({ q, rank }: { q: MockQueue; rank?: number }) {
  return (
    <Link
      href={`/mockup/staff/queue/${q.id}`}
      className={`flex items-center gap-3 rounded-lg border border-zinc-200 border-l-4 ${LEVEL[q.level].bar} px-3 py-2 hover:bg-zinc-50`}
    >
      {rank !== undefined && <span className="w-4 text-xs text-zinc-400">{rank}</span>}
      <div className="flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-mono text-sm font-semibold">{q.queueNumber}</span>
          <LevelChip level={q.level} />
          {q.visitType === "ONLINE" && <span className="rounded bg-sky-50 px-1.5 text-[11px] text-sky-700 ring-1 ring-sky-200">ออนไลน์</span>}
          {q.edited && <span className="rounded bg-violet-50 px-1.5 text-[11px] text-violet-700 ring-1 ring-violet-200">แก้ไขแล้ว</span>}
        </div>
        <div className="mt-0.5 text-xs text-zinc-500">
          {rank === undefined ? <StatusChip status={q.status} /> : `รอ ${q.waitingMinutes} นาที`}
        </div>
      </div>
      {rank !== undefined && <span className="text-sm tabular-nums text-zinc-600">{score(q)}</span>}
    </Link>
  );
}
