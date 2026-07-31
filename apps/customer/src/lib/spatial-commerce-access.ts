import { UserRole, UserStatus, type CompanyMember, type User } from "@avenick/database";

const SPATIAL_COMPANY_ROLES = new Set<UserRole>([
  UserRole.COMPANY_ADMIN,
  UserRole.COMPANY_BUYER,
  UserRole.COMPANY_APPROVER,
]);

type SpatialUserAccess = Pick<User, "role" | "status" | "deletedAt">;
type SpatialMemberAccess = Pick<CompanyMember, "role" | "isActive">;

/**
 * Fail closed unless both the live account class and the live membership are
 * active B2B roles. CompanyMember is authoritative for the member's current
 * company role because the existing team workflow updates that record without
 * rewriting User.role; User.role remains an independent account-class guard.
 */
export function hasLiveSpatialCommerceRole(
  user: SpatialUserAccess | null,
  member: SpatialMemberAccess,
): boolean {
  return Boolean(
    user
    && user.status === UserStatus.ACTIVE
    && !user.deletedAt
    && member.isActive
    && SPATIAL_COMPANY_ROLES.has(user.role)
    && SPATIAL_COMPANY_ROLES.has(member.role),
  );
}
