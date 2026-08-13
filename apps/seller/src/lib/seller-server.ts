import { auth } from "@/lib/auth-instance";
import { db } from "@avenick/database";
import { sellerUserCanAccess } from "./seller-access";
export { sellerHasPermission } from "./seller-permissions";

const SELLER_ROLES = new Set(["SELLER_OWNER", "SELLER_STAFF"]);

/**
 * Canonical seller organization boundary for API/server code.
 *
 * SellerProfile.userId belongs to the seller owner only. Staff must resolve
 * through SellerMembership; otherwise SELLER_STAFF can authenticate but every
 * seller API rejects them. All callers receive seller scope derived from server
 * membership, never from request payload/query parameters.
 */
export async function getServerSellerContext() {
  const session = await auth();
  const sessionUser = session?.user as { id: string; role: string } | undefined;
  if (!sessionUser?.id) return null;
  const user = await db.user.findUnique({
    where: { id: sessionUser.id },
    select: { id: true, role: true, status: true, deletedAt: true },
  });
  if (!user || !SELLER_ROLES.has(user.role)) return null;

  if (user.role === "SELLER_OWNER") {
    const seller = await db.sellerProfile.findUnique({ where: { userId: user.id } });
    if (!sellerUserCanAccess(user) || !seller || seller.status !== "ACTIVE" || seller.deletedAt) return null;
    return {
      session,
      user,
      userId: user.id,
      sellerId: seller.id,
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

  const membership = await db.sellerMembership.findUnique({
    where: { userId: user.id },
    include: { seller: true },
  });
  if (!sellerUserCanAccess(user, membership) || !membership || membership.seller.status !== "ACTIVE" || membership.seller.deletedAt) {
    return null;
  }

  return {
    session,
    user,
    userId: user.id,
    sellerId: membership.sellerId,
    seller: membership.seller,
    membership,
  };
}
