import { prisma } from "@/lib/prisma";

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

export async function issueHn(): Promise<string> {
  await ensureIndex();
  const res = (await prisma.$runCommandRaw({
    findAndModify: COLLECTION,
    query: { key: "HN" },
    update: { $inc: { seq: 1 } },
    new: true,
    upsert: true,
  })) as { value?: { seq?: unknown } };
  if (!res.value) throw new Error("hn counter missing");
  return "HN" + String(toNumber(res.value.seq)).padStart(7, "0");
}