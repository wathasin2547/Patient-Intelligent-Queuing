import NextAuth from "next-auth";
import { authConfig } from "@/auth.config";

// Next 16 "proxy" (was middleware): optimistic check before any /staff page renders —
// not signed in -> /login, wrong role -> that role's home. Pages still check the session themselves.
export default NextAuth(authConfig).auth;

export const config = {
  matcher: ["/staff/:path*", "/login"],
};
