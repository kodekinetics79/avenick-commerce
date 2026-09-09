import { describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ findMany: vi.fn() }));
vi.mock("@avenick/database", () => ({ db: { brand: { findMany: mocks.findMany } } }));

import { readPublicBrands } from "../public-brands";

/**
 * The live brands page listed nine brands, four of which read "0 listings":
 * EATON, Navigator, a second 3M and a Honeywell that never received products.
 * A third of the grid led to an empty shelf, which is the same promise the
 * catalogue strip already refuses to make about a category with nothing in it.
 */
describe("readPublicBrands", () => {
  it("asks only for brands that have a publicly visible product", async () => {
    mocks.findMany.mockResolvedValue([]);
    await readPublicBrands();

    const where = mocks.findMany.mock.calls[0]![0].where;
    expect(where.isActive).toBe(true);
    expect(where.products?.some, "a brand with nothing to sell is still listed").toBeTruthy();
  });

  /**
   * The subtle half: if the existence test and the count disagree, a brand can
   * be listed because it has an ACTIVE product while the count only sees
   * discoverable ones — a tile the query judged worth showing, advertising zero.
   */
  it("counts with the same predicate it filters by", async () => {
    mocks.findMany.mockResolvedValue([]);
    await readPublicBrands();

    const args = mocks.findMany.mock.calls[0]![0];
    expect(args.include.brand ?? args.include._count.select.products.where).toEqual(
      args.where.products.some,
    );
  });

  it("requires publicly discoverable, active and undeleted", async () => {
    mocks.findMany.mockResolvedValue([]);
    await readPublicBrands();

    const predicate = mocks.findMany.mock.calls[0]![0].where.products.some;
    expect(predicate).toMatchObject({ status: "ACTIVE", deletedAt: null, isPubliclyDiscoverable: true });
  });
});
