import { prisma } from "@/lib/prisma";
import { bkkDate } from "@/lib/mock/time";

const COLLECTION = "QueueCounter";
let indexReady: Promise<unknown> | null = null;

function ensureIndex() {
  indexReady ??= prisma
    .$runCommandRaw({
      createIndexes: COLLECTION,
      indexes: [{ key: { key: 1 }, name: "key_unique", unique: true }],
    })
    .catch((err) => {
      indexReady = null;
      throw err;
    });
  return indexReady;
}

function toNumber(v: unknown): number {
  if (typeof v === "number") return v;
  if (v && typeof v === "object") {
    const o = v as Record<string, string>;
    const raw = o.$numberInt ?? o.$numberLong ?? o.$numberDouble;
    if (raw !== undefined) return Number(raw);
  }
  throw new Error("unexpected counter value");
}

async function highestToday(departmentId: string, day: string): Promise<number> {
  const startOfDay = new Date(new Date(`${day}T00:00:00Z`).getTime() - 7 * 3600_000);
  const rows = await prisma.queue.findMany({
    where: { departmentId, checkInTime: { gte: startOfDay } },
    select: { queueNumber: true },
  });
  return rows.reduce((max, r) => Math.max(max, Number(r.queueNumber.split("-").pop()) || 0), 0);
}

export async function issueQueueNumber(departmentId: string): Promise<string> {
  const dept = await prisma.department.findUnique({ where: { id: departmentId }, select: { code: true } });
  const day = bkkDate(Date.now());
  const key = `${departmentId}:${day}`;

  await ensureIndex();

  await prisma.$runCommandRaw({
    update: COLLECTION,
    updates: [{ q: { key }, u: { $setOnInsert: { key, seq: await highestToday(departmentId, day) } }, upsert: true }],
  });

  const res = (await prisma.$runCommandRaw({
    findAndModify: COLLECTION,
    query: { key },
    update: { $inc: { seq: 1 } },
    new: true,
  })) as { value?: { seq?: unknown } };
  if (!res.value) throw new Error("queue counter missing");

  return `${dept?.code ?? "Q"}-${String(toNumber(res.value.seq)).padStart(3, "0")}`;
}