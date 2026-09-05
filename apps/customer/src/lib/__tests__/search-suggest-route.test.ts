import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  productFindFirst: vi.fn(),
  productFindMany: vi.fn(),
  categoryFindMany: vi.fn(),
  brandFindMany: vi.fn(),
  checkRateLimit: vi.fn(),
}));

const PUBLIC = { deletedAt: null, status: "ACTIVE", isPubliclyDiscoverable: true, seller: { is: { deletedAt: null, status: "ACTIVE" } } };

vi.mock("@avenick/database", () => ({
  db: {
    product: { findFirst: mocks.productFindFirst, findMany: mocks.productFindMany },
    category: { findMany: mocks.categoryFindMany },
    brand: { findMany: mocks.brandFindMany },
  },
  publicProductWhere: () => PUBLIC,
  // The catalogue's classification, restated: three characters for free text,
  // any length for an identifier-shaped term. The rule itself is tested in the
  // database package; what this file tests is that the route obeys it.
  classifyCatalogSearch: (value?: string) => {
    const term = value?.trim().replace(/\s+/g, " ");
    if (!term) return { status: "none" };
    const isIdentifier = /^[A-Za-z0-9][A-Za-z0-9._/-]*$/.test(term);
    if (term.length >= 3) return { status: "ran", term, strategy: isIdentifier ? "identifier+text" : "text" };
    if (isIdentifier) return { status: "ran", term, strategy: "identifier" };
    return { status: "too_short", term, minLength: 3 };
  },
}));
vi.mock("@avenick/auth/rate-limit", () => ({ checkRateLimit: mocks.checkRateLimit, clientIpFrom: () => "test-ip" }));

import { GET } from "../../app/api/search/suggest/route";

const suggest = (query: string) => GET(new NextRequest(`https://customer.test/api/search/suggest?${query}`));

const row = (id: string, sku: string, nameEn: string) => ({
  id, slug: id, sku, nameEn, nameAr: `${nameEn} ar`,
  // A mock may hand back more than the route selected; none of it may leave.
  price: 999, inventory: [{ qty: 3, reservedQty: 1 }], commercialMetadata: { purchasePrice: 1, manufacturerPartNumber: "PRIVATE" },
});

beforeEach(() => {
  vi.clearAllMocks();
  mocks.checkRateLimit.mockResolvedValue({ ok: true, count: 1, limit: 180, resetAt: Date.now() + 60_000 });
  mocks.productFindFirst.mockResolvedValue(null);
  mocks.productFindMany.mockResolvedValue([]);
  mocks.categoryFindMany.mockResolvedValue([]);
  mocks.brandFindMany.mockResolvedValue([]);
});

describe("GET /api/search/suggest", () => {
  it("declines a term below the floor and queries nothing, saying which floor", async () => {
    // Two Arabic letters: below the trigram floor and not identifier-shaped.
    // (Any two Latin words are already three characters and run as text.)
    const refused = await (await suggest("q=%D9%85%D8%B3")).json();
    expect(refused.data).toEqual({ query: "مس", status: "too_short", minLength: 3, suggestions: [] });
    const single = await (await suggest("q=m")).json();
    expect(single.data).toEqual({ query: "m", status: "too_short", minLength: 2, suggestions: [] });
    const none = await (await suggest("q=")).json();
    expect(none.data.status).toBe("none");
    expect(mocks.productFindMany).not.toHaveBeenCalled();
    expect(mocks.categoryFindMany).not.toHaveBeenCalled();
    expect(mocks.brandFindMany).not.toHaveBeenCalled();
  });

  it("restricts every source to what the public may reach", async () => {
    mocks.productFindMany.mockResolvedValue([row("p1", "B-1", "Bosch Drill")]);
    mocks.categoryFindMany.mockResolvedValue([{ slug: "drills", nameEn: "Drills", nameAr: "مثاقب", parent: { nameEn: "Power Tools", nameAr: "" } }]);
    mocks.brandFindMany.mockResolvedValue([{ slug: "bosch", nameEn: "Bosch", nameAr: "بوش" }]);

    const response = await suggest("q=bosch");
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toMatch(/public/);

    expect(mocks.productFindMany.mock.calls[0]![0].where).toMatchObject(PUBLIC);
    expect(mocks.productFindMany.mock.calls[0]![0].select).toEqual({ id: true, slug: true, nameEn: true, nameAr: true, sku: true });
    expect(mocks.categoryFindMany.mock.calls[0]![0].where).toMatchObject({ isActive: true, products: { some: PUBLIC } });
    expect(mocks.brandFindMany.mock.calls[0]![0].where).toMatchObject({ isActive: true, products: { some: PUBLIC } });

    const body = await response.json();
    expect(body.data.status).toBe("ran");
    expect(body.data.suggestions.map((s: { kind: string }) => s.kind)).toEqual(["category", "brand", "product"]);
    expect(body.data.suggestions[0]).toMatchObject({ label: "Drills", href: "/products?category=drills", parent: { label: "Power Tools" } });
    expect(body.data.suggestions[1]).toMatchObject({ label: "Bosch", labelAr: "بوش", href: "/products?brand=bosch" });
    expect(body.data.suggestions[2]).toEqual({ kind: "product", label: "Bosch Drill", labelAr: "Bosch Drill ar", href: "/products/p1", sku: "B-1" });
    const serialized = JSON.stringify(body);
    for (const forbidden of ["price", "inventory", "reservedQty", "commercialMetadata", "purchasePrice", "PRIVATE"]) {
      expect(serialized).not.toContain(forbidden);
    }
  });

  it("reads an exact SKU on its own for an identifier-shaped term and ranks it first", async () => {
    mocks.productFindFirst.mockResolvedValue(row("exact", "1145A", "Zulu Socket"));
    mocks.productFindMany.mockResolvedValue([row("other", "1145A-KIT", "Alpha Kit"), row("exact", "1145A", "Zulu Socket")]);
    const body = await (await suggest("q=1145a")).json();
    expect(mocks.productFindFirst.mock.calls[0]![0].where).toMatchObject({ ...PUBLIC, sku: { in: ["1145a", "1145A"] } });
    expect(body.data.suggestions.map((s: { sku?: string }) => s.sku)).toEqual(["1145A", "1145A-KIT"]);
  });

  it("does not attempt an exact SKU read for a phrase", async () => {
    await suggest("q=power%20tools");
    expect(mocks.productFindFirst).not.toHaveBeenCalled();
    expect(JSON.stringify(mocks.productFindMany.mock.calls[0]![0].where)).not.toContain("startsWith");
  });

  it("honours the limit parameter and never returns more than eight", async () => {
    mocks.productFindMany.mockResolvedValue(Array.from({ length: 8 }, (_, i) => row(`p${i}`, `S-${i}`, `Item ${i}`)));
    mocks.categoryFindMany.mockResolvedValue([{ slug: "a", nameEn: "A", nameAr: "", parent: null }, { slug: "b", nameEn: "B", nameAr: "", parent: null }]);
    const limited = await (await suggest("q=item&limit=3")).json();
    expect(limited.data.suggestions).toHaveLength(3);
    expect(mocks.productFindMany.mock.calls[0]![0].take).toBe(3);
    const wide = await (await suggest("q=item&limit=40")).json();
    expect(wide.data.suggestions).toHaveLength(8);
  });

  it("throttles per client like every other public route", async () => {
    mocks.checkRateLimit.mockResolvedValue({ ok: false, count: 181, limit: 180, resetAt: Date.now() + 30_000 });
    const response = await suggest("q=bosch");
    expect(response.status).toBe(429);
    expect(Number(response.headers.get("retry-after"))).toBeGreaterThan(0);
    expect(mocks.productFindMany).not.toHaveBeenCalled();
  });
});
