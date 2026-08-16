import { auth } from "@/lib/auth-instance";
import { redirect } from "next/navigation";
import { db } from "@avenick/database";
import { sellerUserCanAccess } from "./seller-access";

export async function requireSellerSession() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const sessionUser = session.user as { id: string; role: string };
  const user = await db.user.findUnique({
    where: { id: sessionUser.id },
    select: { id: true, role: true, status: true, deletedAt: true },
  });
  if (!user || !["SELLER_OWNER", "SELLER_STAFF"].includes(user.role)) redirect("/login");

  if (user.role === "SELLER_OWNER") {
    const seller = await db.sellerProfile.findUnique({ where: { userId: user.id } });
    if (!sellerUserCanAccess(user) || !seller || seller.deletedAt || seller.status !== "ACTIVE") redirect("/login");

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
  if (!sellerUserCanAccess(user, membership) || !membership || membership.seller.deletedAt || membership.seller.status !== "ACTIVE") {
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

/** Require at least one explicit capability. Useful for read pages shared by viewers and managers. */
export async function requireSellerAnyPermission(required: readonly string[]) {
  const context = await requireSellerSession();
  const permissions = context.membership.permissions ?? [];
  if (!permissions.includes("*") && !required.some((permission) => permissions.includes(permission))) {
    throw new Error(`Seller permission required: ${required.join(" or ")}`);
  }
  return context;
}

/** Require every listed capability. Product publication combines catalog and pricing authority. */
export async function requireSellerPermissions(required: readonly string[]) {
  const context = await requireSellerSession();
  const permissions = context.membership.permissions ?? [];
  if (!permissions.includes("*") && !required.every((permission) => permissions.includes(permission))) {
    throw new Error(`Seller permissions required: ${required.join(" and ")}`);
  }
  return context;
}
