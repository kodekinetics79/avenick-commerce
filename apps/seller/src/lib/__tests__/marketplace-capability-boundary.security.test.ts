import { describe, expect, it } from "vitest";
import { sellerHasPermission } from "../seller-permissions";

describe("seller staff capability boundary", () => {
  it("fails closed for staff with no grants", () => {
    expect(sellerHasPermission({ user: { role: "SELLER_STAFF" }, membership: { permissions: [] } }, "quotes.submit"))
      .toBe(false);
  });

  it("does not let an unrelated grant authorize a binding quote", () => {
    expect(sellerHasPermission({ user: { role: "SELLER_STAFF" }, membership: { permissions: ["rfqs.view"] } }, "quotes.submit"))
      .toBe(false);
  });

  it("accepts exact grants, wildcard grants, and owners", () => {
    expect(sellerHasPermission({ user: { role: "SELLER_STAFF" }, membership: { permissions: ["quotes.submit"] } }, "quotes.submit"))
      .toBe(true);
    expect(sellerHasPermission({ user: { role: "SELLER_STAFF" }, membership: { permissions: ["*"] } }, "quotes.submit"))
      .toBe(true);
    expect(sellerHasPermission({ user: { role: "SELLER_OWNER" } }, "quotes.submit")).toBe(true);
  });
});
