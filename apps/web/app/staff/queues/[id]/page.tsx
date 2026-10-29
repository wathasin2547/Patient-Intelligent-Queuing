"use client";

// UC08 review/edit the screening result (staff) + UC09 record the exam result (doctor).

import { ArrowLeft, CalendarCheck, ClipboardList, FilePenLine, Forward, Layers, MessageSquareText, Pill, Sparkles } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useState } from "react";
import { PrescriptionForm } from "@/components/prescription-form";
import { CalledActions } from "@/components/queue";
import { btn, Card, Field, LEVEL, LevelChip, LevelDot, Notice, StatusChip, Tag } from "@/components/ui";
import { DELIVERY_LABEL, editScreening, referQueue, updateDeliveryStatus } from "@/lib/mock/actions";
import { doctorsOnShift, estimateCallTime, nextShiftStart, positionInLine, queueScore, waitingMinutes } from "@/lib/mock/logic";
import { useLookups, useMock } from "@/lib/mock/store";
import { bkkDate, fmtShortDate, fmtTime } from "@/lib/mock/time";
import type { DeliveryStatus, Level, Queue } from "@/lib/mock/types";

function useMe() {
  const { state } = useMock();
  const me = state.users.find((u) => u.id === state.sessionUserId);
  return { me, isDoctor: me?.role === "DOCTOR" };
}

export default function QueueDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { state } = useMock();
  const { me, isDoctor } = useMe();
  const q = state.queues.find((x) => x.id === id);
  // a doctor sees only the patients assigned to them
  const message = !q ? "ไม่พบคิวนี้" : isDoctor && q.doctorId !== me?.doctorId ? "คิวนี้ไม่ได้อยู่ในความรับผิดชอบของคุณ" : null;
  if (!q || message) {
    return (
      <div className="mx-auto max-w-[1200px]">
        <BackLink />
        <p className="mt-6 text-ink-3">{message}</p>
      </div>
    );
  }
  // key: reset the forms when another queue is opened
  return <QueueDetail key={q.id} q={q} />;
}

function BackLink() {
  const { isDoctor } = useMe();
  return (
    <Link href={isDoctor ? "/staff/doctor" : "/staff/queues"} className="inline-flex items-center gap-2 rounded-full bg-surface px-4 py-2 text-sm text-ink-2 ring-1 ring-line hover:text-ink">
      <ArrowLeft size={15} strokeWidth={1.8} /> {isDoctor ? "คิวของฉัน" : "จัดการคิว"}
    </Link>
  );
}

function QueueDetail({ q }: { q: Queue }) {
  const { state, now } = useMock();
  const { dept, doctor, patient: patientMap, code, user } = useLookups();
  const { isDoctor } = useMe();
  const patient = patientMap.get(q.patientId);
  const screening = state.screenings.find((s) => s.id === q.screeningId);
  const appointment = state.appointments.find((a) => a.id === q.appointmentId);
  const pos = positionInLine(state, q, now);
  const waiting = q.status === "WAITING";

  return (
    <div className="mx-auto max-w-[1200px]">
      <BackLink />

      <section className="card mt-5">
        <div className="flex flex-wrap items-start justify-between gap-6">
          <div>
            <div className="text-sm text-ink-3">หมายเลขคิว</div>
            <h1 className="font-mono text-5xl font-semibold tracking-tight">{q.queueNumber}</h1>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <LevelChip level={q.priorityLevel} />
              <StatusChip status={q.status} />
              {q.visitType === "ONLINE" && <Tag tone="sky">ตรวจออนไลน์</Tag>}
              {q.appointmentId && <Tag tone="accent">มาตามนัดหมาย</Tag>}
            </div>
          </div>
          <dl className="grid flex-1 grid-cols-2 gap-2 sm:max-w-[560px] sm:grid-cols-3">
            <Info label="ผู้ป่วย" value={patient?.fullName ?? "-"} sub={`อายุ ${patient?.ageGroup} ปี · ${patient?.healthCoverage}${patient?.isChronic ? " · โรคประจำตัว" : ""}`} />
            <Info label="แผนก / แพทย์" value={dept.get(q.departmentId)?.name ?? "-"} sub={q.doctorId ? doctor.get(q.doctorId)?.name : "ยังไม่มีแพทย์"} />
            <Info
              label={waiting ? "รอมาแล้ว" : "เวลา"}
              value={waiting ? `${Math.round(waitingMinutes(q, state, now))} นาที` : `${fmtTime(q.checkInTime)} น.`}
              sub={waiting ? `P = ${Math.round(queueScore(q, state, now))} · ลำดับที่ ${pos}` : [q.calledTime && `เรียก ${fmtTime(q.calledTime)}`, q.finishedTime && `จบ ${fmtTime(q.finishedTime)}`].filter(Boolean).join(" · ") || "รับคิว"}
            />
          </dl>
        </div>
      </section>

      <div className="mt-5 grid gap-5 lg:grid-cols-[minmax(0,1fr)_400px]">
        <div className="flex min-w-0 flex-col gap-5">
          {appointment && (
            <Card title="ข้อมูลนัดหมาย" icon={CalendarCheck}>
              <p className="text-sm">นัดกับ {doctor.get(appointment.doctorId)?.name} เวลา {fmtTime(appointment.appointmentTime)} น. · {appointment.reason}</p>
              <p className="mt-2 text-xs text-ink-3">ผู้ป่วยที่มีนัดไม่ต้องซักประวัติผ่านแชทบอท ระบบให้ระดับเขียวเป็นค่าเริ่มต้น และนับเวลารอจากเวลานัดหากมาถึงก่อน</p>
            </Card>
          )}

          {screening && (
            <>
              <Card title="สิ่งที่ผู้ป่วยแจ้ง" icon={MessageSquareText}>
                <dl className="flex flex-col gap-2">
                  {screening.answers.map((a) => (
                    <div key={a.questionText} className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-0.5 rounded-2xl bg-subtle px-4 py-2.5 text-sm">
                      <dt className="text-ink-3">{a.questionText}</dt>
                      <dd className="font-medium">{a.answer}</dd>
                    </div>
                  ))}
                </dl>
                <div className="mt-4">
                  <div className="text-xs text-ink-3">ข้อความที่ผู้ป่วยพิมพ์ (ต้นฉบับ)</div>
                  <p className="mt-1 text-[15px] leading-relaxed">{screening.freeTextInput ? `“${screening.freeTextInput}”` : <span className="text-ink-3">— ไม่ได้พิมพ์ —</span>}</p>
                </div>
                <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-line/70 pt-4 text-sm">
                  <span className="flex items-center gap-1.5 text-xs text-ink-3"><Sparkles size={14} strokeWidth={1.8} /> รหัสอาการจาก LLM</span>
                  {screening.llmStatus === "ok" && (screening.llmCodes.length ? screening.llmCodes.map((c) => <code key={c} className="rounded-full bg-subtle px-2.5 py-0.5 text-xs">{c}</code>) : <span className="text-xs text-ink-3">ไม่พบรหัสที่ตรงกับบัญชี</span>)}
                  {screening.llmStatus === "skipped" && <span className="text-xs text-ink-3">ไม่ได้เรียก (ไม่มีข้อความ)</span>}
                  {screening.llmStatus === "failed" && <Tag tone="amber">เรียก LLM ไม่สำเร็จ · ใช้เฉพาะคำตอบปลายปิด ควรอ่านข้อความประกอบ</Tag>}
                </div>
              </Card>

              <Card title="ผลการคัดกรองของระบบ" icon={ClipboardList} note="ระบบแนะนำแผนก ไม่ได้วินิจฉัยโรค">
                <ScreeningResult q={q} />
              </Card>
            </>
          )}
        </div>

        <div className="flex flex-col gap-5">
          {isDoctor ? <ResultCard q={q} /> : <><EditCard q={q} /><ResultCard q={q} /></>}
          {isDoctor && q.status === "IN_PROGRESS" && <ReferCard q={q} />}
          <OtherQueuesCard q={q} />
          {q.editedBy && (
            <p className="px-2 text-xs text-ink-3">
              แก้ไขล่าสุดโดย {user.get(q.editedBy)?.username} เมื่อ {fmtTime(q.editedAt!)} น. · ผลเดิมของระบบยังเก็บไว้ ใช้นับว่าอัลกอริทึมถูกแก้กี่ครั้ง
            </p>
          )}
          {screening?.symptomCodes.some((c) => code.get(c)?.onsiteOnly) && q.visitType === "ONSITE" && (
            <p className="px-2 text-xs text-ink-3">มีรหัสอาการที่ต้องตรวจที่สถานพยาบาล จึงไม่เสนอการตรวจออนไลน์</p>
          )}
        </div>
      </div>
    </div>
  );
}

/** The same patient's other queues today: shows staff and doctors when a patient is held elsewhere. */
function OtherQueuesCard({ q }: { q: Queue }) {
  const { state, now } = useMock();
  const { dept } = useLookups();
  const { isDoctor } = useMe();
  const others = state.queues
    .filter((x) => x.patientId === q.patientId && x.id !== q.id && bkkDate(x.checkInTime) === bkkDate(now))
    .sort((a, b) => a.checkInTime.localeCompare(b.checkInTime));
  if (others.length === 0) return null;
  return (
    <Card title="คิวอื่นของผู้ป่วยวันนี้" icon={Layers} note="ระบบเรียกได้ทีละคิว ถ้ากำลังตรวจอยู่อีกแผนก ระบบเก็บลำดับไว้">
      <ul className="flex flex-col gap-2">
        {others.map((x) => {
          const eta = estimateCallTime(state, x, now);
          const row = (
            <>
              <span className="font-mono font-semibold">{x.queueNumber}</span>
              <span className="flex-1 truncate text-ink-2">{dept.get(x.departmentId)?.name}{x.referredFromQueueId === q.id ? " · ส่งต่อจากคิวนี้" : ""}</span>
              {eta && <span className="text-xs text-ink-3">~{fmtTime(eta)}</span>}
              <StatusChip status={x.status} />
            </>
          );
          // a doctor may open only their own patients' queues
          return (
            <li key={x.id}>
              {isDoctor ? (
                <div className="flex items-center gap-3 rounded-2xl bg-subtle px-4 py-2.5 text-sm">{row}</div>
              ) : (
                <Link href={`/staff/queues/${x.id}`} className="flex items-center gap-3 rounded-2xl bg-subtle px-4 py-2.5 text-sm hover:bg-subtle-2">{row}</Link>
              )}
            </li>
          );
        })}
      </ul>
    </Card>
  );
}

/** UC09 alternate flow: send the patient to another department today instead of another day. */
function ReferCard({ q }: { q: Queue }) {
  const { state, update } = useMock();
  const options = state.departments.filter((d) => d.isActive && d.id !== q.departmentId);
  const [dept, setDept] = useState(options[0]?.id ?? "");
  const [level, setLevel] = useState<Level>(q.priorityLevel === 1 ? 2 : q.priorityLevel);
  const [result, setResult] = useState<{ ok: boolean; text: string } | null>(null);

  function refer() {
    let outcome: { ok: boolean; text: string } = { ok: false, text: "" };
    update((s, n) => {
      const r = referQueue(s, n, { fromQueueId: q.id, departmentId: dept, priorityLevel: level });
      outcome = r.error ? { ok: false, text: r.error } : { ok: true, text: `ออกคิว ${r.queueNumber} แล้ว ผู้ป่วยได้รับข้อความทาง LINE และรอพร้อมกันได้ทันที` };
      return r.state;
    });
    setResult(outcome);
  }

  return (
    <Card title="ส่งต่อแผนกอื่น" icon={Forward} note="ตรวจได้ในวันนี้ ไม่ต้องมาใหม่อีกวัน">
      <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-2">
        <select value={dept} onChange={(e) => setDept(e.target.value)} className="input">
          {options.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
        </select>
        <select value={level} onChange={(e) => setLevel(Number(e.target.value) as Level)} className="input">
          {([2, 3, 4, 5] as Level[]).map((l) => <option key={l} value={l}>{LEVEL[l].name}</option>)}
        </select>
      </div>
      <button onClick={refer} disabled={!dept} className={`${btn.secondary} mt-3 w-full`}>ส่งต่อและออกคิว</button>
      {result && <div className="mt-3"><Notice tone={result.ok ? "accent" : "amber"}>{result.text}</Notice></div>}
      <p className="mt-3 text-xs text-ink-3">คิวใหม่เริ่มนับเวลารอตั้งแต่ตอนส่งต่อ จึงไม่แซงผู้ป่วยที่รอแผนกนั้นอยู่ก่อน</p>
    </Card>
  );
}

function Info({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-2xl bg-subtle px-4 py-3">
      <dt className="text-xs text-ink-3">{label}</dt>
      <dd className="mt-0.5 truncate font-medium">{value}</dd>
      {sub && <dd className="truncate text-xs text-ink-3">{sub}</dd>}
    </div>
  );
}

function ScreeningResult({ q }: { q: Queue }) {
  const { state } = useMock();
  const { dept, code } = useLookups();
  const s = state.screenings.find((x) => x.id === q.screeningId)!;
  const entries = Object.entries(s.departmentScores).sort((a, b) => b[1] - a[1]);
  const max = Math.max(...entries.map((e) => e[1]), 1);
  const algoDept = s.assignedDepartment;
  const changedDept = algoDept !== q.departmentId;
  const changedLevel = s.priorityLevel !== q.priorityLevel;

  return (
    <>
      <div className="flex flex-wrap items-center gap-3 rounded-2xl bg-subtle px-4 py-3">
        <span className="text-sm text-ink-3">ระบบแนะนำ</span>
        <span className="text-lg font-semibold">{dept.get(algoDept ?? "")?.name ?? "-"}</span>
        <LevelChip level={s.priorityLevel} />
      </div>
      {(changedDept || changedLevel) && (
        <div className="mt-2">
          <Notice tone="accent">
            เจ้าหน้าที่ปรับเป็น {changedDept && <b>{dept.get(q.departmentId)?.name}</b>}
            {changedDept && changedLevel && " · "}
            {changedLevel && <b>ระดับ{LEVEL[q.priorityLevel].name}</b>}
          </Notice>
        </div>
      )}
      {entries.length === 0 ? (
        <p className="mt-4 text-sm text-ink-2">ไม่มีแผนกใดได้คะแนนจากรหัสอาการ ระบบจึงจัดเข้าแผนกเวชปฏิบัติทั่วไป</p>
      ) : (
        <div className="mt-5 flex flex-col gap-3">
          <div className="text-xs text-ink-3">คะแนนรายแผนก (S<sub>d</sub>)</div>
          {entries.map(([d, v]) => (
            <div key={d} className="grid grid-cols-[7rem_minmax(0,1fr)_2rem] items-center gap-3 text-sm">
              <span className="truncate text-ink-2">{dept.get(d)?.name ?? d}</span>
              <div className="h-2.5 rounded-full bg-subtle">
                <div className={`h-2.5 rounded-full ${d === algoDept ? "bg-ink" : "bg-ink-3/40"}`} style={{ width: `${(v / max) * 100}%` }} />
              </div>
              <span className="text-right font-medium tabular-nums">{v}</span>
            </div>
          ))}
        </div>
      )}
      {s.reason.length > 0 && (
        <>
          <div className="mt-6 text-xs text-ink-3">เหตุผล · รหัสอาการที่ให้คะแนนแผนก{dept.get(algoDept ?? "")?.name}</div>
          <ul className="mt-2 flex flex-col">
            {s.reason.map((r) => (
              <li key={r.code} className="flex items-center gap-3 border-t border-line/70 py-2.5 text-sm first:border-0">
                <span className="flex-1">{code.get(r.code)?.label ?? r.code}</span>
                <code className="text-xs text-ink-3">{r.code}</code>
                <span className="w-10 text-right font-medium tabular-nums">+{r.weight}</span>
              </li>
            ))}
          </ul>
        </>
      )}
    </>
  );
}

function EditCard({ q }: { q: Queue }) {
  const { state, now, update } = useMock();
  const { dept: deptMap } = useLookups();
  const [dept, setDept] = useState(q.departmentId);
  const [level, setLevel] = useState<Level>(q.priorityLevel);
  const [saved, setSaved] = useState<string | null>(null);
  const editable = q.status === "WAITING" || q.status === "CALLED";
  const noDoctor = dept !== q.departmentId && doctorsOnShift(state, now, dept).length === 0;
  const next = noDoctor ? nextShiftStart(state, dept, now) : null;
  const changed = dept !== q.departmentId || level !== q.priorityLevel;

  function save() {
    if (noDoctor && !window.confirm(`แผนก${deptMap.get(dept)?.name}ไม่มีแพทย์ในเวรขณะนี้ ผู้ป่วยจะยังไม่มีแพทย์รับผิดชอบ ยืนยันหรือไม่?`)) return;
    update((s, n) => editScreening(s, n, { queueId: q.id, departmentId: dept, priorityLevel: level, userId: s.sessionUserId! }));
    setSaved("บันทึกแล้ว ระบบจัดลำดับคิวใหม่และแจ้งผู้ป่วยผ่าน LINE");
  }

  return (
    <Card title="แก้ไขผลการคัดกรอง" icon={FilePenLine} note="UC08">
      {!editable && <div className="mb-4"><Notice>คิวนี้{q.status === "IN_PROGRESS" ? "อยู่ระหว่างตรวจ" : "สิ้นสุดแล้ว"} แก้ไขผลคัดกรองไม่ได้</Notice></div>}
      <Field label="แผนก">
        <select disabled={!editable} value={dept} onChange={(e) => setDept(e.target.value)} className="input">
          {state.departments.filter((d) => d.isActive).map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
        </select>
      </Field>
      {noDoctor && (
        <div className="mt-2">
          <Notice tone="amber">แผนกนี้ไม่มีแพทย์ในเวรขณะนี้{next ? ` (เวรถัดไป ${fmtShortDate(next)} ${fmtTime(next)} น.)` : ""}</Notice>
        </div>
      )}
      <div className="mb-1.5 mt-4 text-xs font-medium text-ink-2">ระดับความเร่งด่วน</div>
      <div className="grid grid-cols-4 gap-1.5">
        {([2, 3, 4, 5] as Level[]).map((l) => (
          <button
            key={l}
            disabled={!editable}
            onClick={() => setLevel(l)}
            className={`flex items-center justify-center gap-1.5 rounded-full py-2 text-sm transition disabled:opacity-50 ${level === l ? "bg-ink text-white" : "bg-subtle text-ink-2 hover:text-ink"}`}
          >
            <LevelDot level={l} className="h-2 w-2" />
            {LEVEL[l].name}
          </button>
        ))}
      </div>
      <button disabled={!editable || !changed} onClick={save} className={`${btn.primary} mt-5 w-full`}>บันทึกการแก้ไข</button>
      {saved && <p className="mt-2 text-xs text-ink-2">{saved}</p>}
      <p className="mt-3 text-xs text-ink-3">ระดับแดงไม่ออกคิว ระบบส่งต่อจุดบริการฉุกเฉินตั้งแต่ขั้นคัดกรอง</p>
    </Card>
  );
}

function ResultCard({ q }: { q: Queue }) {
  const { state, update } = useMock();
  const { isDoctor } = useMe();
  const rx = state.prescriptions.find((r) => r.queueId === q.id);
  const delivery = rx && state.deliveries.find((d) => d.prescriptionId === rx.id);
  const refill = rx && state.refills.find((r) => r.prescriptionId === rx.id);

  if (q.status === "DONE") {
    return (
      <Card title="ผลการตรวจ" icon={Pill} note="UC09">
        <Notice tone="accent">บันทึกผลการตรวจแล้ว{q.finishedTime ? ` เมื่อ ${fmtTime(q.finishedTime)} น.` : ""}</Notice>
        {!rx && <p className="mt-3 text-sm text-ink-3">ไม่มีการสั่งจ่ายยา</p>}
        {rx && (
          <>
            <ul className="mt-4 flex flex-col gap-2">
              {rx.items.map((i) => (
                <li key={i.name} className="rounded-2xl bg-subtle px-4 py-2.5 text-sm">
                  <div className="font-medium">{i.name}</div>
                  {(i.dosage || i.quantity) && <div className="text-xs text-ink-3">{[i.dosage, i.quantity].filter(Boolean).join(" · ")}</div>}
                </li>
              ))}
            </ul>
            <p className="mt-2 text-xs text-ink-3">จ่ายยาสำหรับ {rx.daysSupply} วัน{refill ? ` · เตือนรับยารอบถัดไป ${refill.dueDate}` : ""}</p>
            <div className="mt-4 border-t border-line/70 pt-4 text-sm">
              {!delivery && <span className="text-ink-3">รอผู้ป่วยเลือกวิธีรับยาผ่าน LINE (UC06)</span>}
              {delivery && isDoctor && (
                <div className="text-ink-2">
                  {delivery.method === "SHIP" ? "จัดส่งถึงบ้าน" : "รับที่ห้องยาโรงพยาบาล"} · {DELIVERY_LABEL[delivery.status]}
                </div>
              )}
              {delivery && !isDoctor && (
                <div className="flex flex-col gap-3">
                  <div className="text-ink-2">{delivery.method === "SHIP" ? `จัดส่งถึงบ้าน · ${delivery.address}` : "รับที่ห้องยาโรงพยาบาล"}</div>
                  <Field label="สถานะการส่งมอบยา">
                    <select value={delivery.status} onChange={(e) => update((s, n) => updateDeliveryStatus(s, n, delivery.id, e.target.value as DeliveryStatus))} className="input">
                      {(Object.keys(DELIVERY_LABEL) as DeliveryStatus[])
                        .filter((k) => (delivery.method === "SHIP" ? k !== "READY" : k !== "SHIPPED"))
                        .map((k) => <option key={k} value={k}>{DELIVERY_LABEL[k]}</option>)}
                    </select>
                  </Field>
                </div>
              )}
            </div>
          </>
        )}
      </Card>
    );
  }

  if (q.status === "CALLED" && isDoctor) {
    return (
      <Card title="บันทึกผลการตรวจ" icon={Pill} note="UC09">
        <p className="mb-4 text-sm text-ink-3">
          {q.visitType === "ONLINE"
            ? "ระบบส่งลิงก์ห้องตรวจออนไลน์ให้ผู้ป่วยแล้ว เริ่มวิดีโอคอลเพื่อตรวจ แล้วจึงบันทึกผลได้"
            : "ระบบเรียกผู้ป่วยแล้ว กดปุ่มด้านล่างเมื่อผู้ป่วยเข้าห้องตรวจ แล้วจึงบันทึกผลได้"}
        </p>
        <CalledActions q={q} />
      </Card>
    );
  }

  if (q.status !== "IN_PROGRESS" || !isDoctor) {
    return (
      <Card title="บันทึกผลการตรวจ" icon={Pill} note="UC09 · แพทย์">
        <p className="text-sm text-ink-3">
          {q.status === "WAITING" && "ยังไม่ถึงคิว ระบบจะเรียกผู้ป่วยเองเมื่อแพทย์ว่าง"}
          {q.status === "CALLED" && (q.visitType === "ONLINE" ? "ระบบส่งลิงก์ห้องตรวจออนไลน์ให้ผู้ป่วยแล้ว รอแพทย์เริ่มวิดีโอคอล" : "ระบบเรียกผู้ป่วยแล้ว กด “ผู้ป่วยเข้าห้องตรวจ” ที่หน้าจัดการคิวเมื่อผู้ป่วยมาถึง")}
          {q.status === "IN_PROGRESS" && "อยู่ระหว่างตรวจ แพทย์เป็นผู้บันทึกผลการตรวจและรายการยา"}
          {(q.status === "NO_SHOW" || q.status === "CANCELLED") && "คิวนี้สิ้นสุดแล้วโดยไม่ได้ตรวจ"}
        </p>
      </Card>
    );
  }

  return <PrescriptionForm q={q} />;
}
