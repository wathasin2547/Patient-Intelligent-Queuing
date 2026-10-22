import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma = globalForPrisma.prisma ?? new PrismaClient();

// ตอน dev โค้ดถูกโหลดใหม่บ่อย เก็บไว้ใน globalThis กันสร้าง client ซ้ำจนเชื่อมต่อเต็ม
if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;