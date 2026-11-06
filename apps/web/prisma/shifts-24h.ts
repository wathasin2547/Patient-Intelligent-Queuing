import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const BANGKOK_OFFSET_HOURS = 7;
const SHIFT_DAYS = 7;
const DAY_MS = 24 * 3600_000;

async function main() {
  if (process.env.NODE_ENV === "production") {
    throw new Error("Refusing to change shifts on a production database");
  }

  const today = new Date(Date.now() + BANGKOK_OFFSET_HOURS * 3600_000);
  const [y, m, d] = [today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()];
  const firstDay = Date.UTC(y, m, d, -BANGKOK_OFFSET_HOURS);

  const doctors = await prisma.doctor.findMany();
  const result = { doctors: doctors.length, updated: 0, created: 0 };

  for (const doctor of doctors) {
    for (let i = 0; i < SHIFT_DAYS; i++) {
      const date = new Date(firstDay + i * DAY_MS);
      const data = { startTime: date, endTime: new Date(date.getTime() + DAY_MS), status: "ACTIVE" };
      const { count } = await prisma.shift.updateMany({ where: { doctorId: doctor.id, date }, data });
      if (count > 0) {
        result.updated += count;
      } else {
        await prisma.shift.create({ data: { doctorId: doctor.id, date, ...data } });
        result.created += 1;
      }
    }
  }

  console.log("Doctors are now on shift 24 hours for the next 7 days:", result);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
