import { describe, expect, it } from "vitest";
import {
  assertProductImportPermissions,
  requiredProductImportPermissions,
  stockQuantityCoversReservations,
} from "../product-import-policy";

describe("seller product import field authorization", () => {
  it("keeps catalog-only imports inside the catalog capability", () => {
    expect(requiredProductImportPermissions([{ nameEn: "Updated", status: "ACTIVE" }]))
      .toEqual(["catalog.manage"]);
    expect(() => assertProductImportPermissions(["catalog.manage"], [{ nameEn: "Updated" }]))
      .not.toThrow();
  });

  it("requires independent pricing and inventory capabilities", () => {
    const row = { price: "12.50", stock: "8" };
    expect(requiredProductImportPermissions([row]))
      .toEqual(["catalog.manage", "pricing.manage", "inventory.manage"]);
    expect(() => assertProductImportPermissions(["catalog.manage"], [row]))
      .toThrow(/pricing\.manage.*inventory\.manage/);
    expect(() => assertProductImportPermissions(
      ["catalog.manage", "pricing.manage", "inventory.manage"],
      [row],
    )).not.toThrow();
  });

  it("never permits on-hand quantity below already reserved units", () => {
    expect(stockQuantityCoversReservations(7, 7)).toBe(true);
    expect(stockQuantityCoversReservations(6, 7)).toBe(false);
    expect(stockQuantityCoversReservations(-1, 0)).toBe(false);
  });
});
