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
  CALLED: { label: "เรียกแล้ว", cls: "bg-accent text-accent-ink" },
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
  ARRIVED: { label: "มาถึงแล้ว", cls: "bg-accent text-accent-ink" },
  CANCELLED: { label: "ยกเลิกนัด", cls: "bg-subtle text-ink-3 line-through" },
  MISSED: { label: "ไม่มาตามนัด", cls: "bg-rose-50 text-rose-700" },
};

type Tone = "neutral" | "accent" | "ink" | "rose" | "amber" | "sky";
const TONE: Record<Tone, string> = {
  neutral: "bg-subtle text-ink-2",
  accent: "bg-accent text-accent-ink",
  ink: "bg-ink text-white",
  rose: "bg-rose-50 text-rose-700",
  amber: "bg-amber-50 text-amber-800",
  sky: "bg-ocean-100 text-ocean-950",
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
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-ocean-100 text-ocean-950">
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

/** Pill tabs: the active one is solid navy, the others turn light blue on hover. */
export function Segmented<T extends string>({ value, options, onChange }: { value: T; options: { value: T; label: string }[]; onChange: (v: T) => void }) {
  return (
    <div className="flex flex-wrap gap-1.5" role="tablist">
      {options.map((o) => (
        <button
          key={o.value}
          role="tab"
          aria-selected={value === o.value}
          onClick={() => onChange(o.value)}
          className={`min-h-10 rounded-full px-4 py-2 text-sm transition ${value === o.value ? "bg-ink font-medium text-white shadow-card" : "bg-surface text-ink-2 ring-1 ring-line hover:bg-subtle hover:text-ink hover:ring-primary/40"}`}
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

// Hover darkens/fills, press nudges down 1px; disabled is visibly flat. Min height 40px for touch.
const BTN = "inline-flex min-h-10 items-center justify-center gap-2 rounded-full text-sm font-medium transition active:translate-y-px disabled:pointer-events-none disabled:opacity-45";
export const btn = {
  // main action: yellow with dark text — stands out against the blue brand and the neutral page
  primary: `${BTN} bg-cta px-5 py-2.5 font-semibold text-ink ring-1 ring-cta-edge shadow-[0_6px_16px_-8px_rgba(217,154,0,0.9)] hover:bg-cta-strong hover:shadow-[0_8px_22px_-8px_rgba(217,154,0,1)]`,
  // blue brand button (login)
  brand: `${BTN} bg-primary px-5 py-2.5 text-white shadow-[0_6px_16px_-8px_rgba(0,119,182,0.7)] hover:bg-primary-strong hover:shadow-[0_8px_20px_-8px_rgba(2,62,138,0.8)]`,
  accent: `${BTN} bg-accent px-5 py-2.5 text-accent-ink hover:bg-accent-strong`,
  secondary: `${BTN} bg-surface px-5 py-2.5 text-ink ring-1 ring-ink/25 hover:bg-subtle hover:ring-ink/60`,
  danger: `${BTN} bg-surface px-5 py-2.5 text-rose-700 ring-1 ring-rose-200 hover:bg-rose-50 hover:ring-rose-300`,
  small: `${BTN} min-h-8 px-3.5 py-1.5 text-xs`,
  primarySmall: `${BTN} min-h-8 bg-cta px-3.5 py-1.5 text-xs font-semibold text-ink ring-1 ring-cta-edge hover:bg-cta-strong`,
  icon: "inline-flex h-10 w-10 items-center justify-center rounded-full bg-surface text-ink-2 ring-1 ring-line transition hover:bg-subtle hover:text-primary-strong hover:ring-primary/50",
  link: "text-sm font-medium text-primary-strong underline decoration-ocean-300 decoration-2 underline-offset-4 hover:text-ink hover:decoration-primary",
};

export function Notice({ tone = "neutral", children }: { tone?: "neutral" | "accent" | "rose" | "amber" | "sky"; children: React.ReactNode }) {
  const cls = {
    neutral: "bg-subtle text-ink-2 border-line",
    accent: "bg-ocean-100 text-accent-ink border-ocean-300",
    rose: "bg-rose-50 text-rose-800 border-rose-200",
    amber: "bg-amber-50 text-amber-900 border-amber-200",
    sky: "bg-ocean-100 text-ocean-950 border-ocean-300",
  }[tone];
  return <div className={`rounded-xl border-l-4 px-4 py-3 text-sm ${cls}`}>{children}</div>;
}

export function Avatar({ text, dark }: { text: string; dark?: boolean }) {
  return (
    <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${dark ? "bg-ink text-white" : "bg-ocean-100 text-ocean-950"}`}>
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
    <span className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-full bg-accent px-3 py-1 text-[11px] font-medium text-accent-ink" title="ยังไม่เชื่อมฐานข้อมูล ข้อมูลเก็บไว้ในเบราว์เซอร์นี้เท่านั้น">
      <span className="h-1.5 w-1.5 rounded-full bg-accent-ink" />
      ข้อมูลสมมติ
    </span>
  );
}

export function Empty({ children }: { children: React.ReactNode }) {
  return <div className="rounded-xl border border-dashed border-line bg-canvas/60 px-4 py-6 text-center text-sm text-ink-3">{children}</div>;
}
