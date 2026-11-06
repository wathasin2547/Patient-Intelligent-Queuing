"use client";

import { ShieldCheck } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Notice } from "@/components/ui";
import { registerPatient, updatePatient } from "@/lib/mock/actions";
import { isLiffReal, liffPost, useMock } from "@/lib/mock/store";
import { ageGroupOf } from "@/lib/age";
import { isValidNationalId } from "@/lib/national-id";


const COVERAGE = ["บัตรทอง", "ประกันสังคม", "ข้าราชการ", "ชำระด้วยตัวเอง"];

export default function RegisterPage() {
  const { state } = useMock();
  return <RegisterForm key={state.liffPatientId ?? "new"} />;
}

function RegisterForm() {
  const { state, update } = useMock();
  const router = useRouter();
  const found = state.patients.find((p) => p.id === state.liffPatientId);
  const existing = found && found.fullName !== "(ยังไม่ลงทะเบียน)" ? found : undefined;
  const [form, setForm] = useState({
    fullName: existing?.fullName ?? "",
    age: existing?.age != null ? String(existing.age) : "",
    phoneNumber: existing?.phoneNumber ?? "",
    nationalId: "",
    gender: existing?.gender ?? "",
    healthCoverage: existing?.healthCoverage ?? COVERAGE[0],
    isChronic: existing?.isChronic ?? false,
    address: existing?.address ?? "",
  });
  const [consent, setConsent] = useState(Boolean(existing));
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    if (!consent) return setError("ต้องยินยอมให้เก็บข้อมูลก่อน จึงจะใช้งานเมนูอื่นได้");
        const age = Number(form.age);
    if (!form.fullName.trim() || !form.gender || form.age.trim() === "" || !Number.isInteger(age) || age < 0 || age > 120)
      return setError("กรุณากรอกชื่อ อายุ (0-120 ปี) และเลือกเพศ");
    if (!/^0\d{8,9}$/.test(form.phoneNumber)) return setError("เบอร์โทรไม่ถูกต้อง (ขึ้นต้น 0 และมี 9-10 หลัก)");
    if (!isValidNationalId(form.nationalId)) return setError("เลขบัตรประชาชนไม่ถูกต้อง");
    const data = {
      fullName: form.fullName.trim(),
      age,
      ageGroup: ageGroupOf(age),
      phoneNumber: form.phoneNumber,
      nationalId: form.nationalId,
      gender: form.gender,
      healthCoverage: form.healthCoverage,
      isChronic: form.isChronic,
      address: form.address.trim() || null,
    };
    if (isLiffReal()) {
      const result = await liffPost("/api/liff/profile", data);
      if (!result.ok) return setError(result.error ?? "บันทึกไม่สำเร็จ");
    } else {
      update((s, now) => (existing ? updatePatient(s, existing.id, data) : registerPatient(s, now, data)));
    }
    router.push("/liff");
  }

  const set = (patch: Partial<typeof form>) => setForm((f) => ({ ...f, ...patch }));
  const pick = (key: "gender", value: string) => set({ [key]: value });
  const chip = (on: boolean) => `rounded-full py-2.5 text-sm transition ${on ? "bg-ink font-medium text-white" : "bg-surface text-ink-2"}`;

  return (
    <div className="flex flex-1 flex-col p-4">
      <div className="px-1 pb-4 pt-2">
        <h1 className="text-2xl font-medium tracking-tight">{existing ? "ข้อมูลของฉัน" : "ลงทะเบียนครั้งแรก"}</h1>
        <p className="text-sm text-ink-3">{existing ? "แก้ไขข้อมูลพื้นฐานได้ตลอด" : "กรอกครั้งเดียว ครั้งต่อไประบบจำบัญชี LINE ของคุณได้"}</p>
      </div>

      <div className="flex flex-col gap-4 rounded-card bg-surface p-5">
        <Row label="ชื่อ-นามสกุล"><input value={form.fullName} onChange={(e) => set({ fullName: e.target.value })} className="input" placeholder="ชื่อ นามสกุล" /></Row>
                <Row label="อายุ (ปี)">
          <input type="number" inputMode="numeric" min={0} max={120} value={form.age} onChange={(e) => set({ age: e.target.value })} className="input" placeholder="เช่น 35" />
        </Row>
        <Row label="เบอร์โทรศัพท์">
          <input type="tel" inputMode="tel" maxLength={10} value={form.phoneNumber} onChange={(e) => set({ phoneNumber: e.target.value.replace(/\D/g, "") })} className="input" placeholder="เช่น 0812345678" />
          {form.phoneNumber.length > 0 && !/^0\d{8,9}$/.test(form.phoneNumber) && (
            <p className="mt-1 text-xs text-rose-600">เบอร์โทรต้องขึ้นต้น 0 และมี 9-10 หลัก</p>
          )}
        </Row>
        <Row label="เลขบัตรประชาชน 13 หลัก">
          <input type="text" inputMode="numeric" maxLength={13} value={form.nationalId} onChange={(e) => set({ nationalId: e.target.value.replace(/\D/g, "") })} className="input" placeholder="x-xxxx-xxxxx-xx-x" />
          {form.nationalId.length === 13 && !isValidNationalId(form.nationalId) && (
            <p className="mt-1 text-xs text-rose-600">เลขบัตรประชาชนไม่ถูกต้อง</p>
          )}
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
          <span className="flex-1">ยินยอมให้สถานพยาบาลเก็บและใช้ข้อมูลอาการเพื่อการคัดกรองและจัดคิว</span>
          <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} className="h-5 w-5 shrink-0 accent-ink" />
        </label>
      )}
      {error && <div className="mt-3"><Notice tone="rose">{error}</Notice></div>}

      <button onClick={submit} className={`mt-4 rounded-full py-3.5 font-medium transition ${consent ? "bg-ink text-white" : "bg-line text-ink-3"}`}>
        {existing ? "บันทึกข้อมูล" : "ลงทะเบียน"}
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
