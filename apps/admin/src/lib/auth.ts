import { auth } from "@/lib/auth-instance";
import { db } from "@avenick/database";
import { redirect } from "next/navigation";
import { isDurableAdmin } from "./admin-access";

export async function requireAdminSession() {
  const context = await getCurrentAdmin();
  if (!context) redirect("/login");
  return context;
}

export async function getCurrentAdmin() {
  const session = await auth();
  if (!session?.user) return null;
  const sessionUser = session.user as { id: string };
  const user = await db.user.findUnique({
    where: { id: sessionUser.id },
    select: { id: true, role: true, status: true, deletedAt: true },
  });
  if (!isDurableAdmin(user)) {
    return null;
  }
  return { session, userId: user.id, role: user.role };
}
