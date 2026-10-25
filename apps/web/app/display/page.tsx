"use client";

// UC13 step 3 — the department screen in front of the exam rooms.
// Shows queue numbers only (no names or symptoms) for privacy.
// Online visits are left out: those patients are at home and get their link on LINE.

import { Activity, Megaphone } from "lucide-react";
import { useState } from "react";
import { doctorsOnShift, rankedWaiting } from "@/lib/mock/logic";
import { useLookups, useMock } from "@/lib/mock/store";
import { fmtDate, fmtTime } from "@/lib/mock/time";

export default function DisplayPage() {
  const { state, now } = useMock();
  const { dept: deptMap, doctor: doctorMap } = useLookups();
  const [dept, setDept] = useState("ALL");
  const doctors = doctorsOnShift(state, now).filter((d) => dept === "ALL" || d.departmentId === dept);
  const onsite = (id: string) => state.queues.find((q) => q.id === id)?.visitType !== "ONLINE";
  const lastCall = [...state.callEvents].reverse().find((e) => e.kind === "CALL" && onsite(e.queueId) && (dept === "ALL" || doctorMap.get(e.doctorId)?.departmentId === dept));
  const latest = lastCall && state.queues.find((q) => q.id === lastCall.queueId);

  return (
    <div className="flex min-h-screen flex-col bg-ink p-4 text-white sm:p-8">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <span className="flex h-11 w-11 items-center justify-center rounded-full bg-lime text-ink"><Activity size={20} strokeWidth={2.2} /></span>
          <div>
            <div className="text-xl font-semibold">จอเรียกคิว</div>
            <div className="text-sm text-white/50">{fmtDate(now)}</div>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <select value={dept} onChange={(e) => setDept(e.target.value)} className="pill bg-white/10 text-white ring-white/10 [&>option]:text-ink">
            <option value="ALL">ทุกแผนก</option>
            {state.departments.filter((d) => d.isActive).map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
          </select>
          <div className="font-mono text-4xl font-light tabular-nums">{fmtTime(now)}</div>
        </div>
      </header>

      {latest && (
        <div className="mt-6 flex flex-wrap items-center justify-between gap-6 rounded-[36px] bg-lime px-8 py-7 text-ink">
          <div className="flex items-center gap-4">
            <span className="flex h-14 w-14 items-center justify-center rounded-full bg-ink text-lime"><Megaphone size={24} strokeWidth={1.8} /></span>
            <div>
              <div className="text-lg text-ink/60">ขอเชิญหมายเลข</div>
              <div className="font-mono text-7xl font-semibold leading-none tracking-tight sm:text-8xl">{latest.queueNumber}</div>
            </div>
          </div>
          <div className="text-right">
            <div className="text-sm text-ink/60">ที่ห้องตรวจ</div>
            <div className="text-2xl font-medium">{latest.doctorId ? doctorMap.get(latest.doctorId)?.name : "-"}</div>
          </div>
        </div>
      )}

      <div className="mt-6 grid flex-1 content-start gap-4 md:grid-cols-2 xl:grid-cols-3">
        {doctors.map((d) => {
          const current = state.queues.find((q) => q.doctorId === d.id && q.visitType !== "ONLINE" && (q.status === "CALLED" || q.status === "IN_PROGRESS"));
          const busyOnline = state.queues.some((q) => q.doctorId === d.id && q.visitType === "ONLINE" && (q.status === "CALLED" || q.status === "IN_PROGRESS"));
          const next = rankedWaiting(state, d.id, now).filter((q) => q.visitType !== "ONLINE").slice(0, 3);
          return (
            <section key={d.id} className="rounded-[32px] bg-white/[0.06] p-6">
              <div className="text-sm text-white/50">{deptMap.get(d.departmentId)?.name}</div>
              <div className="text-lg font-medium">{d.name}</div>
              <div className="mt-6 text-xs text-white/50">{current?.status === "IN_PROGRESS" ? "กำลังตรวจ" : current ? "เรียกแล้ว" : busyOnline ? "กำลังตรวจออนไลน์" : "ว่าง"}</div>
              <div className={`font-mono text-6xl font-semibold tracking-tight ${current?.status === "CALLED" ? "text-lime" : ""}`}>{current?.queueNumber ?? "—"}</div>
              <div className="mt-6 text-xs text-white/50">ลำดับถัดไป</div>
              <div className="mt-2 flex flex-wrap gap-2">
                {next.length ? next.map((q) => <span key={q.id} className="rounded-full bg-white/10 px-3.5 py-1.5 font-mono text-lg">{q.queueNumber}</span>) : <span className="text-white/30">—</span>}
              </div>
            </section>
          );
        })}
        {doctors.length === 0 && <p className="text-white/40">ไม่มีแพทย์อยู่ในเวรขณะนี้</p>}
      </div>
      <footer className="mt-6 text-sm text-white/40">ลำดับถัดไปอาจเปลี่ยนตามความเร่งด่วนและเวลารอ · ผู้ป่วยจะได้รับข้อความทาง LINE เมื่อถึงคิว</footer>
    </div>
  );
}
