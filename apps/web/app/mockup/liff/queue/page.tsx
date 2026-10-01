"use client";

import { useState } from "react";

export default function QueueStatusMockup() {
  const [cancelAsk, setCancelAsk] = useState(false);
  const [cancelled, setCancelled] = useState(false);

  return (
    <div className="flex flex-1 flex-col bg-zinc-50 px-5 py-5">
      <div className="rounded-2xl bg-white p-5 text-center shadow-sm ring-1 ring-zinc-200">
        <div className="text-sm text-zinc-500">หมายเลขคิวของคุณ</div>
        <div className={`mt-1 font-mono text-5xl font-bold ${cancelled ? "text-zinc-300 line-through" : ""}`}>SUR-007</div>
        <div className="mt-2 inline-flex rounded-full bg-amber-400 px-3 py-1 text-xs font-medium text-amber-950">ระดับเหลือง</div>
        <div className="mt-4 grid grid-cols-2 gap-2 text-left text-sm">
          <Info label="แผนก" value="ศัลยกรรม" />
          <Info label="แพทย์" value="แพทย์ทดสอบ ศัลยกรรม 1" />
          <Info label="สถานะ" value={cancelled ? "ยกเลิกแล้ว" : "รอเรียก"} />
          <Info label="รออยู่ในแผนก" value="2 ราย" />
        </div>
      </div>

      {!cancelled && (
        <div className="mt-4 rounded-xl bg-sky-50 px-4 py-3 text-sm text-sky-900 ring-1 ring-sky-200">
          ระบบจะส่งข้อความแจ้งเตือนทาง LINE เมื่อใกล้ถึงคิว และอีกครั้งเมื่อถึงคิวของคุณ ไม่ต้องเฝ้าหน้าจอ
        </div>
      )}

      <div className="mt-4 text-xs text-zinc-500">
        ลำดับอาจเปลี่ยนได้ เพราะผู้ป่วยที่มีอาการเร่งด่วนกว่าจะได้รับการตรวจก่อน แต่ระบบจะเลื่อนลำดับให้ผู้ที่รอนานขึ้นมาเรื่อย ๆ
      </div>

      <div className="mt-auto pt-6">
        {cancelled ? (
          <div className="rounded-xl bg-zinc-100 py-3 text-center text-sm text-zinc-600">ยกเลิกคิวเรียบร้อยแล้ว</div>
        ) : cancelAsk ? (
          <div className="rounded-xl bg-white p-4 ring-1 ring-zinc-200">
            <div className="text-sm font-medium">ยืนยันยกเลิกคิว SUR-007?</div>
            <div className="mt-3 grid grid-cols-2 gap-2">
              <button onClick={() => setCancelAsk(false)} className="rounded-lg bg-zinc-100 py-2 text-sm">ไม่ยกเลิก</button>
              <button onClick={() => setCancelled(true)} className="rounded-lg bg-rose-600 py-2 text-sm font-medium text-white">ยืนยันยกเลิก</button>
            </div>
          </div>
        ) : (
          <button onClick={() => setCancelAsk(true)} className="w-full rounded-xl py-3 text-sm text-rose-600 ring-1 ring-rose-200">ยกเลิกคิว</button>
        )}
      </div>
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-zinc-50 px-3 py-2">
      <div className="text-xs text-zinc-500">{label}</div>
      <div className="font-medium">{value}</div>
    </div>
  );
}
