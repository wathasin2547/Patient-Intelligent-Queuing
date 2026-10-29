"use client";

// UC01 register (first visit) — also used to edit the patient's own details later.

import { ShieldCheck } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Notice } from "@/components/ui";
import { registerPatient, updatePatient } from "@/lib/mock/actions";
import { useMock } from "@/lib/mock/store";

const AGES = [
  { value: "0-5", label: "0-5 ปี" },
  { value: "6-17", label: "6-17 ปี" },
  { value: "18-59", label: "18-59 ปี" },
  { value: "60+", label: "60 ปีขึ้นไป" },
];
const COVERAGE = ["บัตรทอง", "ประกันสังคม", "ข้าราชการ", "ชำระเงินเอง"];

export default function RegisterPage() {
  const { state } = useMock();
  // remount when the demo switches LINE user so the form shows that user's data
  return <RegisterForm key={state.liffPatientId ?? "new"} />;
}

function RegisterForm() {
  const { state, update } = useMock();
  const router = useRouter();
  const existing = state.patients.find((p) => p.id === state.liffPatientId);
  const [form, setForm] = useState({
    fullName: existing?.fullName ?? "",
    ageGroup: existing?.ageGroup ?? "",
    gender: existing?.gender ?? "",
    healthCoverage: existing?.healthCoverage ?? COVERAGE[0],
    isChronic: existing?.isChronic ?? false,
    address: existing?.address ?? "",
  });
  const [consent, setConsent] = useState(Boolean(existing));
  const [error, setError] = useState<string | null>(null);

  function submit() {
    if (!consent) return setError("ต้องยินยอมให้เก็บข้อมูลก่อน จึงจะใช้งานเมนูอื่นได้");
    if (!form.fullName.trim() || !form.ageGroup || !form.gender) return setError("กรุณากรอกชื่อ เลือกช่วงอายุ และเพศ");
    const data = { ...form, fullName: form.fullName.trim(), address: form.address.trim() || null };
    update((s, now) => (existing ? updatePatient(s, existing.id, data) : registerPatient(s, now, data)));
    router.push("/liff");
  }

  const set = (patch: Partial<typeof form>) => setForm((f) => ({ ...f, ...patch }));
  const pick = (key: "ageGroup" | "gender", value: string) => set({ [key]: value });
  const chip = (on: boolean) => `rounded-full py-2.5 text-sm transition ${on ? "bg-ink font-medium text-white" : "bg-surface text-ink-2"}`;

  return (
    <div className="flex flex-1 flex-col p-4">
      <div className="px-1 pb-4 pt-2">
        <h1 className="text-2xl font-medium tracking-tight">{existing ? "ข้อมูลของฉัน" : "ลงทะเบียนครั้งแรก"}</h1>
        <p className="text-sm text-ink-3">{existing ? "แก้ไขข้อมูลพื้นฐานได้ตลอด" : "กรอกครั้งเดียว ครั้งต่อไประบบจำบัญชี LINE ของคุณได้"}</p>
      </div>

      <div className="flex flex-col gap-4 rounded-card bg-surface p-5">
        <Row label="ชื่อ-นามสกุล"><input value={form.fullName} onChange={(e) => set({ fullName: e.target.value })} className="input" placeholder="ชื่อ นามสกุล" /></Row>
        <Row label="ช่วงอายุ">
          <div className="grid grid-cols-2 gap-1.5 rounded-[22px] bg-subtle p-1.5">
            {AGES.map((a) => <button key={a.value} type="button" onClick={() => pick("ageGroup", a.value)} className={chip(form.ageGroup === a.value)}>{a.label}</button>)}
          </div>
        </Row>
        <Row label="เพศ">
          <div className="grid grid-cols-3 gap-1.5 rounded-[22px] bg-subtle p-1.5">
            {["ชาย", "หญิง", "ไม่ระบุ"].map((g) => <button key={g} type="button" onClick={() => pick("gender", g)} className={chip(form.gender === g)}>{g}</button>)}
          </div>
        </Row>
        <Row label="สิทธิการรักษา">
          <select value={form.healthCoverage} onChange={(e) => set({ healthCoverage: e.target.value })} className="input">
            {COVERAGE.map((c) => <option key={c}>{c}</option>)}
          </select>
        </Row>
        <label className="flex items-center justify-between gap-3 rounded-2xl bg-subtle px-4 py-3 text-sm">
          มีโรคประจำตัวที่ต้องรับยาต่อเนื่อง
          <input type="checkbox" checked={form.isChronic} onChange={(e) => set({ isChronic: e.target.checked })} className="h-5 w-5 accent-ink" />
        </label>
        <Row label="ที่อยู่สำหรับจัดส่งยา (ไม่บังคับ)"><textarea value={form.address} onChange={(e) => set({ address: e.target.value })} className="input" rows={2} /></Row>
      </div>

      {!existing && (
        <label className="mt-3 flex gap-3 rounded-card bg-surface p-4 text-xs leading-relaxed text-ink-2">
          <ShieldCheck size={20} strokeWidth={1.8} className="shrink-0 text-ink" />
          <span className="flex-1">ยินยอมให้สถานพยาบาลเก็บและใช้ข้อมูลอาการเพื่อการคัดกรองและจัดคิว ตาม พ.ร.บ. คุ้มครองข้อมูลส่วนบุคคล พ.ศ. 2562</span>
          <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} className="h-5 w-5 shrink-0 accent-ink" />
        </label>
      )}
      {error && <div className="mt-3"><Notice tone="rose">{error}</Notice></div>}

      <button onClick={submit} className={`mt-4 rounded-full py-3.5 font-medium transition ${consent ? "bg-ink text-white" : "bg-line text-ink-3"}`}>
        {existing ? "บันทึก" : "ลงทะเบียน"}
      </button>
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="mb-1.5 text-xs font-medium text-ink-2">{label}</div>
      {children}
    </div>
  );
}
