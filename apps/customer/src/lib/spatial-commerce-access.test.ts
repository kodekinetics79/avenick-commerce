import { describe, expect, it } from "vitest";
import { UserRole, UserStatus } from "@avenick/database";
import { hasLiveSpatialCommerceRole } from "./spatial-commerce-access";

const activeUser = {
  role: UserRole.COMPANY_BUYER,
  status: UserStatus.ACTIVE,
  deletedAt: null,
};

describe("hasLiveSpatialCommerceRole", () => {
  it("allows matching active company roles", () => {
    expect(hasLiveSpatialCommerceRole(activeUser, {
      role: UserRole.COMPANY_BUYER,
      isActive: true,
    })).toBe(true);
  });

  it("uses the live membership role after a legitimate team-role change", () => {
    expect(hasLiveSpatialCommerceRole(activeUser, {
      role: UserRole.COMPANY_APPROVER,
      isActive: true,
    })).toBe(true);
  });

  it.each([
    ["missing user", null, { role: UserRole.COMPANY_BUYER, isActive: true }],
    ["demoted account class", { ...activeUser, role: UserRole.CONSUMER }, { role: UserRole.COMPANY_BUYER, isActive: true }],
    ["consumer role", { ...activeUser, role: UserRole.CONSUMER }, { role: UserRole.CONSUMER, isActive: true }],
    ["seller role", { ...activeUser, role: UserRole.SELLER_OWNER }, { role: UserRole.SELLER_OWNER, isActive: true }],
    ["inactive membership", activeUser, { role: UserRole.COMPANY_BUYER, isActive: false }],
    ["suspended user", { ...activeUser, status: UserStatus.SUSPENDED }, { role: UserRole.COMPANY_BUYER, isActive: true }],
    ["deleted user", { ...activeUser, deletedAt: new Date() }, { role: UserRole.COMPANY_BUYER, isActive: true }],
  ])("rejects %s", (_label, user, member) => {
    expect(hasLiveSpatialCommerceRole(user, member)).toBe(false);
  });
});
