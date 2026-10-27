"use client";

// UC11 Schedule Management — doctors' shifts + appointments for patients who already have one.
// Patients never book by themselves; staff record the appointment here.

import { CalendarPlus, Clock3, X } from "lucide-react";
import { useState } from "react";
import { APPOINTMENT_STATUS, Avatar, btn, Card, doctorInitials, Empty, Field, Notice, PageHeader, PillSelect, Segmented } from "@/components/ui";
import { addAppointment, addShift, cancelShift, checkInAppointment, setAppointmentStatus, shiftImpact, shiftOverlaps } from "@/lib/mock/actions";
import { useLookups, useMock } from "@/lib/mock/store";
import { addDays, atBkk, bkkDate, fmtDay, fmtTime } from "@/lib/mock/time";
import type { Shift } from "@/lib/mock/types";

type Msg = { tone: "accent" | "rose"; text: string } | null;

export default function SchedulePage() {
  const [tab, setTab] = useState<"shifts" | "appointments">("shifts");
  const [dept, setDept] = useState("ALL");
  const { state } = useMock();
  return (
    <div className="mx-auto max-w-[1400px]">
      <PageHeader title="ตารางเวรและนัดหมาย" subtitle="ระบบจ่ายคิวเฉพาะแพทย์ที่อยู่ในเวร และนับคิวนัดหมายในชั่วโมงถัดไปเป็นภาระงานของแพทย์">
        <PillSelect value={dept} onChange={setDept}>
          <option value="ALL">ทุกแผนก</option>
          {state.departments.filter((d) => d.isActive).map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
        </PillSelect>
      </PageHeader>
      <div className="mb-5">
        <Segmented value={tab} onChange={setTab} options={[{ value: "shifts", label: "ตารางเวรแพทย์" }, { value: "appointments", label: "คิวนัดหมาย" }]} />
      </div>
      {tab === "shifts" ? <Shifts key={dept} dept={dept} /> : <Appointments key={dept} dept={dept} />}
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
    const { appts, waiting } = shiftImpact(state, sh, now);
    const text = appts.length + waiting.length
      ? `เวรนี้มีคิวนัดหมาย ${appts.length} ราย และผู้ป่วยรออยู่ ${waiting.length} ราย\nผู้ป่วยที่รออยู่จะถูกย้ายไปแพทย์ท่านอื่นในแผนก ส่วนนัดหมายต้องย้ายเองที่แท็บคิวนัดหมาย\nยืนยันยกเลิกเวร?`
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
                    const appts = state.appointments.filter((a) => a.doctorId === doc.id && a.status === "SCHEDULED" && bkkDate(a.appointmentTime) === d).length;
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
                          {appts > 0 && <span className="text-[11px] text-ink-3">นัด {appts} ราย</span>}
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

function Appointments({ dept }: { dept: string }) {
  const { state, now, update } = useMock();
  const { doctor: doctorMap, patient: patientMap } = useLookups();
  const today = bkkDate(now);
  const days = Array.from({ length: 8 }, (_, i) => addDays(today, i));
  const [day, setDay] = useState(today);
  const doctors = state.doctors.filter((d) => dept === "ALL" || d.departmentId === dept);
  const docIds = new Set(doctors.map((d) => d.id));
  const list = state.appointments
    .filter((a) => docIds.has(a.doctorId) && bkkDate(a.appointmentTime) === day)
    .sort((a, b) => a.appointmentTime.localeCompare(b.appointmentTime));

  const [form, setForm] = useState({ patientId: "", doctorId: doctors[0]?.id ?? "", date: addDays(today, 1), time: "09:00", reason: "" });
  const [msg, setMsg] = useState<Msg>(null);
  const set = (patch: Partial<typeof form>) => setForm((f) => ({ ...f, ...patch }));
  const registered = state.patients.filter((p) => p.fullName).sort((a, b) => a.fullName.localeCompare(b.fullName, "th"));

  function add() {
    if (!form.patientId || !form.doctorId || !form.reason.trim()) return setMsg({ tone: "rose", text: "กรุณาเลือกผู้ป่วย แพทย์ และระบุเหตุผลการนัด" });
    const t = atBkk(form.date, form.time);
    if (new Date(t).getTime() <= now) return setMsg({ tone: "rose", text: "เวลานัดต้องอยู่หลังเวลาปัจจุบัน" });
    const inShift = state.shifts.some((s) => s.doctorId === form.doctorId && s.status === "ACTIVE" && s.startTime <= t && t < s.endTime);
    if (!inShift) return setMsg({ tone: "rose", text: "เวลานัดไม่อยู่ในเวรของแพทย์ท่านนี้" });
    update((s, n) => addAppointment(s, n, { patientId: form.patientId, doctorId: form.doctorId, appointmentTime: t, reason: form.reason.trim(), createdBy: s.sessionUserId! }));
    setMsg({ tone: "accent", text: "บันทึกนัดหมายแล้ว และแจ้งผู้ป่วยผ่าน LINE" });
    set({ reason: "" });
  }

  function checkIn(id: string) {
    const r = checkInAppointment(state, now, id);
    if (r.error) return setMsg({ tone: "rose", text: r.error });
    update(() => r.state);
    setMsg({ tone: "accent", text: "ยืนยันการมาถึงแล้ว ผู้ป่วยเข้าคิวของแพทย์ที่นัดไว้" });
  }

  return (
    <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_380px]">
      <Card
        title="รายการนัดหมาย"
        note={`${list.length} นัด`}
        action={
          <PillSelect value={day} onChange={setDay}>
            {days.map((d) => <option key={d} value={d}>{d === today ? `วันนี้ · ${fmtDay(d)}` : fmtDay(d)}</option>)}
          </PillSelect>
        }
      >
        {list.length === 0 && <Empty>ไม่มีนัดหมายในวันนี้</Empty>}
        <ul className="flex flex-col gap-2">
          {list.map((a) => {
            const late = a.status === "SCHEDULED" && new Date(a.appointmentTime).getTime() < now;
            const st = APPOINTMENT_STATUS[a.status];
            return (
              <li key={a.id} className="flex flex-wrap items-center gap-4 rounded-2xl bg-subtle px-4 py-3 transition hover:bg-subtle-2">
                <div className="w-14 text-center">
                  <div className="text-lg font-semibold tabular-nums">{fmtTime(a.appointmentTime)}</div>
                  <div className="text-[10px] text-ink-3">น.</div>
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium">{patientMap.get(a.patientId)?.fullName}</div>
                  <div className="truncate text-xs text-ink-3">{doctorMap.get(a.doctorId)?.name} · {a.reason}</div>
                </div>
                <span className={`rounded-full px-2.5 py-1 text-xs ${late ? "bg-amber-50 text-amber-800" : st.cls}`}>{late ? "เลยเวลานัด" : st.label}</span>
                {a.status === "SCHEDULED" && (
                  <div className="flex gap-1.5">
                    {day === today && <button onClick={() => checkIn(a.id)} className={btn.primarySmall}>ยืนยันมาถึง</button>}
                    {late && <button onClick={() => update((s) => setAppointmentStatus(s, a.id, "MISSED"))} className={`${btn.small} bg-surface text-ink-2 ring-1 ring-line`}>ไม่มาตามนัด</button>}
                    <button onClick={() => window.confirm("ยกเลิกนัดหมายนี้?") && update((s) => setAppointmentStatus(s, a.id, "CANCELLED"))} className={`${btn.small} bg-surface text-rose-700 ring-1 ring-rose-200`}>ยกเลิก</button>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
        <p className="mt-4 text-xs text-ink-3">ผู้ป่วยที่มีนัดเข้าคิวเมื่อยืนยันการมาถึง ถ้ามาก่อนเวลานัดระบบนับเวลารอจากเวลานัด เพื่อไม่ให้แซงผู้ป่วยที่รออยู่ก่อน</p>
      </Card>

      <Card title="บันทึกคิวนัดหมาย" icon={CalendarPlus} note="สำหรับผู้ป่วยที่แพทย์นัดกลับมาตรวจ">
        <div className="flex flex-col gap-3">
          <Field label="ผู้ป่วย (ที่ลงทะเบียนแล้ว)">
            <select value={form.patientId} onChange={(e) => set({ patientId: e.target.value })} className="input">
              <option value="">เลือกผู้ป่วย</option>
              {registered.map((p) => <option key={p.id} value={p.id}>{p.fullName}</option>)}
            </select>
          </Field>
          <Field label="แพทย์">
            <select value={form.doctorId} onChange={(e) => set({ doctorId: e.target.value })} className="input">
              {doctors.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
          </Field>
          <div className="grid grid-cols-2 gap-2">
            <Field label="วันที่">
              <select value={form.date} onChange={(e) => set({ date: e.target.value })} className="input">
                {days.map((d) => <option key={d} value={d}>{fmtDay(d)}</option>)}
              </select>
            </Field>
            <Field label="เวลา"><input type="time" value={form.time} onChange={(e) => set({ time: e.target.value })} className="input" /></Field>
          </div>
          <Field label="เหตุผลการนัด"><input value={form.reason} onChange={(e) => set({ reason: e.target.value })} className="input" placeholder="เช่น ติดตามความดันโลหิต" /></Field>
          <button onClick={add} className={`${btn.primary} mt-1`}>บันทึกนัดหมาย</button>
          {msg && <Notice tone={msg.tone}>{msg.text}</Notice>}
        </div>
      </Card>
    </div>
  );
}
