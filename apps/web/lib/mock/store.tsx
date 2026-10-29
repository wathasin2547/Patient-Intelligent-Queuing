"use client";

// Client-side mock store shared by the staff web app, the LIFF pages and the call display.
// State lives in a module-level store and is mirrored to localStorage so other tabs
// (e.g. /display) stay in sync. Replace `update(...)` calls with fetches to /api/* once the DB is ready.

import { createContext, useContext, useMemo, useSyncExternalStore } from "react";
import { runAutoCall } from "./logic";
import { buildSeed, MOCK_VERSION } from "./seed";
import { MINUTE } from "./time";
import type { MockState } from "./types";

const STORAGE_KEY = "piq-mock-state";
const TICK_MS = 10_000;
const POLL_MS = 5_000;

// NEXT_PUBLIC_DATA_MODE=real ใน .env = หน้า /staff อ่านข้อมูลจริงจาก DB
// (หน้า LIFF ยังใช้ข้อมูลสมมติจนกว่าจะถึงขั้นของ LIFF)
const REAL_MODE = process.env.NEXT_PUBLIC_DATA_MODE === "real";
let useReal = false;

type Snapshot = { state: MockState; realNow: number };

let snapshot: Snapshot | null = null;
let started = false;
const listeners = new Set<() => void>();

function load(): MockState {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const s = JSON.parse(raw) as MockState;
      if (s.version === MOCK_VERSION) return s;
    }
  } catch {
    // private window or blocked storage: fall back to a fresh seed
  }
  return buildSeed(Date.now());
}

function save(s: MockState) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(s));
  } catch {
    // ignore — the demo still works in memory
  }
}

const simNow = (s: MockState) => Date.now() + s.clockOffsetMs;

function publish(s: MockState, persist = true) {
  snapshot = { state: s, realNow: Date.now() };
  if (persist) save(s);
  listeners.forEach((l) => l());
}

/** Every change goes through UC13 auto-calling, so a freed doctor is always served. */
function commit(s: MockState) {
  publish(useReal ? s : runAutoCall(s, simNow(s)));
}

// ดึงข้อมูลล่าสุดจาก DB แล้วแทนที่ state ฝั่งหน้าเว็บ (ค่าที่เป็นของเบราว์เซอร์เองยังเก็บไว้ตามเดิม)
async function pull() {
  try {
    const res = await fetch("/api/state", { cache: "no-store" });
    if (!res.ok) return;
    const fresh = (await res.json()) as MockState;
    const prev = snapshot?.state;
    publish({ ...fresh, liffPatientId: prev?.liffPatientId ?? null, acknowledgedRedFlags: prev?.acknowledgedRedFlags ?? [] }, false);
  } catch {
    // เน็ตหลุดชั่วคราว รอบถัดไปลองใหม่
  }
}

// ส่งคิวที่เปลี่ยนสถานะ/เวลาไปบันทึกที่เซิร์ฟเวอร์ แล้วดึงข้อมูลจริงกลับมาทับ
// ถ้าเซิร์ฟเวอร์ปฏิเสธ (เช่น แพทย์กำลังตรวจอยู่) จะแจ้งเตือน และหน้าจอย้อนกลับเป็นค่าจริงเอง
async function sync(before: MockState, after: MockState) {
  const old = new Map(before.queues.map((q) => [q.id, q]));
  const changes = after.queues
    .filter((q) => {
      const o = old.get(q.id);
      return o && (o.status !== q.status || o.calledTime !== q.calledTime || o.finishedTime !== q.finishedTime);
    })
    .map((q) => ({ id: q.id, status: q.status, calledTime: q.calledTime, finishedTime: q.finishedTime }));
  if (changes.length === 0) return;

  try {
    const res = await fetch("/api/sync", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ queues: changes }),
    });
    if (!res.ok) {
      const body = (await res.json().catch(() => null)) as { error?: string } | null;
      window.alert(body?.error ?? "บันทึกไม่สำเร็จ");
    }
  } catch {
    window.alert("เชื่อมต่อเซิร์ฟเวอร์ไม่ได้");
  }
  await pull();
}

function start() {
  if (started) return;
  started = true;
  useReal = REAL_MODE && window.location.pathname.startsWith("/staff");
  if (useReal) {
    void pull();
    window.setInterval(pull, POLL_MS);
    return;
  }
  commit(load());
  window.setInterval(() => snapshot && commit(snapshot.state), TICK_MS);
  window.addEventListener("storage", (e) => {
    if (e.key !== STORAGE_KEY || !e.newValue) return;
    try {
      publish(JSON.parse(e.newValue) as MockState, false);
    } catch {
      // ignore malformed writes from other tabs
    }
  });
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  start();
  return () => listeners.delete(listener);
}

const actions = {
  update(fn: (s: MockState, now: number) => MockState) {
    if (!snapshot) return;
    const before = snapshot.state;
    const after = fn(before, simNow(before));
    commit(after);
    if (useReal) void sync(before, after);
  },
  advance(minutes: number) {
    if (useReal) return;
    if (snapshot) commit({ ...snapshot.state, clockOffsetMs: snapshot.state.clockOffsetMs + minutes * MINUTE });
  },
  reset() {
    if (useReal) return;
    const keep = snapshot?.state.sessionUserId ?? null;
    commit({ ...buildSeed(Date.now()), sessionUserId: keep });
  },
};

type Ctx = typeof actions & { state: MockState; now: number };
const MockContext = createContext<Ctx | null>(null);

export function MockProvider({ children }: { children: React.ReactNode }) {
  const snap = useSyncExternalStore(subscribe, () => snapshot, () => null);
  const value = useMemo<Ctx | null>(
    () => (snap ? { ...actions, state: snap.state, now: snap.realNow + snap.state.clockOffsetMs } : null),
    [snap],
  );
  if (!value) {
    return <div className="flex flex-1 items-center justify-center p-10 text-sm text-ink-3">กำลังโหลดข้อมูล…</div>;
  }
  return <MockContext.Provider value={value}>{children}</MockContext.Provider>;
}

export function useMock(): Ctx {
  const ctx = useContext(MockContext);
  if (!ctx) throw new Error("useMock must be used inside <MockProvider>");
  return ctx;
}

/** Convenience lookups used across pages. */
export function useLookups() {
  const { state } = useMock();
  return useMemo(() => {
    const dept = new Map(state.departments.map((d) => [d.id, d]));
    const doctor = new Map(state.doctors.map((d) => [d.id, d]));
    const patient = new Map(state.patients.map((p) => [p.id, p]));
    const screening = new Map(state.screenings.map((x) => [x.id, x]));
    const code = new Map(state.symptomCodes.map((c) => [c.code, c]));
    const user = new Map(state.users.map((u) => [u.id, u]));
    return { dept, doctor, patient, screening, code, user };
  }, [state]);
}
