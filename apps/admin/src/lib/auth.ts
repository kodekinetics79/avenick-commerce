import { auth } from "@/lib/auth-instance";
import { redirect } from "next/navigation";

export async function requireAdminSession() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  const user = session.user as { id: string; role: string };
  if (!["ADMIN", "SUPER_ADMIN"].includes(user.role)) redirect("/login");
  return { session, userId: user.id, role: user.role };
}
