"use client";

// UC06 choose how to receive medicine, then follow the delivery status.

import { Check, Hospital, Pill, Truck } from "lucide-react";
import { useState } from "react";
import { Notice } from "@/components/ui";
import { chooseDelivery, DELIVERY_LABEL } from "@/lib/mock/actions";
import { useMock } from "@/lib/mock/store";
import { fmtShortDate } from "@/lib/mock/time";
import type { DeliveryMethod, DeliveryStatus, Prescription } from "@/lib/mock/types";

const STEPS: Record<DeliveryMethod, DeliveryStatus[]> = {
  PICKUP: ["PENDING", "PREPARING", "READY", "COMPLETED"],
  SHIP: ["PENDING", "PREPARING", "SHIPPED", "COMPLETED"],
};

export default function MedicinePage() {
  const { state } = useMock();
  const queueIds = new Set(state.queues.filter((q) => q.patientId === state.liffPatientId).map((q) => q.id));
  const list = state.prescriptions.filter((r) => queueIds.has(r.queueId)).sort((a, b) => b.issuedAt.localeCompare(a.issuedAt));

  if (list.length === 0) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-4 p-6 text-center">
        <span className="flex h-14 w-14 items-center justify-center rounded-full bg-surface"><Pill size={24} strokeWidth={1.6} /></span>
        <p className="text-sm text-ink-3">ยังไม่มีรายการยา ระบบจะแจ้งทาง LINE เมื่อแพทย์สั่งจ่ายยา</p>
      </div>
    );
  }
  return (
    <div className="flex flex-1 flex-col gap-3 p-4">
      <h1 className="px-1 pb-1 pt-2 text-2xl font-medium tracking-tight">รับยา</h1>
      {list.map((rx) => <RxCard key={rx.id} rx={rx} />)}
    </div>
  );
}

function RxCard({ rx }: { rx: Prescription }) {
  const { state, update } = useMock();
  const patient = state.patients.find((p) => p.id === state.liffPatientId);
  const delivery = state.deliveries.find((d) => d.prescriptionId === rx.id);
  const [method, setMethod] = useState<DeliveryMethod | null>(null);
  const [address, setAddress] = useState(patient?.address ?? "");
  const [error, setError] = useState<string | null>(null);

  function confirm() {
    if (!method) return;
    // UC06 exception: shipping needs a complete address
    if (method === "SHIP" && address.trim().length < 15) return setError("กรุณากรอกที่อยู่ให้ครบ (บ้านเลขที่ ถนน แขวง/ตำบล เขต/อำเภอ จังหวัด รหัสไปรษณีย์)");
    update((s, now) => chooseDelivery(s, now, { prescriptionId: rx.id, method, address: method === "SHIP" ? address.trim() : null }));
  }

  return (
    <section className="rounded-card bg-surface p-5">
      <div className="flex items-baseline justify-between">
        <div className="font-semibold">รายการยา</div>
        <div className="text-xs text-ink-3">{fmtShortDate(rx.issuedAt)} · {rx.daysSupply} วัน</div>
      </div>
      <ul className="mt-3 flex flex-col gap-2">
        {rx.items.map((i) => (
          <li key={i.name} className="flex items-center gap-3 rounded-2xl bg-subtle px-4 py-3">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-surface"><Pill size={16} strokeWidth={1.8} /></span>
            <div className="min-w-0">
              <div className="text-sm font-medium">{i.name}</div>
              <div className="text-xs text-ink-3">{[i.dosage, i.quantity].filter(Boolean).join(" · ")}</div>
            </div>
          </li>
        ))}
      </ul>

      {!delivery && (
        <>
          <div className="mb-2 mt-5 text-sm font-medium">เลือกวิธีรับยา</div>
          <div className="grid grid-cols-2 gap-2">
            {(["PICKUP", "SHIP"] as DeliveryMethod[]).map((m) => {
              const on = method === m;
              const Icon = m === "PICKUP" ? Hospital : Truck;
              return (
                <button key={m} onClick={() => { setMethod(m); setError(null); }} className={`rounded-[22px] p-4 text-left transition ${on ? "bg-ink text-white" : "bg-subtle"}`}>
                  <span className={`flex h-10 w-10 items-center justify-center rounded-full ${on ? "bg-lime text-ink" : "bg-surface"}`}><Icon size={18} strokeWidth={1.8} /></span>
                  <div className="mt-4 text-sm font-medium">{m === "PICKUP" ? "รับที่โรงพยาบาล" : "จัดส่งถึงบ้าน"}</div>
                </button>
              );
            })}
          </div>
          {method === "SHIP" && (
            <label className="mt-3 block">
              <span className="mb-1.5 block text-xs font-medium text-ink-2">ที่อยู่จัดส่ง {patient?.address ? "(จากที่ลงทะเบียนไว้ แก้ไขได้)" : ""}</span>
              <textarea value={address} onChange={(e) => setAddress(e.target.value)} rows={3} className="input" />
            </label>
          )}
          {error && <div className="mt-3"><Notice tone="rose">{error}</Notice></div>}
          <button disabled={!method} onClick={confirm} className="mt-4 w-full rounded-full bg-lime py-3.5 font-medium text-lime-ink disabled:bg-subtle disabled:text-ink-3">
            ยืนยัน
          </button>
        </>
      )}

      {delivery && (
        <div className="mt-5">
          <div className="rounded-2xl bg-subtle px-4 py-3 text-sm">
            {delivery.method === "SHIP" ? <><span className="text-ink-3">จัดส่งถึงบ้าน</span><br />{delivery.address}</> : "รับที่ห้องยาโรงพยาบาล"}
          </div>
          <ol className="mt-4 flex flex-col">
            {STEPS[delivery.method].map((st, i, all) => {
              const reached = all.indexOf(delivery.status) >= i;
              return (
                <li key={st} className="flex gap-3">
                  <div className="flex flex-col items-center">
                    <span className={`flex h-7 w-7 items-center justify-center rounded-full text-xs ${reached ? "bg-ink text-lime" : "bg-subtle text-ink-3"}`}>
                      {reached ? <Check size={14} strokeWidth={2.4} /> : i + 1}
                    </span>
                    {i < all.length - 1 && <span className={`h-5 w-px ${reached ? "bg-ink" : "bg-line"}`} />}
                  </div>
                  <span className={`pt-1 text-sm ${reached ? "font-medium" : "text-ink-3"}`}>{DELIVERY_LABEL[st]}</span>
                </li>
              );
            })}
          </ol>
          <p className="mt-3 text-xs text-ink-3">ระบบแจ้งทาง LINE ทุกครั้งที่สถานะเปลี่ยน</p>
        </div>
      )}
    </section>
  );
}
