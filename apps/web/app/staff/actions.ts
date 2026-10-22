"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";

export async function callQueue(id: string) {
  await prisma.queue.update({
    where: { id },
    data: { status: "CALLED", calledTime: new Date() },
  });
  revalidatePath("/staff");
}

export async function finishQueue(id: string) {
  await prisma.queue.update({
    where: { id },
    data: { status: "DONE", finishedTime: new Date() },
  });
  revalidatePath("/staff");
}

// เรียกคิวถัดไป: เร่งด่วนสุดก่อน ถ้าเท่ากันเอาคนมาก่อน
export async function callNext() {
  const next = await prisma.queue.findFirst({
    where: { status: "WAITING" },
    orderBy: [{ priorityLevel: "asc" }, { checkInTime: "asc" }],
  });
  if (next) await callQueue(next.id);
}