export type SellerPermissionContext = {
  user: { role: string };
  membership?: { permissions?: string[] } | null;
};

/** Owners are the organization root; staff are fail-closed unless explicitly granted. */
export function sellerHasPermission(context: SellerPermissionContext, permission: string) {
  if (context.user.role === "SELLER_OWNER") return true;
  const permissions = context.membership?.permissions ?? [];
  return permissions.includes("*") || permissions.includes(permission);
}
