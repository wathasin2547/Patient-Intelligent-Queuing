"use client";

// Doctor's own screen: the patient in front of them, who comes next, and UC09.
// Calling the next patient stays automatic (UC13): the doctor never picks from the line.

import { CalendarCheck, CheckCheck, ClipboardList, Stethoscope, Users, Video } from "lucide-react";
import Link from "next/link";
import { APPOINTMENT_STATUS, btn, Card, Empty, LevelChip, PageHeader, StatusChip, Tag } from "@/components/ui";
import { CalledActions, PFormula, QueueRow } from "@/components/queue";
import { rankedWaiting, shiftNow } from "@/lib/mock/logic";
import { useLookups, useMock } from "@/lib/mock/store";
import { bkkDate, fmtTime } from "@/lib/mock/time";
import type { Queue } from "@/lib/mock/types";

export default function DoctorPage() {
  const { state, now } = useMock();
  const { dept } = useLookups();
  const me = state.users.find((u) => u.id === state.sessionUserId);
  const doctor = state.doctors.find((d) => d.id === me?.doctorId);

  if (!doctor) {
    return <Empty>บัญชีนี้ยังไม่ได้ผูกกับรายชื่อแพทย์ กรุณาติดต่อผู้ดูแลระบบ</Empty>;
  }

  const today = bkkDate(now);
  const shift = shiftNow(state, doctor.id, now);
  const current = state.queues.find((q) => q.doctorId === doctor.id && (q.status === "CALLED" || q.status === "IN_PROGRESS"));
  const line = rankedWaiting(state, doctor.id, now);
  const done = state.queues
    .filter((q) => q.doctorId === doctor.id && q.status === "DONE" && q.finishedTime && bkkDate(q.finishedTime) === today)
    .sort((a, b) => b.finishedTime!.localeCompare(a.finishedTime!));
  const appointments = state.appointments
    .filter((a) => a.doctorId === doctor.id && bkkDate(a.appointmentTime) === today)
    .sort((a, b) => a.appointmentTime.localeCompare(b.appointmentTime));

  return (
    <div className="mx-auto max-w-[1200px]">
      <PageHeader title="คิวของฉัน" subtitle={`${doctor.name} · ${dept.get(doctor.departmentId)?.name ?? "-"}`}>
        <span className={`rounded-full px-4 py-2 text-sm ${shift ? "bg-lime text-lime-ink" : "bg-surface text-ink-3 ring-1 ring-line"}`}>
          {shift ? `อยู่ในเวร ${fmtTime(shift.startTime)}–${fmtTime(shift.endTime)} น.` : "ไม่อยู่ในเวรขณะนี้"}
        </span>
      </PageHeader>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_380px]">
        <div className="flex min-w-0 flex-col gap-5">
          <Card title="ผู้ป่วยตรงหน้า" icon={Stethoscope}>
            {current ? (
              <CurrentCard q={current} />
            ) : (
              <Empty>{shift ? "ว่าง · ระบบจะเรียกผู้ป่วยรายถัดไปให้เองเมื่อมีผู้ป่วยรอ" : "ไม่มีผู้ป่วย · ระบบเริ่มเรียกคิวเมื่อถึงเวลาเริ่มเวร"}</Empty>
            )}
          </Card>

          <Card title="ตรวจเสร็จวันนี้" icon={CheckCheck} note={`${done.length} ราย`}>
            {done.length === 0 && <p className="text-sm text-ink-3">ยังไม่มี</p>}
            <ul className="-mx-3 flex flex-col">
              {done.map((q) => {
                const rx = state.prescriptions.some((r) => r.queueId === q.id);
                return (
                  <li key={q.id}>
                    <Link href={`/staff/queues/${q.id}`} className="flex items-center gap-3 rounded-2xl px-3 py-2.5 text-sm transition hover:bg-subtle">
                      <span className="font-mono font-semibold">{q.queueNumber}</span>
                      <span className="flex-1 truncate text-ink-2">{state.patients.find((p) => p.id === q.patientId)?.fullName}</span>
                      {rx ? <Tag tone="lime">สั่งยา</Tag> : <Tag>ไม่สั่งยา</Tag>}
                      <span className="w-14 text-right text-xs tabular-nums text-ink-3">{fmtTime(q.finishedTime!)} น.</span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </Card>
        </div>

        <div className="flex flex-col gap-5">
          <Card title="ลำดับถัดไป" icon={Users} note={`${line.length} ราย`}>
            <div className="-mx-3 flex flex-col">
              {line.length === 0 && <p className="px-3 py-2 text-sm text-ink-3">ไม่มีผู้ป่วยรอ</p>}
              {line.map((q, i) => <QueueRow key={q.id} q={q} rank={i + 1} />)}
            </div>
            <div className="mt-4"><PFormula /></div>
          </Card>

          <Card title="นัดหมายวันนี้" icon={CalendarCheck}>
            {appointments.length === 0 && <p className="text-sm text-ink-3">ไม่มีนัดหมาย</p>}
            <ul className="flex flex-col gap-2">
              {appointments.map((a) => (
                <li key={a.id} className="flex items-center gap-3 rounded-2xl bg-subtle px-4 py-2.5 text-sm">
                  <span className="w-12 tabular-nums font-medium">{fmtTime(a.appointmentTime)}</span>
                  <span className="min-w-0 flex-1 truncate">{state.patients.find((p) => p.id === a.patientId)?.fullName}</span>
                  <span className={`rounded-full px-2.5 py-0.5 text-xs ${APPOINTMENT_STATUS[a.status].cls}`}>{APPOINTMENT_STATUS[a.status].label}</span>
                </li>
              ))}
            </ul>
          </Card>
        </div>
      </div>
    </div>
  );
}

function CurrentCard({ q }: { q: Queue }) {
  const { state } = useMock();
  const { code } = useLookups();
  const patient = state.patients.find((p) => p.id === q.patientId);
  const screening = state.screenings.find((s) => s.id === q.screeningId);
  const called = q.status === "CALLED";
  const online = q.visitType === "ONLINE";
  const meetingUrl = state.doctors.find((d) => d.id === q.doctorId)?.meetingUrl;

  return (
    <div>
      <div className={`flex flex-wrap items-center justify-between gap-4 rounded-[22px] px-5 py-4 ${called ? "bg-lime" : "bg-subtle"}`}>
        <div>
          <div className="font-mono text-4xl font-semibold tracking-tight">{q.queueNumber}</div>
          <div className="mt-1 text-sm">{patient?.fullName}</div>
          <div className="text-xs text-ink-2">
            อายุ {patient?.ageGroup} ปี · {patient?.healthCoverage}{patient?.isChronic ? " · มีโรคประจำตัว" : ""}
          </div>
        </div>
        <div className="flex flex-col items-end gap-2">
          <StatusChip status={q.status} />
          <LevelChip level={q.priorityLevel} />
          {online && <Tag tone="sky">ตรวจออนไลน์</Tag>}
        </div>
      </div>

      {screening && (
        <div className="mt-4 flex flex-col gap-3 text-sm">
          <div>
            <div className="text-xs text-ink-3">ข้อความที่ผู้ป่วยพิมพ์</div>
            <p className="mt-0.5">{screening.freeTextInput ? `“${screening.freeTextInput}”` : <span className="text-ink-3">— ไม่ได้พิมพ์ —</span>}</p>
          </div>
          {screening.reason.length > 0 && (
            <div>
              <div className="flex items-center gap-1.5 text-xs text-ink-3"><ClipboardList size={13} strokeWidth={1.8} /> อาการที่ทำให้ระบบแนะนำแผนกนี้</div>
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                {screening.reason.map((r) => <Tag key={r.code}>{code.get(r.code)?.label ?? r.code}</Tag>)}
              </div>
            </div>
          )}
        </div>
      )}
      {q.appointmentId && <p className="mt-4 text-sm text-ink-2">ผู้ป่วยมาตามนัดหมาย ไม่ได้ซักประวัติผ่านแชทบอท</p>}

      <div className="mt-5 flex flex-wrap items-start gap-2">
        {called ? (
          <CalledActions q={q} />
        ) : (
          <>
            <Link href={`/staff/queues/${q.id}`} className={btn.accent}>บันทึกผลการตรวจ</Link>
            {online && meetingUrl && (
              <a href={meetingUrl} target="_blank" rel="noopener noreferrer" className={btn.secondary}>
                <Video size={16} strokeWidth={1.8} /> เปิดห้องวิดีโอคอล
              </a>
            )}
          </>
        )}
        <Link href={`/staff/queues/${q.id}`} className={`${btn.link} ml-auto mt-2.5`}>ดูผลคัดกรองทั้งหมด</Link>
      </div>
    </div>
  );
}
