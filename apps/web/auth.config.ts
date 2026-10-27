import type { NextAuthConfig } from "next-auth";
import { canOpen, homeOf, type Role } from "@/lib/auth/schema";

// Edge-safe part of the auth setup (no Prisma, no bcrypt) so proxy.ts can import it.
// The Credentials provider that touches the database lives in auth.ts.
export const authConfig = {
  pages: { signIn: "/login" },
  session: { strategy: "jwt", maxAge: 8 * 60 * 60 }, // one working shift
  secret: process.env.AUTH_SECRET ?? process.env.NEXTAUTH_SECRET,
  trustHost: true,
  providers: [],
  callbacks: {
    // runs in proxy.ts for /staff and /login
    authorized({ auth, request: { nextUrl } }) {
      const user = auth?.user;
      if (nextUrl.pathname === "/login") {
        return user ? Response.redirect(new URL(homeOf(user.role), nextUrl)) : true; // already signed in
      }
      if (!user) return false; // -> /login?callbackUrl=...
      if (!canOpen(user.role, nextUrl.pathname)) {
        return Response.redirect(new URL(homeOf(user.role), nextUrl));
      }
      return true;
    },
    jwt({ token, user }) {
      if (user) {
        token.role = user.role;
        token.username = user.username;
        token.departmentId = user.departmentId ?? null;
        token.doctorId = user.doctorId ?? null;
      }
      return token;
    },
    session({ session, token }) {
      session.user.id = token.sub ?? "";
      session.user.role = token.role as Role;
      session.user.username = token.username as string;
      session.user.departmentId = (token.departmentId as string | null) ?? null;
      session.user.doctorId = (token.doctorId as string | null) ?? null;
      return session;
    },
  },
} satisfies NextAuthConfig;
