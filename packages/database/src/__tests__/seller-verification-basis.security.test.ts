import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ findFirst: vi.fn(), aggregate: vi.fn() }));

vi.mock("../index", () => ({
  db: {
    product: { findFirst: mocks.findFirst },
    productReview: { aggregate: mocks.aggregate },
  },
}));

import { getProductBySlug } from "../services/products";

/**
 * A seller's "Verified" mark rests on a reviewed document, not on a stored tier.
 *
 * THE DEFECT. Every product page printed a brass VERIFIED mark on its supplier
 * card. Production's four sellers with active listings were all tier VERIFIED,
 * with zero APPROVED SellerDocument rows among them, because the only writer of
 * SellerTier.VERIFIED was the pilot catalogue importer — an upsert whose
 * `update` branch re-stamped it on every run, so no data fix could hold. LAW F:
 * a verification claim no review produced.
 *
 * What these hold, at the service: the detail read selects the seller's most
 * recently reviewed, APPROVED, unexpired document — type and date only — and
 * returns it as `verification` (or null), never as the raw relation; and the
 * importer no longer writes VERIFIED at all.
 */

beforeEach(() => {
  mocks.findFirst.mockReset();
  mocks.aggregate.mockReset();
  mocks.aggregate.mockResolvedValue({ _avg: { rating: null }, _count: { _all: 0 } });
});

const row = (documents: Array<{ type: string; reviewedAt: Date | null }>) => ({
  id: "p1",
  sellerId: "s1",
  slug: "p1",
  status: "ACTIVE",
  inventory: [],
  variants: [],
  prices: [],
  _count: { reviews: 0 },
  seller: { id: "s1", businessNameEn: "Seller", businessNameAr: null, tier: "VERIFIED", city: "Riyadh", country: "SA", documents },
});

describe("getProductBySlug seller verification basis", () => {
  it("selects only an approved, reviewed, unexpired document — its type and date, newest first", async () => {
    mocks.findFirst.mockResolvedValue(row([]));
    await getProductBySlug("p1");
    const documents = mocks.findFirst.mock.calls[0]![0].include.seller.select.documents;
    expect(documents.where.status).toBe("APPROVED");
    expect(documents.where.reviewedAt).toEqual({ not: null });
    expect(documents.where.OR).toHaveLength(2);
    expect(documents.where.OR[0]).toEqual({ expiryDate: null });
    expect(documents.where.OR[1].expiryDate.gt).toBeInstanceOf(Date);
    expect(documents.orderBy).toEqual({ reviewedAt: "desc" });
    expect(documents.take).toBe(1);
    expect(documents.select).toEqual({ type: true, reviewedAt: true });
  });

  it("returns the citation as `verification` and never the relation", async () => {
    const reviewedAt = new Date("2026-02-14T09:00:00.000Z");
    mocks.findFirst.mockResolvedValue(row([{ type: "TRADE_LICENSE", reviewedAt }]));
    const product = await getProductBySlug("p1");
    expect(product?.seller.verification).toEqual({ type: "TRADE_LICENSE", reviewedAt });
    expect(product?.seller).not.toHaveProperty("documents");
  });

  it("returns null when no approved document stands, whatever the stored tier says", async () => {
    mocks.findFirst.mockResolvedValue(row([]));
    const product = await getProductBySlug("p1");
    expect(product?.seller.tier).toBe("VERIFIED");
    expect(product?.seller.verification).toBeNull();
  });
});

describe("pilot catalogue importer", () => {
  it("does not stamp a seller VERIFIED on create or on re-import", () => {
    const here = dirname(fileURLToPath(import.meta.url));
    const source = readFileSync(resolve(here, "../services/pilot-catalog.ts"), "utf8");
    expect(source).not.toMatch(/SellerTier\.VERIFIED/);
    expect(source.match(/tier:\s*SellerTier\.STANDARD/g)).toHaveLength(2);
  });
});
