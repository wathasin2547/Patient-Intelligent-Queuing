import { redirect } from "next/navigation";
import { auth, signOut } from "@/auth";
import StaffShell from "./StaffShell";

export default async function StaffLayout({ children }: LayoutProps<"/staff">) {
  const session = await auth();
  if (!session?.user) redirect("/login");

  async function logout() {
    "use server";
    await signOut({ redirectTo: "/login" });
  }

  return (
    <StaffShell user={{ username: session.user.username, role: session.user.role }} logout={logout}>
      {children}
    </StaffShell>
  );
}
