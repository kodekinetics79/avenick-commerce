export type CurrentSellerUser = {
  role: string;
  status: string;
  deletedAt: Date | null;
};

export type CurrentSellerMembership = {
  isActive: boolean;
} | null;

/** Re-evaluate durable account state; never trust a possibly stale session role. */
export function sellerUserCanAccess(user: CurrentSellerUser | null, membership?: CurrentSellerMembership) {
  if (!user || user.status !== "ACTIVE" || user.deletedAt) return false;
  if (user.role === "SELLER_OWNER") return true;
  return user.role === "SELLER_STAFF" && Boolean(membership?.isActive);
}
