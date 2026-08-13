import { describe, expect, it } from "vitest";
import { sellerUserCanAccess } from "../seller-access";

const activeStaff = { role: "SELLER_STAFF", status: "ACTIVE", deletedAt: null };

describe("durable seller account state", () => {
  it("accepts active staff only with an active membership", () => {
    expect(sellerUserCanAccess(activeStaff, { isActive: true })).toBe(true);
    expect(sellerUserCanAccess(activeStaff, { isActive: false })).toBe(false);
    expect(sellerUserCanAccess(activeStaff, null)).toBe(false);
  });

  it("rejects suspended and deleted staff despite a stale active session", () => {
    expect(sellerUserCanAccess({ ...activeStaff, status: "SUSPENDED" }, { isActive: true })).toBe(false);
    expect(sellerUserCanAccess({ ...activeStaff, deletedAt: new Date() }, { isActive: true })).toBe(false);
  });

  it("rejects non-seller roles and accepts an active owner", () => {
    expect(sellerUserCanAccess({ role: "CONSUMER", status: "ACTIVE", deletedAt: null })).toBe(false);
    expect(sellerUserCanAccess({ role: "SELLER_OWNER", status: "ACTIVE", deletedAt: null })).toBe(true);
  });
});
