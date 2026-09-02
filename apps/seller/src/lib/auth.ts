import { auth } from "@/lib/auth-instance";
import { redirect } from "next/navigation";
import { db, type SellerProfile, type SellerStatus } from "@avenick/database";
import { sellerUserCanAccess } from "./seller-access";

export interface SellerSessionOptions {
  /**
   * Seller-profile statuses this surface admits. Defaults to ACTIVE only.
   *
   * The onboarding surfaces — the documents page, its actions and the
   * `seller-document` presign — pass `ONBOARDING_SELLER_STATUSES` so a seller
   * still under review can upload the evidence the review needs. Without
   * that, approval required documents and documents required approval: a
   * one-way trap with no way in. Nothing commercial (catalog, orders,
   * payouts) should ever widen this.
   */
  allowedSellerStatuses?: readonly SellerStatus[];
}

/**
 * Seller statuses the onboarding surfaces admit, under the name this app has
 * always used. This is an alias, not a copy: DOCUMENT_UPLOAD_SELLER_STATUSES
 * is the authority at the transaction boundary
 * (requireCurrentOnboardingSellerActor), and a page gate that drifted from it
 * would either trap a seller the transaction admits or wave through one it
 * then refuses. Keeping a single list makes that drift impossible.
 */
export { DOCUMENT_UPLOAD_SELLER_STATUSES as ONBOARDING_SELLER_STATUSES } from "@avenick/database";

/**
 * Where a signed-in seller whose profile is not admitted here is sent. A
 * seller under review, suspended or rejected has a valid login but no
 * workspace; /pending explains which of those it is instead of bouncing them
 * to a login form that would accept them again.
 */
function redirectForSellerStatus(status: SellerStatus): never {
  if (status === "ACTIVE") redirect("/login");
  redirect("/pending");
}

export async function requireSellerSession(options: SellerSessionOptions = {}) {
  const allowed = options.allowedSellerStatuses ?? (["ACTIVE"] as const);
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
    if (!sellerUserCanAccess(user) || !seller || seller.deletedAt) redirect("/login");
    if (!allowed.includes(seller.status)) redirectForSellerStatus(seller.status);

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
  if (!sellerUserCanAccess(user, membership) || !membership || membership.seller.deletedAt) {
    redirect("/login");
  }
  if (!allowed.includes(membership.seller.status)) redirectForSellerStatus(membership.seller.status);

  return {
    session,
    userId: user.id,
    userRole: user.role,
    seller: membership.seller,
    membership,
  };
}

export interface SellerAccountState {
  user: { id: string; email: string; firstName: string; lastName: string; role: string; status: string };
  /** Null when the login is a seller role with no live organisation behind it. */
  seller: SellerProfile | null;
  membership: {
    userId: string;
    sellerId: string;
    title: string | null;
    permissions: string[];
    isActive: boolean;
  } | null;
}

/**
 * The seller behind the current session, whatever its review status.
 *
 * `requireSellerSession` sends a non-ACTIVE seller to /pending; /pending needs
 * the same resolution WITHOUT that redirect, or it would bounce to itself. This
 * applies the same user-level checks (seller role, ACTIVE login, not deleted,
 * staff membership active) and returns null when there is no usable session,
 * but never judges SellerProfile.status — that is the caller's job. A seller
 * role with no organisation resolves to `seller: null` rather than null, so
 * the page can say so instead of looping through /login.
 */
export async function getSellerAccountState(): Promise<SellerAccountState | null> {
  const session = await auth();
  if (!session?.user) return null;

  const sessionUser = session.user as { id: string };
  const user = await db.user.findUnique({
    where: { id: sessionUser.id },
    select: { id: true, email: true, firstName: true, lastName: true, role: true, status: true, deletedAt: true },
  });
  if (!user || !["SELLER_OWNER", "SELLER_STAFF"].includes(user.role)) return null;

  const account = { id: user.id, email: user.email, firstName: user.firstName, lastName: user.lastName, role: user.role, status: user.status };

  if (user.role === "SELLER_OWNER") {
    if (!sellerUserCanAccess(user)) return null;
    const seller = await db.sellerProfile.findUnique({ where: { userId: user.id } });
    if (!seller || seller.deletedAt) return { user: account, seller: null, membership: null };
    return {
      user: account,
      seller,
      membership: { userId: user.id, sellerId: seller.id, title: "Owner", permissions: ["*"], isActive: true },
    };
  }

  const membership = await db.sellerMembership.findUnique({
    where: { userId: user.id },
    include: { seller: true },
  });
  if (!sellerUserCanAccess(user, membership)) return null;
  if (!membership || membership.seller.deletedAt) return { user: account, seller: null, membership: null };
  return {
    user: account,
    seller: membership.seller,
    membership: {
      userId: membership.userId,
      sellerId: membership.sellerId,
      title: membership.title,
      permissions: membership.permissions,
      isActive: membership.isActive,
    },
  };
}

/** Require an explicit seller capability for staff; owners always have `*`. */
export async function requireSellerPermission(permission: string, options: SellerSessionOptions = {}) {
  const context = await requireSellerSession(options);
  const permissions = context.membership.permissions ?? [];
  if (!permissions.includes("*") && !permissions.includes(permission)) {
    throw new Error(`Seller permission required: ${permission}`);
  }
  return context;
}

/** Require at least one explicit capability. Useful for read pages shared by viewers and managers. */
export async function requireSellerAnyPermission(required: readonly string[], options: SellerSessionOptions = {}) {
  const context = await requireSellerSession(options);
  const permissions = context.membership.permissions ?? [];
  if (!permissions.includes("*") && !required.some((permission) => permissions.includes(permission))) {
    throw new Error(`Seller permission required: ${required.join(" or ")}`);
  }
  return context;
}
