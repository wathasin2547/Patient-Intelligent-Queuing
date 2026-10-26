import type { LucideIcon } from "lucide-react";
import type { AppointmentStatus, Level, QueueStatus } from "@/lib/mock/types";

// Triage colours follow the hospital scale in the report (แดง ส้ม เหลือง เขียว ขาว).
// Colour only marks the dot; the level name is always written next to it.
export const LEVEL: Record<Level, { name: string; dot: string }> = {
  1: { name: "แดง", dot: "bg-red-500" },
  2: { name: "ส้ม", dot: "bg-orange-500" },
  3: { name: "เหลือง", dot: "bg-amber-400" },
  4: { name: "เขียว", dot: "bg-emerald-500" },
  5: { name: "ขาว", dot: "bg-white ring-1 ring-inset ring-ink-3" },
};

export function LevelDot({ level, className = "h-2.5 w-2.5" }: { level: Level; className?: string }) {
  return <span className={`inline-block shrink-0 rounded-full ${LEVEL[level].dot} ${className}`} />;
}

export function LevelChip({ level, short }: { level: Level; short?: boolean }) {
  return (
    <span className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-full bg-subtle px-2.5 py-1 text-xs text-ink-2">
      <LevelDot level={level} className="h-2 w-2" />
      {short ? LEVEL[level].name : `ระดับ ${level} · ${LEVEL[level].name}`}
    </span>
  );
}

export const QUEUE_STATUS: Record<QueueStatus, { label: string; cls: string }> = {
  WAITING: { label: "รอเรียก", cls: "bg-subtle text-ink-2" },
  CALLED: { label: "เรียกแล้ว", cls: "bg-lime text-lime-ink" },
  IN_PROGRESS: { label: "กำลังตรวจ", cls: "bg-ink text-white" },
  DONE: { label: "ตรวจเสร็จ", cls: "bg-emerald-50 text-emerald-700" },
  NO_SHOW: { label: "ไม่มา", cls: "bg-rose-50 text-rose-700" },
  CANCELLED: { label: "ยกเลิก", cls: "bg-subtle text-ink-3" },
};

export function StatusChip({ status }: { status: QueueStatus }) {
  const s = QUEUE_STATUS[status];
  return <span className={`whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-medium ${s.cls}`}>{s.label}</span>;
}

export const APPOINTMENT_STATUS: Record<AppointmentStatus, { label: string; cls: string }> = {
  SCHEDULED: { label: "รอมาตามนัด", cls: "bg-subtle text-ink-2" },
  ARRIVED: { label: "มาถึงแล้ว", cls: "bg-lime text-lime-ink" },
  CANCELLED: { label: "ยกเลิกนัด", cls: "bg-subtle text-ink-3 line-through" },
  MISSED: { label: "ไม่มาตามนัด", cls: "bg-rose-50 text-rose-700" },
};

type Tone = "neutral" | "lime" | "ink" | "rose" | "amber" | "sky";
const TONE: Record<Tone, string> = {
  neutral: "bg-subtle text-ink-2",
  lime: "bg-lime text-lime-ink",
  ink: "bg-ink text-white",
  rose: "bg-rose-50 text-rose-700",
  amber: "bg-amber-50 text-amber-800",
  sky: "bg-sky-50 text-sky-800",
};

export function Tag({ children, tone = "neutral" }: { children: React.ReactNode; tone?: Tone }) {
  return <span className={`whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-medium ${TONE[tone]}`}>{children}</span>;
}

export function Card({
  title, note, action, icon: Icon, children, className = "",
}: { title?: React.ReactNode; note?: React.ReactNode; action?: React.ReactNode; icon?: LucideIcon; children: React.ReactNode; className?: string }) {
  return (
    <section className={`card ${className}`}>
      {(title || action) && (
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            {Icon && (
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-subtle text-ink">
                <Icon size={17} strokeWidth={1.8} />
              </span>
            )}
            <div className="min-w-0">
              {title && <h2 className="text-[17px] font-semibold tracking-tight">{title}</h2>}
              {note && <p className="text-xs text-ink-3">{note}</p>}
            </div>
          </div>
          {action}
        </div>
      )}
      {children}
    </section>
  );
}

export function PageHeader({ title, subtitle, children }: { title: string; subtitle?: React.ReactNode; children?: React.ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="text-[28px] font-semibold leading-tight tracking-tight sm:text-[32px]">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-ink-3">{subtitle}</p>}
      </div>
      {children}
    </div>
  );
}

/** Pill tabs: the active one is solid ink. */
export function Segmented<T extends string>({ value, options, onChange }: { value: T; options: { value: T; label: string }[]; onChange: (v: T) => void }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {options.map((o) => (
        <button
          key={o.value}
          onClick={() => onChange(o.value)}
          className={`rounded-full px-4 py-2 text-sm transition ${value === o.value ? "bg-ink text-white" : "bg-surface text-ink-2 ring-1 ring-line hover:text-ink"}`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function PillSelect({ value, onChange, children, className = "" }: { value: string; onChange: (v: string) => void; children: React.ReactNode; className?: string }) {
  return (
    <select value={value} onChange={(e) => onChange(e.target.value)} className={`pill ${className}`}>
      {children}
    </select>
  );
}

export function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-medium text-ink-2">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-[11px] text-ink-3">{hint}</span>}
    </label>
  );
}

const BTN = "inline-flex items-center justify-center gap-2 rounded-full text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-40";
export const btn = {
  primary: `${BTN} bg-ink px-5 py-2.5 text-white hover:bg-black`,
  accent: `${BTN} bg-lime px-5 py-2.5 text-lime-ink hover:bg-lime-strong`,
  secondary: `${BTN} bg-surface px-5 py-2.5 text-ink ring-1 ring-line hover:bg-subtle`,
  danger: `${BTN} bg-surface px-5 py-2.5 text-rose-700 ring-1 ring-rose-200 hover:bg-rose-50`,
  small: `${BTN} px-3.5 py-1.5 text-xs`,
  icon: "inline-flex h-10 w-10 items-center justify-center rounded-full bg-surface text-ink-2 ring-1 ring-line transition hover:text-ink",
  link: "text-sm font-medium text-ink underline decoration-line underline-offset-4 hover:decoration-ink",
};

export function Notice({ tone = "neutral", children }: { tone?: "neutral" | "lime" | "rose" | "amber" | "sky"; children: React.ReactNode }) {
  const cls = {
    neutral: "bg-subtle text-ink-2",
    lime: "bg-lime/60 text-lime-ink",
    rose: "bg-rose-50 text-rose-800",
    amber: "bg-amber-50 text-amber-900",
    sky: "bg-sky-50 text-sky-900",
  }[tone];
  return <div className={`rounded-2xl px-4 py-3 text-sm ${cls}`}>{children}</div>;
}

export function Avatar({ text, dark }: { text: string; dark?: boolean }) {
  return (
    <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${dark ? "bg-ink text-white" : "bg-subtle text-ink"}`}>
      {text}
    </span>
  );
}

/** Short avatar text for a doctor: department code initial + trailing number ("M1"). */
export function doctorInitials(name: string, deptCode?: string) {
  return `${(deptCode ?? "D").charAt(0)}${name.match(/\d+$/)?.[0] ?? ""}`;
}

export function MockBadge() {
  return (
    <span className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-full bg-lime px-3 py-1 text-[11px] font-medium text-lime-ink" title="ยังไม่เชื่อมฐานข้อมูล ข้อมูลเก็บไว้ในเบราว์เซอร์นี้เท่านั้น">
      <span className="h-1.5 w-1.5 rounded-full bg-lime-ink" />
      ข้อมูลสมมติ
    </span>
  );
}

export function Empty({ children }: { children: React.ReactNode }) {
  return <div className="rounded-2xl border border-dashed border-line px-4 py-6 text-center text-sm text-ink-3">{children}</div>;
}
