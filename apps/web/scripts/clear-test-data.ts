import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const apply = process.argv.includes("--yes");

async function main() {
  const patients = await prisma.patient.findMany({ where: { lineUserId: { startsWith: "U-test-" } }, select: { id: true } });
  const patientIds = patients.map((p) => p.id);
  const queues = await prisma.queue.findMany({ where: { patientId: { in: patientIds } }, select: { id: true } });
  const queueIds = queues.map((q) => q.id);
  const rx = await prisma.prescription.findMany({ where: { queueId: { in: queueIds } }, select: { id: true } });
  const rxIds = rx.map((r) => r.id);

  console.log(`ผู้ป่วยทดสอบ ${patientIds.length} ราย · คิว ${queueIds.length} · ใบสั่งยา ${rxIds.length}`);
  if (!apply) {
    console.log("ยังไม่ได้ลบอะไร ถ้ารายการถูกต้องให้รันซ้ำพร้อม --yes");
    return;
  }

  await prisma.delivery.deleteMany({ where: { prescriptionId: { in: rxIds } } });
  await prisma.refillSchedule.deleteMany({ where: { patientId: { in: patientIds } } });
  await prisma.prescription.deleteMany({ where: { id: { in: rxIds } } });
  await prisma.queue.deleteMany({ where: { patientId: { in: patientIds } } });
  await prisma.screening.deleteMany({ where: { patientId: { in: patientIds } } });
  await prisma.appointment.deleteMany({ where: { patientId: { in: patientIds } } });
  await prisma.patient.deleteMany({ where: { id: { in: patientIds } } });
  console.log("ลบเรียบร้อย");
}

main().finally(() => prisma.$disconnect());