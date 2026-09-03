import { describe, expect, it } from "vitest";
import { isDurableB2BMember } from "../b2b-access";

const active = {
  role: "COMPANY_ADMIN", isActive: true,
  company: { status: "ACTIVE", deletedAt: null },
  user: { role: "COMPANY_ADMIN", status: "ACTIVE", deletedAt: null },
};

describe("durable B2B authorization", () => {
  it("rejects revoked membership, company, user, and role state", () => {
    expect(isDurableB2BMember({ ...active, isActive: false })).toBe(false);
    expect(isDurableB2BMember({ ...active, company: { ...active.company, status: "SUSPENDED" } })).toBe(false);
    expect(isDurableB2BMember({ ...active, user: { ...active.user, status: "SUSPENDED" } })).toBe(false);
    expect(isDurableB2BMember({ ...active, user: { ...active.user, role: "CONSUMER" } })).toBe(false);
  });

  it("accepts matching active durable state", () => {
    expect(isDurableB2BMember(active)).toBe(true);
  });
});
