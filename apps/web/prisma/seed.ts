// Seeds the development database with MOCK data. Wipes every PIQ collection first.
// Run: npx prisma db seed

import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { departments, doctors, questions, symptomCodes, type DeptKey } from "./seed-data";

const prisma = new PrismaClient();

const BANGKOK_OFFSET_HOURS = 7;
const SHIFT_DAYS = 7;

// Bangkok local time -> UTC Date (Asia/Bangkok has no DST)
function bangkokToUtc(y: number, m: number, d: number, hour: number): Date {
  return new Date(Date.UTC(y, m, d, hour - BANGKOK_OFFSET_HOURS));
}

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Set ${name} in .env before seeding (see .env.example)`);
  }
  return value;
}

async function clearAll() {
  // children before parents
  await prisma.delivery.deleteMany();
  await prisma.refillSchedule.deleteMany();
  await prisma.prescription.deleteMany();
  await prisma.queue.deleteMany();
  await prisma.screening.deleteMany();
  await prisma.patient.deleteMany();
  await prisma.shift.deleteMany();
  await prisma.doctor.deleteMany();
  await prisma.user.deleteMany();
  await prisma.question.deleteMany();
  await prisma.symptomCode.deleteMany();
  await prisma.department.deleteMany();
}

async function main() {
  if (process.env.NODE_ENV === "production") {
    throw new Error("Refusing to seed a production database");
  }
  const adminPassword = requireEnv("SEED_ADMIN_PASSWORD");
  const staffPassword = requireEnv("SEED_STAFF_PASSWORD");

  await clearAll();

  const deptId = {} as Record<DeptKey, string>;
  for (const d of departments) {
    const created = await prisma.department.create({
      data: { name: d.name, scopeOfCare: d.scopeOfCare },
    });
    deptId[d.key] = created.id;
  }

  await prisma.symptomCode.createMany({
    data: symptomCodes.map((s) => ({
      code: s.code,
      label: s.label,
      synonyms: s.synonyms,
      // stored keyed by departmentId, as in SPEC §2
      departmentWeights: Object.fromEntries(
        Object.entries(s.weights).map(([key, w]) => [deptId[key as DeptKey], w]),
      ),
      isRedFlag: s.isRedFlag ?? false,
      onsiteOnly: s.onsiteOnly ?? false,
      priorityHint: s.priorityHint ?? null,
    })),
  });

  const knownCodes = new Set(symptomCodes.map((s) => s.code));
  for (const q of questions) {
    for (const o of q.options) {
      if (o.symptomCode && !knownCodes.has(o.symptomCode)) {
        throw new Error(`Question "${q.questionText}" uses unknown code ${o.symptomCode}`);
      }
    }
  }
  await prisma.question.createMany({
    data: questions.map((q) => ({
      questionText: q.questionText,
      group: q.group,
      order: q.order,
      options: q.options,
      dependsOn: q.dependsOn ?? undefined,
    })),
  });

  const now = new Date();
  // "today" in Bangkok
  const todayBkk = new Date(now.getTime() + BANGKOK_OFFSET_HOURS * 3600_000);
  for (const doc of doctors) {
    const created = await prisma.doctor.create({
      data: { name: doc.name, departmentId: deptId[doc.dept] },
    });
    const shifts = [];
    for (let i = 0; i < SHIFT_DAYS; i++) {
      const y = todayBkk.getUTCFullYear();
      const m = todayBkk.getUTCMonth();
      const d = todayBkk.getUTCDate() + i;
      shifts.push({
        doctorId: created.id,
        date: bangkokToUtc(y, m, d, 0),
        startTime: bangkokToUtc(y, m, d, doc.startHour),
        endTime: bangkokToUtc(y, m, d, doc.endHour),
      });
    }
    await prisma.shift.createMany({ data: shifts });
  }

  await prisma.user.createMany({
    data: [
      {
        username: "admin",
        passwordHash: await bcrypt.hash(adminPassword, 10),
        role: "ADMIN",
      },
      {
        username: "staff.med",
        passwordHash: await bcrypt.hash(staffPassword, 10),
        role: "STAFF",
        departmentId: deptId.MED,
      },
    ],
  });

  console.log(
    `Seeded ${departments.length} departments, ${symptomCodes.length} symptom codes, ` +
      `${questions.length} questions, ${doctors.length} doctors (${SHIFT_DAYS} days of shifts), 2 users`,
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
