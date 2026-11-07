"use client";

import { Clock3, X } from "lucide-react";
import { useState } from "react";
import { Avatar, btn, Card, doctorInitials, Field, Notice, PageHeader, PillSelect } from "@/components/ui";
import { addShift, cancelShift, shiftImpact, shiftOverlaps } from "@/lib/mock/actions";
import { useLookups, useMock } from "@/lib/mock/store";
import { addDays, atBkk, bkkDate, fmtDay, fmtTime } from "@/lib/mock/time";
import type { Shift } from "@/lib/mock/types";

type Msg = { tone: "accent" | "rose"; text: string } | null;

export default function SchedulePage() {
  const [dept, setDept] = useState("ALL");
  const { state } = useMock();
  return (
    <div className="mx-auto max-w-[1400px]">
      <PageHeader title="ตารางเวรแพทย์" subtitle="ระบบจ่ายคิวเฉพาะแพทย์ที่อยู่ในเวร">
        <PillSelect value={dept} onChange={setDept}>
          <option value="ALL">ทุกแผนก</option>
          {state.departments.filter((d) => d.isActive).map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
        </PillSelect>
      </PageHeader>
      <Shifts key={dept} dept={dept} />
    </div>
  );
}

function Shifts({ dept }: { dept: string }) {
  const { state, now, update } = useMock();
  const { dept: deptMap } = useLookups();
  const isAdmin = state.users.find((u) => u.id === state.sessionUserId)?.role === "ADMIN";
  const today = bkkDate(now);
  const nowIso = new Date(now).toISOString();
  const days = Array.from({ length: 7 }, (_, i) => addDays(today, i));
  const doctors = state.doctors.filter((d) => dept === "ALL" || d.departmentId === dept);

  const [form, setForm] = useState({ doctorId: doctors[0]?.id ?? "", date: today, start: "08:00", end: "16:00" });
  const [msg, setMsg] = useState<Msg>(null);
  const set = (patch: Partial<typeof form>) => setForm((f) => ({ ...f, ...patch }));

  function add() {
    if (!form.doctorId) return;
    const startTime = atBkk(form.date, form.start);
    const endTime = atBkk(form.date, form.end);
    if (endTime <= startTime) return setMsg({ tone: "rose", text: "เวลาสิ้นสุดต้องหลังเวลาเริ่มต้น" });
    if (shiftOverlaps(state, form.doctorId, startTime, endTime)) return setMsg({ tone: "rose", text: "เวรนี้ซ้อนกับเวรเดิมของแพทย์ท่านนี้" });
    update((s) => addShift(s, { doctorId: form.doctorId, date: form.date, startTime, endTime }));
    setMsg({ tone: "accent", text: "เพิ่มเวรแล้ว มีผลกับการจ่ายคิวครั้งถัดไป" });
  }

  function cancel(sh: Shift) {
    const { waiting } = shiftImpact(state, sh, now);
    const text = waiting.length
      ? `เวรนี้มีผู้ป่วยรออยู่ ${waiting.length} ราย\nผู้ป่วยที่รออยู่จะถูกย้ายไปแพทย์ท่านอื่นในแผนก\nยืนยันยกเลิกเวร?`
      : "ยืนยันยกเลิกเวรนี้?";
    if (window.confirm(text)) update((s, n) => cancelShift(s, n, sh.id));
  }

  return (
    <div className="grid gap-5 2xl:grid-cols-[minmax(0,1fr)_340px]">
      <section className="card overflow-hidden p-0 sm:p-0">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[880px] text-sm">
            <thead>
              <tr>
                <th className="px-6 py-5 text-left text-xs font-normal text-ink-3">แพทย์</th>
                {days.map((d) => (
                  <th key={d} className="px-1.5 py-5 text-center">
                    <span className={`inline-block rounded-full px-3 py-1 text-xs ${d === today ? "bg-ink font-medium text-white" : "font-normal text-ink-3"}`}>{fmtDay(d)}</span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {doctors.map((doc) => (
                <tr key={doc.id} className="border-t border-line/70 transition hover:bg-subtle/60">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <Avatar text={doctorInitials(doc.name, deptMap.get(doc.departmentId)?.code)} />
                      <div className="min-w-0">
                        <div className="truncate font-medium">{doc.name}</div>
                        <div className="text-xs text-ink-3">{deptMap.get(doc.departmentId)?.name}</div>
                      </div>
                    </div>
                  </td>
                  {days.map((d) => {
                    const list = state.shifts.filter((s) => s.doctorId === doc.id && s.date === d);
                    return (
                      <td key={d} className="px-1.5 py-3 text-center align-middle">
                        <div className="flex flex-col items-center gap-1">
                          {list.length === 0 && <span className="text-xs text-line">—</span>}
                          {list.map((sh) => {
                            const live = sh.status === "ACTIVE";
                            const running = live && sh.startTime <= nowIso && nowIso < sh.endTime;
                            return (
                              <span
                                key={sh.id}
                                className={`group inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs tabular-nums ${!live ? "bg-subtle text-ink-3 line-through" : running ? "bg-accent text-accent-ink" : "bg-subtle text-ink"}`}
                              >
                                {fmtTime(sh.startTime)}–{fmtTime(sh.endTime)}
                                {isAdmin && live && sh.endTime > nowIso && (
                                  <button onClick={() => cancel(sh)} title="ยกเลิกเวร" className="-mr-1 rounded-full p-0.5 text-ink-3 opacity-0 transition hover:bg-surface hover:text-rose-600 focus:opacity-100 group-hover:opacity-100">
                                    <X size={12} strokeWidth={2} />
                                  </button>
                                )}
                              </span>
                            );
                          })}
                        </div>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="flex flex-wrap gap-4 border-t border-line/70 px-6 py-4 text-xs text-ink-3">
          <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-accent" /> กำลังปฏิบัติงาน</span>
          <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-subtle ring-1 ring-line" /> เวรปกติ</span>
          <span className="line-through">ถูกยกเลิก</span>
        </div>
      </section>

      {isAdmin ? (
        <Card title="เพิ่มเวร" icon={Clock3}>
          <div className="flex flex-col gap-3">
            <Field label="แพทย์">
              <select value={form.doctorId} onChange={(e) => set({ doctorId: e.target.value })} className="input">
                {doctors.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
              </select>
            </Field>
            <Field label="วันที่">
              <select value={form.date} onChange={(e) => set({ date: e.target.value })} className="input">
                {days.map((d) => <option key={d} value={d}>{fmtDay(d)}</option>)}
              </select>
            </Field>
            <div className="grid grid-cols-2 gap-2">
              <Field label="เริ่ม"><input type="time" value={form.start} onChange={(e) => set({ start: e.target.value })} className="input" /></Field>
              <Field label="สิ้นสุด"><input type="time" value={form.end} onChange={(e) => set({ end: e.target.value })} className="input" /></Field>
            </div>
            <button onClick={add} className={`${btn.primary} mt-1`}>เพิ่มเวร</button>
            {msg && <Notice tone={msg.tone}>{msg.text}</Notice>}
          </div>
        </Card>
      ) : (
        <Notice>การเพิ่มหรือยกเลิกเวรทำได้เฉพาะผู้ดูแลระบบ</Notice>
      )}
    </div>
  );
}

