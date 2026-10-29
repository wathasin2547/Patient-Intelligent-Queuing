import { LEVEL } from "./ui";
import type { Level } from "@/lib/mock/types";

export type BarDatum = { key: string; label: string; value: number; detail?: string; flag?: string; future?: boolean };
export function HBarChart({ data, unit }: { data: BarDatum[]; unit: string }) {
  const top = Math.max(...data.map((d) => d.value), 1);
  return (
    <ul className="flex flex-col gap-4">
      {data.map((d) => (
        <li key={d.key} className="group relative">
          <div className="mb-1.5 flex items-baseline justify-between gap-3 text-sm">
            <span className="flex min-w-0 items-center gap-2">
              <span className="truncate text-ink-2">{d.label}</span>
              {d.flag && <span className="rounded-full bg-rose-50 px-2 py-0.5 text-[11px] font-medium text-rose-700">{d.flag}</span>}
            </span>
            <span className="shrink-0 tabular-nums">
              <span className="font-semibold">{d.value}</span> <span className="text-xs text-ink-3">{unit}</span>
            </span>
          </div>
          <div className="h-2.5 rounded-full bg-subtle">
            <div className="h-2.5 rounded-full bg-primary transition-[width] group-hover:bg-primary-strong" style={{ width: `${(d.value / top) * 100}%`, minWidth: d.value ? 10 : 0 }} />
          </div>
          {d.detail && (
            <div className="pointer-events-none absolute -top-8 right-0 z-10 hidden whitespace-nowrap rounded-full bg-ink px-3 py-1 text-[11px] text-white group-hover:block">
              {d.detail}
            </div>
          )}
        </li>
      ))}
    </ul>
  );
}

/** Columns over time; the highlighted column (current hour) is navy with its value pinned above. */
export function ColumnChart({ data, highlight, unit }: { data: BarDatum[]; highlight?: string; unit: string }) {
  const top = Math.max(...data.map((d) => d.value), 1);
  const ceil = niceCeil(top);
  return (
    <div>
      <div className="relative h-44">
        {[0, 0.5, 1].map((f) => (
          <div key={f} className="absolute inset-x-0 border-t border-line/70" style={{ bottom: `${f * 100}%` }}>
            <span className="absolute -top-2.5 right-0 bg-surface pl-1 text-[10px] tabular-nums text-ink-3">{Math.round(ceil * f)}</span>
          </div>
        ))}
        <div className="absolute inset-y-0 left-0 right-6 flex items-end justify-around gap-1">
          {data.map((d) => {
            const on = d.key === highlight;
            return (
              <div key={d.key} className="group relative flex h-full flex-1 items-end justify-center">
                {d.future ? (
                  // not reached yet — an empty dashed slot, not a zero
                  <div className="h-full w-full max-w-8 rounded-full border border-dashed border-ink-3/40" />
                ) : (
                  <div
                    className={`w-full max-w-8 rounded-t-[12px] rounded-b-[4px] transition-colors ${on ? "bg-ink" : "bg-ocean-300 group-hover:bg-primary"}`}
                    style={{ height: `${(d.value / ceil) * 100}%`, minHeight: d.value ? 6 : 0 }}
                  />
                )}
                <div
                  className={`pointer-events-none absolute z-10 mb-2 whitespace-nowrap rounded-full bg-ink px-2.5 py-1 text-[11px] text-white ${on ? "block" : d.future ? "hidden" : "hidden group-hover:block"}`}
                  style={{ bottom: `${(d.value / ceil) * 100}%` }}
                >
                  {on ? `${d.value} ${unit}` : `${d.label} · ${d.value} ${unit}`}
                </div>
              </div>
            );
          })}
        </div>
      </div>
      <div className="mr-6 mt-2 flex justify-around gap-1">
        {data.map((d) => (
          <span key={d.key} className={`flex-1 text-center text-[11px] tabular-nums ${d.key === highlight ? "font-semibold text-ink" : "text-ink-3"}`}>
            {d.key}
          </span>
        ))}
      </div>
    </div>
  );
}

function niceCeil(max: number): number {
  const step = max <= 6 ? 2 : max <= 20 ? 5 : 10;
  return Math.ceil(max / step) * step;
}

/** Composition of the waiting line by triage level: one capsule bar + a count per level. */
export function LevelBreakdown({ counts }: { counts: { level: Level; value: number }[] }) {
  const total = counts.reduce((s, c) => s + c.value, 0);
  return (
    <div>
      <div className="flex h-3 gap-[3px]">
        {total === 0 && <div className="h-3 flex-1 rounded-full bg-subtle" />}
        {counts.filter((c) => c.value).map((c) => (
          <div key={c.level} className={`h-3 rounded-full ${LEVEL[c.level].dot}`} style={{ width: `${(c.value / total) * 100}%` }} title={`${LEVEL[c.level].name} ${c.value} ราย`} />
        ))}
      </div>
      <div className="mt-5 grid grid-cols-4 gap-2">
        {counts.map((c) => (
          <div key={c.level} className="rounded-2xl bg-subtle px-3 py-3">
            <div className="flex items-center gap-1.5 text-xs text-ink-2">
              <span className={`h-2 w-2 rounded-full ${LEVEL[c.level].dot}`} />
              {LEVEL[c.level].name}
            </div>
            <div className="mt-1 text-2xl font-light tabular-nums">{c.value}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
