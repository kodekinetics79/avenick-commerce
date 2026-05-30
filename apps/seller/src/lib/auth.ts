import { auth } from "@/lib/auth-instance";
import { redirect } from "next/navigation";
import { db } from "@manzil/database";

export async function requireSellerSession() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const user = session.user as { id: string; role: string };
  if (!["SELLER_OWNER", "SELLER_STAFF"].includes(user.role)) redirect("/login");

  const seller = await db.sellerProfile.findUnique({ where: { userId: user.id } });
  if (!seller) redirect("/login");

  return { session, seller };
}
