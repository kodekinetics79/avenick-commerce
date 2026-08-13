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
      userId: user.id,
      userRole: user.role,
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

  // SELLER_STAFF must belong to a real seller organization. SellerProfile.userId
  // belongs only to the unique owner, so staff resolution is membership-based.
  const membership = await db.sellerMembership.findUnique({
    where: { userId: user.id },
    include: { seller: true },
  });
  if (!membership?.isActive || membership.seller.deletedAt || membership.seller.status !== "ACTIVE") {
    redirect("/login");
  }

  return {
    session,
    userId: user.id,
    userRole: user.role,
    seller: membership.seller,
    membership,
  };
}

/** Require an explicit seller capability for staff; owners always have `*`. */
export async function requireSellerPermission(permission: string) {
  const context = await requireSellerSession();
  const permissions = context.membership.permissions ?? [];
  if (!permissions.includes("*") && !permissions.includes(permission)) {
    throw new Error(`Seller permission required: ${permission}`);
  }
  return context;
}
