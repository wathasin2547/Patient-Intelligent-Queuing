import { z } from "zod";

export const loginSchema = z.object({
  username: z
    .string()
    .trim()
    .min(1, "กรุณากรอกชื่อผู้ใช้")
    .max(64, "ชื่อผู้ใช้ยาวเกินไป")
    .regex(/^[a-zA-Z0-9._-]+$/, "ชื่อผู้ใช้ใช้ได้เฉพาะ a-z 0-9 . _ -"),
  password: z.string().min(1, "กรุณากรอกรหัสผ่าน").max(128, "รหัสผ่านยาวเกินไป"),
});

export type LoginInput = z.infer<typeof loginSchema>;

export const ROLES = ["ADMIN", "STAFF", "DOCTOR"] as const;
export type Role = (typeof ROLES)[number];

export const homeOf = (role: Role) => (role === "DOCTOR" ? "/staff/doctor" : "/staff");

export function canOpen(role: Role, pathname: string): boolean {
  const doctorPath = pathname.startsWith("/staff/doctor") || /^\/staff\/queues\/[^/]+$/.test(pathname);
  if (role === "DOCTOR") return doctorPath;
  if (pathname.startsWith("/staff/doctor")) return false;
  if (pathname.startsWith("/staff/master")) return role === "ADMIN";
  return true;
}
