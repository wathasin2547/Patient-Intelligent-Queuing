import { PrismaClient } from "@prisma/client";
import { departments, doctors, questions, symptomCodes } from "./seed-data";

const prisma = new PrismaClient();

const BANGKOK_OFFSET_HOURS = 7;
const SHIFT_DAYS = 7;

const bangkokToUtc = (y: number, m: number, d: number, hour: number) => new Date(Date.UTC(y, m, d, hour - BANGKOK_OFFSET_HOURS));

async function main() {
  const added = { departments: 0, symptomCodes: 0, questions: 0, doctors: 0, shifts: 0, settings: 0 };

  const deptId: Record<string, string> = {};
  for (const d of departments) {
    let dept = await prisma.department.findUnique({ where: { name: d.name } });
    if (!dept) {
      dept = await prisma.department.create({ data: { name: d.name, code: d.key, scopeOfCare: d.scopeOfCare } });
      added.departments += 1;
    }
    deptId[d.key] = dept.id;
  }

  for (const s of symptomCodes) {
    if (await prisma.symptomCode.findUnique({ where: { code: s.code } })) continue;
    await prisma.symptomCode.create({
      data: {
        code: s.code,
        label: s.label,
        synonyms: s.synonyms,
        departmentWeights: Object.fromEntries(Object.entries(s.weights).map(([key, w]) => [deptId[key], w])),
        isRedFlag: s.isRedFlag ?? false,
        onsiteOnly: s.onsiteOnly ?? false,
        priorityHint: s.priorityHint ?? null,
      },
    });
    added.symptomCodes += 1;
  }

  for (const q of questions) {
    if (await prisma.question.findFirst({ where: { questionText: q.questionText } })) continue;
    await prisma.question.create({
      data: { questionText: q.questionText, group: q.group, order: q.order, options: q.options, dependsOn: q.dependsOn ?? undefined },
    });
    added.questions += 1;
  }

  const today = new Date(Date.now() + BANGKOK_OFFSET_HOURS * 3600_000);
  for (const doc of doctors) {
    let doctor = await prisma.doctor.findFirst({ where: { name: doc.name, departmentId: deptId[doc.dept] } });
    if (!doctor) {
      doctor = await prisma.doctor.create({ data: { name: doc.name, departmentId: deptId[doc.dept] } });
      added.doctors += 1;
    }
    for (let i = 0; i < SHIFT_DAYS; i++) {
      const [y, m, d] = [today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate() + i];
      const date = bangkokToUtc(y, m, d, 0);
      if (await prisma.shift.findFirst({ where: { doctorId: doctor.id, date } })) continue;
      await prisma.shift.create({
        data: { doctorId: doctor.id, date, startTime: bangkokToUtc(y, m, d, doc.startHour), endTime: bangkokToUtc(y, m, d, doc.endHour) },
      });
      added.shifts += 1;
    }
  }

  if (!(await prisma.systemSetting.findFirst())) {
    await prisma.systemSetting.create({ data: {} });
    added.settings = 1;
  }

  console.log("Added only what was missing; nothing was changed or deleted:", added);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
