"use client";

// UC03 happens in the LINE chat itself (quick-reply questions, see feature/line-webhook),
// not in a LIFF page. This screen only tells the patient where to go.

import { MessageCircle } from "lucide-react";
import Link from "next/link";
import { ACTIVE } from "@/lib/mock/logic";
import { useMock } from "@/lib/mock/store";

const STEPS = [
  <>กลับไปที่ห้องแชทของโรงพยาบาล แล้วพิมพ์ <b>“ตรวจ”</b> หรือกดเมนูรับคิว</>,
  <>ตอบคำถามทีละข้อด้วยการกดปุ่ม และพิมพ์อาการเพิ่มเติมได้</>,
  <>ระบบแนะนำแผนกและออกหมายเลขคิวให้ในแชท ถ้าพบอาการฉุกเฉินจะแนะนำให้ไปจุดบริการฉุกเฉินทันที</>,
];

export default function ChatInfoPage() {
  const { state } = useMock();
  const active = state.queues.filter((q) => q.patientId === state.liffPatientId && ACTIVE.includes(q.status));
  const max = state.settings.maxActiveQueues;

  // a second symptom may need another department, up to the limit (one queue per department)
  if (active.length >= max) {
    return (
      <div className="flex flex-1 flex-col justify-center gap-4 p-5 text-center">
        <p className="text-sm text-ink-2">คุณมีคิวอยู่ {active.length} คิวแล้ว ซึ่งเป็นจำนวนสูงสุดที่ถือพร้อมกันได้ รับคิวเพิ่มได้เมื่อคิวใดคิวหนึ่งสิ้นสุด</p>
        <Link href="/liff/queue" className="rounded-full bg-ink py-3.5 font-medium text-white">ดูสถานะคิว</Link>
      </div>
    );
  }
  return (
    <div className="flex flex-1 flex-col gap-3 p-4">
      <div className="rounded-card bg-accent p-6 text-accent-ink">
        <span className="flex h-12 w-12 items-center justify-center rounded-full bg-brand text-accent"><MessageCircle size={22} strokeWidth={1.8} /></span>
        <h1 className="mt-5 text-2xl font-medium tracking-tight">รับคิวผ่านแชท</h1>
        <p className="mt-1 text-sm text-accent-ink/70">ใช้เวลาประมาณ 1–2 นาที</p>
      </div>
      <ol className="flex flex-col gap-2">
        {STEPS.map((s, i) => (
          <li key={i} className="flex gap-4 rounded-card bg-surface p-4 text-sm">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-ink text-xs font-semibold text-white">{i + 1}</span>
            <span className="pt-1.5">{s}</span>
          </li>
        ))}
      </ol>
      {active.length > 0 && (
        <p className="rounded-card bg-surface p-4 text-sm text-ink-2">
          คุณมีคิว <b className="font-mono">{active.map((q) => q.queueNumber).join(", ")}</b> อยู่แล้ว ถ้ามีอาการอื่นที่ต้องพบแพทย์ต่างแผนก รับคิวเพิ่มได้อีก {max - active.length} คิว และรอพร้อมกันได้เลย
        </p>
      )}
      <p className="px-2 text-xs text-ink-3">ระบบแนะนำแผนกจากอาการที่แจ้ง ไม่ใช่การวินิจฉัยโรค แพทย์จะเป็นผู้ตรวจอีกครั้ง</p>
      <p className="mt-auto pt-4 text-center text-xs text-ink-3">ในระบบจริง ปุ่มนี้ปิดหน้า LIFF แล้วกลับไปที่ห้องแชท</p>
    </div>
  );
}
