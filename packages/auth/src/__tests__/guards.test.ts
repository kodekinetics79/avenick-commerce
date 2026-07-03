import { describe, it, expect } from "vitest";
import type { Session } from "next-auth";
import { requireRoles, hasRole, ADMIN_ROLES, SELLER_ROLES } from "../guards";
import { UserRole } from "@avenick/database";

function makeSession(role: UserRole): Session {
  return {
    user: { id: "u1", email: "t@example.test", role } as Session["user"],
    expires: new Date(Date.now() + 60_000).toISOString(),
  };
}

describe("requireRoles", () => {
  it("rejects a missing session with 401", async () => {
    const result = requireRoles(null, ADMIN_ROLES);
    expect(result.authorized).toBe(false);
    if (!result.authorized) expect(result.response.status).toBe(401);
  });

  it("rejects the wrong role with 403", async () => {
    const result = requireRoles(makeSession(UserRole.CONSUMER), ADMIN_ROLES);
    expect(result.authorized).toBe(false);
    if (!result.authorized) expect(result.response.status).toBe(403);
  });

  it("authorizes a matching role", () => {
    const result = requireRoles(makeSession(UserRole.ADMIN), ADMIN_ROLES);
    expect(result.authorized).toBe(true);
  });
});

describe("hasRole", () => {
  it("is false for null sessions", () => {
    expect(hasRole(null, SELLER_ROLES)).toBe(false);
  });

  it("matches only listed roles", () => {
    expect(hasRole(makeSession(UserRole.SELLER_STAFF), SELLER_ROLES)).toBe(true);
    expect(hasRole(makeSession(UserRole.ADMIN), SELLER_ROLES)).toBe(false);
  });
});
