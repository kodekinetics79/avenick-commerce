import { describe, expect, it } from "vitest";
import { sellerHasAnyPermission, sellerHasPermission, sellerNavigationAllows } from "../seller-permissions";
import { sellerLandingRoute } from "../seller-home";

describe("seller SSR capability release boundary", () => {
  const catalogStaff = { user: { role: "SELLER_STAFF" }, membership: { permissions: ["catalog.view", "catalog.manage"] } };

  it("allows a catalog specialist only into catalog capabilities", () => {
    expect(sellerHasAnyPermission(catalogStaff, ["catalog.view", "catalog.manage"])).toBe(true);
    expect(sellerHasPermission(catalogStaff, "finance.view")).toBe(false);
    expect(sellerHasPermission(catalogStaff, "rfqs.view")).toBe(false);
    expect(sellerHasAnyPermission(catalogStaff, ["orders.view", "orders.fulfill"])).toBe(false);
    expect(sellerNavigationAllows(catalogStaff.membership.permissions, ["finance.view"])).toBe(false);
  });

  it("keeps wildcard owner navigation available", () => {
    const owner = { user: { role: "SELLER_OWNER" }, membership: { permissions: ["*"] } };
    expect(sellerHasPermission(owner, "finance.view")).toBe(true);
    expect(sellerHasAnyPermission(owner, ["documents.view", "documents.manage"])).toBe(true);
  });

  it("lands browser-ready staff on their first granted workflow", () => {
    expect(sellerLandingRoute(["orders.view", "orders.fulfill"])).toBe("/orders");
    expect(sellerLandingRoute(["catalog.view", "catalog.manage"])).toBe("/products");
    expect(sellerLandingRoute([])).toContain("error=permissions");
  });
});
