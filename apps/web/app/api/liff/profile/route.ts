import { NextResponse } from "next/server"
import { getLineUserId } from "@/lib/line/profile"
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { ageGroupOf } from "@/lib/age";
import { isValidNationalId } from "@/lib/national-id";

export async function POST(req:Request) {
    const token = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
    if (!token) return NextResponse.json({ error: "Unauthorized"}, {status: 401});

    const lineUserId = await getLineUserId(token);
    if (!lineUserId) return NextResponse.json({ error: "invalid token"}, { status: 401});

    const profileSchema = z.object({
            fullName: z.string().trim().min(1).max(100),
            age: z.number().int().min(0).max(120),
            gender: z.enum(["ชาย", "หญิง", "ไม่ระบุ"]),
            healthCoverage: z.enum(["บัตรทอง", "ประกันสังคม", "ข้าราชการ", "ชำระด้วยตัวเอง"]),
            isChronic: z.boolean(),
            address: z.string().trim().max(500).nullable(),
            phoneNumber: z.string().regex(/^0\d{8,9}$/),
            nationalId: z.string().refine(isValidNationalId),
    });

    const parsed = profileSchema.safeParse(await req.json().catch(() => null));
    if( !parsed.success) return NextResponse.json({ error: "ข้อมูลไม่ถูกต้อง"}, {status:400});
    
        const data = { ...parsed.data, ageGroup: ageGroupOf(parsed.data.age) };

    await prisma.patient.upsert({
        where: { lineUserId },
        update: data,
        create: { lineUserId, ...data },
    });

    return NextResponse.json({ ok: true});
}