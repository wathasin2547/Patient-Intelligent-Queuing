"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useState } from "react";
import { departments, queues, score, type Level } from "../../../_data";
import { LEVEL, LevelChip, StatusChip } from "../../../_ui";

type Med = { name: string; dosage: string; quantity: string };

export default function QueueDetail() {
  const { id } = useParams<{ id: string }>();
  const q = queues.find((x) => x.id === id) ?? queues[0];

  const [dept, setDept] = useState(q.department);
  const [level, setLevel] = useState<Level>(q.level);
  const [saved, setSaved] = useState<string | null>(null);
  const [meds, setMeds] = useState<Med[]>([{ name: "", dosage: "", quantity: "" }]);
  const [days, setDays] = useState("7");
  const [done, setDone] = useState<string | null>(null);

  const maxScore = Math.max(...Object.values(q.departmentScores), 1);
  const algoDept = q.originalDepartment ?? q.department;
  const nextInLine = queues
    .filter((x) => x.doctor === q.doctor && x.status === "WAITING" && x.id !== q.id)
    .sort((a, b) => score(b) - score(a))[0];

  return (
    <div className="mx-auto max-w-6xl px-6 py-6">
      <Link href="/mockup/staff" className="text-sm text-teal-700 hover:underline">← กลับไปหน้าติดตามคิว</Link>

      <div className="mt-3 flex flex-wrap items-center gap-3">
        <h1 className="font-mono text-3xl font-semibold">{q.queueNumber}</h1>
        <LevelChip level={q.level} />
        <StatusChip status={q.status} />
        {q.visitType === "ONLINE" && <span className="rounded bg-sky-50 px-2 py-0.5 text-xs text-sky-700 ring-1 ring-sky-200">ตรวจออนไลน์</span>}
      </div>
      <p className="mt-1 text-sm text-zinc-500">
        {q.patientName} · {q.ageGroup} · {q.department} · {q.doctor} · รอมาแล้ว {q.waitingMinutes} นาที
      </p>

      <div className="mt-6 grid gap-5 lg:grid-cols-5">
        {/* ── left: screening result (UC08) ── */}
        <div className="flex flex-col gap-5 lg:col-span-3">
          <Card title="สิ่งที่ผู้ป่วยแจ้ง">
            <div className="flex flex-wrap gap-1.5">
              {q.closedAnswers.map((a) => (
                <span key={a} className="rounded-md bg-zinc-100 px-2 py-1 text-sm text-zinc-700">{a}</span>
              ))}
            </div>
            <div className="mt-3 rounded-lg bg-zinc-50 px-3 py-2 text-sm">
              <div className="text-xs text-zinc-500">ข้อความที่ผู้ป่วยพิมพ์</div>
              <div className="mt-0.5">{q.freeText || <span className="text-zinc-400">— ไม่ได้พิมพ์ —</span>}</div>
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-2 text-sm">
              <span className="text-xs text-zinc-500">รหัสอาการที่ได้จาก LLM:</span>
              {q.llmStatus === "ok" && q.llmCodes.map((c) => <code key={c} className="rounded bg-violet-50 px-1.5 text-xs text-violet-700">{c}</code>)}
              {q.llmStatus === "skipped" && <span className="text-xs text-zinc-400">ไม่ได้เรียก (ไม่มีข้อความ)</span>}
              {q.llmStatus === "failed" && (
                <span className="rounded bg-amber-50 px-2 py-0.5 text-xs text-amber-800 ring-1 ring-amber-200">
                  เรียก LLM ไม่สำเร็จ — ใช้เฉพาะคำตอบปลายปิด ควรอ่านข้อความด้านบนประกอบ
                </span>
              )}
            </div>
          </Card>

          <Card title="ผลการคัดกรองของระบบ" note="ระบบแนะนำแผนก ไม่ได้วินิจฉัยโรค">
            <div className="text-sm">
              ระบบแนะนำ <b>{algoDept}</b>
              {q.edited && q.originalDepartment && (
                <span className="ml-2 rounded bg-violet-50 px-1.5 text-xs text-violet-700 ring-1 ring-violet-200">
                  เจ้าหน้าที่ย้ายไป {q.department} แล้ว
                </span>
              )}
            </div>
            <div className="mt-3 flex flex-col gap-2">
              {Object.entries(q.departmentScores).sort((a, b) => b[1] - a[1]).map(([d, s]) => (
                <div key={d} className="flex items-center gap-3 text-sm">
                  <span className="w-28 shrink-0 text-zinc-600">{d}</span>
                  <div className="h-2.5 flex-1 rounded-full bg-zinc-100">
                    <div className={`h-2.5 rounded-full ${d === algoDept ? "bg-teal-600" : "bg-zinc-300"}`} style={{ width: `${(s / maxScore) * 100}%` }} />
                  </div>
                  <span className="w-6 text-right tabular-nums">{s}</span>
                </div>
              ))}
            </div>
            <div className="mt-4 text-xs font-medium text-zinc-500">เหตุผล — รหัสอาการที่ให้คะแนนแผนก {algoDept}</div>
            <table className="mt-1.5 w-full text-sm">
              <tbody>
                {q.reason.map((r) => (
                  <tr key={r.code} className="border-t border-zinc-100">
                    <td className="py-1.5"><code className="text-xs text-zinc-500">{r.code}</code></td>
                    <td className="py-1.5">{r.label}</td>
                    <td className="py-1.5 text-right tabular-nums">+{r.weight}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        </div>

        {/* ── right: edit (UC08) + record result (UC09) ── */}
        <div className="flex flex-col gap-5 lg:col-span-2">
          <Card title="แก้ไขผลการคัดกรอง">
            <label className="block text-xs text-zinc-500">แผนก</label>
            <select value={dept} onChange={(e) => setDept(e.target.value)} className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm">
              {departments.map((d) => <option key={d}>{d}</option>)}
            </select>
            <label className="mt-3 block text-xs text-zinc-500">ระดับความเร่งด่วน</label>
            <div className="mt-1 grid grid-cols-4 gap-1.5">
              {([2, 3, 4, 5] as Level[]).map((l) => (
                <button
                  key={l}
                  onClick={() => setLevel(l)}
                  className={`rounded-lg py-1.5 text-sm ${level === l ? LEVEL[l].chip + " ring-2 ring-offset-1 ring-zinc-400" : "bg-zinc-100 text-zinc-600"}`}
                >
                  {LEVEL[l].name}
                </button>
              ))}
            </div>
            <button
              disabled={dept === q.department && level === q.level}
              onClick={() => setSaved(`บันทึกแล้ว: ${dept} · ระดับ ${level} — ระบบจัดลำดับคิวใหม่และแจ้งผู้ป่วยผ่าน LINE`)}
              className="mt-4 w-full rounded-lg bg-teal-600 py-2 text-sm font-medium text-white hover:bg-teal-700 disabled:bg-zinc-200 disabled:text-zinc-400"
            >
              บันทึกการแก้ไข
            </button>
            {saved && <p className="mt-2 text-xs text-teal-700">{saved}</p>}
            <p className="mt-2 text-xs text-zinc-400">ผลเดิมของระบบยังเก็บไว้ ใช้นับว่าอัลกอริทึมถูกแก้กี่ครั้ง</p>
          </Card>

          <Card title="บันทึกผลการตรวจ">
            <div className="text-xs text-zinc-500">รายการยาที่สั่งจ่าย</div>
            {meds.map((m, i) => (
              <div key={i} className="mt-1.5 grid grid-cols-6 gap-1.5">
                <input placeholder="ชื่อยา" value={m.name} onChange={(e) => setMeds(meds.map((x, j) => j === i ? { ...x, name: e.target.value } : x))} className="col-span-3 rounded-lg border border-zinc-300 px-2 py-1.5 text-sm" />
                <input placeholder="ขนาด" value={m.dosage} onChange={(e) => setMeds(meds.map((x, j) => j === i ? { ...x, dosage: e.target.value } : x))} className="col-span-2 rounded-lg border border-zinc-300 px-2 py-1.5 text-sm" />
                <input placeholder="จำนวน" value={m.quantity} onChange={(e) => setMeds(meds.map((x, j) => j === i ? { ...x, quantity: e.target.value } : x))} className="rounded-lg border border-zinc-300 px-2 py-1.5 text-sm" />
              </div>
            ))}
            <button onClick={() => setMeds([...meds, { name: "", dosage: "", quantity: "" }])} className="mt-1.5 text-xs text-teal-700 hover:underline">
              + เพิ่มรายการยา
            </button>
            <div className="mt-3 flex items-center gap-2 text-sm">
              <span className="text-xs text-zinc-500">จ่ายยาสำหรับ</span>
              <input value={days} onChange={(e) => setDays(e.target.value)} className="w-16 rounded-lg border border-zinc-300 px-2 py-1 text-sm" />
              <span className="text-xs text-zinc-500">วัน</span>
            </div>
            <div className="mt-4 grid grid-cols-2 gap-2">
              <button
                onClick={() => setDone(`บันทึกตรวจเสร็จ · ระบบเรียก ${nextInLine?.queueNumber ?? "—"} เข้าตรวจอัตโนมัติแล้ว`)}
                className="rounded-lg bg-emerald-600 py-2 text-sm font-medium text-white hover:bg-emerald-700"
              >
                ตรวจเสร็จ
              </button>
              <button
                onClick={() => setDone(`บันทึกว่าไม่มา · ระบบเรียก ${nextInLine?.queueNumber ?? "—"} เข้าตรวจอัตโนมัติแล้ว`)}
                className="rounded-lg bg-white py-2 text-sm font-medium text-rose-700 ring-1 ring-rose-300 hover:bg-rose-50"
              >
                ผู้ป่วยไม่มา
              </button>
            </div>
            {done ? (
              <div className="mt-3 rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-800 ring-1 ring-emerald-200">{done}</div>
            ) : (
              <p className="mt-2 text-xs text-zinc-400">
                คิวถัดไปของแพทย์ท่านนี้: {nextInLine ? `${nextInLine.queueNumber} (P = ${score(nextInLine)})` : "ไม่มี"}
              </p>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}

function Card({ title, note, children }: { title: string; note?: string; children: React.ReactNode }) {
  return (
    <section className="rounded-xl bg-white p-5 ring-1 ring-zinc-200">
      <div className="mb-3 flex items-baseline justify-between gap-2">
        <h2 className="font-semibold">{title}</h2>
        {note && <span className="text-xs text-zinc-400">{note}</span>}
      </div>
      {children}
    </section>
  );
}
