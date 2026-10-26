// Timestamps are stored in UTC; everything shown to users is Asia/Bangkok (UTC+7, no DST).

const BKK_OFFSET_MS = 7 * 3600_000;
export const MINUTE = 60_000;

/** Bangkok calendar date "YYYY-MM-DD" of an instant. */
export function bkkDate(t: string | number): string {
  return new Date(new Date(t).getTime() + BKK_OFFSET_MS).toISOString().slice(0, 10);
}

/** ISO instant for a Bangkok wall-clock time, e.g. atBkk("2026-10-21", "08:00"). */
export function atBkk(date: string, hhmm: string): string {
  return new Date(new Date(`${date}T${hhmm}:00Z`).getTime() - BKK_OFFSET_MS).toISOString();
}

export function addDays(date: string, days: number): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** Bangkok hour 0-23 of an instant. */
export function bkkHour(t: string | number): number {
  return new Date(new Date(t).getTime() + BKK_OFFSET_MS).getUTCHours();
}

export function minutesSince(t: string, now: number): number {
  return Math.max(0, (now - new Date(t).getTime()) / MINUTE);
}

const timeFmt = new Intl.DateTimeFormat("th-TH", { timeZone: "Asia/Bangkok", hour: "2-digit", minute: "2-digit", hour12: false });
const dateFmt = new Intl.DateTimeFormat("th-TH", { timeZone: "Asia/Bangkok", weekday: "long", day: "numeric", month: "long", year: "numeric" });
const shortDateFmt = new Intl.DateTimeFormat("th-TH", { timeZone: "Asia/Bangkok", weekday: "short", day: "numeric", month: "short" });

export const fmtTime = (t: string | number) => timeFmt.format(new Date(t));
export const fmtDate = (t: string | number) => dateFmt.format(new Date(t));
export const fmtShortDate = (t: string | number) => shortDateFmt.format(new Date(t));
/** "YYYY-MM-DD" (Bangkok) → short Thai label. Noon avoids any day roll-over. */
export const fmtDay = (date: string) => fmtShortDate(atBkk(date, "12:00"));
