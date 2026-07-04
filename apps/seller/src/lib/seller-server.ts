import { auth } from "@/lib/auth-instance";
import { db } from "@avenick/database";

export async function getServerSellerContext() {
  const session = await auth();
  const user = session?.user as { id?: string; role?: string } | undefined;
  if (!user?.id || !user.role || !["SELLER_OWNER", "SELLER_STAFF"].includes(user.role)) return null;

  const seller = await db.sellerProfile.findUnique({ where: { userId: user.id } });
  if (!seller) return null;
  return { session, userId: user.id, seller };
}
