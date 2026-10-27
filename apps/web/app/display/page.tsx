"use client";

// UC13 step 3 — the department screen in front of the exam rooms.
// Shows queue numbers only (no names or symptoms) for privacy.
// Online visits are left out: those patients are at home and get their link on LINE.
// Read from across the room: near-black board, white numbers, yellow = called now; labels >= 16px.

import { Activity, ArrowRight, Megaphone } from "lucide-react";
import { useState } from "react";
import { doctorsOnShift, rankedWaiting } from "@/lib/mock/logic";
import { useLookups, useMock } from "@/lib/mock/store";
import { fmtDate, fmtTime } from "@/lib/mock/time";

type RoomState = "CALLED" | "IN_PROGRESS" | "ONLINE" | "FREE";
const ROOM: Record<RoomState, { label: string; pill: string }> = {
  CALLED: { label: "เรียกแล้ว เชิญเข้าห้อง", pill: "bg-call text-ink" },
  IN_PROGRESS: { label: "กำลังตรวจ", pill: "bg-white text-ink" },
  ONLINE: { label: "กำลังตรวจออนไลน์", pill: "bg-white/15 text-white" },
  FREE: { label: "ว่าง", pill: "bg-white/15 text-white" },
};

export default function DisplayPage() {
  const { state, now } = useMock();
  const { dept: deptMap, doctor: doctorMap } = useLookups();
  const [dept, setDept] = useState("ALL");
  const doctors = doctorsOnShift(state, now).filter((d) => dept === "ALL" || d.departmentId === dept);
  const onsite = (id: string) => state.queues.find((q) => q.id === id)?.visitType !== "ONLINE";
  const lastCall = [...state.callEvents].reverse().find((e) => e.kind === "CALL" && onsite(e.queueId) && (dept === "ALL" || doctorMap.get(e.doctorId)?.departmentId === dept));
  const latest = lastCall && state.queues.find((q) => q.id === lastCall.queueId);

  return (
    <div className="flex min-h-screen flex-col bg-board p-4 text-white sm:p-8">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-accent text-ink"><Activity size={22} strokeWidth={2.2} /></span>
          <div>
            <div className="text-2xl font-semibold">จอเรียกคิว</div>
            <div className="text-base text-white/80">{fmtDate(now)}</div>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <select
            value={dept}
            onChange={(e) => setDept(e.target.value)}
            aria-label="เลือกแผนก"
            className="pill bg-board-card text-base text-white ring-white/25 hover:ring-white/60 [&>option]:text-ink"
          >
            <option value="ALL">ทุกแผนก</option>
            {state.departments.filter((d) => d.isActive).map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
          </select>
          <div className="font-mono text-5xl font-semibold tabular-nums">{fmtTime(now)}</div>
        </div>
      </header>

      {latest && (
        // aria-live so a screen reader at the counter announces each new call
        <div aria-live="polite" className="mt-6 flex flex-wrap items-center justify-between gap-6 rounded-3xl bg-call px-8 py-7 text-ink shadow-[0_0_0_6px_rgba(255,214,10,0.18)]">
          <div className="flex items-center gap-5">
            <span className="flex h-16 w-16 items-center justify-center rounded-full bg-ink text-call motion-safe:animate-pulse"><Megaphone size={28} strokeWidth={2} /></span>
            <div>
              <div className="text-xl font-medium">ขอเชิญหมายเลข</div>
              <div className="font-mono text-7xl font-bold leading-none tracking-tight sm:text-8xl">{latest.queueNumber}</div>
            </div>
          </div>
          <div className="flex items-center gap-3 text-right">
            <ArrowRight size={36} strokeWidth={2.2} aria-hidden />
            <div>
              <div className="text-lg font-medium">ที่ห้องตรวจ</div>
              <div className="text-3xl font-bold">{latest.doctorId ? doctorMap.get(latest.doctorId)?.name : "-"}</div>
            </div>
          </div>
        </div>
      )}

      <div className="mt-6 grid flex-1 content-start gap-5 md:grid-cols-2 xl:grid-cols-3">
        {doctors.map((d) => {
          const current = state.queues.find((q) => q.doctorId === d.id && q.visitType !== "ONLINE" && (q.status === "CALLED" || q.status === "IN_PROGRESS"));
          const busyOnline = state.queues.some((q) => q.doctorId === d.id && q.visitType === "ONLINE" && (q.status === "CALLED" || q.status === "IN_PROGRESS"));
          const next = rankedWaiting(state, d.id, now).filter((q) => q.visitType !== "ONLINE").slice(0, 3);
          const room: RoomState = current ? (current.status as "CALLED" | "IN_PROGRESS") : busyOnline ? "ONLINE" : "FREE";
          const called = room === "CALLED";
          return (
            <section
              key={d.id}
              className={`rounded-3xl bg-board-card p-6 ring-2 ${called ? "ring-call" : "ring-white/10"}`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-base font-medium text-accent">{deptMap.get(d.departmentId)?.name}</div>
                  <div className="truncate text-xl font-semibold">{d.name}</div>
                </div>
                <span className={`shrink-0 rounded-full px-3 py-1 text-sm font-semibold ${ROOM[room].pill}`}>{ROOM[room].label}</span>
              </div>
              <div className={`mt-5 font-mono text-7xl font-bold leading-none tracking-tight ${called ? "text-call" : current ? "text-white" : "text-white/70"}`}>
                {current?.queueNumber ?? "—"}
              </div>
              <div className="mt-6 border-t border-white/15 pt-4 text-base font-medium text-white/80">ลำดับถัดไป</div>
              <div className="mt-2 flex flex-wrap gap-2">
                {next.length
                  ? next.map((q) => <span key={q.id} className="rounded-xl bg-white/10 px-4 py-2 font-mono text-2xl font-semibold ring-1 ring-white/25">{q.queueNumber}</span>)
                  : <span className="text-lg text-white/80">ไม่มีผู้ป่วยรอ</span>}
              </div>
            </section>
          );
        })}
        {doctors.length === 0 && <p className="text-xl text-white/80">ไม่มีแพทย์อยู่ในเวรขณะนี้</p>}
      </div>
      <footer className="mt-6 text-base text-white/80">ลำดับถัดไปอาจเปลี่ยนตามความเร่งด่วนและเวลารอ · ผู้ป่วยจะได้รับข้อความทาง LINE เมื่อถึงคิว</footer>
    </div>
  );
}
