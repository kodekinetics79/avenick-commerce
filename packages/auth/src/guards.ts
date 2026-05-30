import { type Session } from "next-auth";
import { UserRole } from "@manzil/database";
import { NextResponse, type NextRequest } from "next/server";

export type AuthGuardResult =
  | { authorized: true; session: Session }
  | { authorized: false; response: NextResponse };

/**
 * Check if the current session has one of the required roles.
 * Returns an unauthorized response if not.
 */
export function requireRoles(
  session: Session | null,
  roles: UserRole[],
): AuthGuardResult {
  if (!session?.user) {
    return {
      authorized: false,
      response: NextResponse.json(
        { success: false, error: "Authentication required" },
        { status: 401 },
      ),
    };
  }

  const userRole = (session.user as { role: UserRole }).role;
  if (!roles.includes(userRole)) {
    return {
      authorized: false,
      response: NextResponse.json(
        { success: false, error: "Insufficient permissions" },
        { status: 403 },
      ),
    };
  }

  return { authorized: true, session };
}

export const SELLER_ROLES: UserRole[] = [UserRole.SELLER_OWNER, UserRole.SELLER_STAFF];
export const ADMIN_ROLES: UserRole[] = [UserRole.ADMIN, UserRole.SUPER_ADMIN];
export const BUYER_ROLES: UserRole[] = [
  UserRole.CONSUMER,
  UserRole.COMPANY_ADMIN,
  UserRole.COMPANY_BUYER,
  UserRole.COMPANY_APPROVER,
];
export const COMPANY_ROLES: UserRole[] = [
  UserRole.COMPANY_ADMIN,
  UserRole.COMPANY_BUYER,
  UserRole.COMPANY_APPROVER,
];

/** Helper: does the user belong to one of the given roles? */
export function hasRole(session: Session | null, roles: UserRole[]): boolean {
  if (!session?.user) return false;
  const role = (session.user as { role: UserRole }).role;
  return roles.includes(role);
}
