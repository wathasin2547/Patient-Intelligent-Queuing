import bcrypt from "bcryptjs";
import NextAuth, { CredentialsSignin } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { authConfig } from "@/auth.config";
import { loginSchema, ROLES, type Role } from "@/lib/auth/schema";
import { prisma } from "@/lib/prisma";

/** Right password but the admin suspended the account (UC12) — tell the user instead of a generic error. */
export class SuspendedAccount extends CredentialsSignin {
  code = "suspended";
}

// Compared against when the username does not exist, so a wrong username takes as long as a wrong password.
const DUMMY_HASH = bcrypt.hashSync("piq-unknown-user", 10);

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  providers: [
    Credentials({
      credentials: { username: {}, password: {} },
      async authorize(raw) {
        const parsed = loginSchema.safeParse(raw);
        if (!parsed.success) return null;
        const { username, password } = parsed.data;

        const user = await prisma.user.findUnique({ where: { username } });
        const ok = await bcrypt.compare(password, user?.passwordHash ?? DUMMY_HASH);
        if (!user || !ok) return null;
        if (!user.isActive) throw new SuspendedAccount();
        if (!ROLES.includes(user.role as Role)) return null;

        return {
          id: user.id,
          name: user.username,
          username: user.username,
          role: user.role as Role,
          departmentId: user.departmentId,
          doctorId: user.doctorId,
        };
      },
    }),
  ],
});
