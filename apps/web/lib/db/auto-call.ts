import { loadState } from "@/lib/db/state";
import { sendToPatient } from "@/lib/line/notify";
import { runAutoCall } from "@/lib/mock/logic";
import { prisma } from "@/lib/prisma";

export type TickResult = { changedQueues: number; messages: number; reminders: number };

const MIN_INTERVAL_MS = 3000;
const IDLE: TickResult = { changedQueues: 0, messages: 0, reminders: 0 };

const shared = globalThis as unknown as { piqTick?: { running: Promise<TickResult> | null; last: number } };
const tickState = (shared.piqTick ??= { running: null, last: 0 });

async function callPatients(now: number): Promise<Omit<TickResult, "reminders">> {
  const state = await loadState();
  const next = runAutoCall(state, now);
  const before = new Map(state.queues.map((q) => [q.id, q]));

  let changedQueues = 0;
  for (const q of next.queues) {
    const old = before.get(q.id);
    if (!old || old.status === q.status) continue;
    const { count } = await prisma.queue.updateMany({
      where: { id: q.id, status: old.status },
      data: {
        status: q.status,
        calledTime: q.calledTime ? new Date(q.calledTime) : null,
        finishedTime: q.finishedTime ? new Date(q.finishedTime) : null,
      },
    });
    changedQueues += count;
  }

  let messages = 0;
  if (changedQueues > 0) {
    for (const n of next.notifications) {
      if (await sendToPatient(n.patientId, n.text)) messages += 1;
    }
  }
  return { changedQueues, messages };
}

async function remindRefills(now: number): Promise<number> {
  const due = await prisma.refillSchedule.findMany({
    where: { status: "PENDING", remindedAt: null, dueDate: { lte: new Date(now) } },
  });
  let reminders = 0;
  for (const r of due) {
    const { count } = await prisma.refillSchedule.updateMany({
      where: { id: r.id, status: "PENDING" },
      data: { status: "SENT", remindedAt: new Date(now) },
    });
    if (count === 0) continue;
    reminders += 1;
    await sendToPatient(r.patientId, 'ใกล้ถึงกำหนดรับยารอบถัดไปแล้ว พิมพ์ "ตรวจ" เพื่อรับคิวติดตามอาการ');
  }
  return reminders;
}

export function autoCallTick(force = false): Promise<TickResult> {
  if (tickState.running) return tickState.running;
  const now = Date.now();
  if (!force && now - tickState.last < MIN_INTERVAL_MS) return Promise.resolve(IDLE);
  tickState.last = now;
  tickState.running = (async () => {
    const called = await callPatients(now);
    return { ...called, reminders: await remindRefills(now) };
  })().finally(() => {
    tickState.running = null;
  });
  return tickState.running;
}
