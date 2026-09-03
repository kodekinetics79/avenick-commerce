export type DurableAdminUser = { role: string; status: string; deletedAt: Date | null };

export function isDurableAdmin(user: DurableAdminUser | null | undefined): user is DurableAdminUser {
  return Boolean(user && user.status === "ACTIVE" && !user.deletedAt && ["ADMIN", "SUPER_ADMIN"].includes(user.role));
}
