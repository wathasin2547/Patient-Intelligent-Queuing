import type { Level, QueueStatus } from "./_data";

export const LEVEL: Record<Level, { name: string; chip: string; bar: string; dot: string }> = {
  1: { name: "แดง", chip: "bg-red-600 text-white", bar: "border-l-red-600", dot: "bg-red-600" },
  2: { name: "ส้ม", chip: "bg-orange-500 text-white", bar: "border-l-orange-500", dot: "bg-orange-500" },
  3: { name: "เหลือง", chip: "bg-amber-400 text-amber-950", bar: "border-l-amber-400", dot: "bg-amber-400" },
  4: { name: "เขียว", chip: "bg-emerald-600 text-white", bar: "border-l-emerald-600", dot: "bg-emerald-600" },
  5: { name: "ขาว", chip: "bg-white text-zinc-700 ring-1 ring-zinc-300", bar: "border-l-zinc-300", dot: "bg-white ring-1 ring-zinc-400" },
};

export function LevelChip({ level }: { level: Level }) {
  const l = LEVEL[level];
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${l.chip}`}>
      ระดับ {level} · {l.name}
    </span>
  );
}

const STATUS: Record<QueueStatus, { label: string; cls: string }> = {
  WAITING: { label: "รอเรียก", cls: "bg-zinc-100 text-zinc-700" },
  CALLED: { label: "เรียกแล้ว", cls: "bg-sky-100 text-sky-800" },
  IN_PROGRESS: { label: "กำลังตรวจ", cls: "bg-indigo-100 text-indigo-800" },
  DONE: { label: "ตรวจเสร็จ", cls: "bg-emerald-100 text-emerald-800" },
  NO_SHOW: { label: "ไม่มา", cls: "bg-rose-100 text-rose-800" },
  CANCELLED: { label: "ยกเลิก", cls: "bg-zinc-100 text-zinc-500" },
};

export function StatusChip({ status }: { status: QueueStatus }) {
  const s = STATUS[status];
  return <span className={`rounded-md px-2 py-0.5 text-xs font-medium ${s.cls}`}>{s.label}</span>;
}

export function MockBanner() {
  return (
    <div className="bg-amber-50 px-4 py-1.5 text-center text-xs text-amber-800 border-b border-amber-200">
      Mockup — ข้อมูลทั้งหมดเป็นข้อมูลสมมติ ปุ่มต่าง ๆ ยังไม่บันทึกลงฐานข้อมูล
    </div>
  );
}
