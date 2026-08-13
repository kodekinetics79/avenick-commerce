import { auth } from "@/lib/auth-instance";
import { redirect } from "next/navigation";
import { db } from "@avenick/database";

export async function requireSellerSession() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const user = session.user as { id: string; role: string };
  if (!["SELLER_OWNER", "SELLER_STAFF"].includes(user.role)) redirect("/login");

  if (user.role === "SELLER_OWNER") {
    const seller = await db.sellerProfile.findUnique({ where: { userId: user.id } });
    if (!seller || seller.deletedAt || seller.status !== "ACTIVE") redirect("/login");

    return {
      session,
      seller,
      membership: {
        userId: user.id,
        sellerId: seller.id,
        title: "Owner",
        permissions: ["*"],
        isActive: true,
      },
    };
  }

  // SELLER_STAFF must belong to a real seller organization. The previous
  // implementation looked up SellerProfile.userId, which can only ever resolve
  // the unique owner and therefore made the staff role non-functional.
  const membership = await db.sellerMembership.findUnique({
    where: { userId: user.id },
    include: { seller: true },
  });
  if (!membership?.isActive || membership.seller.deletedAt || membership.seller.status !== "ACTIVE") {
    redirect("/login");
  }

  return { session, seller: membership.seller, membership };
}
