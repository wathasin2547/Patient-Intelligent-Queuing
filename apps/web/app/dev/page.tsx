import { Activity, ArrowUpRight, CalendarDays, LayoutGrid, ListOrdered, LogIn, MonitorPlay, Pill, SlidersHorizontal, Smartphone, Stethoscope, Ticket, UserRound, type LucideIcon } from "lucide-react";
import Link from "next/link";
import { MockBadge } from "@/components/ui";

type Item = { href: string; title: string; uc: string; icon: LucideIcon };

const STAFF: Item[] = [
  { href: "/login", title: "เข้าสู่ระบบ", uc: "UC02", icon: LogIn },
  { href: "/staff", title: "ภาพรวมคิว (Dashboard)", uc: "UC07 → UC10", icon: LayoutGrid },
  { href: "/staff/queues", title: "จัดการคิวและการเรียกคิว", uc: "UC08 · UC10 · UC13", icon: ListOrdered },
  { href: "/staff/doctor", title: "คิวของฉัน (แพทย์)", uc: "UC09 · DOCTOR", icon: Stethoscope },
  { href: "/staff/schedule", title: "ตารางเวรและคิวนัดหมาย", uc: "UC11", icon: CalendarDays },
  { href: "/staff/master", title: "ข้อมูลพื้นฐานของระบบ", uc: "UC12 · ADMIN", icon: SlidersHorizontal },
];
const PATIENT: Item[] = [
  { href: "/liff", title: "เมนูผู้ป่วยบน LINE", uc: "UC02", icon: Smartphone },
  { href: "/liff/register", title: "ลงทะเบียน", uc: "UC01", icon: UserRound },
  { href: "/liff/queue", title: "ติดตามสถานะคิว", uc: "UC05", icon: Ticket },
  { href: "/liff/medicine", title: "เลือกวิธีรับยา", uc: "UC06", icon: Pill },
];

export default function Home() {
  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-10 sm:px-8 sm:py-14">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-full bg-brand text-accent"><Activity size={19} strokeWidth={2.2} /></span>
          <span className="font-semibold">PIQ</span>
        </div>
        <MockBadge />
      </div>

      <h1 className="mt-12 max-w-3xl text-[40px] font-medium leading-[1.12] tracking-tight sm:text-[56px]">
        ระบบจัดการคิว
        <span className="mx-3 inline-flex h-11 w-20 translate-y-1 items-center justify-center rounded-full bg-accent align-baseline sm:h-14 sm:w-24"><ListOrdered size={24} strokeWidth={2} /></span>
        ผู้ป่วยอัจฉริยะ
      </h1>
      <p className="mt-4 max-w-xl text-ink-2">
        หน้าเว็บทั้งหมดของระบบ แยกตามผู้ใช้งาน · ซักประวัติ (UC03) ทำในห้องแชท LINE ส่วนการคัดกรอง (UC04) ทำที่ Python service
      </p>

      <div className="mt-10 grid gap-5 lg:grid-cols-[1.4fr_1fr]">
        <Group title="บุคลากรทางการแพทย์" sub="เว็บแอปพลิเคชัน" items={STAFF} />
        <div className="flex flex-col gap-5">
          <Group title="ผู้ป่วย" sub="LINE OA / LIFF" items={PATIENT} />
          <Link href="/display" className="group flex items-center justify-between rounded-card bg-brand p-6 text-white transition hover:bg-primary-strong">
            <div className="flex items-center gap-4">
              <span className="flex h-11 w-11 items-center justify-center rounded-full bg-accent text-ink"><MonitorPlay size={19} strokeWidth={1.8} /></span>
              <div>
                <div className="font-medium">จอเรียกคิวหน้าห้องตรวจ</div>
                <div className="text-xs text-white/50">UC13 · ระบบเรียกคิวเอง</div>
              </div>
            </div>
            <ArrowUpRight size={20} strokeWidth={1.8} className="text-white/50 transition group-hover:text-accent" />
          </Link>
        </div>
      </div>
    </div>
  );
}

function Group({ title, sub, items }: { title: string; sub: string; items: Item[] }) {
  return (
    <section className="card">
      <div className="mb-4">
        <h2 className="text-[17px] font-semibold tracking-tight">{title}</h2>
        <p className="text-xs text-ink-3">{sub}</p>
      </div>
      <div className="flex flex-col gap-1.5">
        {items.map((i) => (
          <Link key={i.href} href={i.href} className="group flex items-center gap-4 rounded-2xl bg-subtle px-4 py-3.5 transition hover:bg-ink hover:text-white">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-surface text-ink"><i.icon size={18} strokeWidth={1.8} /></span>
            <div className="min-w-0 flex-1">
              <div className="font-medium">{i.title}</div>
              <div className="text-xs text-ink-3 group-hover:text-white/50">{i.uc}</div>
            </div>
            <ArrowUpRight size={18} strokeWidth={1.8} className="text-ink-3 group-hover:text-accent" />
          </Link>
        ))}
      </div>
    </section>
  );
}
