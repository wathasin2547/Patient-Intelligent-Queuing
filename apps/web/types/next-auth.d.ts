import type { DefaultSession } from "next-auth";
import type { Role } from "@/lib/auth/schema";

// Fields PIQ keeps on the signed-in user (from the User collection, see SPEC.md).
declare module "next-auth" {
  interface User {
    username: string;
    role: Role;
    departmentId?: string | null;
    doctorId?: string | null;
  }
  interface Session {
    user: {
      id: string;
      username: string;
      role: Role;
      departmentId: string | null;
      doctorId: string | null;
    } & DefaultSession["user"];
  }
}
