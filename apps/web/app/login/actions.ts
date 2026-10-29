"use server";

import { AuthError } from "next-auth";
import { z } from "zod";
import { signIn } from "@/auth";
import { loginSchema } from "@/lib/auth/schema";

export type LoginState = {
  username?: string;
  fieldErrors?: { username?: string[]; password?: string[] };
  error?: string;
};

/** UC02: validate with Zod, then let NextAuth check the password against the User collection. */
export async function login(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const raw = { username: formData.get("username"), password: formData.get("password") };
  const parsed = loginSchema.safeParse(raw);
  const username = typeof raw.username === "string" ? raw.username : "";
  if (!parsed.success) {
    return { username, fieldErrors: z.flattenError(parsed.error).fieldErrors };
  }

  try {
    // /staff sends each role on to its own home (proxy.ts)
    await signIn("credentials", { ...parsed.data, redirectTo: safeCallback(formData.get("callbackUrl")) });
    return {};
  } catch (e) {
    if (e instanceof AuthError) {
      const suspended = e.type === "CredentialsSignin" && (e as AuthError & { code?: string }).code === "suspended";
      return {
        username,
        error: suspended ? "บัญชีนี้ถูกระงับ กรุณาติดต่อผู้ดูแลระบบ" : "ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง",
      };
    }
    throw e; // the redirect after a successful sign-in is thrown too
  }
}

/** Keep only the path, and only under /staff, so the login form cannot be used as an open redirect. */
function safeCallback(value: FormDataEntryValue | null): string {
  if (typeof value !== "string" || !value) return "/staff";
  try {
    const url = new URL(value, "http://piq.local"); // relative or absolute, the host is dropped
    return url.pathname.startsWith("/staff") ? url.pathname + url.search : "/staff";
  } catch {
    return "/staff";
  }
}
