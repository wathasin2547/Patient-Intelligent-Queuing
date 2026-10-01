import Link from "next/link";
import { MockBanner } from "./_ui";

const STAFF = [
  { href: "/mockup/login", title: "เข้าสู่ระบบ", uc: "UC02" },
  { href: "/mockup/staff", title: "ติดตามภาพรวมคิว", uc: "UC07" },
  { href: "/mockup/staff/queue/q7", title: "ตรวจสอบ/แก้ไขผลคัดกรอง + บันทึกผลตรวจ", uc: "UC08, UC09 → UC10" },
  { href: "/mockup/staff/shifts", title: "ตารางเวรแพทย์", uc: "UC11" },
];
const PATIENT = [
  { href: "/mockup/liff/register", title: "ลงทะเบียน", uc: "UC01" },
  { href: "/mockup/liff/screening", title: "ซักประวัติผ่านแชทบอท", uc: "UC03 → UC04" },
  { href: "/mockup/liff/queue", title: "ติดตามสถานะคิว", uc: "UC05" },
];

export default function MockupIndex() {
  return (
    <div className="min-h-screen bg-zinc-50">
      <MockBanner />
      <div className="mx-auto max-w-3xl px-6 py-10">
        <h1 className="text-2xl font-semibold">PIQ — Mockup หน้าจอ</h1>
        <p className="mt-1 text-sm text-zinc-500">กดเข้าไปดูแต่ละหน้า ปุ่มส่วนใหญ่กดได้เพื่อดูการทำงาน</p>
        <Group title="บุคลากรทางการแพทย์ (เว็บ)" items={STAFF} />
        <Group title="ผู้ป่วย (LINE / LIFF)" items={PATIENT} />
      </div>
    </div>
  );
}

function Group({ title, items }: { title: string; items: { href: string; title: string; uc: string }[] }) {
  return (
    <section className="mt-8">
      <h2 className="text-sm font-semibold text-zinc-500">{title}</h2>
      <div className="mt-2 grid gap-2 sm:grid-cols-2">
        {items.map((i) => (
          <Link key={i.href} href={i.href} className="rounded-xl bg-white px-4 py-3 ring-1 ring-zinc-200 hover:ring-teal-500">
            <div className="font-medium">{i.title}</div>
            <div className="text-xs text-zinc-500">{i.uc}</div>
          </Link>
        ))}
      </div>
    </section>
  );
}
