"use client";

// UC09 exam result form for the doctor. Built to avoid typing: repeat the last
// prescription, pick from frequent drugs, or search the formulary; directions and
// quantity fill in by themselves and the quantity follows the number of days.

import { History, Pill, Plus, Search, X } from "lucide-react";
import { useState } from "react";
import { btn, Card } from "@/components/ui";
import { recordResult } from "@/lib/mock/actions";
import { DAY_PRESETS, type Drug, findDrug, FORMULARY, quantityFor, searchDrugs, SIG_PRESETS } from "@/lib/mock/formulary";
import { useLookups, useMock } from "@/lib/mock/store";
import { fmtShortDate } from "@/lib/mock/time";
import type { Queue } from "@/lib/mock/types";

/** auto = quantity still follows the days; it stops once the doctor edits it by hand */
type Line = { name: string; dosage: string; quantity: string; drug: Drug | null; auto: boolean };

const toLine = (drug: Drug, days: number): Line => ({ name: drug.name, dosage: drug.dosage, quantity: quantityFor(drug, days), drug, auto: true });

export function PrescriptionForm({ q }: { q: Queue }) {
  const { state, update } = useMock();
  const { dept } = useLookups();
  const [lines, setLines] = useState<Line[]>([]);
  const [days, setDays] = useState(7);
  const [query, setQuery] = useState("");

  const added = new Set(lines.map((l) => l.name));
  const matches = searchDrugs(query, added);

  // the patient's most recent prescription from another visit (chronic follow-ups repeat it)
  const myQueueIds = new Set(state.queues.filter((x) => x.patientId === q.patientId && x.id !== q.id).map((x) => x.id));
  const lastRx = state.prescriptions.filter((r) => myQueueIds.has(r.queueId)).sort((a, b) => b.issuedAt.localeCompare(a.issuedAt))[0];

  // what this doctor prescribes most, then drugs tagged for the department
  const doctorQueueIds = new Set(state.queues.filter((x) => x.doctorId === q.doctorId).map((x) => x.id));
  const counts = new Map<string, number>();
  for (const r of state.prescriptions) if (doctorQueueIds.has(r.queueId)) for (const i of r.items) counts.set(i.name, (counts.get(i.name) ?? 0) + 1);
  const deptCode = dept.get(q.departmentId)?.code ?? "GEN";
  const frequent = [
    ...[...counts.entries()].sort((a, b) => b[1] - a[1]).map(([name]) => findDrug(name)).filter((d): d is Drug => Boolean(d)),
    ...FORMULARY.filter((d) => d.depts.includes(deptCode)),
  ].filter((d, i, all) => all.indexOf(d) === i && !added.has(d.name)).slice(0, 8);

  function add(line: Line) {
    setLines((all) => (all.some((l) => l.name === line.name) ? all : [...all, line]));
    setQuery("");
  }
  function addFromSearch() {
    if (matches[0]) return add(toLine(matches[0], days));
    const name = query.trim();
    if (name) add({ name, dosage: "", quantity: "", drug: null, auto: false });
  }
  function setLine(i: number, patch: Partial<Line>) {
    setLines((all) => all.map((l, j) => (j === i ? { ...l, ...patch } : l)));
  }
  function changeDays(d: number) {
    setDays(d);
    setLines((all) => all.map((l) => (l.auto && l.drug ? { ...l, quantity: quantityFor(l.drug, d) } : l)));
  }
  function repeatLast() {
    if (!lastRx) return;
    setDays(lastRx.daysSupply);
    // keep last time's directions; quantities of known drugs keep following the days
    setLines(lastRx.items.map((i) => {
      const drug = findDrug(i.name) ?? null;
      return { ...i, drug, auto: drug !== null };
    }));
  }
  function save() {
    update((s, n) => recordResult(s, n, { queueId: q.id, items: lines.map(({ name, dosage, quantity }) => ({ name, dosage, quantity })), daysSupply: lines.length ? days : 0 }));
  }

  return (
    <Card title="บันทึกผลการตรวจ" icon={Pill} note="UC09">
      {lastRx && (
        <div className="mb-4 rounded-2xl bg-subtle p-3">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs text-ink-3">ยาครั้งล่าสุด · {fmtShortDate(lastRx.issuedAt)} · {lastRx.daysSupply} วัน</span>
            <button onClick={repeatLast} className={`${btn.small} bg-ink text-white hover:bg-black`}>
              <History size={13} strokeWidth={1.8} /> ใช้ยาชุดเดิม
            </button>
          </div>
          <div className="mt-1.5 text-sm">{lastRx.items.map((i) => i.name).join(", ")}</div>
        </div>
      )}

      <div className="relative">
        <Search size={16} strokeWidth={1.8} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-ink-3" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addFromSearch())}
          placeholder="ค้นหายา เช่น พารา, ความดัน, amox"
          className="input pl-10"
        />
        {query.trim() && (
          <ul className="absolute inset-x-0 top-full z-10 mt-1.5 overflow-hidden rounded-2xl bg-surface py-1 shadow-[0_12px_32px_-12px_rgba(21,22,19,0.35)] ring-1 ring-line">
            {matches.map((d) => (
              <li key={d.name}>
                <button onClick={() => add(toLine(d, days))} className="flex w-full flex-col px-4 py-2 text-left hover:bg-subtle">
                  <span className="text-sm font-medium">{d.name}</span>
                  <span className="text-xs text-ink-3">{d.dosage}</span>
                </button>
              </li>
            ))}
            <li>
              <button onClick={addFromSearch} className="w-full px-4 py-2 text-left text-xs text-ink-2 hover:bg-subtle">
                {matches.length ? "Enter เพื่อเพิ่มรายการแรก" : <>เพิ่ม “{query.trim()}” เป็นยานอกรายการ</>}
              </button>
            </li>
          </ul>
        )}
      </div>

      {frequent.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {frequent.map((d) => (
            <button key={d.name} onClick={() => add(toLine(d, days))} className="inline-flex items-center gap-1 rounded-full bg-subtle px-3 py-1.5 text-xs text-ink-2 transition hover:bg-ink hover:text-white">
              <Plus size={12} strokeWidth={2} /> {d.name}
            </button>
          ))}
        </div>
      )}

      <datalist id="sig-presets">{SIG_PRESETS.map((s) => <option key={s} value={s} />)}</datalist>
      <ul className="mt-4 flex flex-col gap-2">
        {lines.map((l, i) => (
          <li key={l.name} className="rounded-2xl bg-subtle p-2.5">
            <div className="flex items-center gap-2 px-1.5">
              <span className="flex-1 truncate text-sm font-medium">{l.name}</span>
              {!l.drug && <span className="text-[11px] text-ink-3">นอกรายการ</span>}
              <button onClick={() => setLines((all) => all.filter((_, j) => j !== i))} title="ลบรายการ" className="flex h-7 w-7 items-center justify-center rounded-full text-ink-3 hover:bg-surface hover:text-ink">
                <X size={14} strokeWidth={2} />
              </button>
            </div>
            <div className="mt-1.5 grid grid-cols-[minmax(0,1fr)_6.5rem] gap-1.5">
              <input list="sig-presets" placeholder="วิธีใช้" value={l.dosage} onChange={(e) => setLine(i, { dosage: e.target.value })} className="input bg-surface py-2 text-sm" />
              <input placeholder="จำนวน" value={l.quantity} onChange={(e) => setLine(i, { quantity: e.target.value, auto: false })} className="input bg-surface py-2 text-center text-sm" />
            </div>
          </li>
        ))}
      </ul>
      {lines.length === 0 && <p className="mt-3 text-center text-xs text-ink-3">ยังไม่ได้เลือกยา · ถ้าไม่สั่งยา กดบันทึกได้เลย</p>}

      {lines.length > 0 && (
        <div className="mt-4">
          <div className="mb-1.5 text-xs font-medium text-ink-2">จ่ายยาสำหรับ</div>
          <div className="flex flex-wrap items-center gap-1.5">
            {DAY_PRESETS.map((d) => (
              <button key={d} onClick={() => changeDays(d)} className={`rounded-full px-3.5 py-1.5 text-sm transition ${days === d ? "bg-ink text-white" : "bg-subtle text-ink-2 hover:text-ink"}`}>
                {d}
              </button>
            ))}
            <input
              inputMode="numeric"
              value={days}
              onChange={(e) => changeDays(Number(e.target.value.replace(/\D/g, "")) || 0)}
              className="input w-14 py-1.5 text-center text-sm"
              aria-label="จำนวนวัน"
            />
            <span className="text-xs text-ink-3">วัน</span>
          </div>
          <p className="mt-1.5 text-xs text-ink-3">จำนวนยาปรับตามจำนวนวันให้เอง ยกเว้นรายการที่แก้จำนวนเอง</p>
        </div>
      )}

      <button onClick={save} className={`${lines.length ? btn.accent : btn.primary} mt-5 w-full`}>
        {lines.length ? `บันทึกผลและสั่งยา ${lines.length} รายการ` : "บันทึกผล · ไม่สั่งยา"}
      </button>
      <p className="mt-3 text-xs text-ink-3">ถ้ามีการสั่งยา ระบบส่งข้อความให้ผู้ป่วยเลือกวิธีรับยา และสร้างรอบเตือนรับยาให้ผู้ป่วยโรคเรื้อรัง</p>
    </Card>
  );
}
