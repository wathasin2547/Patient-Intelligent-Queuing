"use client";

// UC12 master data (ADMIN only). Screening criteria live here, never in code:
// weights, red flags, onsite-only codes and the question set are all editable.
// Records that may already be referenced are deactivated, not deleted.

import { Building2, HeartPulse, KeyRound, Layers, ListChecks, Plus, Stethoscope, Tags, X } from "lucide-react";
import { useState } from "react";
import { Avatar, btn, Card, doctorInitials, Field, Notice, PageHeader, PillSelect, Segmented, Tag } from "@/components/ui";
import { ROLE_LABEL, saveDepartment, saveDoctor, saveQuestion, saveSymptomCode, saveUser } from "@/lib/mock/actions";
import { maxSafeBonusMinutes, newId } from "@/lib/mock/logic";
import { useLookups, useMock } from "@/lib/mock/store";
import type { Level, Question, Role, SymptomCode } from "@/lib/mock/types";

type Tab = "departments" | "doctors" | "codes" | "questions" | "users";

export default function MasterPage() {
  const { state } = useMock();
  const [tab, setTab] = useState<Tab>("codes");
  const me = state.users.find((u) => u.id === state.sessionUserId);
  if (me?.role !== "ADMIN") {
    return <div className="mx-auto max-w-3xl"><Notice tone="amber">หน้านี้สำหรับผู้ดูแลระบบเท่านั้น</Notice></div>;
  }
  return (
    <div className="mx-auto max-w-[1400px]">
      <PageHeader title="ข้อมูลพื้นฐาน" subtitle="เกณฑ์ที่แก้ที่นี่มีผลกับการคัดกรองครั้งถัดไปโดยไม่ต้องแก้โค้ด" />
      <div className="mb-5">
        <Segmented<Tab>
          value={tab}
          onChange={setTab}
          options={[
            { value: "codes", label: "รหัสอาการ" },
            { value: "questions", label: "คำถามซักประวัติ" },
            { value: "departments", label: "แผนก" },
            { value: "doctors", label: "แพทย์" },
            { value: "users", label: "บัญชีผู้ใช้" },
          ]}
        />
      </div>
      {tab === "departments" && <Departments />}
      {tab === "doctors" && <Doctors />}
      {tab === "codes" && <Codes />}
      {tab === "questions" && <Questions />}
      {tab === "users" && <Users />}
    </div>
  );
}

const LAYOUT = "grid gap-5 xl:grid-cols-[minmax(0,1fr)_380px]";
const TH = "pb-3 text-left text-xs font-normal text-ink-3";
const TR = "border-t border-subtle";

function ActiveToggle({ active, onChange }: { active: boolean; onChange: (v: boolean) => void }) {
  return (
    <button onClick={() => onChange(!active)} className="inline-flex items-center gap-2 text-xs text-ink-2" title={active ? "ปิดใช้งาน" : "เปิดใช้งาน"}>
      <span className={`relative h-5 w-9 rounded-full transition ${active ? "bg-ink" : "bg-line"}`}>
        <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-surface shadow transition-all ${active ? "left-[18px]" : "left-0.5"}`} />
      </span>
      {active ? "ใช้งาน" : "ปิด"}
    </button>
  );
}

function Check({ checked, onChange, children }: { checked: boolean; onChange: (v: boolean) => void; children: React.ReactNode }) {
  return (
    <label className="flex cursor-pointer items-start gap-2.5 rounded-2xl bg-subtle px-4 py-3 text-sm">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="mt-0.5 h-4 w-4 accent-[#151613]" />
      <span>{children}</span>
    </label>
  );
}

// ── departments ──

function Departments() {
  const { state, update } = useMock();
  const [form, setForm] = useState({ code: "", name: "", scopeOfCare: "" });
  const [err, setErr] = useState<string | null>(null);

  function add() {
    const code = form.code.trim().toUpperCase();
    if (!/^[A-Z]{2,5}$/.test(code) || !form.name.trim()) return setErr("รหัสแผนกต้องเป็นตัวอักษรภาษาอังกฤษ 2–5 ตัว และต้องมีชื่อแผนก");
    if (state.departments.some((d) => d.code === code || d.name === form.name.trim())) return setErr("รหัสหรือชื่อแผนกซ้ำกับที่มีอยู่");
    update((s) => saveDepartment(s, { id: `dept_${code}`, code, name: form.name.trim(), scopeOfCare: form.scopeOfCare.trim(), defaultServiceMinutes: 10, isActive: true }));
    setForm({ code: "", name: "", scopeOfCare: "" });
    setErr(null);
  }

  return (
    <div className={LAYOUT}>
      <Card title="แผนก" icon={Building2} note="แผนกเวชปฏิบัติทั่วไปรับผู้ป่วยที่ไม่มีแผนกใดได้คะแนน ควรเปิดใช้งานไว้เสมอ">
        <div className="-mx-5 overflow-x-auto px-5 sm:-mx-6 sm:px-6">
          <table className="w-full min-w-[560px] text-sm">
            <thead><tr><th className={TH}>รหัส</th><th className={TH}>ชื่อ</th><th className={TH}>ขอบเขตการรักษา</th><th className={TH} title="ใช้ประมาณเวลาที่จะถึงคิวจนกว่าแพทย์จะตรวจเสร็จวันนี้ครบ 3 ราย">นาที/ราย</th><th className={`${TH} text-right`}>สถานะ</th></tr></thead>
            <tbody>
              {state.departments.map((d) => (
                <tr key={d.id} className={TR}>
                  <td className="py-3"><span className="rounded-full bg-subtle px-2.5 py-1 font-mono text-xs">{d.code}</span></td>
                  <td className="py-3 font-medium">{d.name}</td>
                  <td className="py-3 pr-4 text-ink-2">{d.scopeOfCare}</td>
                  <td className="py-3 pr-4">
                    <input inputMode="numeric" value={d.defaultServiceMinutes} onChange={(e) => update((s) => saveDepartment(s, { ...d, defaultServiceMinutes: Number(e.target.value.replace(/\D/g, "")) || 1 }))} className="input w-16 py-1.5 text-center text-sm" />
                  </td>
                  <td className="py-3 text-right"><ActiveToggle active={d.isActive} onChange={(v) => update((s) => saveDepartment(s, { ...d, isActive: v }))} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
      <Card title="เพิ่มแผนก" icon={Plus}>
        <div className="flex flex-col gap-3">
          <Field label="รหัส (ใช้เป็นตัวนำหน้าเลขคิว)"><input value={form.code} onChange={(e) => setForm((f) => ({ ...f, code: e.target.value }))} className="input" placeholder="เช่น OBG" /></Field>
          <Field label="ชื่อแผนก"><input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} className="input" /></Field>
          <Field label="ขอบเขตการรักษา"><textarea value={form.scopeOfCare} onChange={(e) => setForm((f) => ({ ...f, scopeOfCare: e.target.value }))} className="input" rows={2} /></Field>
          <button onClick={add} className={`${btn.primary} mt-1`}>เพิ่มแผนก</button>
          {err && <Notice tone="rose">{err}</Notice>}
        </div>
      </Card>
      <Card title="คิวหลายแผนก" icon={Layers} className="xl:col-start-2">
        <Field label="ผู้ป่วย 1 คนถือคิวพร้อมกันได้สูงสุด (แผนกละ 1 คิว)">
          <select value={state.settings.maxActiveQueues} onChange={(e) => update((s) => ({ ...s, settings: { ...s.settings, maxActiveQueues: Number(e.target.value) } }))} className="input">
            {[1, 2, 3, 4].map((n) => <option key={n} value={n}>{n} คิว</option>)}
          </select>
        </Field>
        <p className="mt-3 text-xs text-ink-3">ระบบเรียกผู้ป่วยได้ทีละคิว ถ้ากำลังตรวจอยู่อีกแผนก ระบบเก็บลำดับไว้และเรียกคนถัดไปแทน</p>
      </Card>
      <RiskSettings />
    </div>
  );
}

// ── queue risk factors (D in P = B + α(W + D)) ──

const AGE_GROUPS = ["0-5", "6-17", "18-59", "60+"];
const BONUS_CHOICES = [0, 5, 10, 15, 20, 25, 30, 40];

function RiskSettings() {
  const { state, update } = useMock();
  const st = state.settings;
  const limit = maxSafeBonusMinutes();
  // a choice is offered only if age + chronic stays below the narrowest level gap
  const allowed = (n: number, other: number) => n + other < limit;
  const set = (patch: Partial<typeof st>) => update((s) => ({ ...s, settings: { ...s.settings, ...patch } }));
  const toggleAge = (g: string) =>
    set({ priorityAgeGroups: st.priorityAgeGroups.includes(g) ? st.priorityAgeGroups.filter((x) => x !== g) : [...st.priorityAgeGroups, g] });
  return (
    <Card title="ปัจจัยเสี่ยงในการจัดคิว" icon={HeartPulse} className="xl:col-start-2">
      <div className="flex flex-col gap-3">
        <Field label="ช่วงอายุที่ได้คิวก่อน">
          <div className="flex flex-wrap gap-3 text-sm">
            {AGE_GROUPS.map((g) => (
              <label key={g} className="flex items-center gap-1.5">
                <input type="checkbox" checked={st.priorityAgeGroups.includes(g)} onChange={() => toggleAge(g)} />
                {g} ปี
              </label>
            ))}
          </div>
        </Field>
        <Field label="แต้มต่อของช่วงอายุข้างต้น (นาที)">
          <select value={st.ageBonusMinutes} onChange={(e) => set({ ageBonusMinutes: Number(e.target.value) })} className="input">
            {BONUS_CHOICES.map((n) => <option key={n} value={n} disabled={!allowed(n, st.chronicBonusMinutes)}>{n} นาที</option>)}
          </select>
        </Field>
        <Field label="แต้มต่อของผู้มีโรคประจำตัว (นาที)">
          <select value={st.chronicBonusMinutes} onChange={(e) => set({ chronicBonusMinutes: Number(e.target.value) })} className="input">
            {BONUS_CHOICES.map((n) => <option key={n} value={n} disabled={!allowed(n, st.ageBonusMinutes)}>{n} นาที</option>)}
          </select>
        </Field>
      </div>
      <p className="mt-3 text-xs text-ink-3">ผู้ป่วยกลุ่มนี้นับเวลารอเหมือนรอมาก่อนแล้วตามจำนวนนาทีที่ตั้ง ใช้จัดลำดับภายในระดับความเร่งด่วนเดียวกันเท่านั้น แต้มต่อรวมต้องน้อยกว่า {limit} นาที เพื่อไม่ให้ผู้ป่วยข้ามระดับ</p>
    </Card>
  );
}

// ── doctors ──

function Doctors() {
  const { state, update } = useMock();
  const { dept } = useLookups();
  const [form, setForm] = useState({ name: "", departmentId: state.departments[0]?.id ?? "", meetingUrl: "" });
  return (
    <div className={LAYOUT}>
      <Card title="แพทย์" icon={Stethoscope} note="เพิ่มเวรให้แพทย์ได้ที่หน้าตารางเวรและนัดหมาย · ลิงก์ห้องตรวจออนไลน์ส่งให้ผู้ป่วยตรวจออนไลน์เมื่อถึงคิว">
        <ul className="flex flex-col gap-2">
          {state.doctors.map((d) => (
            <li key={d.id} className="flex flex-wrap items-center gap-3 rounded-2xl bg-subtle px-3 py-2.5">
              <Avatar text={doctorInitials(d.name, dept.get(d.departmentId)?.code)} dark />
              <div className="min-w-0 flex-1">
                <div className="truncate font-medium">{d.name}</div>
                <MeetingUrlInput key={d.meetingUrl ?? ""} value={d.meetingUrl} onSave={(v) => update((s) => saveDoctor(s, { ...d, meetingUrl: v }))} />
              </div>
              <PillSelect value={d.departmentId} onChange={(v) => update((s) => saveDoctor(s, { ...d, departmentId: v }))} className="w-48">
                {state.departments.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}
              </PillSelect>
            </li>
          ))}
        </ul>
      </Card>
      <Card title="เพิ่มแพทย์" icon={Plus}>
        <div className="flex flex-col gap-3">
          <Field label="ชื่อ"><input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} className="input" placeholder="เช่น แพทย์ทดสอบ อายุรกรรม 3" /></Field>
          <Field label="แผนก">
            <select value={form.departmentId} onChange={(e) => setForm((f) => ({ ...f, departmentId: e.target.value }))} className="input">
              {state.departments.filter((d) => d.isActive).map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
          </Field>
          <Field label="ลิงก์ห้องตรวจออนไลน์" hint="ห้องประจำของแพทย์บนบริการวิดีโอคอลภายนอก เว้นว่างได้">
            <input value={form.meetingUrl} onChange={(e) => setForm((f) => ({ ...f, meetingUrl: e.target.value }))} className="input" placeholder="https://" />
          </Field>
          <button
            disabled={!form.name.trim()}
            onClick={() => {
              update((s) => saveDoctor(s, { id: newId("doc"), name: form.name.trim(), departmentId: form.departmentId, meetingUrl: form.meetingUrl.trim() || null }));
              setForm((f) => ({ ...f, name: "", meetingUrl: "" }));
            }}
            className={`${btn.primary} mt-1`}
          >
            เพิ่มแพทย์
          </button>
        </div>
      </Card>
    </div>
  );
}

/** Saved on blur so typing a link does not rewrite the store on every key. */
function MeetingUrlInput({ value, onSave }: { value: string | null; onSave: (v: string | null) => void }) {
  const [text, setText] = useState(value ?? "");
  return (
    <input
      value={text}
      onChange={(e) => setText(e.target.value)}
      onBlur={() => text.trim() !== (value ?? "") && onSave(text.trim() || null)}
      placeholder="ลิงก์ห้องตรวจออนไลน์ (ยังไม่ได้ตั้ง)"
      className="mt-0.5 w-full truncate bg-transparent text-xs text-ink-3 outline-none placeholder:text-ink-3/60 focus:text-ink"
    />
  );
}

// ── symptom codes ──

const EMPTY_CODE = (): SymptomCode => ({ id: "", code: "", label: "", synonyms: [], departmentWeights: {}, isRedFlag: false, onsiteOnly: false, priorityHint: null, isActive: true });

function Codes() {
  const { state, update } = useMock();
  const { dept } = useLookups();
  const [filter, setFilter] = useState<"all" | "red" | "onsite" | "off">("all");
  const [editing, setEditing] = useState<SymptomCode | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const depts = state.departments.filter((d) => d.isActive);
  const list = state.symptomCodes.filter((c) => (filter === "red" ? c.isRedFlag : filter === "onsite" ? c.onsiteOnly : filter === "off" ? !c.isActive : true));
  const edit = (patch: Partial<SymptomCode>) => setEditing((e) => (e ? { ...e, ...patch } : e));

  function save() {
    if (!editing) return;
    const code = editing.code.trim();
    if (!/^[a-z][a-z0-9_]*$/.test(code) || !editing.label.trim()) return setErr("รหัสต้องเป็นภาษาอังกฤษตัวเล็กและ _ เท่านั้น และต้องมีชื่ออาการ");
    if (state.symptomCodes.some((c) => c.code === code && c.id !== editing.id)) return setErr("รหัสอาการนี้มีอยู่แล้ว");
    const weights = Object.fromEntries(Object.entries(editing.departmentWeights).filter(([, w]) => w > 0));
    update((s) => saveSymptomCode(s, { ...editing, id: editing.id || `sc_${code}`, code, label: editing.label.trim(), departmentWeights: weights }));
    setEditing(null);
    setErr(null);
  }

  return (
    <div className={LAYOUT}>
      <Card
        title="รหัสอาการ"
        icon={Tags}
        note={`${list.length} รายการ · น้ำหนัก (w) ใช้คำนวณคะแนนรายแผนก`}
        action={
          <div className="flex gap-2">
            <PillSelect value={filter} onChange={(v) => setFilter(v as typeof filter)}>
              <option value="all">ทั้งหมด</option>
              <option value="red">อาการฉุกเฉิน</option>
              <option value="onsite">ต้องตรวจที่ รพ.</option>
              <option value="off">ปิดใช้งาน</option>
            </PillSelect>
            <button onClick={() => { setEditing(EMPTY_CODE()); setErr(null); }} className={btn.primary}><Plus size={15} strokeWidth={2} /> เพิ่ม</button>
          </div>
        }
      >
        <div className="-mx-5 overflow-x-auto px-5 sm:-mx-6 sm:px-6">
          <table className="w-full min-w-[640px] text-sm">
            <thead><tr><th className={TH}>อาการ</th><th className={TH}>น้ำหนักรายแผนก</th><th className={TH}>เกณฑ์</th><th className={TH} /></tr></thead>
            <tbody>
              {list.map((c) => (
                <tr key={c.id} className={`${TR} ${c.isActive ? "" : "opacity-40"} ${editing?.id === c.id ? "bg-subtle" : ""}`}>
                  <td className="py-3 pr-3">
                    <div className="font-medium">{c.label}</div>
                    <code className="text-xs text-ink-3">{c.code}</code>
                  </td>
                  <td className="py-3">
                    <div className="flex flex-wrap gap-1">
                      {Object.entries(c.departmentWeights).map(([d, w]) => (
                        <span key={d} className="rounded-full bg-subtle px-2.5 py-0.5 text-xs text-ink-2">{dept.get(d)?.name} <b className="font-semibold text-ink">{w}</b></span>
                      ))}
                    </div>
                  </td>
                  <td className="py-3">
                    <div className="flex flex-wrap gap-1">
                      {c.isRedFlag && <Tag tone="rose">ฉุกเฉิน</Tag>}
                      {c.onsiteOnly && <Tag tone="amber">ตรวจที่ รพ.</Tag>}
                      {c.priorityHint && <Tag>ระดับ ≤ {c.priorityHint}</Tag>}
                    </div>
                  </td>
                  <td className="py-3 text-right"><button onClick={() => { setEditing(c); setErr(null); }} className={`${btn.small} bg-surface text-ink ring-1 ring-line hover:bg-subtle`}>แก้ไข</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <Card className="xl:sticky xl:top-6 xl:self-start" title={editing ? (editing.id ? "แก้ไขรหัสอาการ" : "เพิ่มรหัสอาการ") : "แก้ไขรหัสอาการ"} note={editing?.id ? editing.code : undefined}>
        {!editing && <p className="text-sm text-ink-3">เลือก “แก้ไข” จากตาราง หรือกด “เพิ่ม”</p>}
        {editing && (
          <div className="flex flex-col gap-3">
            <Field label="รหัส"><input disabled={Boolean(editing.id)} value={editing.code} onChange={(e) => edit({ code: e.target.value })} className="input font-mono" placeholder="เช่น chest_pain_mild" /></Field>
            <Field label="ชื่ออาการ"><input value={editing.label} onChange={(e) => edit({ label: e.target.value })} className="input" /></Field>
            <Field label="คำที่ผู้ป่วยมักใช้ (คั่นด้วย ,)" hint="ช่วยให้ LLM แปลงข้อความเป็นรหัสนี้ได้แม่นขึ้น">
              <input value={editing.synonyms.join(", ")} onChange={(e) => edit({ synonyms: e.target.value.split(",").map((x) => x.trim()).filter(Boolean) })} className="input" />
            </Field>
            <div>
              <div className="mb-1.5 text-xs font-medium text-ink-2">น้ำหนักคะแนนรายแผนก (w)</div>
              <div className="grid grid-cols-2 gap-1.5">
                {depts.map((d) => (
                  <label key={d.id} className="flex items-center gap-2 rounded-2xl bg-subtle py-1 pl-3.5 pr-1 text-sm">
                    <span className="flex-1 truncate text-ink-2">{d.name}</span>
                    <input
                      inputMode="numeric"
                      value={editing.departmentWeights[d.id] ?? ""}
                      onChange={(e) => edit({ departmentWeights: { ...editing.departmentWeights, [d.id]: Number(e.target.value.replace(/\D/g, "")) || 0 } })}
                      className="w-12 rounded-xl bg-surface px-2 py-1.5 text-right outline-none focus:ring-1 focus:ring-ink/30"
                    />
                  </label>
                ))}
              </div>
            </div>
            <Check checked={editing.isRedFlag} onChange={(v) => edit({ isRedFlag: v, onsiteOnly: v || editing.onsiteOnly })}>เป็นอาการฉุกเฉิน · หยุดและส่งต่อทันที</Check>
            <Check checked={editing.onsiteOnly} onChange={(v) => edit({ onsiteOnly: v })}>ต้องตรวจที่สถานพยาบาล · ไม่เสนอตรวจออนไลน์</Check>
            <Field label="ระดับความเร่งด่วนอย่างน้อย">
              <select value={editing.priorityHint ?? ""} onChange={(e) => edit({ priorityHint: e.target.value ? (Number(e.target.value) as Level) : null })} className="input">
                <option value="">ไม่กำหนด</option>
                <option value="2">ระดับ 2 (ส้ม)</option>
                <option value="3">ระดับ 3 (เหลือง)</option>
              </select>
            </Field>
            <div className="flex items-center justify-between rounded-2xl bg-subtle px-4 py-3 text-sm">
              สถานะ <ActiveToggle active={editing.isActive} onChange={(v) => edit({ isActive: v })} />
            </div>
            <div className="mt-1 flex gap-2">
              <button onClick={save} className={`${btn.primary} flex-1`}>บันทึก</button>
              <button onClick={() => setEditing(null)} className={btn.secondary}>ยกเลิก</button>
            </div>
            {err && <Notice tone="rose">{err}</Notice>}
            <p className="text-xs text-ink-3">รหัสที่ผลคัดกรองเดิมใช้อยู่ลบไม่ได้ ให้ปิดใช้งานแทนเพื่อให้ตรวจสอบย้อนหลังได้</p>
          </div>
        )}
      </Card>
    </div>
  );
}

// ── questions ──

function Questions() {
  const { state, update } = useMock();
  const { code } = useLookups();
  const [editing, setEditing] = useState<Question | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const list = [...state.questions].sort((a, b) => a.order - b.order);
  const edit = (patch: Partial<Question>) => setEditing((e) => (e ? { ...e, ...patch } : e));

  function save() {
    if (!editing) return;
    if (!editing.questionText.trim() || editing.options.length < 2) return setErr("คำถามต้องมีข้อความและตัวเลือกอย่างน้อย 2 ข้อ");
    const missing = editing.options.map((o) => o.symptomCode).filter((c): c is string => Boolean(c) && !code.has(c!));
    if (missing.length) return setErr(`ตัวเลือกอ้างถึงรหัสที่ไม่มีอยู่: ${missing.join(", ")}`);
    if (editing.dependsOn && !code.has(editing.dependsOn.symptomCode)) return setErr("เงื่อนไขการถามอ้างถึงรหัสที่ไม่มีอยู่");
    update((s) => saveQuestion(s, editing));
    setEditing(null);
    setErr(null);
  }

  return (
    <div className={LAYOUT}>
      <Card title="ชุดคำถามซักประวัติ" icon={ListChecks} note="แชทบอทถามตามลำดับ และข้ามข้อที่เงื่อนไขไม่ตรง">
        <ol className="flex flex-col gap-2">
          {list.map((q) => (
            <li key={q.id} className={`flex gap-4 rounded-2xl px-4 py-3.5 ${editing?.id === q.id ? "bg-lime/50" : "bg-subtle"} ${q.isActive ? "" : "opacity-40"}`}>
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-surface text-xs font-semibold tabular-nums">{q.order}</span>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-medium">{q.questionText}</span>
                  {q.dependsOn && <Tag tone="sky">ถามเมื่อมี “{code.get(q.dependsOn.symptomCode)?.label ?? q.dependsOn.symptomCode}”</Tag>}
                </div>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {q.options.map((o) => (
                    <span key={o.label} className="rounded-full bg-surface px-2.5 py-1 text-xs text-ink-2">
                      {o.label}{o.symptomCode && <code className="ml-1 text-ink-3">→ {o.symptomCode}</code>}
                    </span>
                  ))}
                </div>
              </div>
              <button onClick={() => { setEditing(structuredClone(q)); setErr(null); }} className={`${btn.small} h-fit shrink-0 bg-surface text-ink ring-1 ring-line hover:bg-subtle`}>แก้ไข</button>
            </li>
          ))}
        </ol>
      </Card>

      <Card className="xl:sticky xl:top-6 xl:self-start" title={editing ? `แก้ไขคำถามข้อ ${editing.order}` : "แก้ไขคำถาม"}>
        {!editing && <p className="text-sm text-ink-3">เลือก “แก้ไข” จากรายการคำถาม</p>}
        {editing && (
          <div className="flex flex-col gap-3">
            <Field label="ข้อความคำถาม"><textarea value={editing.questionText} onChange={(e) => edit({ questionText: e.target.value })} className="input" rows={2} /></Field>
            <Field label="ถามเมื่อผู้ป่วยมีรหัสอาการ">
              <select value={editing.dependsOn?.symptomCode ?? ""} onChange={(e) => edit({ dependsOn: e.target.value ? { symptomCode: e.target.value } : null })} className="input">
                <option value="">ถามทุกคน</option>
                {state.symptomCodes.map((c) => <option key={c.id} value={c.code}>{c.label} ({c.code})</option>)}
              </select>
            </Field>
            <div>
              <div className="mb-1.5 text-xs font-medium text-ink-2">ตัวเลือก → รหัสอาการ</div>
              <div className="flex flex-col gap-1.5">
                {editing.options.map((o, i) => (
                  <div key={i} className="flex items-center gap-1.5 rounded-2xl bg-subtle p-1.5">
                    <input value={o.label} onChange={(e) => edit({ options: editing.options.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)) })} className="min-w-0 flex-1 rounded-xl bg-surface px-3 py-2 text-sm outline-none" />
                    <select value={o.symptomCode ?? ""} onChange={(e) => edit({ options: editing.options.map((x, j) => (j === i ? { ...x, symptomCode: e.target.value || null } : x)) })} className="w-32 rounded-xl bg-surface px-2 py-2 text-xs outline-none">
                      <option value="">ไม่มีรหัส</option>
                      {state.symptomCodes.map((c) => <option key={c.id} value={c.code}>{c.code}</option>)}
                    </select>
                    <button onClick={() => edit({ options: editing.options.filter((_, j) => j !== i) })} className="rounded-full p-1.5 text-ink-3 hover:bg-surface hover:text-rose-600"><X size={14} strokeWidth={2} /></button>
                  </div>
                ))}
              </div>
              <button onClick={() => edit({ options: [...editing.options, { label: "", symptomCode: null }] })} className="mt-2 inline-flex items-center gap-1.5 text-xs font-medium text-ink-2 hover:text-ink">
                <Plus size={14} strokeWidth={2} /> เพิ่มตัวเลือก
              </button>
            </div>
            <div className="flex items-center justify-between rounded-2xl bg-subtle px-4 py-3 text-sm">
              สถานะ <ActiveToggle active={editing.isActive} onChange={(v) => edit({ isActive: v })} />
            </div>
            <div className="mt-1 flex gap-2">
              <button onClick={save} className={`${btn.primary} flex-1`}>บันทึก</button>
              <button onClick={() => setEditing(null)} className={btn.secondary}>ยกเลิก</button>
            </div>
            {err && <Notice tone="rose">{err}</Notice>}
          </div>
        )}
      </Card>
    </div>
  );
}

// ── users ──

const EMPTY_USER = { username: "", password: "", role: "STAFF" as Role, departmentId: "", doctorId: "" };

function Users() {
  const { state, update } = useMock();
  const { dept, doctor: doctorMap } = useLookups();
  const [form, setForm] = useState(EMPTY_USER);
  const [err, setErr] = useState<string | null>(null);
  const set = (patch: Partial<typeof form>) => setForm((f) => ({ ...f, ...patch }));
  const linked = new Set(state.users.map((u) => u.doctorId).filter(Boolean));
  const freeDoctors = state.doctors.filter((d) => !linked.has(d.id));

  function add() {
    const username = form.username.trim();
    if (!/^[a-z0-9._]{3,}$/.test(username)) return setErr("ชื่อผู้ใช้ต้องเป็นภาษาอังกฤษตัวเล็ก ตัวเลข . หรือ _ อย่างน้อย 3 ตัว");
    if (state.users.some((u) => u.username === username)) return setErr("ชื่อผู้ใช้นี้มีอยู่แล้ว");
    if (form.password.length < 8) return setErr("รหัสผ่านต้องมีอย่างน้อย 8 ตัวอักษร");
    const isDoctor = form.role === "DOCTOR";
    if (isDoctor && !form.doctorId) return setErr("บัญชีแพทย์ต้องเลือกรายชื่อแพทย์ที่ใช้บัญชีนี้");
    // a doctor account belongs to the doctor's own department
    const departmentId = isDoctor ? doctorMap.get(form.doctorId)!.departmentId : form.departmentId || null;
    // Mock: the password is not stored. The real API hashes it with bcrypt before saving.
    update((s) => saveUser(s, { id: newId("u"), username, role: form.role, departmentId, doctorId: isDoctor ? form.doctorId : null, isActive: true }));
    setForm(EMPTY_USER);
    setErr(null);
  }

  return (
    <div className={LAYOUT}>
      <Card title="บัญชีบุคลากร" icon={KeyRound} note="บุคลากรสมัครเองไม่ได้ · บัญชีที่ปิดใช้งานจะเข้าสู่ระบบไม่ได้">
        <ul className="flex flex-col gap-2">
          {state.users.map((u) => (
            <li key={u.id} className={`flex flex-wrap items-center gap-3 rounded-2xl bg-subtle px-3 py-2.5 ${u.isActive ? "" : "opacity-50"}`}>
              <Avatar text={u.username.slice(0, 2).toUpperCase()} dark={u.role === "ADMIN"} />
              <div className="min-w-0 flex-1">
                <div className="font-mono text-sm">{u.username}</div>
                <div className="text-xs text-ink-3">
                  {ROLE_LABEL[u.role]} · {u.doctorId ? doctorMap.get(u.doctorId)?.name : u.departmentId ? dept.get(u.departmentId)?.name : "ทุกแผนก"}
                </div>
              </div>
              {u.id === state.sessionUserId ? <Tag tone="lime">บัญชีของคุณ</Tag> : <ActiveToggle active={u.isActive} onChange={(v) => update((s) => saveUser(s, { ...u, isActive: v }))} />}
            </li>
          ))}
        </ul>
      </Card>
      <Card title="สร้างบัญชี" icon={Plus}>
        <div className="flex flex-col gap-3">
          <Field label="ชื่อผู้ใช้"><input value={form.username} onChange={(e) => set({ username: e.target.value })} className="input" placeholder="เช่น staff.ped" /></Field>
          <Field label="รหัสผ่านเริ่มต้น" hint="เก็บในรูปแบบแฮชเมื่อเชื่อมฐานข้อมูลจริง"><input type="password" autoComplete="new-password" value={form.password} onChange={(e) => set({ password: e.target.value })} className="input" /></Field>
          <div className="grid grid-cols-2 gap-2">
            <Field label="บทบาท">
              <select value={form.role} onChange={(e) => set({ role: e.target.value as Role })} className="input">
                {(Object.keys(ROLE_LABEL) as Role[]).map((r) => <option key={r} value={r}>{ROLE_LABEL[r]}</option>)}
              </select>
            </Field>
            {form.role === "DOCTOR" ? (
              <Field label="แพทย์">
                <select value={form.doctorId} onChange={(e) => set({ doctorId: e.target.value })} className="input">
                  <option value="">เลือกแพทย์</option>
                  {freeDoctors.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
                </select>
              </Field>
            ) : (
              <Field label="แผนก">
                <select value={form.departmentId} onChange={(e) => set({ departmentId: e.target.value })} className="input">
                  <option value="">ทุกแผนก</option>
                  {state.departments.filter((d) => d.isActive).map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
                </select>
              </Field>
            )}
          </div>
          {form.role === "DOCTOR" && <p className="text-xs text-ink-3">แพทย์เห็นเฉพาะคิวของตนเองและบันทึกผลการตรวจ (UC09) · แพทย์ 1 คนมีได้ 1 บัญชี</p>}
          <button onClick={add} className={`${btn.primary} mt-1`}>สร้างบัญชี</button>
          {err && <Notice tone="rose">{err}</Notice>}
        </div>
      </Card>
    </div>
  );
}
