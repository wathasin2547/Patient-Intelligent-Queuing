import { prisma } from "@/lib/prisma";
import { bkkDate } from "@/lib/mock/time";

const COLLECTION = "QueueCounter";
let indexReady: Promise<unknown> | null = null;

// สร้าง unique index ให้ key (ทำครั้งเดียวต่อรอบที่เซิร์ฟเวอร์ทำงาน)
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

// ค่าที่ MongoDB ส่งกลับอาจเป็นเลขธรรมดา หรือ { $numberLong: "5" }
function toNumber(v: unknown): number {
  if (typeof v === "number") return v;
  if (v && typeof v === "object") {
    const o = v as Record<string, string>;
    const raw = o.$numberInt ?? o.$numberLong ?? o.$numberDouble;
    if (raw !== undefined) return Number(raw);
  }
  throw new Error("unexpected counter value");
}

// เลขสูงสุดที่ใช้ไปแล้ววันนี้ (กรณีมีคิวเก่าก่อนมีตัวนับ)
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

  // 1) ถ้ายังไม่มีตัวนับของวันนี้ ให้สร้าง โดยเริ่มจากเลขสูงสุดที่ใช้ไปแล้ว
  await prisma.$runCommandRaw({
    update: COLLECTION,
    updates: [{ q: { key }, u: { $setOnInsert: { key, seq: await highestToday(departmentId, day) } }, upsert: true }],
  });

  // 2) บวก 1 และเอาค่าใหม่คืนมา ในคำสั่งเดียว
  const res = (await prisma.$runCommandRaw({
    findAndModify: COLLECTION,
    query: { key },
    update: { $inc: { seq: 1 } },
    new: true,
  })) as { value?: { seq?: unknown } };
  if (!res.value) throw new Error("queue counter missing");

  return `${dept?.code ?? "Q"}-${String(toNumber(res.value.seq)).padStart(3, "0")}`;
}