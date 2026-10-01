"use client";

import Link from "next/link";
import { useState } from "react";

export default function RegisterMockup() {
  const [consent, setConsent] = useState(false);
  return (
    <div className="flex flex-1 flex-col px-5 py-5">
      <h1 className="text-lg font-semibold">ลงทะเบียนครั้งแรก</h1>
      <p className="text-sm text-zinc-500">กรอกครั้งเดียว ครั้งต่อไประบบจำบัญชี LINE ของคุณได้</p>

      <div className="mt-5 flex flex-col gap-3">
        <Field label="ชื่อ-นามสกุล"><input className="input" placeholder="ชื่อ นามสกุล" /></Field>
        <Field label="ช่วงอายุ">
          <div className="grid grid-cols-4 gap-1.5">
            {["0-5", "6-17", "18-59", "60+"].map((a) => (
              <button key={a} className="rounded-lg border border-zinc-300 py-2 text-sm focus:border-[#06C755] focus:bg-green-50">{a}</button>
            ))}
          </div>
        </Field>
        <Field label="เพศ">
          <div className="grid grid-cols-3 gap-1.5">
            {["ชาย", "หญิง", "ไม่ระบุ"].map((a) => (
              <button key={a} className="rounded-lg border border-zinc-300 py-2 text-sm focus:border-[#06C755] focus:bg-green-50">{a}</button>
            ))}
          </div>
        </Field>
        <Field label="สิทธิการรักษา">
          <select className="input">
            <option>บัตรทอง (หลักประกันสุขภาพถ้วนหน้า)</option>
            <option>ประกันสังคม</option>
            <option>ข้าราชการ</option>
            <option>ชำระเงินเอง</option>
          </select>
        </Field>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" className="h-4 w-4 accent-[#06C755]" /> มีโรคประจำตัวที่ต้องรับยาต่อเนื่อง
        </label>
        <Field label="ที่อยู่สำหรับจัดส่งยา (ไม่บังคับ)"><textarea className="input" rows={2} /></Field>
      </div>

      <label className="mt-5 flex gap-2 rounded-lg bg-zinc-50 p-3 text-xs text-zinc-600">
        <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} className="mt-0.5 h-4 w-4 shrink-0 accent-[#06C755]" />
        ยินยอมให้สถานพยาบาลเก็บและใช้ข้อมูลอาการเพื่อการคัดกรองและจัดคิว ตาม พ.ร.บ. คุ้มครองข้อมูลส่วนบุคคล พ.ศ. 2562
      </label>

      <Link
        href={consent ? "/mockup/liff/screening" : "#"}
        aria-disabled={!consent}
        className={`mt-4 rounded-xl py-3 text-center font-medium ${consent ? "bg-[#06C755] text-white" : "bg-zinc-200 text-zinc-400 pointer-events-none"}`}
      >
        ลงทะเบียน
      </Link>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="mb-1 text-xs text-zinc-500">{label}</div>
      {children}
    </div>
  );
}
